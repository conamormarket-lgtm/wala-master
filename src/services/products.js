import { getCollection, getDocument, getCollectionPaginated, createDocument, updateDocument, deleteDocument, setDocument } from './firebase/firestore';
import { deleteFile } from './firebase/storage';
import { collection, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase/config';
import { DEFAULT_VENDOR_ID, DEFAULT_NICHE_ID, normalizeFulfillmentType } from '../constants/marketplace';
import { PLACEHOLDER_IMG } from '../constants/placeholder';

const COLLECTION = 'productos_wala';
const CACHE_VERSION = 'v2'; // Cambiar esto invalida la caché de todos los usuarios
const CACHE_KEYS = {
  products: `wala_products_cache_${CACHE_VERSION}`,
  featured: `wala_featured_cache_${CACHE_VERSION}`,
  categories: `wala_categories_cache_${CACHE_VERSION}`
};

export const generateProductId = () => {
  return doc(collection(db, COLLECTION)).id;
};

// ── BÚSQUEDA POR FIRESTORE (campos derivados, ADITIVOS) ──────────────────────
// Normaliza texto para búsqueda: minúsculas + sin tildes/diacríticos. Es la
// MISMA transformación que aplica el servicio de búsqueda al término del usuario,
// para que el prefijo (where >= q & < q+'') y el array-contains coincidan.
// IMPORTANTE: debe quedar idéntica a la de scripts/backfill-search-tokens.js.
export const normalizeSearchText = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (tildes, ñ→n se mantiene aparte)
    .replace(/\s+/g, ' ')
    .trim();

// Construye los tokens/prefijos para array-contains a partir del nombre + marca
// (+ cualquier texto extra). Para cada palabra genera sus prefijos desde 2 chars
// (ej. "polo" → po, pol, polo) y también la palabra completa. Así array-contains
// de un prefijo del usuario encuentra el producto sin escanear todo el catálogo.
// Límite defensivo de tamaño para no inflar el doc (Firestore: 1MiB/doc).
const MAX_SEARCH_TOKENS = 60;
const MIN_TOKEN_LEN = 2;
const MAX_PREFIX_LEN = 12;
export const buildSearchTokens = (...parts) => {
  const text = parts.map((p) => normalizeSearchText(p)).filter(Boolean).join(' ');
  if (!text) return [];
  const words = Array.from(new Set(text.split(' ').filter((w) => w.length >= MIN_TOKEN_LEN)));
  const tokens = new Set();
  for (const w of words) {
    const upper = Math.min(w.length, MAX_PREFIX_LEN);
    for (let len = MIN_TOKEN_LEN; len <= upper; len++) {
      tokens.add(w.slice(0, len));
    }
    if (w.length > MAX_PREFIX_LEN) tokens.add(w); // conserva palabras largas completas
    if (tokens.size >= MAX_SEARCH_TOKENS) break;
  }
  return Array.from(tokens).slice(0, MAX_SEARCH_TOKENS);
};

// Tolerante a objetos/strings: extrae un ID string limpio de categorías/colecciones.
// Soporta docs viejos corruptos ([{id}], ['[object Object]']) y guardados nuevos (string).
const toId = (c) => {
  if (c == null) return '';
  if (typeof c === 'object') return String(c.id ?? c.slug ?? c.name ?? '').trim();
  const s = String(c).trim();
  return s === '[object Object]' ? '' : s;
};

// Limpiar cachés antiguas para liberar espacio
try {
  localStorage.removeItem('conamor_products_cache');
  localStorage.removeItem('conamor_featured_cache');
  localStorage.removeItem('conamor_categories_cache');
} catch(e) {}
export const getProducts = async (filters = [], orderBy = null, limitCount = null, options = {}) => {
  const { includeHidden = false } = options;
  const result = await getCollection(COLLECTION, filters, orderBy, limitCount);
  if (result.error) return result;
  const raw = includeHidden ? result.data : result.data.filter((p) => p.visible !== false);
  const data = raw.map((doc) => normalizeProductForRead(doc));

  try {
    if (!includeHidden && (!filters || filters.length === 0) && !orderBy && !limitCount) {
      localStorage.setItem(CACHE_KEYS.products, JSON.stringify(data));
    }
  } catch(e) {}

  return { data, error: null };
};

export const getCachedProducts = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.products);
    if (cached) return JSON.parse(cached);
  } catch(e) {}
  return undefined;
};

/**
 * Normaliza un item de variante (nuevo modelo)
 */
function normalizeVariantItem(item, index) {
  if (!item || typeof item !== 'object') return null;
  const id = item.id || `variant_${Date.now()}_${index}`;
  const name = String(item.name ?? '').trim();
  const imageUrl = String(item.imageUrl ?? '');
  const sizes = Array.isArray(item.sizes) ? item.sizes.filter(Boolean) : [];
  
  // Extraer las URLs asegurando que los objetos legacy se conviertan a strings
  const extractUrl = (img) => {
    if (!img) return '';
    if (typeof img === 'string') return img;
    return img.url || img.imageUrl || '';
  };
  
  // Guardamos tanto 'images' (nuevo) como 'galleryImages' (viejo/tienda) para máxima compatibilidad
  const rawImages = Array.isArray(item.images) ? item.images : (Array.isArray(item.galleryImages) ? item.galleryImages : []);
  const images = rawImages.map(extractUrl).filter(Boolean);
  
  return { 
    id, 
    name, 
    imageUrl, 
    sizes, 
    images,
    galleryImages: images,
    thumbnailCrop: item.thumbnailCrop ?? null,
    ...(item.colorHex ? { colorHex: item.colorHex } : {})
  };
}

/**
 * Normaliza un producto leÃ­do de Firestore.
 * - Soporta nuevo modelo: hasVariants, mainImage, mainSizes, variants[].
 * - Migra formato viejo: variants.colors + imagesByColor -> variants[].
 * - Deriva images e imagesByColor para compatibilidad con tienda/editor.
 */
