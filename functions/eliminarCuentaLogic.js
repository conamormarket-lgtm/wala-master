"use strict";

/**
 * Lógica PURA de "Borrar mi cuenta" (eliminarCuentaSecure). Sin
 * firebase-admin: se testea con Node puro (functions/test/eliminarCuentaLogic.test.js).
 * El manejador, con la base y el almacenamiento, está en ./eliminarCuenta.js.
 *
 * Lo que decidió el dueño (2026-11):
 *   - Los pedidos y los registros de pago SE CONSERVAN tal cual (la ley obliga
 *     a guardarlos): pedidos, pedidos_web, wala_pedidos, orders, subOrders,
 *     recibos y cobros, el libro de reclamaciones.
 *   - Si hay algo en curso NO se borra todavía: un pedido sin entregar (ni
 *     anulado), un saldo por pagar, una suscripción al sorteo activa, un pago
 *     en proceso o una cuenta del equipo (admin).
 *   - Lo público que creó (diseños de la comunidad, opiniones) se borra con sus
 *     archivos. Todo lo demás de la cuenta también.
 *   - Queda un registro sin datos personales (cuentasEliminadas/{hash}): el uid
 *     nunca va en claro, solo un HMAC con la sal del servidor.
 *
 * El inventario completo (qué se borra, qué se conserva y por qué) está en
 * BORRAR y CONSERVAR, abajo: el manejador recorre BORRAR.
 */

const crypto = require("crypto");
const { saldoCobrableOnline } = require("./erpCobranzaLogic");
const { rutaDeUrlStorage } = require("./comunidadLogic");

// Volver a entrar hace menos de esto para poder confirmar.
const MAX_EDAD_SESION_MS = 5 * 60 * 1000;
// Un pago "cobrando" se considera en proceso durante esto (igual que pagosLogic).
const COBRO_EN_CURSO_MS = 10 * 60 * 1000;

const MENSAJES = {
  sinSesion: "Inicia sesión con tu cuenta.",
  reautenticar: "Por seguridad, vuelve a entrar con tu cuenta para borrarla.",
  pendientes: "Antes de borrar tu cuenta resuelve lo pendiente.",
  solicitud: "Pide revisar ({ revisar: true }) o confirmar ({ confirmar: true }).",
  suscripcion: "Tienes activa la suscripción al sorteo. Cancélala antes de borrar tu cuenta.",
  admin: "Esta cuenta es del equipo de Walá: no se puede borrar desde aquí. Pídeselo a un administrador.",
  pagoEnCurso: "Tienes un pago en proceso. Espera unos minutos y vuelve a intentarlo.",
};

// ── La llamada ───────────────────────────────────────────────────────────────

/** 'revisar' | 'confirmar' | null. Solo valen { revisar: true } o { confirmar: true }, sin nada más. */
function tipoDeSolicitud(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const claves = Object.keys(data);
  if (claves.length !== 1) return null;
  if (data.revisar === true) return "revisar";
  if (data.confirmar === true) return "confirmar";
  return null;
}

/** La sesión anónima del checkout de landings no es una cuenta. */
function esSesionAnonima(token) {
  return Boolean(token && token.firebase && token.firebase.sign_in_provider === "anonymous");
}

/** ¿Entró (con contraseña o Google) hace menos de 5 minutos? auth_time viene en segundos. */
function sesionReciente(token, ahoraMs = Date.now()) {
  const authTime = Number(token && token.auth_time);
  if (!Number.isFinite(authTime) || authTime <= 0) return false;
  const edad = ahoraMs - authTime * 1000;
  return edad >= -60 * 1000 && edad <= MAX_EDAD_SESION_MS;
}

// La app de Capacitor corre en https://localhost o capacitor://localhost; la
// app nativa (React Native) no manda Origin. La web manda el suyo (wala.pe).
const ORIGENES_APP = new Set(["https://localhost", "capacitor://localhost"]);

