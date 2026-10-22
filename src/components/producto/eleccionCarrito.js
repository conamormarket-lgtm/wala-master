import { isComboProduct } from '../../utils/comboProductUtils';

/*
 * Lo que se eligió en el kit (la ficha, "Agregar rápido") → lo que espera
 * CartContext.addToCart, igual que lo armaba ProductDetail:
 *   addToCart(product, { size, selectedVariant }, null, cantidad,
 *     combo ? { variantSelections, customizations: {}, subProductsData } : null)
 * eleccion = { variante, opcion, piezas: { [i]: color }, tallas: { [i]: talla },
 * cantidad } (la de PaginaProducto y AgregarRapido).
 */

const normal = (n) => String(n ?? '').trim().toLowerCase();

/**
 * Una prenda del combo: los colores que el combo permite, si tiene colores,
 * la variante del color elegido (o la primera) y sus tallas. Es
 * getComboVariantInfo de ProductDetail.
 */
export const infoDePieza = (sub, cfg, color) => {
  const permitidos = cfg?.variantMapping?.allowedColors?.map(normal) || [];
  const todas = Array.isArray(sub?.variants) ? sub.variants : [];
  const vars = permitidos.length ? todas.filter((v) => permitidos.includes(normal(v.name))) : todas;
  const conColores = Boolean(sub?.hasVariants && vars.length > 0);
  const elegida = conColores ? (vars.find((v) => v.name === color) || vars[0]) : null;
  return { vars, conColores, elegida };
};

/** La variante del producto que corresponde a la del kit (por id; sin id, por nombre). */
export const varianteDelProducto = (product, variante) => {
  if (!product?.hasVariants || !variante) return undefined;
  return (product.variants || []).find((v) => (variante.id != null ? String(v.id) === String(variante.id) : v.name === variante.nombre));
};

/**
 * → { variant, cantidad, combo } para addToCart.
 *  - comboProd: { [índice]: producto } de las prendas del combo
 * En un combo, cada prenda lleva su color (el elegido; sin tocarlo, el
 * primero: ese es el que se ve) y su talla (`tallas[i]`; sin ella, la
 * `opcion` compartida de antes).
 */
export function argumentosDelCarrito(product, eleccion = {}, comboProd = {}) {
  const { variante, opcion, piezas = {}, tallas = {}, cantidad = 1 } = eleccion;
  const combo = isComboProduct(product);
  const variant = { size: combo ? '' : (opcion || ''), selectedVariant: combo ? undefined : varianteDelProducto(product, variante) };
  if (!combo) return { variant, cantidad, combo: null };
  const variantSelections = {};
  (product.comboItems || []).forEach((cfg, i) => {
    const { elegida } = infoDePieza(comboProd[i], cfg, piezas[i]);
    const color = elegida?.name || piezas[i] || cfg.variantMapping?.color;
    variantSelections[i] = { ...(color && { color }), size: tallas[i] || opcion || '' };
  });
  return { variant, cantidad, combo: { variantSelections, customizations: {}, subProductsData: comboProd } };
}

/** La ruta del editor con lo elegido (la de handlePersonalize de ProductDetail). */
export function rutaDelEditor(product, eleccion = {}, comboProd = {}) {
  const { variant, combo } = argumentosDelCarrito(product, eleccion, comboProd);
  const p = new URLSearchParams();
  if (eleccion.opcion) p.set('size', eleccion.opcion);
  if (variant.selectedVariant?.name) p.set('color', variant.selectedVariant.name);
  if (combo && product?.comboItems?.length) p.set('comboSelections', JSON.stringify(combo.variantSelections));
  return `/editor/${product.id}${p.toString() ? `?${p}` : ''}`;
}
