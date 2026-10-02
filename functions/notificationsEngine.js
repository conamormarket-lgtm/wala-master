const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { limaNow, limaTodayStr } = require("./economyLogic");
const { recordatoriosDeHoy } = require("./fechasLogic");

const db = admin.firestore();
const messaging = admin.messaging();
const PORTAL_USERS_COLLECTION = "portal_clientes_users";
const CAMPAIGNS_COLLECTION = "notification_campaigns";

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
function categoriaActiva(settings, categoria) {
  if (settings.categories && settings.categories[categoria] === false) return false;
  const horario = (settings.schedules && settings.schedules[categoria]) || {};
  const desde = aMinutos(horario.start, 9 * 60);
  const hasta = aMinutos(horario.end, 21 * 60);
  const ahora = minutosLima();
  return ahora >= desde && ahora < hasta;
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
      await userRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalid) });
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
    .replace(/\{monedas\}/g, String(vars.monedas || 0));
  return { text: texto, variante };
}

function mensajeFcm(tokens, { title, body, type, link, image }) {
  const notification = { title, body };
  if (image) notification.imageUrl = image;
  return {
    tokens,
    notification,
    data: { type: String(type || ""), link: String(link || "") },
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
    const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, payload));
    await removeInvalidTokens(userRef, tokens, response);
    if (response.successCount > 0) {
      await db.collection(`users/${uid}/notifications`).add(docInApp(payload));
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
        await ref.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens) }).catch(() => {});
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

async function procesarCampanasProgramadas() {
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

  try {
    await procesarCampanasProgramadas();
  } catch (e) {
    console.error("Error procesando campañas programadas:", e);
  }

  try {
    let settings = { categories: {}, copys: {}, schedules: {} };
    const settingsDoc = await db.collection("notification_settings").doc("global").get();
    if (settingsDoc.exists) settings = { ...settings, ...settingsDoc.data() };

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
exports.datesReminderEngine = onSchedule({
  schedule: "0 10 * * *",
  timeZone: "America/Lima",
}, async () => {
  const hoy = limaTodayStr();
  const anioMinimo = Number(hoy.slice(0, 4)) - 1;
  let avisos = 0;
  try {
    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION).get();
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (!Array.isArray(data.giftRecipients) || data.giftRecipients.length === 0) continue;
      const pendientes = recordatoriosDeHoy(data.giftRecipients, hoy, data.datesReminderLog);
      if (pendientes.length === 0) continue;

      const log = {};
      Object.keys(data.datesReminderLog || {}).forEach((k) => {
        if (Number(k.split("|")[1]) >= anioMinimo) log[k] = true;
      });

      const tokens = data.fcmTokens || [];
      for (const r of pendientes) {
        const payload = {
          title: r.titulo, body: r.cuerpo, type: "fecha_recordatorio", link: "/cuenta/fechas-importantes",
        };
        await db.collection(`users/${doc.id}/notifications`).add(docInApp(payload));
        if (tokens.length > 0) {
          try {
            const response = await messaging.sendEachForMulticast(mensajeFcm(tokens, payload));
            await removeInvalidTokens(doc.ref, tokens, response);
          } catch (e) {
            console.warn(`datesReminderEngine: push a ${doc.id} falló:`, e.message);
          }
        }
        log[r.key] = true;
        avisos++;
      }
      await doc.ref.update({ datesReminderLog: log });
    }
    console.log(`datesReminderEngine: ${avisos} recordatorios enviados (${hoy}).`);
  } catch (e) {
    console.error("Error in datesReminderEngine:", e);
  }
});

exports.sendManualPromoNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }

  // Solo admins pueden enviar push masivos (H-04). Admin = custom claim o, como
  // puente de bootstrap, doc adminUsers/{uid} con role 'admin'.
  const isCallerAdmin = context.auth.token?.admin === true
    || (await db.collection("adminUsers").doc(context.auth.uid).get()
      .then((s) => s.exists && s.data().role === "admin")
      .catch(() => false));
  if (!isCallerAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede enviar notificaciones.");
  }

  const campana = validarCampana(data);

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
