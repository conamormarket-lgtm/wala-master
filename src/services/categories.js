import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'tienda_categories';

/**
 * Obtener todas las categorías ordenadas por order
 */
export const getCategories = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

/**
 * Obtener una categoría por ID
 */
export const getCategory = async (id) => {
  return await getDocument(COLLECTION, id);
};

/**
 * Crear categoría (Firestore genera ID)
 * @param {{ name: string, order: number }} data
 */
export const createCategory = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || '',
    imageUrl: data.imageUrl || '',
    order: typeof data.order === 'number' ? data.order : 0
  });
};

/**
 * Actualizar categoría
 * @param {string} id
 * @param {{ name?: string, order?: number }} data
 */
export const updateCategory = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
  if (data.order !== undefined) payload.order = data.order;
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar categoría
 */
export const deleteCategory = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
