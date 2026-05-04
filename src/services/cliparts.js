import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'cliparts';

/**
 * Obtener todos los cliparts (galería global)
 */
export const getCliparts = async (category = null) => {
  const filters = category ? [{ field: 'category', operator: '==', value: category }] : [];
  return await getCollection(COLLECTION, filters, { field: 'name', direction: 'asc' });
};

/**
 * Obtener un clipart por ID
 */
export const getClipart = async (clipartId) => {
  return await getDocument(COLLECTION, clipartId);
};

/**
 * Crear clipart
 * @param {Object} data - { name, url, category? }
 */
export const createClipart = async (data) => {
  const payload = {
    name: data.name ?? '',
    url: data.url ?? '',
    category: data.category ?? ''
  };
  return await createDocument(COLLECTION, payload);
};

/**
 * Actualizar clipart
 */
export const updateClipart = async (id, data) => {
  const payload = {
    name: data.name ?? '',
    url: data.url ?? '',
    category: data.category ?? ''
  };
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar clipart
 */
export const deleteClipart = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
