/**
 * Tope de monedas por marca: espejo de functions/checkoutTotals.js
 * (pctMonedasDeMarca, topeDeMarca y topeMonedasCheckout). Si cambias algo
 * aquí, cambia el espejo: el servidor rechaza el pago si el checkout deja usar
 * más.
 *
 * Cada marca elige en Admin → Marcas cuánto del precio de SUS productos se
 * puede pagar con monedas, de una de dos formas (tienda_brands.topeMonedasTipo):
 *  - 'pct' (o sin decir): un porcentaje del precio (topeMonedasPct, 0-100);
 *  - 'monedas': una cantidad fija por cada producto (topeMonedasCantidad),
 *    nunca más que su precio.
 * Sin marca o sin configurar: la mitad, la regla de siempre.
 */
export const TOPE_MONEDAS_PCT_POR_DEFECTO = 50;

export function pctMonedasDeMarca(marca) {
  const crudo = marca && marca.topeMonedasPct;
  if (crudo === null || crudo === undefined || crudo === '') return TOPE_MONEDAS_PCT_POR_DEFECTO;
  const pct = Number(crudo);
  if (!Number.isFinite(pct)) return TOPE_MONEDAS_PCT_POR_DEFECTO;
  return Math.max(0, Math.min(100, pct));
}

/** Monedas por producto de una marca con tope fijo; null si no es un número válido. */
export function cantidadMonedasDeMarca(marca) {
  const crudo = marca && marca.topeMonedasCantidad;
  if (crudo === null || crudo === undefined || crudo === '') return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

/**
 * { tipo: 'pct', valor } o { tipo: 'monedas', valor }. Con 'monedas' pero sin
 * una cantidad válida, vale el porcentaje (como si no lo hubiera elegido).
 */
export function topeDeMarca(marca) {
  if (marca && marca.topeMonedasTipo === 'monedas') {
    const cantidad = cantidadMonedasDeMarca(marca);
    if (cantidad !== null) return { tipo: 'monedas', valor: cantidad };
  }
  return { tipo: 'pct', valor: pctMonedasDeMarca(marca) };
}

const marcaDe = (brandId, marcas = []) => (brandId ? (marcas || []).find((m) => m.id === brandId) : null);

/** % de un producto según su brandId y la lista de marcas ya leída (sin el tope fijo: ver topeDeProducto). */
export const pctMonedasDeProducto = (brandId, marcas = []) => pctMonedasDeMarca(marcaDe(brandId, marcas));

/** El tope de un producto según su brandId y la lista de marcas ya leída. */
export const topeDeProducto = (brandId, marcas = []) => topeDeMarca(marcaDe(brandId, marcas));

/** Las monedas que admite una línea: el % de su importe o la cantidad fija por unidad (sin pasar del importe). */
function monedasDeLinea(l) {
  const importe = Math.max(0, Number(l?.importe) || 0);
  const tope = l?.tope;
  if (tope && tope.tipo === 'monedas' && Number.isFinite(Number(tope.valor))) {
    const cantidad = Math.max(1, Number(l?.cantidad) || 1);
    return Math.min(importe, Math.max(0, Number(tope.valor)) * cantidad);
  }
  // Un número suelto en `tope` es un % (como lo pasaban antes las líneas del checkout).
  const crudo = typeof tope === 'number' ? tope : tope && tope.tipo === 'pct' ? tope.valor : l?.pct;
  const pct = Number.isFinite(Number(crudo)) ? Math.max(0, Math.min(100, Number(crudo))) : TOPE_MONEDAS_PCT_POR_DEFECTO;
  return (importe * pct) / 100;
}

/**
 * `lineas`: [{ importe (precio × cantidad), cantidad, tope }] (o, como antes,
 * { importe, pct }). Se suma todo y se redondea hacia abajo una sola vez (el
 * 1e-9, por los errores de coma flotante).
 */
export function topeMonedasCheckout(lineas = []) {
  const suma = lineas.reduce((tot, l) => tot + monedasDeLinea(l), 0);
  return Math.floor(suma + 1e-9);
}
