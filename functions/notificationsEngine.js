const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // admin.firestore.FieldValue puede venir undefined (emulador)
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { limaNow, limaTodayStr } = require("./economyLogic");
const { recordatoriosDeHoy, eventosValidos, diasHastaProxima } = require("./fechasLogic");
const { hitoDeEstadoErp, hitoDeEstadoWala, debeAvisar, textoHito } = require("./ordersLogic");
const { agruparInteres, elegirProducto } = require("./productViewLogic");
const { recomendarRegalos } = require("./giftLogic");
const {
  avisosFestivosDeHoy, festivasDesdeDoc, recordatorioPersonalDesdeDoc, proximaFecha, armarAvisoFestivo,
} = require("./fechasFestivasLogic");

const db = admin.firestore();
const messaging = admin.messaging();
const PORTAL_USERS_COLLECTION = "portal_clientes_users";
const CAMPAIGNS_COLLECTION = "notification_campaigns";
// Conteo de enviados/abiertos por tipo de aviso y variante (A/B), para saber
// qué texto funciona mejor. Lo escribe solo el servidor; el panel lo lee.
const STATS_COLLECTION = "notification_stats";
// Qué hitos de cada pedido ya se avisaron (para no repetir). Solo servidor.
const ORDER_LOG_COLLECTION = "order_notifications";

// ── Hora de Lima ──────────────────────────────────────────────────────────────
// Antes se usaba new Date().getHours(), que en Cloud Functions es la hora UTC:
// la ventana "9 a 21" en realidad era de 4 a 16 hora de Lima.
const minutosLima = () => {
  const d = limaNow();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const aMinutos = (hhmm, porDefecto) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : porDefecto;
};

// Respeta el interruptor y el horario que el admin fija por categoría en
// /admin/notificaciones (antes se guardaban pero el motor no los leía).
const HORARIO_POR_DEFECTO = {
  cart_abandoned: ["09:00", "21:00"],
  retention: ["09:00", "21:00"],
  promos: ["10:00", "20:00"],
  orders: ["08:00", "21:00"],
  product_views: ["11:00", "20:00"],
};
function categoriaEncendida(settings, categoria) {
  return !(settings.categories && settings.categories[categoria] === false);
}
function enHorario(settings, categoria) {
  const horario = (settings.schedules && settings.schedules[categoria]) || {};
  const [d, h] = HORARIO_POR_DEFECTO[categoria] || ["09:00", "21:00"];
  const desde = aMinutos(horario.start, aMinutos(d, 9 * 60));
  const hasta = aMinutos(horario.end, aMinutos(h, 21 * 60));
  const ahora = minutosLima();
  return ahora >= desde && ahora < hasta;
}
function categoriaActiva(settings, categoria) {
  return categoriaEncendida(settings, categoria) && enHorario(settings, categoria);
}

async function leerSettings() {
  const base = { categories: {}, copys: {}, schedules: {} };
  try {
    const snap = await db.collection("notification_settings").doc("global").get();
    return snap.exists ? { ...base, ...snap.data() } : base;
  } catch (e) {
    console.warn("leerSettings:", e.message);
    return base;
  }
}

// Suma al conteo A/B. Best-effort: si falla, el aviso igual salió.
async function contar(type, variante, campo, cantidad = 1) {
  try {
    await db.collection(STATS_COLLECTION).doc(String(type)).set({
      [variante === "b" ? "b" : "a"]: { [campo]: FieldValue.increment(cantidad) },
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn("contar:", e.message);
  }
}

// Limpia de fcmTokens los tokens que FCM reporta como inválidos/no registrados (H-10).
const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];
async function removeInvalidTokens(userRef, tokens, response) {
  try {
    if (!response || !Array.isArray(response.responses)) return;
    const invalid = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error && INVALID_TOKEN_CODES.includes(r.error.code)) {
        invalid.push(tokens[i]);
      }
    });
    if (invalid.length > 0) {
      await userRef.update({ fcmTokens: FieldValue.arrayRemove(...invalid) });
    }
  } catch (e) {
    console.warn("removeInvalidTokens error:", e.message);
  }
}

// Anti-spam global: máximo 2 automáticas por día (día de Lima), una por tipo.
const canSendPush = (userData, type) => {
  const log = userData.antiSpamLog || [];
  const today = limaTodayStr();
  const todaysPushes = log.filter((l) => l.date && limaTodayStr(Date.parse(l.date)) === today);
  if (todaysPushes.length >= 2) return false;
  if (todaysPushes.some((l) => l.type === type)) return false;
  return true;
};

