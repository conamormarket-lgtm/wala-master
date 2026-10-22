/*
 * Las fotos de un producto con colores: cada color (variante) tiene las suyas
 * (imageUrl, images, galleryImages y las de sus vistas de personalización).
 * Las "generales" del producto (mainImage, images) se guardan con la foto del
 * primer color al frente, así que sumarlas tal cual a otro color mostraba,
 * por ejemplo, la billetera azul en la marrón (en la ficha, en la tarjeta del
 * catálogo y en las fotos de referencia del pedido).
 */

const normal = (n) => String(n ?? '').trim().toLowerCase();

/** Todas las fotos de un color: las de la variante y las de sus vistas. */
const fotosDeVariante = (product, variante) => {
  if (!variante) return [];
  const color = normal(variante.name);
  const vistas = (product?.customizationViews || []).flatMap((vista) => {
    const de = (mapa) => Object.entries(mapa || {}).filter(([k]) => normal(k) === color).map(([, u]) => u);
    return [...de(vista.imagesByColor), ...(vista.hasBackSide ? de(vista.backSide?.imagesByColor) : [])];
  });
  return [variante.imageUrl, ...(variante.images || []), ...(variante.galleryImages || []), ...vistas].filter(Boolean);
};

/**
 * Las fotos generales del producto que sirven para este color: las que no
 * son de OTRO color. Sin variante (o con una sola), todas.
 */
export const fotosGenerales = (product, variante) => {
  const generales = [product?.mainImage, ...(product?.images || [])].filter(Boolean);
  const otras = (product?.variants || []).filter((v) => v && v !== variante && String(v.id) !== String(variante?.id));
  if (!variante || otras.length === 0) return generales;
  const propias = new Set(fotosDeVariante(product, variante));
  const ajenas = new Set(otras.flatMap((v) => fotosDeVariante(product, v)).filter((u) => !propias.has(u)));
  return generales.filter((u) => !ajenas.has(u));
};
