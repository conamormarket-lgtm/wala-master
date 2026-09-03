import { getCollection, getDocument, createDocument, updateDocument, deleteDocument, setDocument } from './firebase/firestore';

const COLLECTION = 'tienda_brands';

/**
 * Genera el "slug canónico" de la marca a partir de un texto (normalmente el name):
 * minúsculas, sin acentos, sin espacios ni símbolos (solo a-z0-9).
 * Ej: 'Con Amor' → 'conamor', 'MUEBLERÍA' → 'muebleria'.
 * Debe quedar consistente con el slugify() del Header para que la detección de
 * página de marca coincida con lo que aquí se persiste.
 */
const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos, tildes, diéresis)
    .replace(/[^a-z0-9]+/g, '');     // quita espacios, guiones y cualquier símbolo

/**
 * Obtener todas las marcas ordenadas por order
 */
export const getBrands = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

/**
 * Obtener una marca por ID
 */
export const getBrand = async (id) => {
  return await getDocument(COLLECTION, id);
};

/**
 * Normaliza el array `categoryNav` de una marca.
 * Cada item es una "burbuja" con foto + label: { categoryId, name, imageUrl, order }.
 * - categoryId puede referenciar una categoría de tienda_categories o ser libre.
 * - Se descartan items no válidos y se garantiza el tipo de cada campo.
 */
const normalizeCategoryNav = (categoryNav) => {
  if (!Array.isArray(categoryNav)) return [];
  return categoryNav
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => ({
      categoryId: item.categoryId || '',
      name: item.name || '',
      imageUrl: item.imageUrl || '',
      order: typeof item.order === 'number' ? item.order : idx
    }));
};

/**
 * Normaliza el objeto `categoryNavStyle` de una marca (estilo del nav de categorías).
 * Controla cómo se PINTAN las burbujas en el storefront (sincronizado en todos lados):
 *  - align: alineación del contenedor → 'left' | 'center' | 'right' | 'justify'.
 *  - animation: modo de presentación → 'static' (fila/wrap, como hoy) | 'slider' (auto-scroll).
 * Default retrocompatible = { align: 'center', animation: 'static' } (= comportamiento actual).
 * Cualquier valor no válido cae al default.
 */
const VALID_ALIGN = ['left', 'center', 'right', 'justify'];
const VALID_ANIMATION = ['static', 'slider'];

const normalizeCategoryNavStyle = (style) => {
  const src = style && typeof style === 'object' ? style : {};
  return {
    align: VALID_ALIGN.includes(src.align) ? src.align : 'center',
    animation: VALID_ANIMATION.includes(src.animation) ? src.animation : 'static'
  };
};

/**
 * Secciones por defecto de la PÁGINA de una marca: un encabezado con el nombre
 * de la marca + el catálogo (sidebar_catalog) filtrado a su brandId. Es lo mínimo
 * para que WALA.PE/<slug> muestre solo los productos de esa marca.
 */
const buildBrandCatalogSections = (brandId, name) => ([
  {
    id: 'sec_header',
    type: 'header',
    order: 0,
    settings: {
      title: name || 'Nuestra Tienda',
      subtitle: name ? `Productos de ${name}` : 'Explora nuestros productos.',
      backgroundColor: 'transparent',
      titleColor: '#000000',
      subtitleColor: '#666666',
      textAlign: 'center',
      paddingTop: '3rem',
      paddingBottom: '2rem',
      titleAlign: '', titleUnderline: false, titleBg: '', titleLink: ''
    }
  },
  {
    id: 'sec_catalog',
    type: 'sidebar_catalog',
    order: 1,
    settings: {
      title: name ? `Productos ${name}` : 'Catálogo',
      brandId,
      backgroundColor: 'transparent',
      paddingTop: '2rem',
      paddingBottom: '2rem',
      titleAlign: '', titleUnderline: false, titleBg: '', titleLink: '', buttonText: '', buttonLink: ''
    }
  }
]);

/**
 * Garantiza que exista la PÁGINA DE MARCA (landing + layout) para que
 * WALA.PE/<slug> muestre solo los productos de esa marca. Idempotente:
 *  - landingPages/{slug}: crea/actualiza { slug, brandId } (conecta URL ↔ marca).
 *  - pages/{slug}: crea el layout con el catálogo SOLO si aún no existe uno
 *    (así no pisa una página ya editada a mano en el Editor Visual).
 * No lanza: ante un error solo lo registra (crear la marca no debe fallar por esto).
 */
export const ensureBrandLanding = async (brandId, slug, name) => {
  try {
    if (!brandId || !slug) return { error: 'brandId y slug son requeridos' };
    // 1) Landing: el eslabón que resuelve /<slug> → marca (vía DynamicLandingPage).
    await setDocument('landingPages', slug, { slug, brandId, title: name || slug });
    // 2) Layout de la página. Solo si no hay secciones previas (no pisar ediciones).
    const existing = await getDocument('pages', slug);
    const hasSections = Array.isArray(existing?.data?.sections) && existing.data.sections.length > 0;
    if (!hasSections) {
      await setDocument('pages', slug, { sections: buildBrandCatalogSections(brandId, name) });
    }
    return { error: null };
  } catch (error) {
    console.warn('[brands] ensureBrandLanding:', error?.message || error);
    return { error: error?.message || String(error) };
  }
};

