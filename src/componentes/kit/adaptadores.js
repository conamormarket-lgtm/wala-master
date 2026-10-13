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

const DIAS_NUEVO = 30;

/** Fecha de creación en ms (Timestamp de Firestore, texto ISO o número). */
const msDe = (f) => {
  if (!f) return 0;
  if (typeof f.toMillis === 'function') return f.toMillis();
  if (typeof f.seconds === 'number') return f.seconds * 1000;
  const n = typeof f === 'number' ? f : Date.parse(f);
  return Number.isFinite(n) ? n : 0;
};

/** Creado hace menos de 30 días (misma regla que PremiumProductCard). */
export const esNuevo = (p, ahora = Date.now()) => {
  const ms = msDe(p?.createdAt) || Number(p?.createdAtMs) || 0;
  return ms > 0 && ahora - ms < DIAS_NUEVO * 86400000;
};

/**
 * Props de <TarjetaProducto> desde un producto.
 *  - imagen: miniatura ya elegida por la tienda (useProductThumbnailVariant)
 *  - catalogo: { marcas, categorias, marcaActual } para el sello de la marca
 *    y el nombre de la categoría. marcaActual = id de la marca de la página
 *    (dentro de una marca no se repite su logo en cada tarjeta).
 */
export function tarjetaDesdeProducto(p, { imagen, catalogo = {} } = {}) {
  const vs = variantesDe(p);
  const { marcas = [], categorias = [], marcaActual = null } = catalogo;
  const m = !marcaActual && p.brandId ? marcas.find((x) => x.id === p.brandId) : null;
  const cat = (p.categories || []).map((id) => categorias.find((c) => (c.categoryId || c.id) === id)).find(Boolean);
  const principal = vs.find((v) => String(v.id) === String(p.defaultVariantId)) || vs[0];
  const fotos = [principal?.imageUrl, ...(principal?.images || []), p.mainImage, ...(p.images || [])].filter(Boolean);
  return {
    url: p.esPrendaBase ? `/crear/${p.id}` : `/producto/${p.id}`,
    imagen: imagen || fotos[0],
    imagenHover: fotos.find((f) => f !== (imagen || fotos[0])),
    nombre: p.name,
    categoria: cat?.name,
    precio: p.salePrice || p.price,
    precioAntes: p.salePrice ? p.price : undefined,
    personalizable: Boolean(p.customizable),
    agotado: !p.inStock,
    stock: typeof p.inStock === 'number' ? p.inStock : undefined,
    nuevo: esNuevo(p),
    marca: m?.logoUrl ? { nombre: m.name, logo: m.logoUrl } : undefined,
    piezas: p.isComboProduct ? (p.comboItems || []).map((it) => ({ nombre: it.name, imagen: it.imageUrl })) : [],
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
    // Los productos guardados antes de que products.js conservara sizeLabel
    // no lo tienen: dicen "Talla" hasta que se vuelvan a guardar.
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
  // bgColor viene en #ffffff en casi todas las marcas (valor por defecto del
  // admin): blanco o casi blanco no sirve de fondo de tarjeta → paleta.
  const color = /^#?(f{3}|f{6}|fefefe|fafafa)$/i.test(String(m.bgColor || '').trim()) ? '' : m.bgColor || '';
  return {
    id: m.id || ruta,
    nombre: m.name,
    logo: m.logoUrl || m.imageUrl || '',
    url: `/${ruta}`,
    color,
    fondo: m.bgImage || '',
  };
}
