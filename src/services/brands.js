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
 * @param {{ name: string, logoUrl?: string, order: number, bgColor?: string, bgImage?: string, bgOpacity?: number }} data
 */
export const createBrand = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || '',
    logoUrl: data.logoUrl || '',
    order: typeof data.order === 'number' ? data.order : 0,
    bgColor: data.bgColor || '#ffffff',
    bgImage: data.bgImage || '',
    bgOpacity: typeof data.bgOpacity === 'number' ? data.bgOpacity : 100
  });
};

/**
 * Actualizar marca
 * @param {string} id
 * @param {{ name?: string, logoUrl?: string, order?: number, bgColor?: string, bgImage?: string, bgOpacity?: number }} data
 */
export const updateBrand = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.logoUrl !== undefined) payload.logoUrl = data.logoUrl;
  if (data.order !== undefined) payload.order = data.order;
  if (data.bgColor !== undefined) payload.bgColor = data.bgColor;
  if (data.bgImage !== undefined) payload.bgImage = data.bgImage;
  if (data.bgOpacity !== undefined) payload.bgOpacity = data.bgOpacity;
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar marca
 */
export const deleteBrand = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