export function normalizeProductForRead(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const customizationViews = Array.isArray(doc.customizationViews)
    ? doc.customizationViews.map(normalizeCustomizationView).filter(Boolean)
    : [];

  const rawComboItems = Array.isArray(doc.comboItems) ? doc.comboItems : [];
  const comboItems = rawComboItems.map((item, index) => normalizeComboItem(item, index)).filter(Boolean);
  const isComboProduct = Boolean(doc.isComboProduct) || comboItems.length > 0;
  const comboLayout = isComboProduct && doc.comboLayout
    ? normalizeComboLayout(doc.comboLayout)
    : (isComboProduct ? { orientation: 'horizontal', spacing: 20 } : null);

  // Combos no usan variantes: evita que se derive la miniatura de variants (que suele estar vacÃ­o)
  let hasVariants = isComboProduct ? false : doc.hasVariants;
  let mainImage = doc.mainImage ?? '';
  let mainSizes = Array.isArray(doc.mainSizes) ? doc.mainSizes : [];
  let variants = Array.isArray(doc.variants)
    ? doc.variants.map((item, i) => normalizeVariantItem(item, i)).filter(Boolean)
    : [];

  // MigraciÃ³n: documento viejo con variants.colors / imagesByColor
  if (variants.length === 0 && Array.isArray(doc.variants?.colors) && doc.variants.colors.length > 0) {
    hasVariants = true;
    const legacySizes = Array.isArray(doc.variants?.sizes) ? doc.variants.sizes : [];
    const imagesByColorOld = doc.imagesByColor && typeof doc.imagesByColor === 'object' ? doc.imagesByColor : {};
    variants = doc.variants.colors.map((name, i) => {
      const url = Array.isArray(imagesByColorOld[name])
        ? imagesByColorOld[name][0]
        : (imagesByColorOld[name] || '');
      return {
        id: `variant_legacy_${i}`,
        name: String(name),
        imageUrl: String(url ?? ''),
        sizes: [...legacySizes]
      };
    });
  }

  const validBehaviors = ['default_only', 'after_impressions', 'by_engagement', 'both'];
  const variantDisplayBehavior = validBehaviors.includes(doc.variantDisplayBehavior)
    ? doc.variantDisplayBehavior
    : 'default_only';
  const defaultVariantId =
    doc.defaultVariantId && typeof doc.defaultVariantId === 'string'
      ? doc.defaultVariantId
      : variants.length > 0
        ? variants[0].id
        : '';

  // Extraer las URLs asegurando que los objetos legacy se conviertan a strings
  const extractUrl = (img) => {
    if (!img) return '';
    if (typeof img === 'string') return img;
    return img.url || img.imageUrl || '';
  };
  
  let rawImages = Array.isArray(doc.images) ? doc.images.map(extractUrl).filter(Boolean) : [];
  let images = [...rawImages];
  let imagesByColor = doc.imagesByColor && typeof doc.imagesByColor === 'object' ? doc.imagesByColor : {};

  if (hasVariants && variants.length > 0) {
    const defaultVariant = defaultVariantId ? variants.find((v) => v.id === defaultVariantId) : variants[0];
    const principalImage = defaultVariant?.imageUrl || variants[0]?.imageUrl || '';
    
    // Si hay una imagen principal, asegurarse de que esté al inicio, pero no borrar el resto de imágenes
    if (principalImage) {
      images = [principalImage, ...rawImages.filter(u => u !== principalImage)];
    }
    
    const byName = {};
    variants.forEach((v) => {
      if (v.imageUrl) byName[v.name] = [v.imageUrl];
    });
    if (Object.keys(byName).length > 0) imagesByColor = byName;
  } else if (!hasVariants && mainImage) {
    images = [mainImage, ...rawImages.filter(u => u !== mainImage)];
    imagesByColor = { default: mainImage };
  }

  // Miniatura con diseÃ±o: solo usar thumbnailWithDesignUrl si:
  // 1. Existe en Firestore
  // 2. La imagen de la variante principal NO es una URL directa de Firebase Storage
  //    (si es Firebase, la imagen es ya la fuente de verdad = variante actualizada)
  // Esto evita que thumbnails desactualizados oculten las imÃ¡genes reales de las variantes.
  if (!isComboProduct && doc.thumbnailWithDesignUrl && typeof doc.thumbnailWithDesignUrl === 'string' && doc.thumbnailWithDesignUrl.trim()) {
    const principalVariantImageUrl = (hasVariants && variants.length > 0)
      ? (variants.find((v) => v.id === defaultVariantId)?.imageUrl || variants[0]?.imageUrl || '')
      : mainImage || '';
    // Si la imagen de la variante es de Firebase Storage, ya es la imagen actualizada â€” no sobreescribir
    const variantIsFirebase = principalVariantImageUrl && principalVariantImageUrl.includes('firebasestorage.googleapis.com');
    if (!variantIsFirebase) {
      images = [doc.thumbnailWithDesignUrl];
    }
    // Si la variante es Firebase, images ya fue asignado correctamente arriba con el imageUrl de la variante
  }

  // Productos combo: siempre tener miniatura (preview o placeholder) para admin y tienda
  if (isComboProduct) {
    images = doc.comboPreviewImage
      ? [doc.comboPreviewImage]
      : [PLACEHOLDER_IMG];
  }

  // Fallback final: ningÃºn producto sin miniatura (admin y tienda)
  if (!Array.isArray(images) || images.length === 0) {
    images = [PLACEHOLDER_IMG];
  }

  const behaviorImpressionsThreshold =
    typeof doc.behaviorImpressionsThreshold === 'number' && doc.behaviorImpressionsThreshold >= 1
      ? doc.behaviorImpressionsThreshold
      : 3;

  const visible = doc.visible !== false;

  return {
    ...doc,
    name: doc.name ?? '',
    visible,
    whatsappMessage: doc.whatsappMessage ?? 'Hola CON AMOR: Me interesa este producto de tu página: {url}',
    // Tolerante al LEER: docs viejos ([{id}] o ['[object Object]']) salen como IDs string limpios.
    categories: Array.isArray(doc.categories)
      ? doc.categories.map(toId).filter(Boolean)
      : (doc.category ? [toId(doc.category)].filter(Boolean) : []),
    collections: Array.isArray(doc.collections)
      ? doc.collections.map(toId).filter(Boolean)
      : (doc.collection ? [toId(doc.collection)].filter(Boolean) : []),
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    characters: Array.isArray(doc.characters) ? doc.characters : [],
    vendors: Array.isArray(doc.vendors) ? doc.vendors : (doc.vendor ? [doc.vendor] : []),
    sku: doc.sku ?? '',
    whatsappEnabled: doc.whatsappEnabled !== false,
    whatsappNumber: doc.whatsappNumber ?? '+51912881722',
    productType: doc.productType ?? '',
    brandId: doc.brandId ?? '',
    // Base multi-vendor / multi-nicho (Fase 1) — defaults aditivos.
    vendorId: doc.vendorId || DEFAULT_VENDOR_ID,
    nicheId: doc.nicheId || DEFAULT_NICHE_ID,
    fulfillmentType: normalizeFulfillmentType(
      doc.fulfillmentType,
      Boolean(doc.customizable) || customizationViews.length > 0
    ),
    customizationViews,
    customizable: Boolean(doc.customizable) || customizationViews.length > 0,
    hasVariants: Boolean(hasVariants),
    mainImage,
    mainSizes,
    variants: variants.length ? variants : [],
    defaultVariantId: String(doc.defaultVariantId || ''),
    variantDisplayBehavior,
    behaviorImpressionsThreshold,
    images,
    imagesByColor,
    isComboProduct,
    ...(comboLayout && { comboLayout }),
    comboItems,
    ...(doc.comboPreviewImage && { comboPreviewImage: String(doc.comboPreviewImage) }),
    ...(isComboProduct && Array.isArray(doc.comboItemCustomization) && doc.comboItemCustomization.length > 0 && {
      comboItemCustomization: doc.comboItemCustomization.map((c) => ({
        productId: String(c.productId ?? ''),
        viewId: String(c.viewId ?? ''),
        printAreas: Array.isArray(c.printAreas) ? c.printAreas : [],
        initialLayersByColor: c.initialLayersByColor && typeof c.initialLayersByColor === 'object' ? c.initialLayersByColor : { default: [] },
        ...(c.backSide ? {
          backSide: {
            initialLayersByColor: c.backSide.initialLayersByColor && typeof c.backSide.initialLayersByColor === 'object' ? c.backSide.initialLayersByColor : { default: [] },
            printAreas: Array.isArray(c.backSide.printAreas) ? c.backSide.printAreas : []
          }
        } : {})
      }))
    })
  };
}