// ── Textos editables desde el panel ──────────────────────────────────────────
// El panel guarda cada texto como { a: {text, emoji, cta}, b: {...}|null }, pero
// el motor lo usaba como string: en cuanto el admin guardaba, la push salía con
// un objeto como cuerpo. Acá se arma el texto final, se reparte la variante B
// (mitad de los usuarios, fija por uid) y se reemplazan {nombre} y {monedas}.
function hashUid(uid) {
  let h = 0;
  for (const ch of String(uid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
function copyDe(settings, key, uid, vars, fallback) {
  const c = settings.copys && settings.copys[key];
  let texto = null;
  let variante = null;
  if (typeof c === "string" && c.trim()) {
    texto = c.trim();
    variante = "a";
  } else if (c && typeof c === "object") {
    variante = c.b && c.b.text && hashUid(uid) % 2 === 1 ? "b" : "a";
    const v = c[variante];
    if (v && typeof v.text === "string" && v.text.trim()) {
      texto = [v.text, v.cta, v.emoji].map((x) => (x || "").trim()).filter(Boolean).join(" ");
    } else {
      variante = null;
    }
  }
  if (!texto) return { text: fallback, variante: null };
  texto = texto
    .replace(/\{nombre\}/g, vars.nombre || "")
    .replace(/\{monedas\}/g, String(vars.monedas || 0))
    .replace(/\{producto\}/g, vars.producto || "");
  return { text: texto, variante };
}

const SITIO = String(process.env.PUBLIC_SITE_URL || "https://www.wala.pe").replace(/\/+$/, "");

// Link absoluto para las notificaciones WEB: al tocarlas el navegador abre esta
// URL. Lleva ?notif=/&camp= para que la página registre la apertura al cargar.
function linkWeb(link, notifId, campaignId) {
  let url;
  try {
    url = new URL(link && /^https:\/\//.test(link) ? link : `${SITIO}${link && link.startsWith("/") ? link : "/"}`);
  } catch (e) {
    url = new URL(SITIO);
  }
  if (notifId) url.searchParams.set("notif", notifId);
  else if (campaignId) url.searchParams.set("camp", campaignId);
  return url.toString();
}

function mensajeFcm(tokens, { title, body, type, link, image, notifId, campaignId }) {
  const notification = { title, body };
  if (image) notification.imageUrl = image;
  // notifId / campaignId viajan en la push para que, al tocarla, la app pueda
  // marcarla como abierta (markNotificationOpenedSecure) y contar la apertura.
  return {
    tokens,
    notification,
    data: {
      type: String(type || ""),
      link: String(link || ""),
      notifId: String(notifId || ""),
      campaignId: String(campaignId || ""),
    },
    // Navegador (Chrome, Brave, Edge…): ícono de Walá y, al tocar, abre el link.
    webpush: {
      notification: { icon: "/logo192.png" },
      fcmOptions: { link: linkWeb(link, notifId, campaignId) },
    },
  };
}

function docInApp({ title, body, type, link, image, variante, campaignId }) {
  const out = { title, body, type, read: false, createdAt: new Date().toISOString() };
  if (link) out.link = link;
  if (image) out.image = image;
  if (variante) out.variante = variante;
  if (campaignId) out.campaignId = campaignId;
  return out;
}

// Push automática a un usuario (+ registro in-app y anti-spam si salió).
const sendPush = async (uid, tokens, payload, userRef, currentLog) => {
  if (!tokens || tokens.length === 0) return false;
  try {
    // El id del aviso in-app se reserva antes para mandarlo dentro de la push.
    const ref = db.collection(`users/${uid}/notifications`).doc();
    const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, { ...payload, notifId: ref.id }));
    await removeInvalidTokens(userRef, tokens, response);
    if (response.successCount > 0) {
      await ref.set(docInApp(payload));
      await contar(payload.type, payload.variante, "sent");
      const newLog = [...(currentLog || [])];
      newLog.push({ date: new Date().toISOString(), type: payload.type });
      await userRef.update({ antiSpamLog: newLog.slice(-20) });
      return true;
    }
  } catch (err) {
    console.warn(`Error sending push to ${uid}:`, err);
  }
  return false;
};

// ── Campañas (ofertas / novedades) ───────────────────────────────────────────
const SEGMENTOS = ["all", "vip", "inactive", "cart", "dates"];

function enSegmento(userData, segment, now) {
  if (segment === "vip") return (userData.monedas || 0) >= 50;
  if (segment === "inactive") {
    if (!userData.lastAppOpen) return false;
    return (now - new Date(userData.lastAppOpen)) / 86400000 >= 30;
  }
  if (segment === "cart") return !!(userData.cart && Array.isArray(userData.cart.items) && userData.cart.items.length > 0);
  if (segment === "dates") return Array.isArray(userData.giftRecipients) && userData.giftRecipients.length > 0;
  return true;
}

function validarCampana(data) {
  const title = String((data && data.title) || "").trim();
  const body = String((data && data.body) || "").trim();
  const segment = SEGMENTOS.includes(data && data.segment) ? data.segment : "all";
  const link = String((data && data.link) || "").trim();
  const image = String((data && data.image) || "").trim();
  if (!title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan título o cuerpo de mensaje.");
  }
  if (title.length > 80 || body.length > 300) {
    throw new functions.https.HttpsError("invalid-argument", "El título (80) o el mensaje (300) son demasiado largos.");
  }
  if (link && !/^\/[^/]/.test(link) && !/^https:\/\//.test(link)) {
    throw new functions.https.HttpsError("invalid-argument", "El link debe empezar con / (página de la tienda) o https://.");
  }
  if (image && !/^https:\/\//.test(image)) {
    throw new functions.https.HttpsError("invalid-argument", "La imagen debe ser una URL https://.");
  }
  return { title, body, segment, link, image };
}

// Envía la campaña: in-app a TODOS los del segmento (así la ven también quienes
// usan la web, donde hoy no hay push) y push a los que tienen la app.
async function enviarCampana(campaignId, campana) {
  const now = new Date();
  const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION).get();
  const payload = { ...campana, type: "manual_promo", campaignId };
  const destinos = []; // { token, ref }
  let inApp = 0;
  const pushUsers = new Set();

  let batch = db.batch();
  let enBatch = 0;
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    if (!enSegmento(userData, campana.segment, now)) continue;
    batch.set(db.collection(`users/${doc.id}/notifications`).doc(), docInApp(payload));
    inApp++;
    enBatch++;
    if (enBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
    (userData.fcmTokens || []).forEach((token) => destinos.push({ token, ref: doc.ref, uid: doc.id }));
  }
  if (enBatch > 0) await batch.commit();

  // FCM acepta hasta 500 tokens por envío.
  for (let i = 0; i < destinos.length; i += 500) {
    const grupo = destinos.slice(i, i + 500);
    try {
      const response = await messaging.sendEachForMulticast(mensajeFcm(grupo.map((d) => d.token), payload));
      const invalidosPorUsuario = new Map();
      response.responses.forEach((r, idx) => {
        const d = grupo[idx];
        if (r.success) pushUsers.add(d.uid);
        else if (r.error && INVALID_TOKEN_CODES.includes(r.error.code)) {
          if (!invalidosPorUsuario.has(d.uid)) invalidosPorUsuario.set(d.uid, { ref: d.ref, tokens: [] });
          invalidosPorUsuario.get(d.uid).tokens.push(d.token);
        }
      });
      for (const { ref, tokens } of invalidosPorUsuario.values()) {
        await ref.update({ fcmTokens: FieldValue.arrayRemove(...tokens) }).catch(() => {});
      }
    } catch (e) {
      console.warn("enviarCampana: error en un grupo de envío:", e.message);
    }
  }

  await db.collection(CAMPAIGNS_COLLECTION).doc(campaignId).set({
    status: "sent",
    sentAt: new Date().toISOString(),
    pushUsers: pushUsers.size,
    inAppUsers: inApp,
  }, { merge: true });

  return { pushUsers: pushUsers.size, inAppUsers: inApp };
}

async function procesarCampanasProgramadas(settings) {
  // PROMOS apagado o fuera de su horario: las programadas esperan (siguen en
  // cola y salen en la primera vuelta dentro del horario).
  if (!categoriaActiva(settings, "promos")) return;
  const snap = await db.collection(CAMPAIGNS_COLLECTION).where("status", "==", "scheduled").get();
  const ahora = new Date().toISOString();
  for (const doc of snap.docs) {
    const c = doc.data();
    if (!c.scheduledAt || c.scheduledAt > ahora) continue;
    // Se marca antes de enviar: si el envío se corta, no se repite a medias cada hora.
    await doc.ref.update({ status: "sending" });
    try {
      await enviarCampana(doc.id, {
        title: c.title, body: c.body, segment: c.segment, link: c.link || "", image: c.image || "",
      });
    } catch (e) {
      console.error(`Campaña programada ${doc.id} falló:`, e);
      await doc.ref.update({ status: "error", error: String(e.message || e) }).catch(() => {});
    }
  }
}

exports.notificationEngine = onSchedule({
  schedule: "0 * * * *", // Cada hora
  timeZone: "America/Lima",
}, async () => {
  console.log("Running notification engine...");
  const now = new Date();

  const settings = await leerSettings();

  try {
    await procesarCampanasProgramadas(settings);
  } catch (e) {
    console.error("Error procesando campañas programadas:", e);
  }

  try {
    await avisosProductoVisto(settings);
  } catch (e) {
    console.error("Error en avisos de producto visto:", e);
  }

  try {

    const carritoActivo = categoriaActiva(settings, "cart_abandoned");
    const retencionActiva = categoriaActiva(settings, "retention");
    if (!carritoActivo && !retencionActiva) {
      console.log("Notification engine: fuera de horario o categorías apagadas.");
      return;
    }

    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION).get();

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const uid = doc.id;
      const fcmTokens = data.fcmTokens || [];
      const userRef = doc.ref;
      if (fcmTokens.length === 0) continue; // No puede recibir push

      const vars = {
        nombre: data.displayName ? data.displayName.split(" ")[0] : "",
        monedas: data.monedas || 0,
      };

      // -- REGLA 1: Carrito Abandonado --
      if (carritoActivo && data.cart && data.cart.items && data.cart.items.length > 0 && data.cart.cartUpdatedAt) {
        const diffHours = (now - new Date(data.cart.cartUpdatedAt)) / (1000 * 60 * 60);
        const level = data.cart.abandonedLevel || 0;
        let sent = false;

        const enviarCarrito = async (type, nivel, fallback) => {
          if (!canSendPush(data, type)) return false;
          const { text, variante } = copyDe(settings, type, uid, vars, fallback);
          const ok = await sendPush(uid, fcmTokens, {
            title: "🛒 Tu Carrito", body: text, type, link: "/carrito", variante,
          }, userRef, data.antiSpamLog);
          if (ok) await userRef.update({ "cart.abandonedLevel": nivel });
          return ok;
        };

        if (diffHours >= 48 && level < 3) {
          sent = await enviarCarrito("cart_48h", 3, "Última oportunidad. Tu carrito se vacía mañana. ¿Lo completamos?");
        } else if (diffHours >= 24 && diffHours < 48 && level < 2) {
          sent = await enviarCarrito("cart_24h", 2, vars.monedas > 10
            ? `El box que elegiste sigue en tu carrito. Recuerda que tienes ${vars.monedas} monedas disponibles 💰`
            : "El box que elegiste sigue en tu carrito. ¿Terminamos de armarlo?");
        } else if (diffHours >= 1 && diffHours < 24 && level < 1) {
          sent = await enviarCarrito("cart_1h", 1, "Tu regalo te está esperando. ¿Terminamos? 📦");
        }

        if (sent) continue; // Una automática por usuario por corrida.
      }

      // -- REGLA 2: Retención Kapi --
      if (retencionActiva && data.lastAppOpen) {
        const diffDays = (now - new Date(data.lastAppOpen)) / (1000 * 60 * 60 * 24);
        const nombreKapi = vars.nombre || "Kapi";

        if (diffDays >= 14 && canSendPush(data, "retention_14d")) {
          const { text, variante } = copyDe(settings, "retention_14d", uid, vars, vars.monedas > 0
            ? `Tienes ${vars.monedas} monedas que se van a perder. Y Kapi está muy triste...`
            : "Kapi te extraña mucho. Lleva varios días sin verte 😢");
          await sendPush(uid, fcmTokens, {
            title: "Kapi te extraña", body: text, type: "retention_14d", link: "/cuenta", variante,
          }, userRef, data.antiSpamLog);
        } else if (diffDays >= 7 && diffDays < 14 && canSendPush(data, "retention_7d")) {
          const { text, variante } = copyDe(settings, "retention_7d", uid, vars,
            `Kapi extraña a ${nombreKapi}. Lleva ${Math.floor(diffDays)} días sin comer 😢`);
          await sendPush(uid, fcmTokens, {
            title: "Mascota Hambrienta", body: text, type: "retention_7d", link: "/cuenta", variante,
          }, userRef, data.antiSpamLog);
        }
      }
    }

    console.log("Notification engine finished.");
  } catch (error) {
    console.error("Error in notificationEngine:", error);
  }
});

