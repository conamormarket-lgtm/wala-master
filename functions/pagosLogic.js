"use strict";

// Lógica pura de los cobros de la tienda (sin Firestore ni pasarelas), para
// probarla en functions/test/pagosLogic.test.js. La usan processCulqiPayment,
// culqiWebhook, prepareCheckoutPayment y las funciones de PayPal (index.js).

const redondear = (n) => Math.round(Number(n) * 100) / 100;
const aCentimos = (soles) => Math.round(Number(soles) * 100);

// Un cobro que empezó y no terminó (la llamada a la pasarela se cortó) bloquea
// nuevos intentos este tiempo: si el cargo existió, el webhook lo registra antes.
const COBRO_EN_CURSO_MS = 10 * 60 * 1000;

// Culqi cobra 3 soles como mínimo.
const MINIMO_CULQI_PEN = 3;

function aMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v._seconds === "number") return v._seconds * 1000;
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? 0 : n;
}

/** ¿Hay otro cobro en marcha sobre este objetivo (y todavía no venció)? */
function cobroEnCursoVigente(estado, nowMs = Date.now()) {
  if (!estado || estado.status !== "cobrando") return false;
  return nowMs - aMillis(estado.cobroIniciadoAt) < COBRO_EN_CURSO_MS;
}

/**
 * Lo que se cobra AHORA por una intención, en soles. Las intenciones nuevas lo
 * guardan en `cobro.cobroPen` (lo calcula el servidor); las anteriores solo
 * tienen el total del pedido.
 */
function cobroDeIntencion(intent) {
  const cobro = (intent && intent.cobro) || {};
  const p = (intent && intent.orderPayload) || {};
  const n = Number(cobro.cobroPen ?? p.montoPendiente ?? p.montoTotal ?? p.montoDeuda);
  return Number.isFinite(n) && n > 0 ? redondear(n) : null;
}

/** Culqi muestra en su ventana el monto que manda el navegador: debe ser el del servidor. */
function coincideMonto(clienteCentimos, servidorCentimos) {
  return Math.abs(Number(clienteCentimos) - Number(servidorCentimos)) <= 1;
}

/** Ajustes de la sección de pago de una landing (pages/{slug}.sections[]). */
function ajustesPagoLanding(pageDoc) {
  const sections = pageDoc && Array.isArray(pageDoc.sections) ? pageDoc.sections : [];
  const seccion = sections.find((s) => s && s.type === "landing_payment");
  return seccion ? (seccion.settings || {}) : null;
}

/**
 * Pago completo o adelanto de una landing, con el adelanto de la configuración
 * de la landing (no del navegador). Misma regla que LandingPaymentBlock.jsx.
 */
function cobroLanding({ total, modalidad, ajustes }) {
  const t = redondear(Math.max(0, Number(total) || 0));
  const permiteAdelanto = !ajustes || ajustes.allowAdelanto !== false;
  if (modalidad !== "adelanto" || !permiteAdelanto) {
    return { modalidad: "completo", cobroPen: t, saldoPen: 0 };
  }
  const adelanto = Math.max(MINIMO_CULQI_PEN, Number(ajustes && ajustes.adelantoMonto) || 10);
  const cobroPen = redondear(Math.min(adelanto, t));
  return { modalidad: "adelanto", cobroPen, saldoPen: redondear(Math.max(0, t - cobroPen)) };
}

// Campos de pago que el navegador no puede poner en el pedido: los escribe el
// servidor después de comprobar el cobro con la pasarela.
const CAMPOS_PAGO = [
  "pagado", "estadoPago", "montoPagado", "montoPagadoUsd", "pagadoAt", "metodoPago",
  "culqiChargeId", "paypalOrderId", "paypalCaptureId", "pagoOnline", "pagosOnline",
  "conDeuda", "montoDeuda", "buyerUid", "webAprobado", "estadoValidacion",
];

function limpiarPayloadCliente(payload) {
  const limpio = { ...(payload || {}) };
  CAMPOS_PAGO.forEach((campo) => { delete limpio[campo]; });
  return limpio;
}

