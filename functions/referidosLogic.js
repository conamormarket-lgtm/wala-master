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
function referidoVigenteParaCheckout(r, { ahoraMs, intentId } = {}) {
  if (!r || !String(r.referrerCode || "").trim()) return false;
  if (r.orderId && String(r.orderId) !== String(intentId || "")) return false;
  if (!["clicked", "purchased"].includes(r.status)) return false;
  const clic = aMs(r.clickedAt);
  if (!clic) return false;
  const ahora = Number(ahoraMs) || Date.now();
  return ahora - clic < VENTANA_REFERIDO_MS;
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

module.exports = {
  VENTANA_REFERIDO_MS,
  primerNombre,
  calcularRecompensaReferido,
  referidoVigenteParaCheckout,
  pedidoEsDelReferido,
  estadoPedidoReferido,
  resumenPedidoReferido,
};
