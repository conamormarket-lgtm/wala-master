import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'tienda_mockups';

/**
 * Obtener todos los mockups
 */
export const getMockups = async () => {
  return await getCollection(COLLECTION, [], { field: 'createdAt', direction: 'desc' });
};

/**
 * Obtener un mockup por ID
 */
export const getMockupById = async (id) => {
  return await getDocument(COLLECTION, id);
};

/**
 * Crear mockup
 */
export const createMockup = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || '',
    category: data.category || '',
    baseImageUrl: data.baseImageUrl || '',
    variants: data.variants || [],
  });
};

/**
 * Actualizar mockup
 */
export const updateMockup = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.category !== undefined) payload.category = data.category;
  if (data.baseImageUrl !== undefined) payload.baseImageUrl = data.baseImageUrl;
  if (data.variants !== undefined) payload.variants = data.variants;
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar mockup
 */
export const deleteMockup = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
