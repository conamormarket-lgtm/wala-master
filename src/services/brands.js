import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

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
 * Crear marca (Firestore genera ID)
 * @param {{ name: string, slug?: string, logoUrl?: string, order: number, bgColor?: string, bgImage?: string, bgOpacity?: number, categoryNav?: Array, categoryNavStyle?: { align?: string, animation?: string } }} data
 */
export const createBrand = async (data) => {
  // Slug de primera clase: si viene explícito se respeta (normalizado); si no, se
  // deriva del name. createBrand SIEMPRE deja un slug para que la marca sea
  // detectable como página /<slug> desde el Header.
  const slug = slugify(data.slug) || slugify(data.name);
  return await createDocument(COLLECTION, {
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
    categoryNavStyle: normalizeCategoryNavStyle(data.categoryNavStyle)
  });
};

/**
 * Actualizar marca
 * @param {string} id
 * @param {{ name?: string, slug?: string, logoUrl?: string, order?: number, bgColor?: string, bgImage?: string, bgOpacity?: number, categoryNav?: Array, categoryNavStyle?: { align?: string, animation?: string } }} data
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
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar marca
 */
export const deleteBrand = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
