/**
 * Lógica PURA de referidos. Sin firebase-admin: se testea con Node puro
 * (functions/test/referidosLogic.test.js).
 *
 * Cómo se arma el vínculo (ver prepareCheckoutPayment / claimReferralSecure):
 *   1. El navegador del comprador guarda el referralId al abrir el enlace.
 *   2. prepareCheckoutPayment lo valida y lo escribe en el pedido como
 *      `referido: { referralId, referrerCode }`. Lo pone el servidor; el que
 *      mande el navegador dentro del pedido se descarta.
 *   3. El ERP, al aprobar el pedido web, copia todos sus campos al pedido nuevo
 *      de `pedidos` (con otro número y origenPedidoWebId = código web). El
 *      `referido` viaja con él.
 *   4. Reclamar y "Ver pedido" exigen que el pedido diga que vino de ESE
 *      referido. Como `referrals` lo puede escribir cualquiera, apuntar un
 *      referido al pedido de otra persona ya no sirve de nada.
 */

const { hitoDeEstadoErp } = require("./ordersLogic");

// Plazo para comprar desde que se abre el enlace. Es el mismo que muestran
// ReferralTracker.jsx y CuentaReferidosPage.jsx.
const VENTANA_REFERIDO_MS = 36 * 60 * 60 * 1000;

// ── Invitación a cuentas nuevas ──────────────────────────────────────────────
// Dos tipos de referido (ver docs en CuentaReferidosPage):
//   - 'producto' (o la tienda): cualquiera que compre dentro de 36 h desde que
//     ESA persona abrió el link. Premio: 5 % / 10 % del pedido.
//   - 'invitacion': si quien abre el link crea una cuenta NUEVA, recibe un bono
//     de bienvenida y su primera compra dentro de 30 días le paga a quien
//     invitó (fijo o el %, lo que sea mayor). Si no es cuenta nueva, el link
//     funciona como uno de producto (36 h y %).
// Una compra paga a un solo link: el último abierto. Si no hay ninguno
// vigente, la invitación de la cuenta.
const BONO_BIENVENIDA_INVITACION = 10;
const PREMIO_INVITACION = 15;
const VENTANA_INVITACION_MS = 30 * 24 * 60 * 60 * 1000;
// La cuenta tiene que haberse creado DESPUÉS de abrir el link (con 10 min de
// margen por relojes) y dentro de los 7 días siguientes.
const MARGEN_CUENTA_NUEVA_MS = 10 * 60 * 1000;
const PLAZO_CREAR_CUENTA_MS = 7 * 24 * 60 * 60 * 1000;

