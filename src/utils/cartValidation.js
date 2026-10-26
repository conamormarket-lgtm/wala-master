import { getCachedProducts } from '../services/products';
import { faltaPersonalizacionYoryo } from './yoryoPersonalizacion.mjs';

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
 * El catálogo de la caché como Map productId → producto. getCachedProducts
 * parsea todo el JSON de localStorage en cada llamada: quien revisa varias
 * líneas lo lee UNA vez con esto y se lo pasa a las funciones de abajo.
 */
export const catalogoPorId = () => {
  const catalogo = getCachedProducts();
  return new Map(Array.isArray(catalogo) ? catalogo.map((p) => [p.id, p]) : []);
};

const productoDe = (item, porId) => {
  if (porId) return porId.get(item?.productId) || null;
  const lista = getCachedProducts();
  return Array.isArray(lista) ? lista.find((p) => p.id === item?.productId) || null : null;
};

/**
 * @param {Array} items artículos del carrito
 * @param {Map} [porId] el catálogo ya leído (catalogoPorId); sin él, se lee aquí
 * @returns {Set<string>} ids de los artículos incompletos
 */
export const idsDeItemsIncompletos = (items = [], porId = catalogoPorId()) => {
  const incompletos = new Set();
  if (!Array.isArray(items) || items.length === 0) return incompletos;
  items.forEach((item) => { if (faltaPersonalizacionYoryo(item)) incompletos.add(item.id); });
  if (!porId || porId.size === 0) return incompletos;

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

/**
 * ¿Vale la pena mostrar el "color" de este artículo? Todo producto guarda al
 * menos una variante, aunque no sea ropa: un sérum queda con "Color:
 * Principal". Si el producto tiene una sola variante y el artículo no lleva
 * talla, no hay nada que decir. Sin el producto en caché se muestra (lo seguro).
 */
export const muestraColor = (item, porId) => {
  if (item?.variant?.size) return true;
  const product = productoDe(item, porId);
  if (!product) return true;
  return (product.variants?.length || 0) > 1;
};

/**
 * Qué le falta a un artículo, para poder decírselo al cliente.
 *
 * Se contrasta con el producto real, igual que idsDeItemsIncompletos: antes
 * esta función solo miraba la línea del carrito, así que a un reloj o una
 * billetera —que no tienen tallas— les decía "Falta elegir color y talla".
 * Si el producto no está en la caché se nombran ambos, que es lo que hacía
 * hasta ahora y es el lado seguro.
 */
export const queLeFalta = (item, porId) => {
  const product = productoDe(item, porId);

  const pideColor = product ? Boolean(product.hasVariants && product.variants?.length > 0) : true;
  const pideTalla = product ? tallasDe(product).length > 0 : true;

  const falta = [];
  if (pideColor && !nombreColor(item)) falta.push('color');
  if (pideTalla && !item?.variant?.size) falta.push('talla');
  return falta;
};
