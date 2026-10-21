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
// Cada marca elige en Admin → Marcas qué parte del precio de SUS productos se
// puede pagar con monedas (tienda_brands.topeMonedasPct, 0-100). Sin marca o
// sin configurar: la mitad, la regla de siempre. Espejo de src/utils/topeMonedas.js.
const TOPE_MONEDAS_PCT_POR_DEFECTO = 50;

function pctMonedasDeMarca(marca) {
  const crudo = marca && marca.topeMonedasPct;
  if (crudo === null || crudo === undefined || crudo === "") return TOPE_MONEDAS_PCT_POR_DEFECTO;
  const pct = Number(crudo);
  if (!Number.isFinite(pct)) return TOPE_MONEDAS_PCT_POR_DEFECTO;
  return Math.max(0, Math.min(100, pct));
}

// `lineas`: [{ importe (precio × cantidad), pct }]. Un número suelto es un
// subtotal sin marcas (la mitad). Se suma todo y se redondea hacia abajo una
// sola vez; el 1e-9 evita que 22,4999999 (error de coma flotante) quede en 22.
function topeMonedasCheckout(lineas) {
  const lista = Array.isArray(lineas)
    ? lineas
    : [{ importe: lineas, pct: TOPE_MONEDAS_PCT_POR_DEFECTO }];
  const suma = lista.reduce((tot, l) => {
    const importe = Math.max(0, Number(l && l.importe) || 0);
    const pct = l && Number.isFinite(Number(l.pct)) ? Math.max(0, Math.min(100, Number(l.pct))) : TOPE_MONEDAS_PCT_POR_DEFECTO;
    return tot + (importe * pct) / 100;
  }, 0);
  return Math.floor(suma + 1e-9);
}

// Margen para redondeos: cada línea de catálogo puede diferir en ±0,01 del
// precio del servidor (verificarPreciosYStock lo tolera).
const toleranciaCheckout = (unidades) => 0.05 + 0.01 * Math.max(0, Number(unidades) || 0);

module.exports = {
  totalEsperadoCheckout, topeMonedasCheckout, pctMonedasDeMarca, TOPE_MONEDAS_PCT_POR_DEFECTO, toleranciaCheckout,
};