/** 'app' | 'web' según el Origin de la llamada (solo para el registro: no da permisos). */
function origenDeLlamada(cabeceras) {
  const origen = String((cabeceras && cabeceras.origin) || "").trim().toLowerCase();
  if (!origen || ORIGENES_APP.has(origen)) return "app";
  return "web";
}

/** El id del registro: HMAC-SHA256 del uid con la sal fija del servidor. Nunca el uid en claro. */
function hashDeCuenta(uid, sal) {
  if (!uid || !sal) throw new Error("hashDeCuenta: falta el uid o la sal.");
  return crypto.createHmac("sha256", String(sal)).update(String(uid)).digest("hex");
}

// ── Lo pendiente ─────────────────────────────────────────────────────────────

const normalizar = (v) => String(v == null ? "" : v)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .trim();

function aMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v._seconds === "number") return v._seconds * 1000;
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? 0 : n;
}

const soles = (n) => `S/ ${Number(n).toFixed(2)}`;

/** El número que ve el cliente (mismo orden que misPedidosLogic.claveDeNegocio). */
function codigoDePedido(p) {
  return String((p && (p.numeroPedido || p.portalPseudoOrderId || p.pedidoWebId || p.id)) || "").trim();
}

// El pedido vivo del ERP manda; luego el pedido web y al final la copia de Walá.
const PRIORIDAD = { pedidos: 0, pedidos_web: 1, wala_pedidos: 2 };

/** Todas las claves con las que se conoce a un pedido (el ERP le da otro número al aprobarlo). */
function clavesDePedido(p) {
  const claves = new Set();
  [p.numeroPedido, p.portalPseudoOrderId, p.pedidoWebId, p.origenPedidoWebId]
    .forEach((v) => { if (v != null && String(v).trim()) claves.add(String(v).trim()); });
  if (p._coleccion !== "pedidos" && p.id) claves.add(String(p.id));
  claves.add(`${p._coleccion}/${p.id}`);
  return claves;
}

/**
 * Un pedido por compra: el ERP aprueba un pedido web con un número nuevo y la
 * copia de Walá sigue con el de la web. Se queda el doc de más prioridad.
 */
function agruparPedidos(pedidos) {
  const lista = (pedidos || []).filter((p) => p && PRIORIDAD[p._coleccion] != null)
    .sort((a, b) => PRIORIDAD[a._coleccion] - PRIORIDAD[b._coleccion]);
  const vistas = new Set();
  const principales = [];
  for (const p of lista) {
    const claves = clavesDePedido(p);
    if ([...claves].some((c) => vistas.has(c))) {
      claves.forEach((c) => vistas.add(c));
      continue;
    }
    claves.forEach((c) => vistas.add(c));
    principales.push(p);
  }
  return principales;
}

/** { anulado, entregado, saldo } de un pedido (saldo: lo que falta pagar, en soles). */
function estadoDePedido(p) {
  const general = normalizar(p.estadoGeneral || p.estado);
  const wala = normalizar(p.estadoWala);
  const anulado = Boolean(p.deletedAt) || /anulad|cancelad|rechazad|eliminad/.test(general) || wala === "cancelado";
  const entregado = /finaliz|entregad|completad/.test(general) || wala === "entregado";
  // El saldo es el del ERP (lo mismo que se cobra al "Pagar deuda" en Mis pedidos).
  const saldo = p._coleccion === "pedidos" && !anulado ? saldoCobrableOnline(p) : 0;
  return { anulado, entregado, saldo };
}

/**
 * Lo que impide borrar en los pedidos de la cuenta (los que misPedidosSecure
 * muestra completos: los que la cuenta demostró que son suyos).
 * @returns {Array<{tipo:'pedido'|'saldo', texto:string}>}
 */
function pendientesDePedidos(pedidos) {
  const out = [];
  for (const p of agruparPedidos(pedidos)) {
    const { anulado, entregado, saldo } = estadoDePedido(p);
    if (anulado) continue;
    const codigo = codigoDePedido(p);
    if (!entregado) out.push({ tipo: "pedido", texto: `Tu pedido #${codigo} todavía no se entrega.` });
    if (saldo > 0) out.push({ tipo: "saldo", texto: `El pedido #${codigo} tiene un saldo de ${soles(saldo)} por pagar.` });
  }
  return out;
}

