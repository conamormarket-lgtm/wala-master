import { getCachedProducts } from '../services/products';

/**
 * Detecta artículos del carrito a los que les falta el color o la talla.
 *
 * POR QUÉ EXISTE
 *   El botón rápido de la tarjeta llamaba a addToCart con la variante vacía, así
 *   que metía la línea SIN color y SIN talla. Ese origen ya está arreglado, pero
 *   las líneas creadas antes siguen guardadas en los carritos de los clientes
 *   (localStorage / Firestore) y el checkout las acepta: escribe talla:'' en el
 *   pedido, que llega sin saber qué despachar.
 *
 * CÓMO DECIDE
 *   Que falte el color o la talla NO basta: hay productos que no tienen nada que
 *   elegir y ahí es correcto. Por eso se compara contra el producto real. El
 *   catálogo se lee de la caché local (getCachedProducts), que es síncrona y ya
 *   la puebla la tienda; si el producto no está, se FALLA EN ABIERTO (no se
 *   marca), porque bloquear una compra por un dato que no tenemos es peor que
 *   dejar pasar un caso raro.
 *
 *   Se ignoran los combos (su selección vive en comboVariantSelections) y los
 *   productos personalizados en el editor, que llevan su propio flujo.
 */

const nombreColor = (item) =>
  item?.variant?.selectedVariant?.name || item?.variant?.color || '';

/** Tallas que ofrece un producto, mire donde mire (variantes o tallas sueltas). */
const tallasDe = (product) => {
  if (!product) return [];
  const deVariantes = Array.isArray(product.variants)
    ? product.variants.flatMap((v) => (Array.isArray(v.sizes) ? v.sizes : []))
    : [];
  const sueltas = Array.isArray(product.mainSizes) ? product.mainSizes : [];
  return [...deVariantes, ...sueltas].filter(Boolean);
};

/**
 * @param {Array} items artículos del carrito
 * @returns {Set<string>} ids de los artículos incompletos
 */
export const idsDeItemsIncompletos = (items = []) => {
  const incompletos = new Set();
  if (!Array.isArray(items) || items.length === 0) return incompletos;

  // Una sola lectura de la caché para todo el carrito.
  const catalogo = getCachedProducts();
  if (!Array.isArray(catalogo) || catalogo.length === 0) return incompletos;
  const porId = new Map(catalogo.map((p) => [p.id, p]));

  for (const item of items) {
    if (!item || item.isComboProduct || item.customization) continue;

    const tieneColor = Boolean(nombreColor(item));
    const tieneTalla = Boolean(item.variant?.size);
    if (tieneColor && tieneTalla) continue;

    const product = porId.get(item.productId);
    if (!product) continue; // sin dato fiable no se marca

    const pideColor = Boolean(product.hasVariants && product.variants?.length > 0);
    const pideTalla = tallasDe(product).length > 0;

    if ((pideColor && !tieneColor) || (pideTalla && !tieneTalla)) {
      incompletos.add(item.id);
    }
  }
  return incompletos;
};

/** Qué le falta a un artículo, para poder decírselo al cliente. */
export const queLeFalta = (item) => {
  const falta = [];
  if (!nombreColor(item)) falta.push('color');
  if (!item?.variant?.size) falta.push('talla');
  return falta;
};