// ── Recordatorios de fechas importantes ──────────────────────────────────────
// Todos los días a las 10:00 de Lima: 7 días y 1 día antes de cada fecha que el
// usuario guardó en "Fechas importantes" le llega un aviso (in-app siempre, push
// si tiene la app) con link a sus ideas de regalo. No cuenta para el tope
// anti-spam: es un aviso que el usuario pidió al cargar la fecha.
// Catálogo para el buscador de regalos (se carga una vez por corrida, solo si
// hay recordatorios que mandar). Ver functions/giftLogic.js.
async function cargarCatalogoRegalos() {
  const mapa = async (col) => Object.fromEntries((await db.collection(col).get()).docs.map((d) => [d.id, d.data().name || ""]));
  const [prods, tags, characters, collections, cfg] = await Promise.all([
    db.collection("productos_wala").get(),
    mapa("tags"), mapa("characters"), mapa("tienda_collections"),
    db.doc("tienda_encuesta_config/global").get(),
  ]);
  const conjuntoCategorias = {};
  const cats = (cfg.exists && cfg.data().brandsPanel && cfg.data().brandsPanel.categories) || [];
  cats.forEach((c) => { if (c && c.id && Array.isArray(c.tiendaCategorias)) conjuntoCategorias[c.id] = c.tiendaCategorias; });
  return {
    productos: prods.docs.map((d) => ({ id: d.id, ...d.data() })),
    dicts: { tags, characters, collections },
    conjuntoCategorias,
  };
}