/**
 * Obtener un producto por ID (normalizado para uso en tienda y editor)
 *
 * IMPORTANTE (soft-delete): esta función NO filtra por visible/deleted, así que
 * puede devolver un producto borrado lógicamente (deleted===true, visible===false).
 * Es intencional: el historial de compras/wishlist necesita leer el tombstone
 * (name, imágenes, precio). Cada CONSUMIDOR decide qué hacer con un doc borrado
 * (p.ej. ProductPage muestra "ya no está disponible" en vez de la ficha comprable).
 * La firma no cambia: (productId) => { data, error }.
 */
export const getProduct = async (productId) => {
  const result = await getDocument(COLLECTION, productId);
  if (result.error || !result.data) return result;
  return { data: normalizeProductForRead(result.data), error: null };
};

/**
 * Obtener productos paginados
 */
export const getProductsPaginated = async (filters = [], orderBy = null, pageSize = 12, lastDoc = null) => {
  const result = await getCollectionPaginated(COLLECTION, filters, orderBy, pageSize, lastDoc);
  if (result.error) return result;
  return { ...result, data: (result.data || []).map((doc) => normalizeProductForRead(doc)) };
};

// ── PAGINACIÓN DE CATÁLOGO PARA LA TIENDA (Fase 3 · C-1) ──────────────
// Tamaño de página por defecto. Suficiente para llenar el viewport y disparar
// el scroll incremental sin montar miles de nodos a la vez.
export const STORE_PAGE_SIZE = 24;

// Mapea el "sort" de la UI (newest/price/price-desc/name) al orderBy de Firestore.
// IMPORTANTE: para paginar con cursor (startAfter) el orden DEBE venir de la
// query — no se puede ordenar en memoria por página. 'newest' usa createdAt DESC.
const sortToOrderBy = (sort) => {
  switch (sort) {
    case 'price':
      return { field: 'price', direction: 'asc' };
    case 'price-desc':
      return { field: 'price', direction: 'desc' };
    case 'name':
      return { field: 'name', direction: 'asc' };
    case 'newest':
    default:
      return { field: 'createdAt', direction: 'desc' };
  }
};

// Traduce un único filtro de faceta (categoría/colección/marca/etc.) a un
// where() de Firestore. Devuelve [] si no hay faceta soportada, de modo que la
// query trae el catálogo ordenado sin filtrar en servidor (y el filtrado fino
// multi-faceta se sigue haciendo en cliente, igual que hoy).
//
// LÍMITE CONOCIDO: Firestore solo permite UNA faceta combinada con orderBy por
// query (y requiere índice compuesto faceta+orden). Por eso esta función acepta
// como mucho una faceta "server-side"; el resto de facetas activas se aplican en
// cliente sobre la página recibida (ver SidebarCatalogLayout). Para multi-faceta
// real a escala se usaría un motor de búsqueda (Algolia/Typesense), fuera de
// alcance de esta tarea.
const facetToWhere = (facet) => {
  if (!facet || !facet.value) return [];
  switch (facet.type) {
    case 'category':
      return [{ field: 'categories', operator: 'array-contains', value: facet.value }];
    case 'collection':
      return [{ field: 'collections', operator: 'array-contains', value: facet.value }];
    case 'tag':
      return [{ field: 'tags', operator: 'array-contains', value: facet.value }];
    case 'character':
      return [{ field: 'characters', operator: 'array-contains', value: facet.value }];
    case 'brand':
      return [{ field: 'brandId', operator: '==', value: facet.value }];
    case 'type':
      return [{ field: 'productType', operator: '==', value: facet.value }];
    default:
      return [];
  }
};

/**
 * Obtener una PÁGINA del catálogo de la tienda con cursor (Fase 3 · C-1).
 *
 * Devuelve { items, lastDoc, hasMore, error } usando Firestore
 * startAfter(cursor) + limit(pageSize). El orden viene de la query (sortToOrderBy)
 * para que el cursor sea consistente entre páginas.
 *
 * RETROCOMPATIBILIDAD:
 *  - El filtro de visibilidad (visible !== false) se aplica EN CLIENTE sobre la
 *    página, igual que hoy en getProducts. Así no exigimos que todos los docs
 *    tengan el campo `visible` (no haría falta backfill) ni un índice extra.
 *    `hasMore` se calcula con el tamaño CRUDO de la página (docs devueltos por
 *    Firestore), de modo que el cursor sigue avanzando aunque algún producto
 *    oculto se descarte: nunca se "pierde" el resto del catálogo.
 *  - `facet` (opcional) permite filtrar UNA faceta en servidor; las demás se
 *    filtran en cliente (ver nota de límite en facetToWhere).
 *
 * @param {Object}   params
 * @param {Object}   [params.facet]    { type, value } faceta única server-side (opcional)
 * @param {string}   [params.sort]     'newest' | 'price' | 'price-desc' | 'name'
 * @param {*}        [params.cursor]    DocumentSnapshot de la página anterior (lastDoc) o null
 * @param {number}   [params.pageSize]  tamaño de página (def. STORE_PAGE_SIZE)
 */