/**
 * Montos de un pedido web pagado online. `montoAdelanto` lleva lo pagado: el ERP
 * lo precarga al validar y calcula el saldo (montoTotal - montoAdelanto).
 */
function montosPedidoPagado({ total, montoPagadoPen }) {
  const t = redondear(Math.max(0, Number(total) || 0));
  const pagado = redondear(Math.max(0, Number(montoPagadoPen) || 0));
  const saldo = redondear(Math.max(0, t - pagado));
  return {
    montoAdelanto: pagado,
    montoPendiente: saldo,
    montoDeuda: saldo,
    conDeuda: saldo > 0,
    pagado: saldo === 0,
    estadoPago: saldo === 0 ? "pagado" : "adelanto_pagado",
  };
}

/** Enlaces de pago: los nuevos traen expiresAt; los antiguos vencen a las 36 h. */
function enlaceVencido(enlace, nowMs = Date.now()) {
  if (!enlace) return true;
  const expira = aMillis(enlace.expiresAt);
  if (expira) return expira <= nowMs;
  const creado = aMillis(enlace.createdAt);
  return !!creado && creado + 36 * 60 * 60 * 1000 <= nowMs;
}

/** El id del cargo en un evento de Culqi (su `data` llega a veces como texto JSON). */
function chargeIdDeEvento(body) {
  if (!body || typeof body !== "object") return null;
  let data = body.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { data = null; }
  }
  const candidatos = [data && data.id, data && data.data && data.data.id, body.object === "charge" ? body.id : null];
  const id = candidatos.find((v) => typeof v === "string" && /^chr_[A-Za-z0-9_]+$/.test(v));
  return id || null;
}

/**
 * ¿La API de Culqi dice que ese cargo no existe? Para un id que no existe no
 * responde 404 sino 401 "Ruta inválida" (authentication_error).
 */
function cargoNoExiste(status, cuerpo) {
  if (status === 404) return true;
  if (status !== 401) return false;
  let error = null;
  try { error = JSON.parse(cuerpo); } catch (e) { return false; }
  return !!error && /ruta inv[aá]lida/i.test(String(error.merchant_message || ""));
}

/** ¿El cargo (tal como lo devuelve la API de Culqi) es una venta aprobada? */
function ventaExitosa(charge) {
  const outcome = (charge && charge.outcome) || {};
  return outcome.type === "venta_exitosa" || outcome.code === "AUT0000";
}

/** Líneas de producto ligeras para el espejo wala_pedidos (sin datos de pago). */
function resumirProductos(productos) {
  const lineas = Array.isArray(productos)
    ? productos.filter(Boolean)
    : (productos && typeof productos === "object" ? Object.values(productos).filter(Boolean) : []);
  return lineas.map((l) => ({
    productoId: l.productoId ?? null,
    nombre: l.producto ?? l.nombre ?? "Producto",
    brandId: l.brandId ?? null,
    cantidad: l.cantidad ?? 1,
    talla: l.talla ?? null,
    color: l.color ?? null,
    precio: l.precio ?? null,
    subtotal: l.subtotal ?? null,
    personalizado: !!l.personalizado,
    ...(l.urlImagen && { urlImagen: l.urlImagen }),
    ...(l.urlImagenPersonalizada && { urlImagenPersonalizada: l.urlImagenPersonalizada }),
    ...(l.textoPersonalizado && { textoPersonalizado: l.textoPersonalizado }),
    ...(l.designId && { designId: l.designId }),
  }));
}

module.exports = {
  COBRO_EN_CURSO_MS,
  MINIMO_CULQI_PEN,
  CAMPOS_PAGO,
  aMillis,
  aCentimos,
  redondear,
  cobroEnCursoVigente,
  cobroDeIntencion,
  coincideMonto,
  ajustesPagoLanding,
  cobroLanding,
  limpiarPayloadCliente,
  montosPedidoPagado,
  enlaceVencido,
  chargeIdDeEvento,
  cargoNoExiste,
  ventaExitosa,
  resumirProductos,
};