// Agrega al aviso la foto y el nombre del mejor regalo para esa persona
// (buscador de regalos). Si no hay idea, el aviso sale igual, sin foto.
async function conIdeaDeRegalo(payload, r, catalogo) {
  if (!r.recipient) return payload;
  try {
    const [mejor] = recomendarRegalos({ recipient: r.recipient, ...catalogo, ocasion: r.ocasion, limite: 1 });
    if (!mejor) return payload;
    const p = mejor.producto;
    return {
      ...payload,
      image: (Array.isArray(p.images) && p.images[0]) || p.mainImage || "",
      body: `${r.cuerpo} Por ejemplo: ${p.name}.`,
    };
  } catch (e) {
    console.warn("aviso de fecha: sin sugerencia de regalo:", e.message);
    return payload;
  }
}

exports.datesReminderEngine = onSchedule({
  schedule: "0 10 * * *",
  timeZone: "America/Lima",
  // El aviso general de una fecha festiva puede llegar a todos los clientes
  // (miles): escrituras en lote y hasta 9 minutos.
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  const hoy = limaTodayStr();
  const anioMinimo = Number(hoy.slice(0, 4)) - 1;
  let avisos = 0;
  let catalogo = null;
  const enviados = {};
  // Avisos in-app y logs en lote: con miles de avisos generales, uno por uno
  // no termina a tiempo.
  const lote = db.bulkWriter();
  lote.onWriteError((err) => {
    console.warn("datesReminderEngine: escritura falló:", err.message);
    return err.failedAttempts < 3;
  });
  try {
    // Calendario de fechas festivas (Día de la Madre, Navidad…), editable en
    // /admin/fechas-importantes. Sin documento, las de Perú por defecto.
    const festivasDoc = await db.doc("storeConfig/fechasFestivas").get();
    const festivas = festivasDesdeDoc(festivasDoc.exists ? festivasDoc.data() : null);
    // Días de aviso de los cumpleaños/aniversarios de cada persona (mismo doc).
    const diasPersonales = recordatorioPersonalDesdeDoc(festivasDoc.exists ? festivasDoc.data() : null);

    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION).get();
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const personas = Array.isArray(data.giftRecipients) ? data.giftRecipients : [];
      // Fechas de sus personas (cumpleaños, aniversarios…) + fechas festivas:
      // con su persona si le toca a alguien que anotó; si no, aviso general
      // solo en las fechas marcadas "avisar a todos".
      const pendientes = [
        ...recordatoriosDeHoy(personas, hoy, data.datesReminderLog, diasPersonales).map((r) => ({
          ...r,
          tipo: "fecha_recordatorio",
          ocasion: r.event.type === "Fecha Especial" ? r.event.customName : r.event.type,
        })),
        ...avisosFestivosDeHoy(festivas, personas, hoy, data.datesReminderLog).map((a) => ({
          ...a,
          tipo: "fecha_festiva",
          recipient: a.personas[0] || null,
          ocasion: a.festiva.nombre,
        })),
      ];
      if (pendientes.length === 0) continue;

      // Se conservan solo los avisos de este año y el anterior. Las claves son
      // "<evento>|<año>|<días>" y las festivas "fest|<id>|<año>|<días>".
      const log = {};
      Object.keys(data.datesReminderLog || {}).forEach((k) => {
        const partes = k.split("|");
        const anio = Number(partes[0] === "fest" ? partes[2] : partes[1]);
        if (anio >= anioMinimo) log[k] = true;
      });

      const tokens = data.fcmTokens || [];
      for (const r of pendientes) {
        if (r.recipient && !catalogo) catalogo = await cargarCatalogoRegalos();
        const payload = await conIdeaDeRegalo({
          title: r.titulo, body: r.cuerpo, type: r.tipo, link: "/cuenta/fechas-importantes",
        }, r, catalogo);
        const ref = db.collection(`users/${doc.id}/notifications`).doc();
        lote.create(ref, docInApp(payload));
        enviados[r.tipo] = (enviados[r.tipo] || 0) + 1;
        // El aviso general es casi publicidad: su push respeta el tope
        // anti-spam diario. Los de sus personas (los pidió él) salen siempre.
        const pushPermitido = r.tipo !== "fecha_festiva" || r.personal || canSendPush(data, r.tipo);
        if (tokens.length > 0 && pushPermitido) {
          try {
            const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, { ...payload, notifId: ref.id }));
            await removeInvalidTokens(doc.ref, tokens, response);
          } catch (e) {
            console.warn(`datesReminderEngine: push a ${doc.id} falló:`, e.message);
          }
        }
        log[r.key] = true;
        avisos++;
      }
      lote.update(doc.ref, { datesReminderLog: log });
    }
    await lote.close();
    await Promise.all(Object.entries(enviados).map(([tipo, n]) => contar(tipo, "a", "sent", n)));
    console.log(`datesReminderEngine: ${avisos} avisos enviados (${hoy}).`, enviados);
  } catch (e) {
    console.error("Error in datesReminderEngine:", e);
    await lote.close().catch(() => {});
  }
});

