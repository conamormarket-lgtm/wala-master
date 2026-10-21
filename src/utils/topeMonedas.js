/**
 * Tope de monedas por marca: espejo de functions/checkoutTotals.js
 * (pctMonedasDeMarca y topeMonedasCheckout). Si cambias algo aquí, cambia el
 * espejo: el servidor rechaza el pago si el checkout deja usar más.
 *
 * Cada marca elige en Admin → Marcas qué parte del precio de SUS productos se
 * puede pagar con monedas (tienda_brands.topeMonedasPct, 0-100). Sin marca o
 * sin configurar: la mitad, la regla de siempre.
 */
export const TOPE_MONEDAS_PCT_POR_DEFECTO = 50;

export function pctMonedasDeMarca(marca) {
  const crudo = marca && marca.topeMonedasPct;
  if (crudo === null || crudo === undefined || crudo === '') return TOPE_MONEDAS_PCT_POR_DEFECTO;
  const pct = Number(crudo);
  if (!Number.isFinite(pct)) return TOPE_MONEDAS_PCT_POR_DEFECTO;
  return Math.max(0, Math.min(100, pct));
}

/** % de un producto según su brandId y la lista de marcas ya leída. */
export const pctMonedasDeProducto = (brandId, marcas = []) =>
  pctMonedasDeMarca(brandId ? (marcas || []).find((m) => m.id === brandId) : null);

/**
 * `lineas`: [{ importe (precio × cantidad), pct }]. Se suma todo y se redondea
 * hacia abajo una sola vez (el 1e-9, por los errores de coma flotante).
 */
export function topeMonedasCheckout(lineas = []) {
  const suma = lineas.reduce((tot, l) => {
    const importe = Math.max(0, Number(l?.importe) || 0);
    const pct = Number.isFinite(Number(l?.pct)) ? Math.max(0, Math.min(100, Number(l.pct))) : TOPE_MONEDAS_PCT_POR_DEFECTO;
    return tot + (importe * pct) / 100;
  }, 0);
  return Math.floor(suma + 1e-9);
}
