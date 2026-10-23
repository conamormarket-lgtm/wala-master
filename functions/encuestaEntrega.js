// ── Encuesta de la entrega ("¿Cómo te fue con tu pedido?") ──────────────────
// Llega con el aviso de "Tu pedido fue entregado" (link /opinar/<código>) y
// desde el detalle del pedido en Mis pedidos. Todo pasa por el servidor: las
// respuestas (encuestas_entrega/{uid}__{código}) no tienen reglas para el
// navegador; el admin las lee con resultadosEncuestaEntrega.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { hitoDeEstadoErp, hitoDeEstadoWala } = require("./ordersLogic");
const { puedeUsarPuente } = require("./adminAuth");
const { configEntrega, limpiarRespuestaEntrega, claveEntrega } = require("./encuestaEntregaLogic");

const db = admin.firestore();
const PORTAL_USERS_COLLECTION = "portal_clientes_users";
const RESPUESTAS = "encuestas_entrega";

async function leerConfigEntrega() {
  const snap = await db.doc("tienda_encuesta_config/global").get();
  return configEntrega(snap.exists ? snap.data().entregaPanel : null);
}

function codigoDe(data) {
  const codigo = String((data && data.codigo) || "").trim();
  if (!codigo || codigo.length > 80) throw new functions.https.HttpsError("invalid-argument", "Falta el código del pedido.");
  return codigo;
}

function requireAuth(context) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Inicia sesión para responder.");
  return context.auth.uid;
}

// El código que el cliente ve en Mis pedidos (igual que en notificationsEngine).
const codigoCliente = (p, id) => String(p.origenPedidoWebId || p.portalPseudoOrderId || p.numeroPedido || id || "").trim();
const limpiarClave = (s) => String(s).trim().replace(/[/\\#?[\].]/g, "-").replace(/\s+/g, "-");

/** ¿Ese pedido es del cliente y ya fue entregado? Busca en el registro de avisos, en wala_pedidos y en el ERP. */
async function pedidoEntregadoDe(uid, codigo) {
  const log = await db.collection("order_notifications").doc(limpiarClave(codigo)).get();
  if (log.exists && log.data().uid === uid && (log.data().hitos || []).includes("entregado")) return true;

  const propios = await db.collection("wala_pedidos").where("buyerUid", "==", uid).get();
  if (propios.docs.some((d) => codigoCliente(d.data(), d.id) === codigo && hitoDeEstadoWala(d.data().estadoWala) === "entregado")) return true;

  // ERP: por cualquiera de sus códigos (el número puede estar guardado como número).
  const user = await db.collection(PORTAL_USERS_COLLECTION).doc(uid).get();
  const dni = String((user.exists && (user.data().dni || user.data().clienteNumeroDocumento)) || "").trim();
  const esDelCliente = (p) => p.buyerUid === uid || (dni && String(p.dni || p.clienteNumeroDocumento || "").trim() === dni);
  const candidatos = [];
  const directo = await db.collection("pedidos").doc(limpiarClave(codigo)).get().catch(() => null);
  if (directo && directo.exists) candidatos.push(directo.data());
  const valores = /^\d+$/.test(codigo) ? [codigo, Number(codigo)] : [codigo];
  for (const campo of ["origenPedidoWebId", "portalPseudoOrderId", "numeroPedido"]) {
    for (const v of valores) {
      const q = await db.collection("pedidos").where(campo, "==", v).limit(3).get();
      q.forEach((d) => candidatos.push(d.data()));
    }
  }
  return candidatos.some((p) => esDelCliente(p) && hitoDeEstadoErp(p.estadoGeneral) === "entregado");
}

exports._pedidoEntregadoDe = pedidoEntregadoDe; // para probar con datos reales

// Lo que necesita la página al abrirse: si puede responder, si ya respondió y la config.
exports.estadoEncuestaEntrega = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const codigo = codigoDe(data);
  const cfg = await leerConfigEntrega();
  const respuesta = await db.collection(RESPUESTAS).doc(claveEntrega(uid, codigo)).get();
  if (respuesta.exists) return { ...cfg, entregado: true, respondida: true, estrellas: respuesta.data().estrellas };
  return { ...cfg, entregado: await pedidoEntregadoDe(uid, codigo), respondida: false };
});

// Guarda la respuesta (una por pedido) y paga las monedas de la config.
exports.responderEncuestaEntrega = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const codigo = codigoDe(data);
  const cfg = await leerConfigEntrega();
  if (!cfg.activo) throw new functions.https.HttpsError("failed-precondition", "Esta encuesta no está disponible ahora.");
  const r = limpiarRespuestaEntrega(data, cfg);
  if (r.error) throw new functions.https.HttpsError("invalid-argument", r.error);
  if (!(await pedidoEntregadoDe(uid, codigo))) {
    throw new functions.https.HttpsError("failed-precondition", "Este pedido todavía no figura como entregado.");
  }

  const ref = db.collection(RESPUESTAS).doc(claveEntrega(uid, codigo));
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  return db.runTransaction(async (t) => {
    const [ya, userSnap] = await Promise.all([t.get(ref), t.get(userRef)]);
    if (ya.exists) return { yaRespondida: true, monedas: 0 };
    const u = userSnap.exists ? userSnap.data() : {};
    t.set(ref, {
      uid,
      codigo,
      ...r,
      nombre: u.displayName || "",
      email: u.email || "",
      monedas: cfg.monedas,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    if (cfg.monedas > 0 && userSnap.exists) {
      const balanceAfter = (u.monedas || 0) + cfg.monedas;
      t.update(userRef, { monedas: balanceAfter });
      // Igual que writeLedger de index.js.
      t.set(db.collection("loyaltyLedger").doc(), {
        uid, type: "earn", amount: cfg.monedas, source: "encuesta_entrega", balanceAfter, createdAt: FieldValue.serverTimestamp(),
      });
    }
    return { monedas: userSnap.exists ? cfg.monedas : 0 };
  });
});

// Admin: las respuestas (las últimas 2000) para /admin/encuesta-entregas.
exports.resultadosEncuestaEntrega = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  const esAdmin = context.auth.token?.admin === true
    || (puedeUsarPuente(context.auth.token)
      && await db.collection("adminUsers").doc(context.auth.uid).get()
        .then((s) => s.exists && s.data().role === "admin")
        .catch(() => false));
  if (!esAdmin) throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede ver las respuestas.");
  const snap = await db.collection(RESPUESTAS).orderBy("createdAtMs", "desc").limit(2000).get();
  return {
    respuestas: snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id, codigo: x.codigo, estrellas: x.estrellas, mejorar: x.mejorar || [], comentario: x.comentario || "",
        nombre: x.nombre || "", email: x.email || "", fecha: x.createdAtMs || 0,
      };
    }),
  };
});