// ── Probar un aviso de fechas desde el admin ─────────────────────────────────
// Arma el MISMO aviso que mandaría datesReminderEngine (texto, idea de regalo y
// foto) y se lo manda SOLO al admin que lo pide: campanita + push si tiene la
// app. Usa las personas que ese admin anotó en "Fechas importantes" con su
// propia cuenta. Hace de cuenta que hoy es día de aviso. No toca el log de
// avisos ni las estadísticas.
//   data.festivaId: id de una fecha festiva ("dia_madre"); sin él, la fecha más
//   cercana de sus personas (cumpleaños, aniversario…).
exports.probarAvisoFechas = functions.https.onCall(async (data, context) => {
  await exigirAdmin(context);
  const uid = context.auth.uid;
  const hoy = limaTodayStr();
  const [userSnap, festivasDoc] = await Promise.all([
    db.collection(PORTAL_USERS_COLLECTION).doc(uid).get(),
    db.doc("storeConfig/fechasFestivas").get(),
  ]);
  const usuario = userSnap.exists ? userSnap.data() : {};
  const personas = Array.isArray(usuario.giftRecipients) ? usuario.giftRecipients : [];

  let aviso = null;
  if (data && data.festivaId) {
    const festivas = festivasDesdeDoc(festivasDoc.exists ? festivasDoc.data() : null);
    const f = festivas.find((x) => x.id === String(data.festivaId));
    if (!f) throw new functions.https.HttpsError("not-found", "Esa fecha festiva no existe.");
    // Se arma como el PRIMER aviso que recibirán los clientes ("Navidad en 21
    // días"), no con los días que faltan hoy (que pueden ser 200).
    const prox = proximaFecha(f.regla, hoy);
    const dias = f.avisarDias.length ? f.avisarDias[0] : prox.dias;
    const a = armarAvisoFestivo(f, personas, prox.fecha, dias);
    aviso = { ...a, tipo: "fecha_festiva", recipient: a.personas[0] || null, ocasion: f.nombre };
  } else {
    let cercana = null;
    for (const { event } of eventosValidos(personas)) {
      const dias = diasHastaProxima(event.date, hoy);
      if (dias != null && (!cercana || dias < cercana.dias)) cercana = { dias, event };
    }
    if (!cercana) {
      throw new functions.https.HttpsError("failed-precondition",
        "Con tu cuenta, agrega una persona con su fecha en Mi cuenta → Fechas importantes y vuelve a probar.");
    }
    const r = recordatoriosDeHoy(personas, hoy, {}, [cercana.dias]).find((x) => x.event.id === cercana.event.id);
    if (r) {
      aviso = {
        ...r,
        tipo: "fecha_recordatorio",
        ocasion: r.event.type === "Fecha Especial" ? r.event.customName : r.event.type,
      };
    }
  }
  if (!aviso) throw new functions.https.HttpsError("internal", "No se pudo armar el aviso.");

  const catalogo = aviso.recipient ? await cargarCatalogoRegalos() : null;
  const payload = await conIdeaDeRegalo({
    title: `🧪 Prueba · ${aviso.titulo}`, body: aviso.cuerpo, type: aviso.tipo, link: "/cuenta/fechas-importantes",
  }, aviso, catalogo);
  const ref = db.collection(`users/${uid}/notifications`).doc();
  await ref.set({ ...docInApp(payload), prueba: true });
  const tokens = usuario.fcmTokens || [];
  let push = 0;
  if (tokens.length > 0) {
    try {
      const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, { ...payload, notifId: ref.id }));
      await removeInvalidTokens(userSnap.ref, tokens, response);
      push = response.successCount;
    } catch (e) {
      console.warn("probarAvisoFechas: push falló:", e.message);
    }
  }
  return { titulo: payload.title, cuerpo: payload.body, image: payload.image || "", push, tieneApp: tokens.length > 0 };
});