/** Suscripciones al sorteo activas (las cobra el cron cada periodo). docs: [{ estado, titulo? }]. */
function pendientesDeSuscripciones(suscripciones) {
  return (suscripciones || [])
    .filter((s) => s && s.estado === "activo")
    .map(() => ({ tipo: "suscripcion", texto: MENSAJES.suscripcion }))
    .slice(0, 1);
}

function cobroVigente(estado, ahoraMs) {
  if (!estado || estado.status !== "cobrando") return false;
  const inicio = aMillis(estado.cobroIniciadoAt);
  // Sin fecha de inicio no se sabe cuándo empezó: se da por en curso.
  return !inicio || ahoraMs - inicio < COBRO_EN_CURSO_MS;
}

/** Un pago que la pasarela está procesando ahora (intención o cobro genérico). */
function pendientesDePagos({ intenciones = [], cobros = [] } = {}, ahoraMs = Date.now()) {
  const enCurso = [...intenciones, ...cobros].some((e) => cobroVigente(e, ahoraMs));
  return enCurso ? [{ tipo: "pedido", texto: MENSAJES.pagoEnCurso }] : [];
}

/** Una cuenta del equipo no se borra por aquí. */
function pendienteDeAdmin({ claimAdmin = false, adminUser = false, permisosPanel = [] } = {}) {
  const conPermisos = Array.isArray(permisosPanel) && permisosPanel.length > 0;
  return claimAdmin || adminUser || conPermisos ? [{ tipo: "admin", texto: MENSAJES.admin }] : [];
}

// ── Lo que se borra con condiciones ──────────────────────────────────────────

// Intenciones de pago que no son registro de un cobro: preparadas sin cobrar,
// reemplazadas o vencidas. Las cobradas (paid_order_created…) y las que están
// cobrando se conservan.
const INTENCIONES_BORRABLES = new Set(["prepared", "reemplazada", "vencida"]);
function intencionBorrable(intent) {
  return Boolean(intent) && INTENCIONES_BORRABLES.has(intent.status);
}

/** Un ticket de sorteo sin pago confirmado es solo una intención: se borra. Los pagados son registro de pago. */
function ticketBorrable(ticket) {
  return Boolean(ticket) && ticket.pagoConfirmado !== true;
}

/** Marca de "borrar este campo" (el manejador la cambia por FieldValue.delete()). */
const BORRAR_CAMPO = Object.freeze({ __borrarCampo: true });

/**
 * Qué hacer con un doc de referrals:
 *   - Visitas a MI link (referrerCode = mi código): existen para pagarme a mí;
 *     se borran. Si otra persona aceptó mi invitación (invitadoUid), el doc es
 *     también su registro (evita darle dos bonos de bienvenida): se queda sin
 *     la referencia a mí.
 *   - Docs de OTRA persona donde yo soy el visitante o el invitado: se quitan
 *     solo mis datos (uid y nombre); el referido sigue siendo de ella.
 * @returns {null | {tipo:'borrar'} | {tipo:'actualizar', cambios:object}}
 */
function accionReferido(r, uid, miCodigo) {
  if (!r || !uid) return null;
  if (miCodigo && r.referrerCode === miCodigo) {
    if (r.invitadoUid && r.invitadoUid !== uid) {
      return { tipo: "actualizar", cambios: { referrerCode: BORRAR_CAMPO, linkId: BORRAR_CAMPO, referenteEliminado: true } };
    }
    return { tipo: "borrar" };
  }
  const cambios = {};
  if (r.visitanteUid === uid || r.invitadoUid === uid) {
    cambios.visitanteUid = BORRAR_CAMPO;
    cambios.visitanteNombre = BORRAR_CAMPO;
  }
  if (r.invitadoUid === uid) cambios.invitadoUid = BORRAR_CAMPO;
  if (r.invitacionRechazada && r.invitacionRechazada.uid === uid) cambios.invitacionRechazada = BORRAR_CAMPO;
  if (!Object.keys(cambios).length) return null;
  cambios.visitanteEliminado = true;
  return { tipo: "actualizar", cambios };
}