/**
 * Backfill: garantiza la página de marca (landing + catálogo) para TODAS las
 * marcas existentes que aún no la tengan. Pensado para un botón en el admin
 * (usa la sesión del administrador; no requiere Cloud Shell ni credenciales).
 * Idempotente: las marcas que ya tienen landing simplemente se re-aseguran.
 * @returns {{ total:number, procesadas:number, sinSlug:number, error:(string|null) }}
 */
export const ensureAllBrandLandings = async () => {
  const { data: brands, error } = await getBrands();
  if (error) return { total: 0, procesadas: 0, sinSlug: 0, error };
  let procesadas = 0;
  let sinSlug = 0;
  for (const b of (brands || [])) {
    const slug = b.slug ? slugify(b.slug) : slugify(b.name);
    if (!slug) { sinSlug++; continue; }
    await ensureBrandLanding(b.id, slug, b.name || '');
    procesadas++;
  }
  return { total: (brands || []).length, procesadas, sinSlug, error: null };
};

/**
 * Crear marca (Firestore genera ID)
 * @param {{ name: string, slug?: string, logoUrl?: string, order: number, bgColor?: string, bgImage?: string, bgOpacity?: number, categoryNav?: Array, categoryNavStyle?: { align?: string, animation?: string }, storeTitle?: string, storeSubtitle?: string, storeEmpty?: string }} data
 */
export const createBrand = async (data) => {
  // Slug de primera clase: si viene explícito se respeta (normalizado); si no, se
  // deriva del name. createBrand SIEMPRE deja un slug para que la marca sea
  // detectable como página /<slug> desde el Header.
  const slug = slugify(data.slug) || slugify(data.name);
  const result = await createDocument(COLLECTION, {
    name: data.name || '',
    slug,
    logoUrl: data.logoUrl || '',
    order: typeof data.order === 'number' ? data.order : 0,
    bgColor: data.bgColor || '#ffffff',
    bgImage: data.bgImage || '',
    bgOpacity: typeof data.bgOpacity === 'number' ? data.bgOpacity : 100,
    whatsappNumber: data.whatsappNumber || '',
    // Nav de categorías por marca (burbujas con miniatura). Vacío por defecto.
    categoryNav: normalizeCategoryNav(data.categoryNav),
    // Estilo del nav de categorías (alineación + modo estático/slider). Default centrado/estático.
    categoryNavStyle: normalizeCategoryNavStyle(data.categoryNavStyle),
    // Mensajes de tienda propios de la marca (opcionales). Vacío = usa el global
    // (ver TiendaPage: storeTitle/storeSubtitle/storeEmpty con fallback al mensaje
    // global de la colección 'messages').
    storeTitle: data.storeTitle || '',
    storeSubtitle: data.storeSubtitle || '',
    storeEmpty: data.storeEmpty || ''
  });

  // Auto-crear su página de marca (landing + catálogo) para que WALA.PE/<slug>
  // funcione sin pasos manuales. Si falla, la marca igual queda creada.
  if (result?.id && slug) {
    await ensureBrandLanding(result.id, slug, data.name || '');
  }

  return result;
};

/**
 * Actualizar marca
 * @param {string} id
 * @param {{ name?: string, slug?: string, logoUrl?: string, order?: number, bgColor?: string, bgImage?: string, bgOpacity?: number, categoryNav?: Array, categoryNavStyle?: { align?: string, animation?: string }, storeTitle?: string, storeSubtitle?: string, storeEmpty?: string }} data
 */
export const updateBrand = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  // Slug: se persiste si se pasa explícito (normalizado, derivado del name si queda
  // vacío) o si NO se pasa pero sí viene el name (para rellenar marcas que aún no
  // tienen slug). Si no llega ni slug ni name, no se toca (aditivo/retrocompatible).
  if (data.slug !== undefined) {
    payload.slug = slugify(data.slug) || slugify(data.name);
  } else if (data.name !== undefined) {
    payload.slug = slugify(data.name);
  }
  if (data.logoUrl !== undefined) payload.logoUrl = data.logoUrl;
  if (data.order !== undefined) payload.order = data.order;
  if (data.bgColor !== undefined) payload.bgColor = data.bgColor;
  if (data.bgImage !== undefined) payload.bgImage = data.bgImage;
  if (data.bgOpacity !== undefined) payload.bgOpacity = data.bgOpacity;
  if (data.whatsappNumber !== undefined) payload.whatsappNumber = data.whatsappNumber;
  // Persistir el nav de categorías de la marca (aditivo: solo si viene en data).
  if (data.categoryNav !== undefined) payload.categoryNav = normalizeCategoryNav(data.categoryNav);
  // Persistir el estilo del nav (aditivo: solo se escribe si viene en data).
  if (data.categoryNavStyle !== undefined) payload.categoryNavStyle = normalizeCategoryNavStyle(data.categoryNavStyle);
  // Mensajes de tienda por marca (aditivo: solo se escriben si vienen en data).
  if (data.storeTitle !== undefined) payload.storeTitle = data.storeTitle;
  if (data.storeSubtitle !== undefined) payload.storeSubtitle = data.storeSubtitle;
  if (data.storeEmpty !== undefined) payload.storeEmpty = data.storeEmpty;
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar marca
 */
export const deleteBrand = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