export const getStoreProductsPage = async ({ facet = null, sort = 'newest', cursor = null, pageSize = STORE_PAGE_SIZE } = {}) => {
  const filters = facetToWhere(facet);
  const orderBy = sortToOrderBy(sort);

  const result = await getCollectionPaginated(COLLECTION, filters, orderBy, pageSize, cursor);
  if (result.error) {
    return { items: [], lastDoc: null, hasMore: false, error: result.error };
  }

  // hasMore se basa en el tamaño CRUDO de la página (antes de filtrar visibles).
  const rawCount = Array.isArray(result.data) ? result.data.length : 0;
  const items = (result.data || [])
    .filter((p) => p.visible !== false)
    .map((doc) => normalizeProductForRead(doc));

  // ── RED DE SEGURIDAD (anti catálogo-vacío) ──────────────────────────
  // En la PRIMERA página de la ruta por defecto (cursor null y SIN faceta
  // server-side, es decir el orden por createdAt del modo "newest"), si la
  // query devuelve 0 docs CRUDOS no asumimos catálogo vacío: lo más probable
  // es que ningún doc tenga `createdAt` (Firestore EXCLUYE de un orderBy los
  // docs que no tienen el campo) o que el índice falle silenciosamente. En ese
  // caso caemos al catálogo COMPLETO sin orden de servidor —getProducts([], null,
  // null)— como una sola página (hasMore:false), igual que el fallback de error
  // del queryFn en TiendaPage. Así el storefront SIEMPRE muestra productos.
  //
  // Importante: solo se dispara con rawCount===0 (no hay NADA que paginar), así
  // que no interfiere con el caso normal (sí hay docs) ni con una página que
  // trae solo productos ocultos —ahí rawCount>0 y el cursor sigue avanzando—.
  // Se restringe a !facet para no enmascarar una categoría/colección legítima
  // sin resultados (esa SÍ debe poder verse vacía).
  if (cursor == null && !facet && rawCount === 0) {
    const full = await getProducts([], null, null);
    if (!full.error) {
      return { items: full.data || [], lastDoc: null, hasMore: false, error: null };
    }
    // Si el fallback también falla, devolvemos vacío (no rompemos la tienda).
  }

  return {
    items,
    lastDoc: result.lastDoc || null,
    hasMore: rawCount === pageSize,
    error: null
  };
};

/**
 * Buscar productos por tÃ©rmino
 */
/**
 * Buscar productos por tÃ©rmino
 */
export const searchProducts = async (searchTerm) => {
  const { data, error } = await getCollection(COLLECTION);
  if (error) return { data: [], error };

  const term = searchTerm.toLowerCase();
  const filtered = data
    .filter((p) => p.visible !== false)
    .filter((product) => {
      if (product.name?.toLowerCase().includes(term)) return true;
      if (product.description?.toLowerCase().includes(term)) return true;
      const cats = product.categories ?? (product.category ? [product.category] : []);
      if (Array.isArray(cats) && cats.some((id) => String(id).toLowerCase().includes(term))) return true;
      if (product.category?.toLowerCase().includes(term)) return true;
      return false;
    });

  return { data: filtered.map((doc) => normalizeProductForRead(doc)), error: null };
};

/**
 * Obtener productos por categorÃ­a (solo visibles)
 *
 * brandId OPCIONAL (multimarca): si se pasa, se ACOTAN los resultados a esa marca
 * filtrando client-side por p.brandId === brandId (sin índices Firestore nuevos).
 * Sin brandId = comportamiento global actual (retrocompatible).
 */
export const getProductsByCategory = async (categoryId, brandId = null) => {
  const result = await getCollection(COLLECTION, [
    { field: 'categories', operator: 'array-contains', value: categoryId }
  ]);
  if (result.error) return result;
  let data = result.data.filter((p) => p.visible !== false);
  if (data.length === 0) {
    const legacy = await getCollection(COLLECTION, [
      { field: 'category', operator: '==', value: categoryId }
    ]);
    if (!legacy.error) data = legacy.data.filter((p) => p.visible !== false);
  }
  // Acotar a la marca de la página si viene brandId (filtro en cliente).
  if (brandId) data = data.filter((p) => p.brandId === brandId);
  return { data: data.map((doc) => normalizeProductForRead(doc)), error: null };
};

/**
 * Obtener productos por marca (brandId = doc id de tienda_brands, solo visibles)
 */
export const getProductsByBrand = async (brandId) => {
  const result = await getCollection(COLLECTION, [
    { field: 'brandId', operator: '==', value: brandId }
  ]);
  if (result.error) return result;
  let data = result.data.filter((p) => p.visible !== false);
  return { data: data.map((doc) => normalizeProductForRead(doc)), error: null };
};

/**
 * Obtener productos por colecciÃ³n (solo visibles)
 *
 * brandId OPCIONAL (multimarca): si se pasa, se ACOTAN los resultados a esa marca
 * filtrando client-side por p.brandId === brandId (sin índices Firestore nuevos).
 * Sin brandId = comportamiento global actual (retrocompatible).
 */
export const getProductsByCollection = async (collectionName, brandId = null) => {
  const result = await getCollection(COLLECTION, [
    { field: 'collections', operator: 'array-contains', value: collectionName }
  ]);
  if (result.error) return result;
  let data = result.data.filter((p) => p.visible !== false);
  // Acotar a la marca de la página si viene brandId (filtro en cliente).
  if (brandId) data = data.filter((p) => p.brandId === brandId);
  return { data: data.map((doc) => normalizeProductForRead(doc)), error: null };
};

/**
 * Obtener productos destacados (featured === true, solo visibles) ordenados por featuredOrder
 *
 * brandId OPCIONAL (multimarca): si se pasa, los destacados se derivan de los
 * productos de la marca (getProductsByBrand) filtrando por featured y ordenando
 * por featuredOrder — sin índices Firestore nuevos. Además, el caché de destacados
 * en localStorage SOLO se usa/escribe para el caso GLOBAL (sin brandId) para no
 * mezclar destacados de distintas marcas. Sin brandId = comportamiento global actual.
 */
