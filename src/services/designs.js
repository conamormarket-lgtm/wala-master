import { getCollection, createDocument, updateDocument, getDocument, deleteDocument } from './firebase/firestore';
import { obtenerStorage } from './firebase/config';

/**
 * Obtiene los diseños guardados de un usuario (colección designs por userId).
 */
export const getDesignsByUser = async (userId, { soloBorradores = false } = {}) => {
  if (!userId) return { data: [], error: 'userId requerido' };

  // No usamos orderBy ni limit en Firestore para evitar errores de índice compuesto
  const { data, error } = await getCollection(
    'designs',
    [{ field: 'userId', operator: '==', value: userId }]
  );

  // Los borradores de Crear (diseños sin terminar) van aparte de las creaciones.
  const elegidos = (data || []).filter((d) => (d.estado === 'borrador') === soloBorradores);

  let sortedData = [];
  if (elegidos.length > 0) {
    sortedData = [...elegidos].sort((a, b) => {
      const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
      const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }

  return { data: sortedData.slice(0, 50), error };
};

/** Borradores del apartado Crear: diseños que el cliente empezó y no guardó. */
export const getBorradoresCrear = (userId) => getDesignsByUser(userId, { soloBorradores: true });

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

  const { designId, productId, productName, layers, layersByView, variant, name, comboItemCustomization, isUserComboDesign, tipo, previewUrl, color, archivosImpresion, vistasPrevias, imagenConjunta, estado, miniatura } = payload || {};

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
    // Diseños del apartado Crear: se reabren en /crear/:id y su miniatura es
    // la vista previa ya renderizada (prenda teñida + diseño).
    // Además guarda lo ya generado (imágenes de cada lado y archivos de
    // impresión): así la creación se puede ver y agregar al carrito desde su
    // propia página (/creacion/:id) sin volver a abrir el estudio.
    // Un borrador se guarda solo mientras el cliente diseña (sin archivos de
    // impresión, con una miniatura pequeña). Al guardarlo pasa a 'guardada'
    // en el mismo documento.
    ...(tipo === 'crear' ? {
      tipo: 'crear',
      estado: estado === 'borrador' ? 'borrador' : 'guardada',
      ...(typeof miniatura === 'string' && { miniatura }),
      previewUrl: previewUrl || '',
      color: color || null,
      ...(Array.isArray(archivosImpresion) && { archivosImpresion }),
      ...(Array.isArray(vistasPrevias) && { vistasPrevias }),
      ...(imagenConjunta && { imagenConjunta }),
    } : {}),
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

/** URLs de todo lo que guarda un diseño: imágenes del cliente, vistas previas y archivos de impresión. */
const urlsDeDiseno = (d) => {
  const urls = new Set();
  const agregar = (u) => { if (typeof u === 'string' && /^https?:/i.test(u)) urls.add(u); };
  agregar(d?.previewUrl);
  agregar(d?.imagenConjunta);
  (d?.vistasPrevias || []).forEach((p) => agregar(p?.url));
  (d?.archivosImpresion || []).forEach((a) => agregar(a?.url));
  const capas = [
    ...(Array.isArray(d?.layers) ? d.layers : []),
    ...Object.values(d?.layersByView || {}).flat(),
  ];
  capas.forEach((c) => { if (c?.type === 'image') agregar(c.src); });
  return urls;
};

/**
 * Elimina para siempre una creación del cliente y sus imágenes en Storage.
 *
 * Solo borra archivos de su carpeta (designs/{uid}/): nunca fotos del
 * catálogo. Tampoco borra un archivo que otra de sus creaciones también usa,
 * ni ningún archivo si la creación ya está en un pedido (`conservarArchivos`
 * o `enPedido`): el pedido apunta a esas imágenes para imprimir.
 * Devuelve { error, archivosBorrados }.
 */
export const eliminarCreacion = async (userId, diseno, { conservarArchivos = false } = {}) => {
  if (!userId || !diseno?.id) return { error: 'Falta la creación.', archivosBorrados: 0 };
  if (diseno.userId && diseno.userId !== userId) return { error: 'Esta creación no es tuya.', archivosBorrados: 0 };

  let urls = [];
  if (!conservarArchivos && diseno.enPedido !== true) {
    const propias = urlsDeDiseno(diseno);
    const { data: todas } = await getCollection('designs', [{ field: 'userId', operator: '==', value: userId }]);
    (todas || []).filter((d) => d.id !== diseno.id).forEach((d) => {
      urlsDeDiseno(d).forEach((u) => propias.delete(u));
    });
    urls = [...propias];
  }

  // Primero el documento: si algún archivo no se borra, solo queda huérfano.
  const { error } = await deleteDocument('designs', diseno.id);
  if (error) return { error, archivosBorrados: 0 };

  let archivosBorrados = 0;
  if (urls.length) {
    const storage = await obtenerStorage();
    if (storage) {
      const { ref, deleteObject } = await import('firebase/storage');
      await Promise.all(urls.map(async (url) => {
        try {
          const archivo = ref(storage, url);
          if (!archivo.fullPath.startsWith(`designs/${userId}/`)) return;
          await deleteObject(archivo);
          archivosBorrados += 1;
        } catch { /* ya no existe o no es de Storage */ }
      }));
    }
  }
  return { error: null, archivosBorrados };
};

/** Marca las creaciones de un pedido: sus archivos ya no se pueden borrar. */
export const marcarCreacionesEnPedido = async (designIds) => {
  const ids = [...new Set((designIds || []).filter(Boolean))];
  await Promise.all(ids.map((id) => updateDocument('designs', id, { enPedido: true }).catch(() => null)));
};

/**
 * Guarda solo la talla elegida de una creación. La talla no es parte del
 * diseño (no cambia sus imágenes): se recuerda sin volver a generarlas.
 */
export const guardarTallaCreacion = (designId, talla) =>
  updateDocument('designs', designId, { 'variant.size': talla });

/** Cambia solo el nombre de una creación (no vuelve a generar sus imágenes). */
export const renombrarCreacion = (designId, nombre) =>
  updateDocument('designs', designId, { name: nombre });
