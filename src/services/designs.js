import { getCollection, createDocument, updateDocument, getDocument } from './firebase/firestore';

/**
 * Obtiene los diseños guardados de un usuario (colección designs por userId).
 */
export const getDesignsByUser = async (userId) => {
  if (!userId) return { data: [], error: 'userId requerido' };

  // No usamos orderBy ni limit en Firestore para evitar errores de índice compuesto
  const { data, error } = await getCollection(
    'designs',
    [{ field: 'userId', operator: '==', value: userId }]
  );

  let sortedData = [];
  if (data && data.length > 0) {
    sortedData = [...data].sort((a, b) => {
      const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
      const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }

  return { data: sortedData.slice(0, 50), error };
};

/**
 * Quita capas de imagen con src blob: (no válidas al recargar).
 */
/**
 * Quita capas de imagen con src blob: (no válidas al recargar).
 */
function stripBlobLayers(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((l) => {
    if (l?.type === 'image' && typeof l.src === 'string' && l.src.trim().toLowerCase().startsWith('blob:')) return false;
    return true;
  });
}

/**
 * Sanitiza recursivamente un mapa de vistas (ej: { "combo-view-0-Blanco": [...] })
 */
function sanitizeLayersByViewMap(layersMap) {
  if (!layersMap || typeof layersMap !== 'object') return {};
  const cleaned = {};
  for (const [key, layers] of Object.entries(layersMap)) {
    if (Array.isArray(layers)) {
      cleaned[key] = stripBlobLayers(layers);
    }
  }
  return cleaned;
}

/**
 * Purifica completamente un documento de diseño para quitar cualquier blob muerto.
 */
function stripBlobLayersFromDesignDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = { ...doc };
  
  if (Array.isArray(out.layers)) {
    out.layers = stripBlobLayers(out.layers);
  }
  
  if (out.layersByView) {
    out.layersByView = sanitizeLayersByViewMap(out.layersByView);
  }

  // Clave: Asegurar que el payload asíncrono del editor Combo también se sanitice,
  // dado que userComboCustomization guarda copias exactas del layersByView.
  if (Array.isArray(out.comboItemCustomization)) {
    out.comboItemCustomization = out.comboItemCustomization.map(item => {
      if (!item) return item;
      const cleanedItem = { ...item };
      if (cleanedItem.layersByView) {
        cleanedItem.layersByView = sanitizeLayersByViewMap(cleanedItem.layersByView);
      }
      return cleanedItem;
    });
  }

  return out;
}

/**
 * Obtiene un diseño por ID (solo si pertenece al usuario o es público).
 */
export const getDesignById = async (designId) => {
  const { data, error } = await getDocument('designs', designId);
  return { data: data ? stripBlobLayersFromDesignDoc(data) : data, error };
};

/**
 * Guarda un diseño en la colección designs.
 * @param {string} userId - UID del usuario
 * @param {object} payload - Payload principal
 */
export const saveDesign = async (userId, payload) => {
  if (!userId) return { id: null, error: 'Usuario no autenticado' };

  const { designId, productId, productName, layers, layersByView, variant, name, comboItemCustomization, isUserComboDesign } = payload || {};

  // Formar una vista estandar del root layersByView (hacia atrás para compatibilidad)
  const sanitizedLayersByView = sanitizeLayersByViewMap(layersByView);
  
  const firstViewLayers = layersByView && typeof layersByView === 'object'
    ? Object.values(layersByView).flat()
    : layers || [];
  const sanitizedFirstViewLayers = stripBlobLayers(firstViewLayers);

  // Sanitizar minuciosamente la estructura modular (combos)
  let sanitizedComboItems = null;
  if (isUserComboDesign && Array.isArray(comboItemCustomization)) {
    sanitizedComboItems = comboItemCustomization.map(item => {
      if (!item) return item;
      return {
        ...item,
        layersByView: sanitizeLayersByViewMap(item.layersByView || {})
      };
    });
  }

  const doc = {
    userId,
    productId: productId || '',
    productName: productName || '',
    layers: Array.isArray(layers) ? stripBlobLayers(layers) : sanitizedFirstViewLayers,
    layersByView: sanitizedLayersByView,
    variant: variant || { size: '', color: '' },
    name: name || `Diseño ${new Date().toLocaleDateString('es-PE')}`,
    ...(isUserComboDesign && sanitizedComboItems ? { comboItemCustomization: sanitizedComboItems, isUserComboDesign: true } : {}),
  };

  try {
    if (designId) {
      const { error } = await updateDocument('designs', designId, doc);
      return { id: designId, error };
    }
    const { id, error } = await createDocument('designs', doc);
    return { id, error };
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes('payload') || msg.includes('size') || msg.includes('exceeded')) {
      return { id: designId || null, error: 'El diseño es demasiado grande (muchas imágenes en alta resolución). Recorta las imágenes o simplifica el arte.' };
    }
    return { id: designId || null, error: msg };
  }
};
