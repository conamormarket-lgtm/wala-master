import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'brands';

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
 * Crear marca (Firestore genera ID)
 * @param {{ name: string, logoUrl?: string, order: number }} data
 */
export const createBrand = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || '',
    logoUrl: data.logoUrl || '',
    order: typeof data.order === 'number' ? data.order : 0
  });
};

/**
 * Actualizar marca
 * @param {string} id
 * @param {{ name?: string, logoUrl?: string, order?: number }} data
 */
export const updateBrand = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.logoUrl !== undefined) payload.logoUrl = data.logoUrl;
  if (data.order !== undefined) payload.order = data.order;
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar marca
 */
export const deleteBrand = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