// Admin = custom claim o, como puente de bootstrap, doc adminUsers/{uid} con
// role 'admin' (H-04).
async function exigirAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  const esAdmin = context.auth.token?.admin === true
    || (await db.collection("adminUsers").doc(context.auth.uid).get()
      .then((s) => s.exists && s.data().role === "admin")
      .catch(() => false));
  if (!esAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede enviar notificaciones.");
  }
}

// Prueba: la campaña llega SOLO al admin que la pide (campanita + push si tiene
// la app). No crea campaña ni suma a las estadísticas.
async function enviarPrueba(uid, campana) {
  const payload = { ...campana, type: "manual_promo" };
  const ref = db.collection(`users/${uid}/notifications`).doc();
  await ref.set({ ...docInApp(payload), prueba: true });
  const snap = await db.collection(PORTAL_USERS_COLLECTION).doc(uid).get();
  const tokens = (snap.exists && snap.data().fcmTokens) || [];
  let push = 0;
  if (tokens.length > 0) {
    try {
      const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, { ...payload, notifId: ref.id }));
      await removeInvalidTokens(snap.ref, tokens, response);
      push = response.successCount;
    } catch (e) {
      console.warn("enviarPrueba: push falló:", e.message);
    }
  }
  return { push, tieneApp: tokens.length > 0 };
}

exports.sendManualPromoNotification = functions.https.onCall(async (data, context) => {
  await exigirAdmin(context);

  const campana = validarCampana(data);

  if (data && data.prueba === true) {
    const r = await enviarPrueba(context.auth.uid, campana);
    return { success: true, test: true, ...r };
  }

  // PROMOS apagado o fuera de horario: "Enviar ahora" pide confirmación en el
  // panel (forzar). Las programadas se aceptan y esperan al horario.
  const quiereProgramar = !!(data && data.scheduledAt && Date.parse(data.scheduledAt) > Date.now() + 5 * 60 * 1000);
  if (!quiereProgramar && !(data && data.forzar === true)) {
    const settings = await leerSettings();
    if (!categoriaEncendida(settings, "promos")) {
      throw new functions.https.HttpsError("failed-precondition", "PROMOS está apagado en Configuración.", { motivo: "promos_apagado" });
    }
    if (!enHorario(settings, "promos")) {
      throw new functions.https.HttpsError("failed-precondition", "Estás fuera del horario de PROMOS.", { motivo: "promos_fuera_horario" });
    }
  }

  // Programada: queda en cola y la manda el motor horario cuando llegue la hora.
  let scheduledAt = null;
  if (data && data.scheduledAt) {
    const t = Date.parse(data.scheduledAt);
    if (Number.isNaN(t)) {
      throw new functions.https.HttpsError("invalid-argument", "Fecha de programación inválida.");
    }
    if (t > Date.now() + 5 * 60 * 1000) scheduledAt = new Date(t).toISOString();
  }

  const ref = db.collection(CAMPAIGNS_COLLECTION).doc();
  await ref.set({
    ...campana,
    status: scheduledAt ? "scheduled" : "sending",
    scheduledAt,
    createdAt: new Date().toISOString(),
    createdBy: context.auth.uid,
  });

  if (scheduledAt) return { success: true, scheduled: true, scheduledAt, campaignId: ref.id };

  try {
    const { pushUsers, inAppUsers } = await enviarCampana(ref.id, campana);
    return { success: true, count: pushUsers, inApp: inAppUsers, campaignId: ref.id };
  } catch (error) {
    console.error(error);
    await ref.update({ status: "error", error: String(error.message || error) }).catch(() => {});
    throw new functions.https.HttpsError("internal", "Error al enviar la promo");
  }
});

