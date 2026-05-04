import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'customShapes';

/**
 * Obtener todas las formas personalizadas
 */
export const getCustomShapes = async () => {
  return await getCollection(COLLECTION, [], { field: 'name', direction: 'asc' });
};

/**
 * Obtener una forma personalizada por ID
 */
export const getCustomShape = async (shapeId) => {
  return await getDocument(COLLECTION, shapeId);
};

/**
 * Crear forma personalizada
 * @param {Object} data - { name, svgPath }
 */
export const createCustomShape = async (data) => {
  const payload = {
    name: data.name ?? '',
    svgPath: data.svgPath ?? '',
    createdAt: new Date().toISOString()
  };
  return await createDocument(COLLECTION, payload);
};

/**
 * Actualizar forma personalizada
 */
export const updateCustomShape = async (id, data) => {
  const payload = {
    name: data.name ?? '',
    svgPath: data.svgPath ?? ''
  };
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar forma personalizada
 */
export const deleteCustomShape = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
