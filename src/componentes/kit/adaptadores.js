/*
 * Adaptadores: producto de la tienda (colección productos_wala, ver
 * normalizeProductForRead en src/services/products.js) → props del kit.
 *
 * El kit no lee Firestore; estas funciones solo traducen nombres de campos
 * para usar <TarjetaProducto> y <AgregarRapido> con productos reales.
 */

const variantesDe = (p) => (p?.hasVariants ? p.variants || [] : []);

/**
 * Qué hace el botón de la tarjeta. Misma regla que productNeedsVariantSelection
 * (src/utils/comboProductUtils.js) más las prendas base del estudio Crear.
 *  - 'crear':   esPrendaBase → se diseña en /crear/:id
 *  - 'elegir':  combo, más de una variante, variantes con opciones o mainSizes
 *  - 'agregar': sin opciones (taza, llavero, producto con una sola variante)
 */
export function accionDeProducto(p) {
  if (p?.esPrendaBase) return 'crear';
  if (p?.isComboProduct && p.comboItems?.length) return 'elegir';
  const vs = variantesDe(p);
  if (vs.length > 1 || vs.some((v) => v.sizes?.length) || p?.mainSizes?.length) return 'elegir';
  return 'agregar';
}

/** Props de <TarjetaProducto> desde un producto. */
export function tarjetaDesdeProducto(p, { imagen } = {}) {
  const vs = variantesDe(p);
  return {
    url: p.esPrendaBase ? `/crear/${p.id}` : `/producto/${p.id}`,
    imagen: imagen || p.mainImage || p.images?.[0],
    nombre: p.name,
    precio: p.salePrice || p.price,
    precioAntes: p.salePrice ? p.price : undefined,
    personalizable: Boolean(p.customizable),
    agotado: !p.inStock,
    // Con una sola variante (la "Principal" que crea el admin por defecto) no
    // hay colores que mostrar.
    colores: vs.length > 1 ? vs.filter((v) => v.colorHex).map((v) => v.colorHex) : [],
    accion: accionDeProducto(p),
  };
}

/**
 * Props de <AgregarRapido> desde un producto.
 *  - subproductos: { [productId]: producto } de las piezas de un combo
 *    (la tienda ya los carga en ProductDetail para mostrar sus colores).
 */
export function opcionesDeProducto(p, { subproductos = {} } = {}) {
  const vs = variantesDe(p);
  const piezas = p?.isComboProduct
    ? (p.comboItems || []).map((it) => ({
      nombre: it.name,
      colores: variantesDe(subproductos[it.productId])
        .filter((v) => !it.variantMapping?.allowedColors || it.variantMapping.allowedColors.includes(v.name))
        .map((v) => ({ nombre: v.name, hex: v.colorHex || '#cccccc' })),
    }))
    : [];
  // Combos: talla compartida = las que tienen todas las piezas (o todas, si no coinciden).
  let opcionesCombo = [];
  if (piezas.length) {
    const listas = (p.comboItems || []).map((it) => [...new Set(variantesDe(subproductos[it.productId]).flatMap((v) => v.sizes || []))]);
    const comunes = listas.reduce((a, l) => a.filter((x) => l.includes(x)), listas[0] || []);
    opcionesCombo = comunes.length ? comunes : [...new Set(listas.flat())];
  }
  return {
    producto: { nombre: p.name, imagen: p.mainImage || p.images?.[0], precio: p.salePrice || p.price, precioAntes: p.salePrice ? p.price : undefined },
    variantes: piezas.length ? [] : vs.map((v) => ({ id: v.id, nombre: v.name, colorHex: v.colorHex, imagen: v.imageUrl, opciones: v.sizes || [] })),
    opciones: piezas.length ? opcionesCombo : p.mainSizes || [],
    // Ojo: hoy products.js no guarda sizeLabel al normalizar la variante, así
    // que llega vacío y se usa "Talla". Cuando se guarde, aparecerá solo.
    etiquetaOpcion: vs.find((v) => v.sizeLabel)?.sizeLabel || 'Talla',
    piezas,
    personalizable: Boolean(p.customizable),
  };
}

/*
 * Marcas (colección tienda_brands, la misma consulta getBrands() que ya usan
 * el Header y el mosaico "Explora nuestros mundos") → tarjeta del kit.
 */

/** Ruta de la landing de una marca: su `slug` o el nombre sin tildes ni espacios. */
export function rutaDeMarca(m) {
  if (m?.slug) return String(m.slug).replace(/^\/+|\/+$/g, '');
  return String(m?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Props de una tarjeta de marca; null si la marca está oculta o no tiene ruta. */
export function tarjetaDesdeMarca(m) {
  const ruta = rutaDeMarca(m);
  if (!m?.name || !ruta || m.active === false || m.visible === false) return null;
  return {
    id: m.id || ruta,
    nombre: m.name,
    logo: m.logoUrl || m.imageUrl || '',
    url: `/${ruta}`,
    color: m.bgColor || '',
    fondo: m.bgImage || '',
  };
}