// ── Archivos ─────────────────────────────────────────────────────────────────

/** Carpetas de Storage que son solo de la cuenta (web y app suben ahí). */
function carpetasDeCuenta(uid) {
  return [`users/${uid}/`, `gift_recipients/${uid}/`, `designs/${uid}/`];
}

/** Las rutas de designs/{uid}/… que nombra un valor (un pedido entero, recorrido a fondo). */
function rutasDelCliente(valor, uid, out = new Set(), profundidad = 0) {
  if (profundidad > 14 || valor == null) return out;
  if (typeof valor === "string") {
    const r = rutaDeUrlStorage(valor);
    if (r && r.path.startsWith(`designs/${uid}/`)) out.add(r.path);
  } else if (Array.isArray(valor)) {
    valor.forEach((v) => rutasDelCliente(v, uid, out, profundidad + 1));
  } else if (typeof valor === "object" && typeof valor.toMillis !== "function") {
    Object.values(valor).forEach((v) => rutasDelCliente(v, uid, out, profundidad + 1));
  }
  return out;
}

/**
 * Archivos que NO se borran: los de designs/{uid}/ que un pedido todavía
 * nombra. Al pagar, pedidoDisenos copia los archivos a pedidos/{id}/, pero si
 * una copia falló (o el pedido es de antes), el pedido apunta al original y
 * el taller lo necesita.
 */
function rutasProtegidas(pedidos, uid) {
  const out = new Set();
  (pedidos || []).forEach((p) => rutasDelCliente(p, uid, out));
  return out;
}

/** La ruta en Storage de una URL, si empieza con alguno de los prefijos (si no, null). */
function rutaPropia(url, prefijos) {
  const r = rutaDeUrlStorage(url);
  if (!r || r.path.includes("..")) return null;
  return prefijos.some((p) => r.path.startsWith(p)) ? r.path : null;
}

/** Las imágenes de una opinión (product_reviews/{producto}/…). */
function archivosDeOpinion(review) {
  const urls = Array.isArray(review && review.imageUrls) ? review.imageUrls : [];
  return urls.map((u) => rutaPropia(u, ["product_reviews/"])).filter(Boolean);
}

// ── Inventario ───────────────────────────────────────────────────────────────

/**
 * Lo que se BORRA. El manejador lo recorre en este orden; cada entrada lleva
 * su porqué. `doc`: un doc por uid · `consulta`: docs con ese campo = uid ·
 * `recursivo`: con sus subcolecciones. Los casos con reglas propias
 * (referidos, sorteos, comunidad, tarjetas, archivos, perfil) están en el
 * manejador y en CONDICIONALES.
 */