function normalizar(v) {
  return String(v == null ? "" : v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function aMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const p = Date.parse(v);
  return Number.isFinite(p) ? p : 0;
}

/**
 * Premio de quien refirió, en monedas (1 moneda = S/1): 5% del total del pedido
 * si es S/200 o menos, 10% si supera los S/200. Misma fórmula que el estimado
 * del cliente (estimateReferralReward en src/services/referrals.js).
 */
function calcularRecompensaReferido(montoTotal) {
  const monto = Number(montoTotal) || 0;
  if (monto <= 0) return 0;
  const tasa = monto > 200 ? 0.10 : 0.05;
  return Math.round(monto * tasa);
}

/**
 * ¿Este referido puede quedar en un pedido nuevo? Tiene que tener código, haber
 * abierto el enlace hace menos de 36 h y no estar ya usado por otra compra (un
 * enlace = una compra; si se vuelve a preparar el MISMO pedido, sigue valiendo).
 */
function referidoVigenteParaCheckout(r, { ahoraMs, intentId, uid } = {}) {
  if (!r || !String(r.referrerCode || "").trim()) return false;
  if (r.orderId && String(r.orderId) !== String(intentId || "")) return false;
  const ahora = Number(ahoraMs) || Date.now();
  // Invitación aceptada: vale para ESA cuenta durante 30 días.
  if (r.invitadoUid) {
    if (!uid || String(r.invitadoUid) !== String(uid)) return false;
    if (!["registered", "purchased"].includes(r.status)) return false;
    const aceptada = aMs(r.aceptadaAt);
    return !!aceptada && ahora - aceptada < VENTANA_INVITACION_MS;
  }
  if (!["clicked", "purchased"].includes(r.status)) return false;
  const clic = aMs(r.clickedAt);
  if (!clic) return false;
  return ahora - clic < VENTANA_REFERIDO_MS;
}

/**
 * Premio de quien refirió por este pedido. Invitación aceptada: 15 monedas o el
 * %, lo que sea mayor (una invitación nunca paga menos que un link de producto).
 */
function premioReferido(r, montoTotal) {
  const porcentaje = calcularRecompensaReferido(montoTotal);
  if (r && r.tipo === "invitacion" && r.invitadoUid) {
    return Number(montoTotal) > 0 ? Math.max(PREMIO_INVITACION, porcentaje) : 0;
  }
  return porcentaje;
}

/** ¿La cuenta se creó después de abrir la invitación y a tiempo? */
function cuentaCreadaPorInvitacion({ creadaMs, clicMs }) {
  const creada = Number(creadaMs) || 0;
  const clic = Number(clicMs) || 0;
  if (!creada || !clic) return false;
  return creada >= clic - MARGEN_CUENTA_NUEVA_MS && creada <= clic + PLAZO_CREAR_CUENTA_MS;
}

/** Documento normalizado: sin espacios ni puntos, en mayúsculas. */
function normDocumento(v) {
  return String(v == null ? "" : v).replace(/[\s.-]/g, "").toUpperCase();
}

/**
 * Formas en que el ERP y la tienda guardan un mismo celular de Perú
 * ("999888777", "51999888777", "+51999888777", "+51 999888777"), para buscar
 * si ya compró con él. Los de otros países se buscan tal cual.
 */
function variantesTelefono(v) {
  const digitos = String(v == null ? "" : v).replace(/\D/g, "");
  if (!digitos) return [];
  const local = digitos.length === 11 && digitos.startsWith("51") ? digitos.slice(2) : digitos;
  if (local.length !== 9) return [String(v).trim(), digitos].filter((x, i, a) => x && a.indexOf(x) === i);
  return [local, `51${local}`, `+51${local}`, `+51 ${local}`];
}

/** ¿El pedido dice que vino de este referido? */
function pedidoEsDelReferido(orderData, referralId) {
  const r = orderData && orderData.referido;
  return !!(r && referralId && String(r.referralId) === String(referralId));
}

/**
 * Estado del pedido para quien refirió. `coleccion` es dónde se encontró:
 * en pedidos_web todavía no lo aprobó el ERP.
 */
function estadoPedidoReferido(orderData, coleccion) {
  const o = orderData || {};
  const estado = normalizar(o.estadoGeneral || o.estado || o.status);
  const anulado = !!o.deletedAt || /anul|cancel/.test(estado);
  const finalizado = !anulado && /^(finalizado|entregado|completado)$/.test(estado);
  let etapa;
  if (anulado) etapa = "anulado";
  else if (coleccion === "pedidos_web") etapa = "por_confirmar";
  else etapa = hitoDeEstadoErp(o.estadoGeneral || o.estado) || "confirmado";
  return { etapa, finalizado, anulado, estadoErp: o.estadoGeneral || o.estado || "" };
}

function fechaIso(v) {
  const ms = aMs(v);
  return ms ? new Date(ms).toISOString() : null;
}

/**
 * Lo que ve quien refirió de la compra: qué se compró, cuánto y en qué va.
 * NUNCA datos de quien compró (nombre, documento, teléfono, dirección) ni sus
 * diseños personalizados (pueden llevar fotos suyas): solo la foto del
 * catálogo de cada producto.
 */
function resumenPedidoReferido(orderData, coleccion) {
  const o = orderData || {};
  let lista = o.productos;
  if (lista && typeof lista === "object" && !Array.isArray(lista)) lista = Object.values(lista);
  if (!Array.isArray(lista)) lista = [];
  const productos = lista.filter(Boolean).map((p) => ({
    nombre: String(p.producto || p.nombre || p.name || "Producto"),
    cantidad: Math.max(1, Number(p.cantidad ?? p.quantity) || 1),
    talla: String(p.talla || p.size || ""),
    color: String(p.color || ""),
    productoId: String(p.productoId || ""),
    // imagenReferencial/urlImagen es la foto del producto al comprar. En uno
    // personalizado puede ser el diseño del comprador: ahí no se manda.
    imagen: p.personalizado ? "" : String(p.imagenReferencial || p.urlImagen || ""),
    personalizado: !!p.personalizado,
  }));
  const est = estadoPedidoReferido(o, coleccion);
  return {
    numeroPedido: String(o.portalPseudoOrderId || o.origenPedidoWebId || o.numeroPedido || ""),
    fecha: fechaIso(o.createdAt),
    montoTotal: Number(o.montoTotal) || 0,
    etapa: est.etapa,
    estadoErp: est.estadoErp,
    finalizado: est.finalizado,
    productos,
  };
}

/**
 * Primer nombre de quien refirió, para "María te invitó" en la tienda. Solo
 * el primero (nunca apellidos ni correo) y con mayúscula inicial: los perfiles
 * lo traen como lo escribieron ("JOSÉ ALEJANDRO…", "flor huaman…"). null si
 * no hay un nombre usable.
 */
function primerNombre(perfil) {
  const p = perfil || {};
  const crudo = [p.displayName, p.clienteNombre, p.name, p.nombre]
    .map((v) => String(v == null ? "" : v).trim())
    .find((v) => v && !v.includes("@"));
  if (!crudo) return null;
  const palabra = crudo.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, "");
  if (palabra.length < 2) return null;
  const nombre = palabra.slice(0, 20).toLocaleLowerCase("es");
  return nombre.charAt(0).toLocaleUpperCase("es") + nombre.slice(1);
}

/** Nombres de lo comprado (máx. 5, sin repetir), del mapa `productos` del pedido. */
function nombresProductos(productos) {
  let lista = productos;
  if (lista && typeof lista === "object" && !Array.isArray(lista)) lista = Object.values(lista);
  if (!Array.isArray(lista)) return [];
  const nombres = lista.filter(Boolean)
    .map((p) => String(p.producto || p.nombre || p.name || "").trim().slice(0, 80))
    .filter(Boolean);
  return [...new Set(nombres)].slice(0, 5);
}

module.exports = {
  VENTANA_REFERIDO_MS,
  nombresProductos,
  BONO_BIENVENIDA_INVITACION,
  PREMIO_INVITACION,
  VENTANA_INVITACION_MS,
  premioReferido,
  cuentaCreadaPorInvitacion,
  normDocumento,
  variantesTelefono,
  primerNombre,
  calcularRecompensaReferido,
  referidoVigenteParaCheckout,
  pedidoEsDelReferido,
  estadoPedidoReferido,
  resumenPedidoReferido,
};