// ── Apertura de avisos (para medir A/B y campañas) ───────────────────────────
// El cliente la llama al tocar un aviso en la campanita o una push. Marca el
// aviso como abierto UNA vez y suma al conteo de su tipo/variante y, si es de
// una campaña, a la campaña. "Marcar todas como leídas" NO cuenta como abrir.
exports.markNotificationOpenedSecure = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  const uid = context.auth.uid;
  const notifId = String((data && data.notifId) || "");
  const campaignId = String((data && data.campaignId) || "");
  const col = db.collection(`users/${uid}/notifications`);
  const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

  let ref = null;
  if (notifId && ID_VALIDO.test(notifId)) {
    ref = col.doc(notifId);
  } else if (campaignId && ID_VALIDO.test(campaignId)) {
    const snap = await col.where("campaignId", "==", campaignId).limit(1).get();
    if (!snap.empty) ref = snap.docs[0].ref;
  }
  if (!ref) return { ok: false };

  const abierto = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return null;
    const n = snap.data();
    if (n.openedAt) return null;
    t.update(ref, { openedAt: new Date().toISOString(), read: true });
    return n;
  });
  if (!abierto) return { ok: true, yaContado: true };

  await contar(abierto.type || "otro", abierto.variante, "opened");
  if (abierto.campaignId) {
    await db.collection(CAMPAIGNS_COLLECTION).doc(String(abierto.campaignId))
      .update({ opened: FieldValue.increment(1) })
      .catch(() => {});
  }
  return { ok: true };
});

// ── Avisos de pedido (categoría ORDERS) ──────────────────────────────────────
// Dos fuentes: wala_pedidos (pago confirmado, estado propio de Wala) y pedidos
// del ERP (producción, reparto, entregado). Una sola vez por hito y pedido,
// aunque el pedido aparezca en las dos colecciones (la clave es numeroPedido).
async function uidDePedido(p) {
  if (p.buyerUid) return String(p.buyerUid);
  const dni = String(p.dni || p.clienteNumeroDocumento || "").trim();
  if (!dni) return null;
  const snap = await db.collection(PORTAL_USERS_COLLECTION).where("dni", "==", dni).limit(2).get();
  // Si dos cuentas comparten DNI no se adivina a quién avisar.
  return snap.size === 1 ? snap.docs[0].id : null;
}

function claveDePedido(p, docId) {
  return String(p.numeroPedido || docId).trim().replace(/[/\\#?[\].]/g, "-").replace(/\s+/g, "-");
}

async function avisarHitoPedido(pedido, docId, hito) {
  const settings = await leerSettings();
  if (!categoriaEncendida(settings, "orders")) return;

  const uid = await uidDePedido(pedido);
  if (!uid) return;

  const logRef = db.collection(ORDER_LOG_COLLECTION).doc(claveDePedido(pedido, docId));
  const avisar = await db.runTransaction(async (t) => {
    const snap = await t.get(logRef);
    const hitos = snap.exists ? (snap.data().hitos || []) : [];
    if (!debeAvisar(hito, hitos)) return false;
    t.set(logRef, { uid, hitos: [...hitos, hito], updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  });
  if (!avisar) return;

  const texto = textoHito(hito, pedido.numeroPedido);
  if (!texto) return;
  const payload = { ...texto, type: "orders", link: "/cuenta/pedidos" };

  // En la campanita siempre; push solo dentro del horario de ORDERS (para no
  // despertar a nadie a las 3 a. m. si el ERP mueve pedidos de noche).
  const ref = db.collection(`users/${uid}/notifications`).doc();
  await ref.set(docInApp(payload));
  await contar("orders", "a", "sent");

  if (!enHorario(settings, "orders")) return;
  const userSnap = await db.collection(PORTAL_USERS_COLLECTION).doc(uid).get();
  const tokens = (userSnap.exists && userSnap.data().fcmTokens) || [];
  if (tokens.length === 0) return;
  try {
    const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, { ...payload, notifId: ref.id }));
    await removeInvalidTokens(userSnap.ref, tokens, response);
  } catch (e) {
    console.warn(`avisarHitoPedido: push a ${uid} falló:`, e.message);
  }
}

exports.notifyOrderMilestoneErp = functions.firestore
  .document("pedidos/{pedidoId}")
  .onUpdate(async (change, context) => {
    const antes = hitoDeEstadoErp((change.before.data() || {}).estadoGeneral);
    const despues = hitoDeEstadoErp((change.after.data() || {}).estadoGeneral);
    if (!despues || despues === antes) return null;
    try {
      await avisarHitoPedido(change.after.data(), context.params.pedidoId, despues);
    } catch (e) {
      console.error("notifyOrderMilestoneErp:", e);
    }
    return null;
  });

exports.notifyOrderMilestoneWala = functions.firestore
  .document("wala_pedidos/{id}")
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const antes = change.before.exists ? hitoDeEstadoWala(change.before.data().estadoWala) : null;
    const despues = hitoDeEstadoWala(change.after.data().estadoWala);
    if (!despues || despues === antes) return null;
    try {
      await avisarHitoPedido(change.after.data(), context.params.id, despues);
    } catch (e) {
      console.error("notifyOrderMilestoneWala:", e);
    }
    return null;
  });

// Cancela una campaña programada que todavía no salió.
exports.cancelPromoCampaign = functions.https.onCall(async (data, context) => {
  await exigirAdmin(context);
  const id = String((data && data.campaignId) || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new functions.https.HttpsError("invalid-argument", "Campaña inválida.");
  }
  const ref = db.collection(CAMPAIGNS_COLLECTION).doc(id);
  const ok = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists || snap.data().status !== "scheduled") return false;
    t.update(ref, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: context.auth.uid });
    return true;
  });
  if (!ok) {
    throw new functions.https.HttpsError("failed-precondition", "Esa campaña ya no está programada.");
  }
  return { success: true };
});