const BORRAR = [
  // Uno por cuenta (id = uid o derivado).
  { coleccion: "wala_direcciones", doc: (u) => u, porque: "libreta de direcciones (nombre, documento, teléfono, dirección)" },
  { coleccion: "wishlists", doc: (u) => u, porque: "lista de deseos pública" },
  { coleccion: "bolitasProgreso", doc: (u) => u, porque: "progreso del juego" },
  { coleccion: "bolitasJugadores", doc: (u) => u, porque: "ficha del jugador (nombre)" },
  { coleccion: "pichangaProgreso", doc: (u) => u, porque: "progreso del juego" },
  { coleccion: "pichangaJugadores", doc: (u) => u, porque: "ficha del jugador (nombre)" },
  { coleccion: "pedidos_vinculo_intentos", doc: (u) => u, porque: "contador de intentos de vincular pedidos" },
  { coleccion: "analytics_user_summary", doc: (u) => u, porque: "resumen de analítica de la persona" },
  { coleccion: "product_view_notifications", doc: (u) => u, porque: "registro de avisos de productos vistos" },
  { coleccion: "survey_reminders", doc: (u) => u, porque: "registro de recordatorios de encuesta" },
  { coleccion: "wordle", doc: (u) => `${u}_stats`, porque: "estadísticas de La palabra del día (ranking público)" },
  // Por campo.
  { coleccion: "designs", campo: "userId", porque: "creaciones propias (los pedidos guardan su copia en pedidos/{id}/)" },
  { coleccion: "product_reviews", campo: "userId", porque: "opiniones públicas (con sus fotos)" },
  { coleccion: "comunidad_disenos", campo: "autorUid", recursivo: true, porque: "diseños publicados en la comunidad (con sus archivos)" },
  { coleccion: "userCoupons", campo: "uid", porque: "cupones de la cuenta" },
  { coleccion: "userMissions", campo: "userId", porque: "progreso de misiones" },
  { coleccion: "userActions", campo: "userId", porque: "acciones de misiones" },
  { coleccion: "loyaltyLedger", campo: "uid", porque: "historial de monedas (no es un comprobante de pago)" },
  { coleccion: "wordle", campo: "userId", porque: "partidas de La palabra del día" },
  { coleccion: "challengeEvidences", campo: "userId", porque: "evidencias de retos (nombre y foto)" },
  { coleccion: "suggested_packages", campo: "userId", porque: "paquetes que el equipo armó para la persona" },
  { coleccion: "producto_cliente_personalizado", campo: "userId", porque: "productos personalizados antes de comprar" },
  { coleccion: "ruletaWins", campo: "uid", porque: "premios de la ruleta (correo y nombre)" },
  { coleccion: "bolitasRetos", campo: "uid", porque: "partidas del reto diario (nombre)" },
  { coleccion: "bolitasSemanas", campo: "uid", porque: "ranking semanal (nombre)" },
  { coleccion: "pichangaRetos", campo: "uid", porque: "partidas del reto diario (nombre)" },
  { coleccion: "pichangaSemanas", campo: "uid", porque: "ranking semanal (nombre)" },
  { coleccion: "pichangaMeses", campo: "uid", porque: "ranking mensual (nombre)" },
  { coleccion: "referralOrderClaims", campo: "uid", porque: "candados de premios de referido que cobró la persona" },
  { coleccion: "encuestas_entrega", campo: "uid", porque: "respuestas de la encuesta de entrega (nombre y correo)" },
  { coleccion: "checkout_payment_intents", campo: "uid", filtro: intencionBorrable, porque: "intenciones de pago sin cobrar (las cobradas se conservan)" },
  { coleccion: "analytics_events", campo: "uid", masiva: true, porque: "eventos de analítica con su uid" },
  { coleccion: "analytics_sessions", campo: "uid", masiva: true, porque: "sesiones de analítica (uid, correo, nombre)" },
  { coleccion: "heatmap_events", campo: "uid", masiva: true, porque: "clics del mapa de calor con su uid" },
];

/** Lo que se borra o se limpia con reglas propias (ver el manejador). */
const CONDICIONALES = [
  { ruta: "portal_clientes_users/{uid} (+ notifications)", accion: "borrar", porque: "perfil: datos, DNI, monedas, fechas importantes, tokens fcmTokens" },
  { ruta: "users/{uid} (+ notifications)", accion: "borrar", porque: "perfil heredado y su bandeja de avisos" },
  { ruta: "culqiCharges/tarjetas_{uid} (+ guardadas)", accion: "borrar", porque: "referencias a tarjetas guardadas; el cliente de Culqi queda en culqiPorBorrar (pendiente)" },
  { ruta: "referrals", accion: "borrar / limpiar", porque: "ver accionReferido" },
  { ruta: "product_reviews.helpfulVotes", accion: "quitar el uid", porque: "votos 'útil' en opiniones de otras personas" },
  { ruta: "sorteos/*/participantes/{uid}", accion: "borrar", porque: "participación (datos de contacto)" },
  { ruta: "sorteos/*/referralClaims/{uid}", accion: "borrar", porque: "candado de referido del sorteo" },
  { ruta: "sorteos/*/tickets (participanteUid)", accion: "borrar sin pago", porque: "los pagados son registro de pago" },
  { ruta: "sorteos_suscripcion/*/suscriptores/{uid}", accion: "borrar el doc", porque: "suscripción ya no activa; su subcolección recibos se conserva" },
  { ruta: "comunidad_disenos/*/usos/{uid}", accion: "borrar", porque: "marca de uso de un diseño de la comunidad" },
  { ruta: "Storage users/{uid}/, gift_recipients/{uid}/, designs/{uid}/", accion: "borrar", porque: "fotos de perfil, de fechas importantes y archivos de Crear (salvo los que un pedido nombra)" },
  { ruta: "Storage product_reviews/… y comunidad/{id}/…", accion: "borrar", porque: "fotos de sus opiniones y de sus publicaciones" },
  { ruta: "Firebase Auth", accion: "borrar el usuario", porque: "al final, cuando todo lo demás ya se borró" },
];