export const getFeaturedProducts = async (brandId = null) => {
  // ── Caso por MARCA: derivar de los productos de la marca ──────────────
  if (brandId) {
    const porMarca = await getProductsByBrand(brandId);
    if (porMarca.error) return porMarca;
    const data = (porMarca.data || [])
      .filter((p) => p.featured === true)
      .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
    return { data, error: null };
  }

  // ── Caso GLOBAL (comportamiento actual, con caché) ────────────────────
  const result = await getCollection(
    COLLECTION,
    [{ field: 'featured', operator: '==', value: true }],
    { field: 'featuredOrder', direction: 'asc' },
    null
  );
  if (result.error) return result;
  const data = result.data.filter((p) => p.visible !== false).map((doc) => normalizeProductForRead(doc));

  try {
    localStorage.setItem(CACHE_KEYS.featured, JSON.stringify(data));
  } catch(e) {}

  return { data, error: null };
};

export const getCachedFeaturedProducts = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.featured);
    if (cached) return JSON.parse(cached);
  } catch(e) {}
  return undefined;
};

export const clearProductCaches = () => {
  try {
    localStorage.removeItem(CACHE_KEYS.products);
    localStorage.removeItem(CACHE_KEYS.featured);
    localStorage.removeItem(CACHE_KEYS.categories);
  } catch(e) {}
};

/**
 * Crear producto
 * @param {Object} data - name, category, price, images, description, inStock, customizable, variants, featured, featuredOrder, visible
 */
export const createProduct = async (data, explicitId = null) => {
  const payload = normalizeProductPayload(data);
  let result;
  
  if (explicitId) {
    result = await setDocument(COLLECTION, explicitId, {
      ...payload,
      createdAt: new Date().toISOString()
    });
    if (!result.error) result.id = explicitId;
  } else {
    result = await createDocument(COLLECTION, payload);
  }
  
  if (result.error) throw new Error(result.error);
  clearProductCaches();
  return result;
};

/**
 * Actualizar producto
 */
export const updateProduct = async (id, data) => {
  const payload = normalizeProductPayload(data);
  const result = await updateDocument(COLLECTION, id, payload);
  if (result.error) throw new Error(result.error);
  clearProductCaches();
  return result;
};

/**
 * Actualizar producto parcialmente (sin normalizar todo el payload)
 */
export const updateProductField = async (id, partialData) => {
  const result = await updateDocument(COLLECTION, id, partialData);
  if (result.error) throw new Error(result.error);
  clearProductCaches();
  return result;
};

/**
 * Asignar o quitar la MARCA de un producto (Fase 2 multimarca).
 *
 * ESCRITURA PARCIAL DIRECTA del campo `brandId` del doc productos_wala/{id},
 * SIN pasar por normalizeProductPayload ni por updateDocument. Esto es necesario
 * porque esa ruta "limpia" los vacíos (emptyStringsToNull: '' -> null y luego
 * removeEmptyForFirestore: null -> se ELIMINA la clave), de modo que un
 * brandId:'' NUNCA llegaba como escritura y el campo no se borraba: el producto
 * seguía asignado a la marca tras recargar (no-op de "Quitar de la marca").
 *
 * Con updateDoc la escritura es PARCIAL: solo toca brandId, sin alterar
 * precio, stock, imágenes, variantes ni ningún otro campo del documento.
 *
 * @param {string} id       id del documento productos_wala
 * @param {string} brandId  id de marca para ASIGNAR; vacío/null para QUITAR
 * @returns {Promise<{success:true}|{error:string}>}
 */
export const setProductBrand = async (id, brandId) => {
  try {
    const ref = doc(db, COLLECTION, id);
    const cleanBrandId = brandId ? String(brandId).trim() : '';
    if (cleanBrandId) {
      // Asignar: escribe solo el campo brandId (parcial, no toca el resto).
      await updateDoc(ref, { brandId: cleanBrandId });
    } else {
      // Quitar: REMUEVE el campo brandId del documento. Así getProductsByBrand
      // (where brandId == marca) deja de traerlo y el producto queda sin marca.
      await updateDoc(ref, { brandId: deleteField() });
    }
    clearProductCaches();
    return { success: true };
  } catch (error) {
    return { error: error?.message || 'No se pudo actualizar la marca del producto.' };
  }
};

/**
 * Eliminar producto (SOFT-DELETE / borrado lógico).
 *
 * NO borra el documento ni las imágenes de Storage: marca el producto con un
 * "tombstone" { visible:false, deleted:true, deletedAt:ISO } y limpia
 * searchTokens para que deje de aparecer en la búsqueda por Firestore
 * (array-contains). Se CONSERVAN name/mainImage/images/price/salePrice/
 * brandId/variants porque el historial de compras, la wishlist y la lista de
 * regalos siguen necesitando esos datos para pintar miniaturas y precios.
 *
 * La firma NO cambia (id) => {error}: los llamadores del admin siguen igual.
 * Para el borrado FÍSICO antiguo (doc + Storage) existe deleteProductPermanently,
 * que NINGÚN llamador de UI usa por defecto.
 */
export const deleteProduct = async (id) => {
  const tombstone = {
    visible: false,
    deleted: true,
    deletedAt: new Date().toISOString(),
    // Tombstone ligero: sin tokens el producto no vuelve a salir en la búsqueda.
    searchTokens: []
  };
  const result = await updateDocument(COLLECTION, id, tombstone);
  clearProductCaches();
  return result;
};

/**
 * Eliminar producto PERMANENTEMENTE (borrado físico: doc de Firestore + imágenes
 * de Firebase Storage). Es la lógica antigua de deleteProduct y se conserva solo
 * para mantenimiento/limpieza manual. OJO: rompe historial de compras, wishlist
 * y lista de regalos que referencien este producto — usar solo a sabiendas.
 */
export const deleteProductPermanently = async (id) => {
  try {
    const productResult = await getProduct(id);
    const product = productResult?.data;

    if (product) {
      const urlsToDelete = new Set();

      // Recopilar URLs principales y galería
      if (product.mainImage) urlsToDelete.add(product.mainImage);
      if (Array.isArray(product.images)) {
        product.images.forEach(url => urlsToDelete.add(url));
      }

      // Recopilar URLs de variantes
      if (Array.isArray(product.variants)) {
        product.variants.forEach(variant => {
          if (variant.imageUrl) urlsToDelete.add(variant.imageUrl);
          if (Array.isArray(variant.images)) {
            variant.images.forEach(url => urlsToDelete.add(url));
          }
          if (Array.isArray(variant.galleryImages)) {
            variant.galleryImages.forEach(url => urlsToDelete.add(url));
          }
        });
      }

      // Solo borrar URLs de Firebase Storage
      const firebaseUrls = Array.from(urlsToDelete).filter(url => 
        typeof url === 'string' && url.includes('firebasestorage.googleapis.com')
      );

      // Eliminar de Storage
      for (const url of firebaseUrls) {
        await deleteFile(url).catch(() => {});
      }
    }
  } catch (error) {
    console.warn("Error eliminando imágenes de storage:", error);
  }

  const result = await deleteDocument(COLLECTION, id);
  clearProductCaches();
  return result;
};

