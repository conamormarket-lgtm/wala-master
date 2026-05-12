import { getCollection, getDocument, getCollectionPaginated, createDocument, updateDocument, deleteDocument, setDocument } from './firebase/firestore';
import { collection, doc } from 'firebase/firestore';
import { db } from './firebase/config';

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
function normalizeProductForRead(doc) {
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
      : ['https://via.placeholder.com/400x400/eee/999?text=Combo'];
  }

  // Fallback final: ningÃºn producto sin miniatura (admin y tienda)
  if (!Array.isArray(images) || images.length === 0) {
    images = ['https://via.placeholder.com/400x400/eee/999?text=Producto'];
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
    collections: Array.isArray(doc.collections) ? doc.collections : [],
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    characters: Array.isArray(doc.characters) ? doc.characters : [],
    vendors: Array.isArray(doc.vendors) ? doc.vendors : (doc.vendor ? [doc.vendor] : []),
    sku: doc.sku ?? '',
    whatsappEnabled: doc.whatsappEnabled !== false,
    whatsappNumber: doc.whatsappNumber ?? '+51912881722',
    productType: doc.productType ?? '',
    brandId: doc.brandId ?? '',
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
 */
export const getProductsByCategory = async (categoryId) => {
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
  return { data: data.map((doc) => normalizeProductForRead(doc)), error: null };
};

/**
 * Obtener productos por colecciÃ³n (solo visibles)
 */
export const getProductsByCollection = async (collectionName) => {
  const result = await getCollection(COLLECTION, [
    { field: 'collections', operator: 'array-contains', value: collectionName }
  ]);
  if (result.error) return result;
  let data = result.data.filter((p) => p.visible !== false);
  return { data: data.map((doc) => normalizeProductForRead(doc)), error: null };
};

/**
 * Obtener productos destacados (featured === true, solo visibles) ordenados por featuredOrder
 */
export const getFeaturedProducts = async () => {
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
 * Eliminar producto
 */
export const deleteProduct = async (id) => {
  const result = await deleteDocument(COLLECTION, id);
  clearProductCaches();
  return result;
};

export const getCategories = async () => {
  const result = await getCollection('categories', [], { field: 'order', direction: 'asc' });
  if (!result.error && result.data) {
    try {
      localStorage.setItem(CACHE_KEYS.categories, JSON.stringify(result.data));
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
    viewId: String(item.viewId || ''),
    position: typeof item.position === 'number' ? item.position : defaultPosition,
    scale: typeof item.scale === 'number' && item.scale > 0 ? item.scale : 1,
    variantMapping: item.variantMapping && typeof item.variantMapping === 'object'
      ? item.variantMapping
      : {}
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

  const categories = Array.isArray(data.categories)
    ? data.categories.filter(Boolean)
    : data.category
      ? [data.category]
      : [];

  const collections = Array.isArray(data.collections)
    ? data.collections.filter(Boolean).map(c => String(c).trim()).filter(Boolean)
    : [];

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

  const payload = {
    name: (data.name ?? '').toString().trim() || (isComboProduct ? 'Combo' : 'Sin nombre'),
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