// ── Aviso "Producto que estuvo mirando" (categoría product_views) ────────────
// Una vez al día, en la primera vuelta del motor dentro del horario de la
// categoría: a quien miró un producto 3+ veces (o 2+ min) en la última semana,
// ya no lo está mirando (12 h+) y no lo compró, le llega un recordatorio con
// ese producto. Uno por cliente por día; el mismo producto no se repite en 14
// días. Reemplaza la notificación que antes armaba el navegador del cliente
// (src/hooks/useProductTracking.js) mientras todavía miraba el producto.
const PV_STATE_DOC = "notification_state/product_views";
const PV_LOG_COLLECTION = "product_view_notifications";
const PV_TITULO = "👀 Lo que estuviste viendo";
const PV_TEXTO_POR_DEFECTO = "¿Te quedaste pensando en {producto}? Sigue disponible 👀";

async function productosComprados(uid) {
  const comprados = new Set();
  try {
    const snap = await db.collection("wala_pedidos").where("buyerUid", "==", uid).get();
    snap.forEach((d) => {
      const prods = d.data().productos;
      const lineas = Array.isArray(prods) ? prods : Object.values(prods || {});
      lineas.forEach((l) => { if (l && l.productoId) comprados.add(String(l.productoId)); });
    });
  } catch (e) {
    console.warn("productosComprados:", e.message);
  }
  return comprados;
}

async function avisosProductoVisto(settings, { forzar = false } = {}) {
  if (!forzar && !categoriaActiva(settings, "product_views")) return { omitido: "fuera_de_horario" };

  // Una sola corrida por día (Lima): se marca antes para no duplicar si dos
  // vueltas del motor se pisan.
  const hoy = limaTodayStr();
  const stateRef = db.doc(PV_STATE_DOC);
  const yaCorrio = await db.runTransaction(async (t) => {
    const snap = await t.get(stateRef);
    if (!forzar && snap.exists && snap.data().lastRunDate === hoy) return true;
    t.set(stateRef, { lastRunDate: hoy, startedAt: new Date().toISOString() }, { merge: true });
    return false;
  });
  if (yaCorrio) return { omitido: "ya_corrio_hoy" };

  const now = Date.now();
  const snap = await db.collection("analytics_events")
    .where("type", "==", "route_dwell")
    .where("clientTsMs", ">=", now - 7 * 86400 * 1000)
    .select("uid", "path", "dwellMs", "clientTsMs")
    .limit(20000)
    .get();
  const porUsuario = agruparInteres(snap.docs.map((d) => d.data()));

  let enviados = 0;
  for (const [uid, lista] of porUsuario) {
    const logRef = db.collection(PV_LOG_COLLECTION).doc(uid);
    const logSnap = await logRef.get();
    const log = logSnap.exists ? logSnap.data() : {};
    // Se consulta lo comprado solo si hay un candidato posible.
    if (!elegirProducto(lista, log, new Set(), now)) continue;
    const elegido = elegirProducto(lista, log, await productosComprados(uid), now);
    if (!elegido) continue;

    const prodSnap = await db.collection("productos_wala").doc(elegido.productId).get();
    if (!prodSnap.exists) continue;
    const prod = prodSnap.data();
    if (prod.visible === false || prod.deleted) continue;

    const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) continue;
    const user = userSnap.data();

    const vars = {
      nombre: user.displayName ? user.displayName.split(" ")[0] : "",
      monedas: user.monedas || 0,
      producto: prod.name || "el producto que viste",
    };
    const { text, variante } = copyDe(settings, "product_view", uid, vars, PV_TEXTO_POR_DEFECTO.replace("{producto}", vars.producto));
    const payload = {
      title: PV_TITULO,
      body: text,
      type: "product_view",
      link: `/producto/${elegido.productId}`,
      image: (Array.isArray(prod.images) && prod.images[0]) || prod.mainImage || "",
      variante,
    };

    // Campanita siempre (también web); push si tiene la app y no pasó el tope diario.
    const ref = db.collection(`users/${uid}/notifications`).doc();
    await ref.set(docInApp(payload));
    await contar("product_view", variante, "sent");
    const tokens = user.fcmTokens || [];
    if (tokens.length > 0 && canSendPush(user, "product_view")) {
      try {
        const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, { ...payload, notifId: ref.id }));
        await removeInvalidTokens(userRef, tokens, response);
        if (response.successCount > 0) {
          const nuevoLog = [...(user.antiSpamLog || []), { date: new Date().toISOString(), type: "product_view" }];
          await userRef.update({ antiSpamLog: nuevoLog.slice(-20) });
        }
      } catch (e) {
        console.warn(`avisosProductoVisto: push a ${uid} falló:`, e.message);
      }
    }
    await logRef.set({ [elegido.productId]: new Date().toISOString() }, { merge: true });
    enviados++;
  }

  await stateRef.set({ finishedAt: new Date().toISOString(), enviados }, { merge: true });
  console.log(`avisosProductoVisto: ${enviados} avisos (${hoy}).`);
  return { enviados };
}
exports._avisosProductoVisto = avisosProductoVisto; // para pruebas en el emulador
