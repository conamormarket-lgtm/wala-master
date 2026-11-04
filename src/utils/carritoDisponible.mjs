/**
 * Qué líneas del carrito ya no se pueden comprar (2026-11-04): el producto se
 * mandó a la papelera, se borró, se ocultó, o una prenda de su combo o de su
 * pack ya no está. Lo mismo que rechazaría el servidor al pagar
 * (functions/cartValidation.js), pero dicho antes, en el carrito.
 *  - productos: Map id → producto | null (null = ya no existe; sin la
 *    clave = todavía no se sabe: no se marca nada)
 */

/** Los ids que hay que leer para revisar estas líneas. */
export function idsParaRevisar(items = []) {
  const ids = new Set();
  for (const item of items) {
    if (item?.productId) ids.add(String(item.productId));
    const custom = item?.customization;
    if (custom?.tipo === 'comboCrear') (custom.piezas || []).forEach((p) => p?.prendaId && ids.add(String(p.prendaId)));
    if (item?.isComboProduct) (item.comboItems || []).forEach((it) => it?.productId && ids.add(String(it.productId)));
  }
  return [...ids];
}

const fuera = (p) => p === null || p?.deleted === true;

/** '' si se puede comprar; si no, por qué (para mostrarlo en la línea). */
export function motivoNoDisponible(item = {}, productos = new Map()) {
  const id = String(item.productId || '');
  if (!id || !productos.has(id)) return '';
  const p = productos.get(id);
  const custom = item.customization;
  if (custom?.tipo === 'comboCrear') {
    // Un pack de Crear se ve por comboCrear.publicado, no por visible.
    if (fuera(p) || p?.comboCrear?.publicado === false) return 'Este pack ya no se vende.';
    const prendas = (custom.piezas || []).map((x) => x?.prendaId).filter(Boolean).map(String);
    if (prendas.some((pid) => productos.has(pid) && (fuera(productos.get(pid)) || productos.get(pid)?.visible === false))) {
      return 'Una de las prendas de este pack ya no se vende.';
    }
    return '';
  }
  if (fuera(p) || p?.visible === false) return 'Ya no está disponible.';
  if (item.isComboProduct) {
    // Las piezas de un combo pueden estar ocultas (suelen estarlo): solo cuenta si ya no están.
    const piezas = (item.comboItems || []).map((it) => it?.productId).filter(Boolean).map(String);
    if (piezas.some((pid) => productos.has(pid) && fuera(productos.get(pid)))) return 'Una de las prendas de este combo ya no se vende.';
  }
  return '';
}
