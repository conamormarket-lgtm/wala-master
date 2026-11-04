"use strict";

// Cuánto se debe cobrar por un checkout, según el servidor. Espejo de la cuenta
// de CheckoutPage.jsx:
//   total = max(0, subtotal - monedas - cupón) + envío
// El envío se mide sobre el subtotal de los productos (src/constants/envio.js)
// y un cupón de envío gratis lo deja en cero. Las monedas tienen tope: un
// porcentaje del precio de cada producto, el de su marca (ver abajo).
function totalEsperadoCheckout({
  subtotal, monedas = 0, descuentoCupon = 0, envioGratis = false,
  envioEstandar, envioGratisDesde,
}) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const envio = envioGratis ? 0 : (sub > envioGratisDesde ? 0 : envioEstandar);
  const resto = Math.max(0, sub - Math.max(0, Number(monedas) || 0) - Math.max(0, Number(descuentoCupon) || 0));
  return { envio, total: Math.round((resto + envio) * 100) / 100 };
}

// ── Tope de monedas por marca ────────────────────────────────────────────────
// Cada marca elige en Admin → Marcas cuánto del precio de SUS productos se
// puede pagar con monedas, de una de dos formas (tienda_brands.topeMonedasTipo):
//  - "pct" (o sin decir): un porcentaje del precio (topeMonedasPct, 0-100);
//  - "monedas": una cantidad fija por cada producto (topeMonedasCantidad),
//    nunca más que su precio.
// Sin marca o sin configurar: la mitad, la regla de siempre. Espejo de
// src/utils/topeMonedas.js.
const TOPE_MONEDAS_PCT_POR_DEFECTO = 50;

function pctMonedasDeMarca(marca) {
  const crudo = marca && marca.topeMonedasPct;
  if (crudo === null || crudo === undefined || crudo === "") return TOPE_MONEDAS_PCT_POR_DEFECTO;
  const pct = Number(crudo);
  if (!Number.isFinite(pct)) return TOPE_MONEDAS_PCT_POR_DEFECTO;
  return Math.max(0, Math.min(100, pct));
}

// Monedas por producto de una marca con tope fijo; null si no es un número válido.
function cantidadMonedasDeMarca(marca) {
  const crudo = marca && marca.topeMonedasCantidad;
  if (crudo === null || crudo === undefined || crudo === "") return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

// { tipo: "pct", valor } o { tipo: "monedas", valor }. Con "monedas" pero sin
// una cantidad válida, vale el porcentaje (como si no lo hubiera elegido).
function topeDeMarca(marca) {
  if (marca && marca.topeMonedasTipo === "monedas") {
    const cantidad = cantidadMonedasDeMarca(marca);
    if (cantidad !== null) return { tipo: "monedas", valor: cantidad };
  }
  return { tipo: "pct", valor: pctMonedasDeMarca(marca) };
}

// Las monedas que admite una línea: el % de su importe o la cantidad fija por
// unidad (sin pasar del importe).
function monedasDeLinea(l) {
  const importe = Math.max(0, Number(l && l.importe) || 0);
  const tope = l && l.tope;
  if (tope && tope.tipo === "monedas" && Number.isFinite(Number(tope.valor))) {
    const cantidad = Math.max(1, Number(l.cantidad) || 1);
    return Math.min(importe, Math.max(0, Number(tope.valor)) * cantidad);
  }
  // Un número suelto en `tope` es un %.
  const crudo = typeof tope === "number" ? tope : tope && tope.tipo === "pct" ? tope.valor : l && l.pct;
  const pct = Number.isFinite(Number(crudo)) ? Math.max(0, Math.min(100, Number(crudo))) : TOPE_MONEDAS_PCT_POR_DEFECTO;
  return (importe * pct) / 100;
}

// `lineas`: [{ importe (precio × cantidad), cantidad, tope }] (o { importe,
// pct }). Un número suelto es un subtotal sin marcas (la mitad). Se suma todo
// y se redondea hacia abajo una sola vez; el 1e-9 evita que 22,4999999 (error
// de coma flotante) quede en 22.
function topeMonedasCheckout(lineas) {
  const lista = Array.isArray(lineas)
    ? lineas
    : [{ importe: lineas, pct: TOPE_MONEDAS_PCT_POR_DEFECTO }];
  const suma = lista.reduce((tot, l) => tot + monedasDeLinea(l), 0);
  return Math.floor(suma + 1e-9);
}

// Monedas + cupón juntos no pasan el tope de la marca (2026-11-04): antes el
// cupón se sumaba encima y un pedido de S/ 200 en una marca al 50 % podía
// salir con 70 % de descuento. El cupón va primero (es un premio de una vez;
// las monedas que sobran sirven en otra compra del mes):
//  - un cupón de productos descuenta como mucho el tope; "producto_gratis" es
//    un regalo entero y no se recorta;
//  - el envío gratis no toca el precio de los productos (no cuenta);
//  - las monedas, hasta lo que quede del tope.
function repartoTopeCupon({ topeMonedas, descuentoCupon, tipoCupon, envioGratis }) {
  const tope = Math.max(0, Number(topeMonedas) || 0);
  const crudo = envioGratis ? 0 : Math.max(0, Number(descuentoCupon) || 0);
  const cupon = tipoCupon === "producto_gratis" ? crudo : Math.min(crudo, tope);
  return {
    descuentoCupon: Math.round(cupon * 100) / 100,
    maxMonedas: Math.max(0, Math.floor(tope - cupon + 1e-9)),
  };
}

// Margen para redondeos: cada línea de catálogo puede diferir en ±0,01 del
// precio del servidor (verificarPreciosYStock lo tolera).
const toleranciaCheckout = (unidades) => 0.05 + 0.01 * Math.max(0, Number(unidades) || 0);

module.exports = {
  totalEsperadoCheckout, topeMonedasCheckout, pctMonedasDeMarca, topeDeMarca, TOPE_MONEDAS_PCT_POR_DEFECTO, toleranciaCheckout,
  repartoTopeCupon,
};
