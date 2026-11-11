"use strict";

/**
 * Promo "Tu primera compra puede salir gratis" (saldo de bienvenida), lado
 * servidor. Las cuentas puras están en ./primeraCompraLogic.js.
 *
 * Dónde vive cada cosa (todo SOLO servidor: portal_clientes_users y
 * loyaltyConfig están en esSoloWala() y sus subcolecciones no tienen regla
 * para el navegador, así que no hace falta desplegar reglas):
 *  - loyaltyConfig/primeraCompra: la config (interruptor, montos, % y margen por
 *    marca, costos de Lumi). La edita el admin con primeraCompraConfigSecure.
 *  - portal_clientes_users/{uid}/primeraCompra/estado: la fase de cada cuenta
 *    { estado: activa|usada|no_aplica, inicioAt, venceAt, reserva, usado… }.
 *  - portal_clientes_users/{uid}/primeraCompraPremios/{uid del amigo}: un premio
 *    por amigo { estado: pendiente|disponible|no_elegible|revertido|vencido }.
 *    El saldo disponible es la suma de los "disponible".
 *
 * index.js lo usa en prepareCheckoutPayment (saldo y bloqueo de monedas y
 * cupones), al crear el pedido (cierre de la fase y premio de quien invitó), en
 * los canjes de monedas/cupones y en el reinicio de monedas de fin de mes.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const L = require("./primeraCompraLogic");
const { estadoPedidoReferido, primerNombre, normDocumento, variantesTelefono } = require("./referidosLogic");
const { calcularSaldoTotal, parseMontoRobust } = require("./erpCobranzaLogic");

const USERS = "portal_clientes_users";
const HttpsError = functions.https.HttpsError;

const MSG_PAUSA_MONEDAS = "Tus monedas están en pausa durante tu semana de bienvenida. Se liberan cuando hagas tu primera compra o termine tu plazo.";
const MSG_PAUSA_CUPONES = "Tus cupones están en pausa durante tu semana de bienvenida. Se liberan cuando hagas tu primera compra o termine tu plazo.";

module.exports = function crearPrimeraCompra({
  db, getErpDb, callerIsAdmin, duenoDeCodigo, buscarPedidoPorCodigoWeb, walaOrdersCollection = "wala_pedidos",
}) {
  const configRef = db.collection("loyaltyConfig").doc("primeraCompra");
  const estadoRef = (uid) => db.collection(USERS).doc(String(uid)).collection("primeraCompra").doc("estado");
  const premiosCol = (uid) => db.collection(USERS).doc(String(uid)).collection("primeraCompraPremios");

  // ── Config ────────────────────────────────────────────────────────────────
  let cache = null;
  let cacheTs = 0;
  async function leerConfig({ fresca = false } = {}) {
    if (!fresca && cache && Date.now() - cacheTs < 60 * 1000) return cache;
    const snap = await configRef.get();
    cache = L.normalizarConfig(snap.exists ? snap.data() : {});
    cacheTs = Date.now();
    return cache;
  }

  // ── Leer la fase de una cuenta ────────────────────────────────────────────
  async function leerFase(uid, t = null) {
    const leer = (r) => (t ? t.get(r) : r.get());
    const [estadoSnap, premiosSnap] = await Promise.all([
      leer(estadoRef(uid)),
      leer(premiosCol(uid)),
    ]);
    const estado = estadoSnap.exists ? estadoSnap.data() || {} : null;
    const premios = premiosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { estado, premios, ...L.saldoDesdePremios(premios) };
  }

  /** ¿Las monedas y cupones de esta cuenta están en pausa ahora? */
  async function enPausa(uid, t = null) {
    if (!uid) return false;
    const snap = await (t ? t.get(estadoRef(uid)) : estadoRef(uid).get());
    return snap.exists && L.faseActiva(snap.data(), Date.now());
  }

  async function exigirSinPausa(uid, { cupones = false } = {}) {
    if (await enPausa(uid)) throw new HttpsError("failed-precondition", cupones ? MSG_PAUSA_CUPONES : MSG_PAUSA_MONEDAS);
  }

  // ── Empezar la fase ───────────────────────────────────────────────────────
  // ¿Esta cuenta ya compró antes (en la web, por WhatsApp, en un live)? Por su
  // uid, y por su DNI o teléfono si los tiene. Ante la duda (ERP caído) lanza:
  // no se decide nada y se vuelve a intentar en la próxima visita.
  async function yaCompro(uid, perfil) {
    if (Array.isArray(perfil.pedidosVinculados) && perfil.pedidosVinculados.length) return true;
    const erpDb = getErpDb();
    if (!erpDb) throw new Error("ERP no disponible");
    const consultas = [];
    for (const coll of ["pedidos", "pedidos_web", walaOrdersCollection]) {
      consultas.push(erpDb.collection(coll).where("userId", "==", uid).limit(1).get());
      consultas.push(erpDb.collection(coll).where("buyerUid", "==", uid).limit(1).get());
    }
    const dni = normDocumento(perfil.dni);
    const dnis = [...new Set([dni, String(perfil.dni || "").trim()].filter(Boolean))];
    const telefonos = variantesTelefono(perfil.phone);
    for (const coll of ["pedidos", "pedidos_web", walaOrdersCollection]) {
      if (dnis.length) {
        consultas.push(erpDb.collection(coll).where("dni", "in", dnis.slice(0, 10)).limit(1).get());
        consultas.push(erpDb.collection(coll).where("clienteNumeroDocumento", "in", dnis.slice(0, 10)).limit(1).get());
      }
      if (telefonos.length) consultas.push(erpDb.collection(coll).where("clienteContacto", "in", telefonos.slice(0, 10)).limit(1).get());
    }
    const resultados = await Promise.all(consultas);
    return resultados.some((q) => !q.empty);
  }

  async function asegurarFase(uid, token) {
    const ref = estadoRef(uid);
    const actual = await ref.get();
    if (actual.exists) return actual.data();
    const config = await leerConfig();
    if (!config.activa) return null;
    const anonima = token && token.firebase && token.firebase.sign_in_provider === "anonymous";
    const usuario = await admin.auth().getUser(uid);
    const creadaMs = Date.parse(usuario.metadata.creationTime) || 0;
    const perfilSnap = await db.collection(USERS).doc(uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() || {} : {};
    const previo = L.puedeIniciarFase({ config, creadaMs, anonima, origen: perfil.accountOrigin || "" });
    // La promo apagada o una sesión anónima no deciden nada para siempre.
    if (!previo.puede && ["promo_apagada", "anonima"].includes(previo.motivo)) return null;
    let decision = previo;
    if (previo.puede) {
      let compro;
      try {
        compro = await yaCompro(uid, perfil);
      } catch (e) {
        console.warn(`primeraCompra.asegurarFase(${uid}): no se pudo revisar el ERP:`, e.message);
        return null;
      }
      decision = L.puedeIniciarFase({ config, creadaMs, origen: perfil.accountOrigin || "", tieneCompras: compro });
    }
    const ahora = Date.now();
    const datos = decision.puede
      ? {
        estado: "activa",
        inicioAt: Timestamp.fromMillis(ahora),
        venceAt: Timestamp.fromMillis(L.venceDesde(ahora, config)),
        creadaAt: FieldValue.serverTimestamp(),
      }
      : { estado: "no_aplica", motivo: decision.motivo, creadaAt: FieldValue.serverTimestamp() };
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (!s.exists) t.set(ref, datos);
    });
    const final = await ref.get();
    return final.data();
  }

  // ── Lo que ve el cliente ──────────────────────────────────────────────────
  function vistaPremio(p) {
    return {
      id: p.id,
      nombre: p.compradorNombre || "Tu amigo",
      estado: p.estado,
      monto: Number(p.monto) || 0,
      motivo: p.motivo ? L.textoMotivo(p.motivo) : "",
      fecha: p.createdAt && p.createdAt.toMillis ? p.createdAt.toMillis() : null,
    };
  }

  async function resumen(uid) {
    const config = await leerConfig();
    const { estado, premios, disponible, pendiente } = await leerFase(uid);
    const ahora = Date.now();
    const activa = L.faseActiva(estado, ahora);
    return {
      promo: {
        activa: config.activa, premio: config.premio, minimoNeto: config.minimoNeto, horas: config.horas,
      },
      fase: estado ? {
        estado: activa ? "activa" : estado.estado === "activa" ? "vencida" : estado.estado,
        inicioMs: L.aMs(estado.inicioAt) || null,
        venceMs: L.aMs(estado.venceAt) || null,
        usado: Number(estado.usado) || 0,
        reservado: activa && estado.reserva ? Number(estado.reserva.monto) || 0 : 0,
      } : null,
      saldo: activa ? disponible : 0,
      pendiente: activa ? pendiente : 0,
      enPausa: activa,
      premios: premios
        .sort((a, b) => L.aMs(b.createdAt) - L.aMs(a.createdAt))
        .map(vistaPremio),
    };
  }

  // ── Las líneas de un pedido, con su marca ─────────────────────────────────
  // El brandId lo dice el producto, no el navegador.
  async function lineasConMarca(productos, t = null) {
    const items = Object.values(productos || {}).filter(Boolean);
    const ids = [...new Set(items.map((p) => String(p.productoId || "").trim()).filter(Boolean))];
    const marcas = new Map();
    if (ids.length) {
      const refs = ids.map((id) => db.collection("productos_wala").doc(id));
      const snaps = await (t || db).getAll(...refs, { fieldMask: ["brandId"] });
      snaps.forEach((s) => { if (s.exists) marcas.set(s.id, s.get("brandId") || null); });
    }
    return items.map((p) => {
      const id = String(p.productoId || "").trim();
      const cantidad = Math.max(1, Number(p.cantidad) || 1);
      return {
        productId: id || null,
        brandId: (id && marcas.get(id)) || null,
        cantidad,
        importe: Math.max(0, Number(p.precio) || 0) * cantidad,
      };
    });
  }

  // ── En el checkout (dentro de la transacción de prepareCheckoutPayment) ──
  /**
   * Lee la fase (antes de cualquier escritura de la transacción) y revisa el
   * pedido: en la fase no van monedas ni cupones, y el saldo pedido tiene que
   * alcanzar y respetar el tope. Devuelve { saldo, escribir(t) }.
   */
  async function revisarCheckout(t, { uid, intentId, orderPayload, subtotal, envio, monedas, cupon, mobile }) {
    const saldoPedido = Math.max(0, L.redondear(orderPayload && orderPayload.saldoBienvenida));
    if (!uid) {
      if (saldoPedido > 0) throw new HttpsError("failed-precondition", "Inicia sesión para usar tu saldo de bienvenida.");
      return { saldo: 0, escribir: () => {} };
    }
    const { estado, disponible } = await leerFase(uid, t);
    const ahora = Date.now();
    const activa = L.faseActiva(estado, ahora, { intentId });
    if (!activa) {
      if (saldoPedido > 0) throw new HttpsError("failed-precondition", "Tu saldo de bienvenida ya venció. Recarga la página.");
      return { saldo: 0, escribir: () => {} };
    }
    if (monedas > 0) throw new HttpsError("failed-precondition", MSG_PAUSA_MONEDAS);
    if (cupon) throw new HttpsError("failed-precondition", MSG_PAUSA_CUPONES);
    if (mobile && saldoPedido > 0) throw new HttpsError("failed-precondition", "El saldo de bienvenida todavía no se puede usar en esta app. Úsalo en wala.pe.");

    // Otro pedido que reservó el saldo y no se pagó: se reemplaza (como las monedas).
    const reservaPrevia = estado.reserva && estado.reserva.intentId && String(estado.reserva.intentId) !== String(intentId)
      ? String(estado.reserva.intentId) : "";
    let previaRef = null;
    if (reservaPrevia) {
      previaRef = db.collection("checkout_payment_intents").doc(reservaPrevia);
      const previa = await t.get(previaRef);
      const st = previa.exists ? previa.data().status : "";
      if (st === "cobrando") throw new HttpsError("already-exists", "Ya hay un pago en proceso con tu saldo. Espera unos minutos antes de volver a intentarlo.");
      if (st !== "prepared") previaRef = null;
    }

    if (saldoPedido > 0) {
      const config = await leerConfig();
      const lineas = await lineasConMarca(orderPayload.productos, t);
      const tope = L.topeSaldo(lineas, config);
      const maximo = L.saldoAplicable({ disponible, tope, subtotal, envio, config });
      if (saldoPedido > maximo + 0.01) {
        throw new HttpsError("failed-precondition",
          `En este pedido puedes usar hasta S/ ${maximo.toFixed(2)} de tu saldo de bienvenida. Recarga la página.`);
      }
    }
    return {
      saldo: saldoPedido,
      escribir: (tx) => {
        if (previaRef) tx.update(previaRef, { status: "reemplazada", reemplazadaPor: intentId, updatedAt: FieldValue.serverTimestamp() });
        tx.set(estadoRef(uid), {
          reserva: saldoPedido > 0 ? { intentId, monto: saldoPedido, at: Timestamp.now() } : FieldValue.delete(),
        }, { merge: true });
      },
    };
  }

  // ── Al crear un pedido (pagado o por WhatsApp) ────────────────────────────
  /** La primera compra cierra la fase: se usa lo reservado y vence el resto. */
  async function cerrarFaseAlComprar({ uid, orderId, payload }) {
    if (!uid) return null;
    const ref = estadoRef(uid);
    return db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) return null;
      const e = snap.data() || {};
      if (!L.faseActiva(e, Date.now(), { intentId: orderId })) return null;
      const usado = Math.max(0, L.redondear(payload && payload.saldoBienvenida));
      t.set(ref, {
        estado: "usada",
        cerradaAt: FieldValue.serverTimestamp(),
        orderId: String(orderId),
        usado,
        reserva: FieldValue.delete(),
      }, { merge: true });
      return { usado };
    });
  }

  /**
   * El premio de quien invitó. El estado de quien invitó cuando B compra fija
   * el tipo de premio: en su fase, saldo (o nada, con el motivo); fuera de ella,
   * las monedas de siempre. Un pedido pagado con saldo no premia a nadie.
   */
  async function registrarPremio({ orderId, payload, pagado }) {
    const referido = payload && payload.referido;
    const compradorUid = payload && payload.userId ? String(payload.userId) : "";
    if (!referido || !referido.referralId || !compradorUid) return null;
    const referralRef = db.collection("referrals").doc(String(referido.referralId));
    const usoSaldo = Number(payload.saldoBienvenida) > 0;
    try {
      const [rSnap, dueno] = await Promise.all([referralRef.get(), duenoDeCodigo(referido.referrerCode)]);
      if (!rSnap.exists || !dueno || dueno.uid === compradorUid) return null;
      const r = rSnap.data() || {};
      const invitadorUid = dueno.uid;
      const ahora = Date.now();
      const faseSnap = await estadoRef(invitadorUid).get();
      const invitadorEnFase = faseSnap.exists && L.faseActiva(faseSnap.data(), ahora);
      if (!invitadorEnFase) {
        // Fuera de la fase de quien invitó: monedas normales, salvo que B pagara con saldo.
        if (usoSaldo && !r.premioModo) await referralRef.update({ premioModo: "sin_premio", updatedAt: FieldValue.serverTimestamp() });
        return null;
      }
      const config = await leerConfig();
      const lineas = await lineasConMarca(payload.productos);
      const descuentos = (Number(payload.descuentoMonedas) || 0) + (Number(payload.descuentoCupon) || 0) + (Number(payload.saldoBienvenida) || 0);
      const evaluacion = L.evaluarPremio({
        lineas, descuentos, cobrado: Number(payload.montoTotal) || 0, config,
        esInvitacion: referido.tipo === "invitacion" && r.invitadoUid === compradorUid,
        usoSaldo,
      });
      const premioRef = premiosCol(invitadorUid).doc(compradorUid);
      const nombre = primerNombre({ displayName: payload.clienteNombre || payload.clienteNombreCompleto }) || r.visitanteNombre || null;
      const creado = await db.runTransaction(async (t) => {
        const ya = await t.get(premioRef);
        if (ya.exists) return null;
        const estado = evaluacion.elegible ? (pagado ? "disponible" : "pendiente") : "no_elegible";
        t.set(premioRef, {
          compradorUid,
          compradorNombre: nombre,
          orderId: String(orderId),
          referralId: referralRef.id,
          estado,
          monto: evaluacion.elegible ? config.premio : 0,
          motivo: evaluacion.motivo || null,
          neto: evaluacion.neto,
          contribucion: evaluacion.contribucion,
          pagado: Boolean(pagado),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        t.update(referralRef, { premioModo: "primera_compra", updatedAt: FieldValue.serverTimestamp() });
        return { estado, monto: evaluacion.elegible ? config.premio : 0 };
      });
      if (creado && creado.estado === "disponible") {
        await avisar(invitadorUid, {
          title: `¡Ganaste S/ ${creado.monto} de saldo!`,
          body: `${nombre || "Tu amigo"} hizo su primera compra con tu invitación. Úsalo en tu primera compra antes de que venza.`,
          link: "/cuenta/referidos",
        });
      }
      return creado;
    } catch (e) {
      console.warn(`primeraCompra.registrarPremio(${orderId}):`, e.message);
      return null;
    }
  }

  async function alCrearPedido({ orderId, payload, uid, pagado }) {
    try {
      await cerrarFaseAlComprar({ uid, orderId, payload });
    } catch (e) {
      console.error(`primeraCompra.cerrarFaseAlComprar(${orderId}):`, e.message);
    }
    await registrarPremio({ orderId, payload, pagado });
  }

  // ── Avisos ────────────────────────────────────────────────────────────────
  async function avisar(uid, { title, body, link }) {
    try {
      const ref = db.collection(`users/${uid}/notifications`).doc();
      await ref.set({ title, body, link, type: "referidos", read: false, createdAt: new Date().toISOString() });
      const userSnap = await db.collection(USERS).doc(uid).get();
      const tokens = (userSnap.exists && userSnap.data().fcmTokens) || [];
      if (!tokens.length) return;
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { type: "referidos", link: String(link || ""), notifId: ref.id, campaignId: "" },
        webpush: { notification: { icon: "/logo192.png" }, fcmOptions: { link: `https://wala.pe${link || "/"}` } },
      });
    } catch (e) {
      console.warn(`primeraCompra.avisar(${uid}):`, e.message);
    }
  }

  // ── Revisión cada hora: pagos por WhatsApp, cancelaciones y avisos ────────
  async function revertir(invitadorUid, premioId, motivo, porAdmin = null) {
    const ref = premiosCol(invitadorUid).doc(premioId);
    const hecho = await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (!s.exists) return null;
      const p = s.data() || {};
      if (!["pendiente", "disponible"].includes(p.estado)) return null;
      t.update(ref, {
        estado: "revertido",
        motivo,
        estadoAnterior: p.estado,
        ...(porAdmin ? { revertidoPor: porAdmin } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return p;
    });
    if (hecho && hecho.estado === "disponible") {
      await avisar(invitadorUid, {
        title: `Perdiste S/ ${Number(hecho.monto) || 0} de saldo`,
        body: `${hecho.compradorNombre || "Tu amigo"} canceló su pedido, así que ese premio ya no cuenta.`,
        link: "/cuenta/referidos",
      });
    }
    return hecho;
  }

  async function reconciliar() {
    const erpDb = getErpDb();
    if (!erpDb) return { revisados: 0 };
    const config = await leerConfig({ fresca: true });
    const ahora = Date.now();
    const snap = await db.collectionGroup("primeraCompraPremios").get();
    let revisados = 0;
    const fases = new Map();
    const faseDe = async (uid) => {
      if (!fases.has(uid)) {
        const s = await estadoRef(uid).get();
        fases.set(uid, s.exists ? s.data() : null);
      }
      return fases.get(uid);
    };
    for (const d of snap.docs) {
      const p = d.data() || {};
      if (!["pendiente", "disponible"].includes(p.estado) || !p.orderId) continue;
      const invitadorUid = d.ref.parent.parent.id;
      const fase = await faseDe(invitadorUid);
      // Fase cerrada y premio ya usado o vencido: no hay nada que revisar.
      if (!L.faseActiva(fase, ahora)) {
        if (p.estado === "pendiente") await d.ref.update({ estado: "vencido", motivo: "vencido", updatedAt: FieldValue.serverTimestamp() });
        continue;
      }
      revisados += 1;
      const pedido = await buscarPedidoPorCodigoWeb(erpDb, p.orderId).catch(() => null);
      if (!pedido) continue;
      const etapa = estadoPedidoReferido(pedido.data, pedido.coleccion);
      if (etapa.anulado) {
        await revertir(invitadorUid, d.id, "revertido");
        continue;
      }
      if (p.estado === "pendiente" && pedido.coleccion === "pedidos") {
        const total = parseMontoRobust(pedido.data.montoTotal);
        const pagado = total - calcularSaldoTotal(pedido.data);
        if (pagado >= Math.min(total, config.minimoNeto)) {
          await d.ref.update({ estado: "disponible", pagado: true, updatedAt: FieldValue.serverTimestamp() });
          await avisar(invitadorUid, {
            title: `¡Ganaste S/ ${Number(p.monto) || 0} de saldo!`,
            body: `${p.compradorNombre || "Tu amigo"} pagó su primera compra con tu invitación.`,
            link: "/cuenta/referidos",
          });
        }
      }
    }
    // "Te quedan 24 horas": una sola vez por cuenta con saldo.
    const activas = await db.collectionGroup("primeraCompra").get();
    for (const d of activas.docs) {
      const e = d.data() || {};
      if (d.id !== "estado" || e.estado !== "activa" || e.avisoUltimoDia) continue;
      const vence = L.aMs(e.venceAt);
      if (!(vence > ahora && vence - ahora <= 24 * L.HORA_MS)) continue;
      const uid = d.ref.parent.parent.id;
      const { disponible } = await leerFase(uid);
      await d.ref.update({ avisoUltimoDia: true });
      if (disponible > 0) {
        await avisar(uid, {
          title: "Te quedan 24 horas",
          body: `Tienes S/ ${disponible.toFixed(2)} de saldo de bienvenida. Úsalo en tu primera compra antes de que venza.`,
          link: "/tienda",
        });
      }
    }
    return { revisados };
  }

  // ── Callables del cliente ─────────────────────────────────────────────────
  const estadoSecure = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
    const uid = context.auth.uid;
    await asegurarFase(uid, context.auth.token).catch((e) => console.warn(`primeraCompraEstado(${uid}):`, e.message));
    return resumen(uid);
  });

  /**
   * Para el checkout: cuánto saldo se puede usar en este carrito y, si quien
   * compra llegó con una invitación, si su compra le da el premio a quien lo
   * invitó (o qué le falta). Nunca bloquea la compra.
   */
  const cotizarSecure = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
    const uid = context.auth.uid;
    // Una cuenta nueva que llega directo al checkout también empieza su semana.
    await asegurarFase(uid, context.auth.token).catch((e) => console.warn(`primeraCompraCotizar(${uid}):`, e.message));
    const config = await leerConfig();
    const productos = data && data.productos && typeof data.productos === "object" ? data.productos : {};
    const lineas = await lineasConMarca(productos);
    const subtotal = lineas.reduce((tot, l) => tot + l.importe, 0);
    const { estado, disponible } = await leerFase(uid);
    const activa = L.faseActiva(estado, Date.now());
    const out = { enPausa: activa, saldo: activa ? disponible : 0, topeSaldo: activa ? L.topeSaldo(lineas, config) : 0, invitador: null };
    // ¿Llegó con una invitación cuya dueña está en su fase?
    try {
      const inv = await db.collection("referrals").where("invitadoUid", "==", uid).limit(1).get();
      if (!inv.empty) {
        const r = inv.docs[0].data() || {};
        const dueno = r.status !== "purchased" ? await duenoDeCodigo(r.referrerCode) : null;
        const fase = dueno ? await estadoRef(dueno.uid).get() : null;
        if (fase && fase.exists && L.faseActiva(fase.data(), Date.now())) {
          const saldo = Math.max(0, Number(data && data.saldo) || 0);
          const ev = L.evaluarPremio({ lineas, descuentos: saldo, cobrado: subtotal - saldo, config, usoSaldo: saldo > 0 });
          out.invitador = {
            nombre: primerNombre(dueno.perfil),
            premio: config.premio,
            genera: ev.elegible,
            motivo: ev.motivo,
            falta: ev.falta,
          };
        }
      }
    } catch (e) {
      console.warn(`primeraCompraCotizar(${uid}):`, e.message);
    }
    return out;
  });

  // ── Callables del admin ───────────────────────────────────────────────────
  async function exigirAdmin(context) {
    if (!(await callerIsAdmin(context, ["premios"]))) throw new HttpsError("permission-denied", "Solo administradores.");
  }

  const CAMPOS_NUMERO = ["horas", "premio", "minimoNeto", "margenMinimo", "comisionPct", "provisionMonedas",
    "margenPorDefecto", "saldoPctPorDefecto", "diasProteccionMonedas", "totalMinimo"];

  const configSecure = functions.https.onCall(async (data, context) => {
    await exigirAdmin(context);
    const cambios = data && data.config;
    if (cambios && typeof cambios === "object") {
      const update = { updatedAt: FieldValue.serverTimestamp() };
      if (typeof cambios.activa === "boolean") {
        update.activa = cambios.activa;
        const actual = await configRef.get();
        // La primera vez que se prende: desde ahora participan las cuentas nuevas.
        if (cambios.activa && !(actual.exists && actual.get("desde"))) update.desde = FieldValue.serverTimestamp();
      }
      for (const k of CAMPOS_NUMERO) {
        if (cambios[k] === undefined) continue;
        const n = Number(cambios[k]);
        if (!Number.isFinite(n) || n < 0) throw new HttpsError("invalid-argument", `Valor inválido en ${k}.`);
        update[k] = n;
      }
      if (cambios.marcas && typeof cambios.marcas === "object") {
        const marcas = {};
        for (const [id, m] of Object.entries(cambios.marcas)) {
          if (!id || id.includes("/") || !m) continue;
          const fila = {};
          for (const k of ["margenPct", "saldoPct"]) {
            if (m[k] === undefined || m[k] === null || m[k] === "") continue;
            const n = Number(m[k]);
            if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpsError("invalid-argument", "Los porcentajes van de 0 a 100.");
            fila[k] = n;
          }
          marcas[id] = fila;
        }
        update.marcas = marcas;
      }
      await configRef.set(update, { merge: true });
      cache = null;
    }
    const snap = await configRef.get();
    const raw = snap.exists ? snap.data() : {};
    const c = L.normalizarConfig(raw);
    return {
      config: { ...c, costos: undefined, cantidadCostos: Object.keys(c.costos).length, desdeMs: c.desdeMs || null },
    };
  });

  const listaSecure = functions.https.onCall(async (data, context) => {
    await exigirAdmin(context);
    const [premiosSnap, fasesSnap] = await Promise.all([
      db.collectionGroup("primeraCompraPremios").get(),
      db.collectionGroup("primeraCompra").get(),
    ]);
    const ahora = Date.now();
    const fases = fasesSnap.docs.filter((d) => d.id === "estado").map((d) => {
      const e = d.data() || {};
      const activa = L.faseActiva(e, ahora);
      return {
        uid: d.ref.parent.parent.id,
        estado: activa ? "activa" : e.estado === "activa" ? "vencida" : e.estado,
        inicioMs: L.aMs(e.inicioAt) || null,
        venceMs: L.aMs(e.venceAt) || null,
        usado: Number(e.usado) || 0,
        orderId: e.orderId || null,
        motivo: e.motivo || null,
      };
    });
    const premios = premiosSnap.docs.map((d) => {
      const p = d.data() || {};
      return {
        id: d.id,
        invitadorUid: d.ref.parent.parent.id,
        compradorNombre: p.compradorNombre || null,
        orderId: p.orderId || null,
        estado: p.estado,
        monto: Number(p.monto) || 0,
        motivo: p.motivo || null,
        neto: Number(p.neto) || 0,
        contribucion: Number(p.contribucion) || 0,
        fechaMs: L.aMs(p.createdAt) || null,
      };
    }).sort((a, b) => (b.fechaMs || 0) - (a.fechaMs || 0));
    // Nombres de quienes invitaron (para la bandeja).
    const uids = [...new Set(premios.map((p) => p.invitadorUid))].slice(0, 300);
    const nombres = {};
    if (uids.length) {
      const snaps = await db.getAll(...uids.map((u) => db.collection(USERS).doc(u)), { fieldMask: ["displayName", "nombre", "email"] });
      snaps.forEach((s) => { if (s.exists) nombres[s.id] = primerNombre(s.data()) || s.get("email") || null; });
    }
    return { fases, premios: premios.map((p) => ({ ...p, invitadorNombre: nombres[p.invitadorUid] || null })) };
  });

  const revertirSecure = functions.https.onCall(async (data, context) => {
    await exigirAdmin(context);
    const invitadorUid = String((data && data.invitadorUid) || "").trim();
    const premioId = String((data && data.premioId) || "").trim();
    if (!invitadorUid || !premioId || invitadorUid.includes("/") || premioId.includes("/")) {
      throw new HttpsError("invalid-argument", "Falta el premio.");
    }
    const hecho = await revertir(invitadorUid, premioId, "revertido", context.auth.uid);
    if (!hecho) throw new HttpsError("failed-precondition", "Ese premio ya no se puede revertir.");
    return { ok: true };
  });

  const reconciliarProgramado = onSchedule("every 60 minutes", async () => {
    const r = await reconciliar();
    console.log("primeraCompra.reconciliar:", r);
  });

  return {
    leerConfig, leerFase, enPausa, exigirSinPausa, revisarCheckout, alCrearPedido, estadoRef,
    MSG_PAUSA_MONEDAS, MSG_PAUSA_CUPONES,
    callables: {
      primeraCompraEstadoSecure: estadoSecure,
      primeraCompraCotizarSecure: cotizarSecure,
      primeraCompraConfigSecure: configSecure,
      primeraCompraListaSecure: listaSecure,
      primeraCompraRevertirSecure: revertirSecure,
      primeraCompraReconciliar: reconciliarProgramado,
    },
  };
};
