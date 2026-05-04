import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'collections';

/**
 * Obtener todas las colecciones ordenadas por order
 */
export const getCollections = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

/**
 * Obtener una colección por ID
 */
export const getCollectionById = async (id) => {
  return await getDocument(COLLECTION, id);
};

/**
 * Crear colección (Firestore genera ID)
 * @param {{ name: string, order: number }} data
 */
export const createCollection = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || '',
    order: typeof data.order === 'number' ? data.order : 0
  });
};

/**
 * Actualizar colección
 * @param {string} id
 * @param {{ name?: string, order?: number }} data
 */
export const updateCollection = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.order !== undefined) payload.order = data.order;
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar colección
 */
export const deleteCollection = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