export const getCategories = async () => {
  // Unifica las DOS colecciones de categorías que coexisten en el proyecto:
  //  - 'tienda_categories': la que EDITA el admin (AdminCategorias) y de donde
  //    salen los ids que se asignan a los productos. Fuente curada/canónica.
  //  - 'categories': la que históricamente leía el storefront.
  // Se UNEN por id para NO perder ninguna categoría real (el cruce id→nombre del
  // nav y del sidebar resuelve aunque el id viva solo en una de las dos). Para
  // nombre/imagen gana 'tienda_categories'. Retrocompatible: si una colección está
  // vacía o no existe, se usa la otra; el storefront de Con Amor sigue resolviendo.
  const [store, admin] = await Promise.all([
    getCollection('categories', [], { field: 'order', direction: 'asc' }),
    getCollection('tienda_categories', [], { field: 'order', direction: 'asc' }),
  ]);
  const porId = new Map();
  (store.data || []).forEach((c) => { if (c && c.id) porId.set(c.id, c); });
  (admin.data || []).forEach((c) => { if (c && c.id) porId.set(c.id, { ...porId.get(c.id), ...c }); });
  const data = [...porId.values()].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  const error = data.length ? null : (store.error || admin.error || null);
  const result = { data, error };
  if (!error && data.length) {
    try {
      localStorage.setItem(CACHE_KEYS.categories, JSON.stringify(data));
    } catch(e) {}
  }
  return result;
};

export const getCachedCategories = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.categories);
    if (cached) return JSON.parse(cached);
  } catch(e) {}
  return undefined;
};

/**
 * Normaliza una capa del editor.
 * No persiste capas de imagen con src blob: (se invalidan al recargar).
 * @param {Object} layer - Capa del editor
 */
function normalizeLayer(layer) {
  if (!layer || typeof layer !== 'object' || !layer.type) return null;
  if (layer.type === 'image') {
    const src = layer.src ?? '';
    if (typeof src === 'string' && (src.trim().toLowerCase().startsWith('blob:') || src.trim().toLowerCase().startsWith('data:'))) return null;
  }
  const normalized = { ...layer };
  if (!normalized.id) {
    normalized.id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  normalized.type = String(layer.type);

  // Mantenemos las propiedades originales para no perder alineaciÃ³n ni posicionamiento
  // relativo (ej. baseW, baseH, textAlign, flipX), validando solo valores clave
  if (layer.type === 'text') {
    normalized.text = String(layer.text ?? '');
    normalized.fontSize = Math.max(8, Math.min(200, Number(layer.fontSize) || 40));
    normalized.color = String(layer.color ?? '#000000');
  } else if (layer.type === 'image') {
    normalized.src = String(layer.src ?? '');
  } else if (layer.type === 'shape') {
    normalized.shapeType = String(layer.shapeType ?? 'rectangle');
    normalized.fill = String(layer.fill ?? '#000000');
  }

  return normalized;
}

/**
 * Normaliza una vista de personalizaciÃ³n para guardar en Firestore.
 * @param {Object} view - { id, name, printAreas, imagesByColor, initialLayersByColor }
 */
function normalizeCustomizationView(view) {
  if (!view || typeof view !== 'object') return null;
  const id = view.id || `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Migrar initialLayers antiguos a initialLayersByColor.default (retrocompatibilidad)
  let initialLayersByColor = {};

  if (view.initialLayersByColor && typeof view.initialLayersByColor === 'object') {
    // Nueva estructura: normalizar cada color
    Object.keys(view.initialLayersByColor).forEach(colorKey => {
      const layers = view.initialLayersByColor[colorKey];
      if (Array.isArray(layers)) {
        initialLayersByColor[colorKey] = layers.map(normalizeLayer).filter(Boolean);
      } else {
        initialLayersByColor[colorKey] = [];
      }
    });
  } else if (Array.isArray(view.initialLayers)) {
    // Estructura antigua: migrar a default
    initialLayersByColor.default = view.initialLayers.map(normalizeLayer).filter(Boolean);
  } else {
    // Sin layers: crear estructura vacÃ­a
    initialLayersByColor.default = [];
  }

  // Asegurar que siempre hay default
  if (!initialLayersByColor.default) {
    initialLayersByColor.default = [];
  }

  // Migrar printArea antiguo a printAreas (retrocompatibilidad)
  let printAreas = [];
  if (Array.isArray(view.printAreas) && view.printAreas.length > 0) {
    // Nueva estructura: normalizar cada zona
    printAreas = view.printAreas.map((area, index) => {
      const normalized = {
        id: area.id || `zone_${Date.now()}_${index}`,
        shape: area.shape || 'rectangle',
        x: Math.max(0, Math.min(100, Number(area.x) || 10)),
        y: Math.max(0, Math.min(100, Number(area.y) || 10)),
        width: Math.max(5, Math.min(100, Number(area.width) || 80)),
        height: Math.max(5, Math.min(100, Number(area.height) || 80)),
        rotation: Number(area.rotation) || 0,
        skewX: Number(area.skewX) || 0,
        skewY: Number(area.skewY) || 0
      };

      // Agregar customShapeId si existe
      if (area.customShapeId) {
        normalized.customShapeId = String(area.customShapeId);
      }

      // Agregar freeDrawPath si existe (para creaciÃ³n libre)
      if (area.freeDrawPath) {
        normalized.freeDrawPath = String(area.freeDrawPath);
      }

      return normalized;
    });
  } else if (view.printArea && typeof view.printArea === 'object') {
    // Estructura antigua: migrar a printAreas[0]
    printAreas = [{
      id: `zone_${Date.now()}_0`,
      shape: 'rectangle',
      x: Math.max(0, Math.min(100, Number(view.printArea.x) || 10)),
      y: Math.max(0, Math.min(100, Number(view.printArea.y) || 10)),
      width: Math.max(5, Math.min(100, Number(view.printArea.width) || 80)),
      height: Math.max(5, Math.min(100, Number(view.printArea.height) || 80))
    }];
  } else {
    // Sin zonas: crear una por defecto
    printAreas = [{
      id: `zone_${Date.now()}_0`,
      shape: 'rectangle',
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      rotation: 0,
      skewX: 0,
      skewY: 0
    }];
  }

  const hasBackSide = Boolean(view.hasBackSide);
  let backSide = undefined;
  if (hasBackSide && view.backSide && typeof view.backSide === 'object') {
    const bs = view.backSide;
    const bsInitialLayers = {};
    if (bs.initialLayersByColor && typeof bs.initialLayersByColor === 'object') {
      Object.keys(bs.initialLayersByColor).forEach(colorKey => {
        const layers = bs.initialLayersByColor[colorKey];
        bsInitialLayers[colorKey] = Array.isArray(layers) ? layers.map(normalizeLayer).filter(Boolean) : [];
      });
    } else {
      bsInitialLayers.default = [];
    }
    
    let bsPrintAreas = [];
    if (Array.isArray(bs.printAreas) && bs.printAreas.length > 0) {
      bsPrintAreas = bs.printAreas.map((area, index) => ({
        id: area.id || `zone_${Date.now()}_back_${index}`,
        shape: area.shape || 'rectangle',
        x: Math.max(0, Math.min(100, Number(area.x) || 10)),
        y: Math.max(0, Math.min(100, Number(area.y) || 10)),
        width: Math.max(5, Math.min(100, Number(area.width) || 80)),
        height: Math.max(5, Math.min(100, Number(area.height) || 80)),
        rotation: Number(area.rotation) || 0,
        skewX: Number(area.skewX) || 0,
        skewY: Number(area.skewY) || 0,
        ...(area.customShapeId && { customShapeId: String(area.customShapeId) }),
        ...(area.freeDrawPath && { freeDrawPath: String(area.freeDrawPath) })
      }));
    } else {
      bsPrintAreas = [{
        id: `zone_${Date.now()}_back_0`,
        shape: 'rectangle', x: 10, y: 10, width: 80, height: 80, rotation: 0, skewX: 0, skewY: 0
      }];
    }

    backSide = {
      id: bs.id || `view_back_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: String(bs.name ?? 'Espalda'),
      printAreas: bsPrintAreas,
      imagesByColor: bs.imagesByColor && typeof bs.imagesByColor === 'object' ? bs.imagesByColor : { default: '' },
      initialLayersByColor: bsInitialLayers
    };
  }

  return {
    id,
    name: String(view.name ?? 'Vista'),
    printAreas,
    imagesByColor: view.imagesByColor && typeof view.imagesByColor === 'object' ? view.imagesByColor : { default: '' },
    initialLayersByColor,
    hasBackSide,
    ...(backSide ? { backSide } : {})
  };
}