/** Lo que se CONSERVA y por qué (nada de esto se toca). */
const CONSERVAR = [
  { ruta: "pedidos, pedidos_web, wala_pedidos", porque: "pedidos: documento de la venta (obligación tributaria)" },
  { ruta: "orders, subOrders, payouts", porque: "órdenes del marketplace y pagos a vendedores" },
  { ruta: "Storage pedidos/{id}/…, boletas_envio/…, comprobantes", porque: "archivos de pedidos y comprobantes" },
  { ruta: "checkout_payment_intents cobradas", porque: "unen el cobro con el pedido" },
  { ruta: "culqiCharges (cobros), culqiWebhookEvents, paypal_ordenes, paypalSubEvents, cobros_en_curso, pagos_anomalias", porque: "registros de pago" },
  { ruta: "suscripcionCharges, sorteos_suscripcion/*/suscriptores/{uid}/recibos", porque: "cobros de la suscripción" },
  { ruta: "sorteos/*/tickets pagados", porque: "registro de pago del ticket" },
  { ruta: "sorteos/*/sorteos_realizados, sorteos_suscripcion/*/sorteos_realizados, chancesAjustes", porque: "evidencia auditable de los sorteos y de los ajustes del equipo" },
  { ruta: "enlaces_pago, payment_link_integrations, fp_transactions", porque: "cobros y finanzas del ERP" },
  { ruta: "libro_reclamaciones", porque: "obligación legal (INDECOPI)" },
  { ruta: "order_notifications", porque: "registro por pedido de los avisos ya mandados (sin uid)" },
  { ruta: "agregados sin uid (bolitasStats, bolitasPremios, notification_stats, analytics_daily…)", porque: "solo cuentan; no identifican a nadie" },
];

/**
 * El registro de auditoría: solo números. `borrados` = { coleccion: cantidad }.
 */
function resumenAuditoria({ origen, borrados = {}, archivos = 0, culqiPendiente = false } = {}) {
  const limpio = {};
  for (const [k, v] of Object.entries(borrados)) {
    const n = Number(v) || 0;
    if (n > 0) limpio[k] = n;
  }
  return { origen: origen === "web" ? "web" : "app", borrados: limpio, archivos: Number(archivos) || 0, culqiPendiente: Boolean(culqiPendiente) };
}

module.exports = {
  MAX_EDAD_SESION_MS,
  MENSAJES,
  BORRAR,
  CONDICIONALES,
  CONSERVAR,
  BORRAR_CAMPO,
  tipoDeSolicitud,
  esSesionAnonima,
  sesionReciente,
  origenDeLlamada,
  hashDeCuenta,
  codigoDePedido,
  agruparPedidos,
  estadoDePedido,
  pendientesDePedidos,
  pendientesDeSuscripciones,
  pendientesDePagos,
  pendienteDeAdmin,
  intencionBorrable,
  ticketBorrable,
  accionReferido,
  carpetasDeCuenta,
  rutasProtegidas,
  rutaPropia,
  archivosDeOpinion,
  resumenAuditoria,
  aMillis,
};