/**
 * Normaliza un clipart de producto.
 */
function normalizeProductClipart(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    id: item.id || `clipart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: item.name ?? '',
    url: item.url ?? ''
  };
}

/**
 * Normaliza un item del combo para guardar en Firestore
 * @param {Object} item - Item del combo
 * @param {number} defaultPosition - PosiciÃ³n por defecto
 */
function normalizeComboItem(item, defaultPosition = 0) {
  if (!item || typeof item !== 'object') return null;

  return {
    productId: String(item.productId || ''),
    name: String(item.name || ''),
    imageUrl: String(item.imageUrl || ''),
    viewId: String(item.viewId || ''),
    position: typeof item.position === 'number' ? item.position : defaultPosition,
    scale: typeof item.scale === 'number' && item.scale > 0 ? item.scale : 1,
    customizable: Boolean(item.customizable),
    variantMapping: item.variantMapping && typeof item.variantMapping === 'object'
      ? item.variantMapping
      : {},
    ...(item.YoryoPersonalizado ? { YoryoPersonalizado: item.YoryoPersonalizado } : {})
  };
}

/**
 * Normaliza la configuraciÃ³n de layout del combo
 * @param {Object} layout - ConfiguraciÃ³n de layout
 */
function normalizeComboLayout(layout) {
  if (!layout || typeof layout !== 'object') {
    return { orientation: 'horizontal', spacing: 20 };
  }

  return {
    orientation: layout.orientation === 'vertical' ? 'vertical' : 'horizontal',
    spacing: typeof layout.spacing === 'number' ? Math.max(0, layout.spacing) : 20
  };
}

function normalizeProductPayload(data) {
  const customizationViews = Array.isArray(data.customizationViews)
    ? data.customizationViews.map(normalizeCustomizationView).filter(Boolean)
    : [];
  const productCliparts = Array.isArray(data.productCliparts)
    ? data.productCliparts.map(normalizeProductClipart).filter(Boolean)
    : [];

  // Tolerante al GUARDAR: normaliza objetos/strings a IDs string limpios.
  const categories = (Array.isArray(data.categories)
    ? data.categories
    : (data.category != null ? [data.category] : []))
    .map(toId).filter(Boolean);

  const collections = (Array.isArray(data.collections)
    ? data.collections
    : (data.collection != null ? [data.collection] : []))
    .map(toId).filter(Boolean);

  const tags = Array.isArray(data.tags)
    ? data.tags.filter(Boolean).map(c => String(c).trim()).filter(Boolean)
    : [];

  const characters = Array.isArray(data.characters)
    ? data.characters.filter(Boolean).map(c => String(c).trim()).filter(Boolean)
    : [];

  const vendors = Array.isArray(data.vendors)
    ? data.vendors.filter(Boolean).map(c => String(c).trim()).filter(Boolean)
    : (data.vendor ? [String(data.vendor).trim()] : []);

  const sku = data.sku ? String(data.sku).trim() : '';
  const productType = data.productType ? String(data.productType).trim() : '';
  const brandId = data.brandId ? String(data.brandId).trim() : '';

  const price = typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0;
  const salePrice = data.salePrice !== undefined && data.salePrice !== null && data.salePrice !== ''
    ? (typeof data.salePrice === 'number' ? data.salePrice : parseFloat(data.salePrice))
    : null;
  const finalSalePrice = salePrice !== null && salePrice < price ? salePrice : null;

  const isComboProduct = Boolean(data.isComboProduct);
  const comboLayout = isComboProduct ? normalizeComboLayout(data.comboLayout) : null;
  const comboItems = isComboProduct && Array.isArray(data.comboItems)
    ? data.comboItems.map((item, index) => normalizeComboItem(item, index)).filter(Boolean)
    : [];

  const hasVariants = Boolean(data.hasVariants);
  const mainImage = hasVariants ? '' : String(data.mainImage ?? '');
  const mainSizes = hasVariants ? [] : (Array.isArray(data.mainSizes) ? data.mainSizes : []);
  const variants = hasVariants && Array.isArray(data.variants)
    ? data.variants.map((item, i) => normalizeVariantItem(item, i)).filter(Boolean)
    : [];

  const validBehaviors = ['default_only', 'after_impressions', 'by_engagement', 'both'];
  const variantDisplayBehavior = validBehaviors.includes(data.variantDisplayBehavior)
    ? data.variantDisplayBehavior
    : 'default_only';
  const defaultVariantId =
    data.defaultVariantId && typeof data.defaultVariantId === 'string'
      ? data.defaultVariantId
      : variants.length > 0
        ? variants[0].id
        : '';
  const behaviorImpressionsThreshold =
    typeof data.behaviorImpressionsThreshold === 'number' && data.behaviorImpressionsThreshold >= 1
      ? data.behaviorImpressionsThreshold
      : 3;

  const images = hasVariants && variants.length > 0
    ? [variants[0].imageUrl].filter(Boolean)
    : (mainImage ? [mainImage] : []);

  const imagesByColor = {};
  if (hasVariants && variants.length > 0) {
    variants.forEach((v) => {
      if (v.imageUrl) imagesByColor[v.name] = [v.imageUrl];
    });
  } else if (mainImage) {
    imagesByColor.default = mainImage;
  }

  const visible = data.visible !== false;

  // Campos de búsqueda derivados (ADITIVOS): nombre normalizado para query por
  // prefijo y tokens para array-contains. El nombre final (con fallback) es el
  // que se indexa, para que coincida con lo que se muestra. Se usan brandId y
  // productType como texto extra de tokens (búsqueda por marca/tipo).
  const finalName = (data.name ?? '').toString().trim() || (isComboProduct ? 'Combo' : 'Sin nombre');
  const nameLower = normalizeSearchText(finalName);
  const searchTokens = buildSearchTokens(finalName, brandId, productType);

  const payload = {
    name: finalName,
    nameLower,
    searchTokens,
    categories: categories.length ? categories : [],
    collections: collections.length ? collections : [],
    tags: tags.length ? tags : [],
    characters: characters.length ? characters : [],
    vendors: vendors.length ? vendors : [],
    sku,
    whatsappEnabled: data.whatsappEnabled !== false,
    whatsappNumber: String(data.whatsappNumber || '').trim(),
    whatsappMessage: String(data.whatsappMessage || '').trim(),
    productType,
    brandId,
    // Base multi-vendor / multi-nicho (Fase 1).
    vendorId: (data.vendorId ? String(data.vendorId).trim() : '') || DEFAULT_VENDOR_ID,
    nicheId: (data.nicheId ? String(data.nicheId).trim() : '') || DEFAULT_NICHE_ID,
    fulfillmentType: normalizeFulfillmentType(data.fulfillmentType, Boolean(data.customizable)),
    price,
    salePrice: finalSalePrice,
    images: images.length ? images : [],
    imagesByColor: Object.keys(imagesByColor).length ? imagesByColor : {},
    description: (data.description ?? '').toString(),
    inStock: typeof data.inStock === 'number' ? data.inStock : parseInt(data.inStock, 10) || 0,
    customizable: Boolean(data.customizable),
    hasVariants: Boolean(hasVariants),
    mainImage: isComboProduct ? '' : mainImage,
    mainSizes: isComboProduct ? [] : mainSizes,
    variants: variants,
    defaultVariantId: defaultVariantId,
    variantDisplayBehavior,
    behaviorImpressionsThreshold,
    customizationViews,
    productCliparts,
    featured: Boolean(data.featured),
    featuredOrder: typeof data.featuredOrder === 'number' ? data.featuredOrder : (parseInt(data.featuredOrder, 10) || 0),
    visible,
    isComboProduct,
    ...(isComboProduct && comboLayout && { comboLayout }),
    ...(isComboProduct && comboItems.length > 0 && { comboItems }),
    ...(data.comboPreviewImage && { comboPreviewImage: String(data.comboPreviewImage) }),
    ...(data.thumbnailWithDesignUrl && { thumbnailWithDesignUrl: String(data.thumbnailWithDesignUrl) }),
    ...(isComboProduct && Array.isArray(data.comboItemCustomization) && data.comboItemCustomization.length > 0 && {
      comboItemCustomization: data.comboItemCustomization.map((c) => ({
        productId: String(c.productId ?? ''),
        viewId: String(c.viewId ?? ''),
        printAreas: Array.isArray(c.printAreas) ? c.printAreas.map((a) => ({
          id: a.id,
          shape: a.shape || 'rectangle',
          x: Number(a.x) ?? 10,
          y: Number(a.y) ?? 10,
          width: Number(a.width) ?? 80,
          height: Number(a.height) ?? 80,
          rotation: Number(a.rotation) ?? 0,
          skewX: Number(a.skewX) ?? 0,
          skewY: Number(a.skewY) ?? 0,
          ...(a.customShapeId && { customShapeId: String(a.customShapeId) }),
          ...(a.freeDrawPath && { freeDrawPath: String(a.freeDrawPath) })
        })) : [],
        initialLayersByColor: c.initialLayersByColor && typeof c.initialLayersByColor === 'object'
          ? Object.fromEntries(Object.entries(c.initialLayersByColor).map(([color, layers]) => [
              color,
              Array.isArray(layers) ? layers.map(normalizeLayer).filter(Boolean) : []
            ]))
          : { default: [] },
        ...(c.backSide ? {
          backSide: {
            initialLayersByColor: c.backSide.initialLayersByColor && typeof c.backSide.initialLayersByColor === 'object'
              ? Object.fromEntries(Object.entries(c.backSide.initialLayersByColor).map(([color, layers]) => [
                  color,
                  Array.isArray(layers) ? layers.map(normalizeLayer).filter(Boolean) : []
                ]))
              : { default: [] },
            printAreas: Array.isArray(c.backSide.printAreas) ? c.backSide.printAreas.map((a) => ({
              id: a.id,
              shape: a.shape || 'rectangle',
              x: Number(a.x) ?? 10,
              y: Number(a.y) ?? 10,
              width: Number(a.width) ?? 80,
              height: Number(a.height) ?? 80,
              rotation: Number(a.rotation) ?? 0,
              skewX: Number(a.skewX) ?? 0,
              skewY: Number(a.skewY) ?? 0,
              ...(a.customShapeId && { customShapeId: String(a.customShapeId) }),
              ...(a.freeDrawPath && { freeDrawPath: String(a.freeDrawPath) })
            })) : []
          }
        } : {})
      }))
    })
  };
  return payload;
}
