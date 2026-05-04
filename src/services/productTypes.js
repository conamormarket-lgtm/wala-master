import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'productTypes';

export const getProductTypes = async () => {
  return await getCollection(COLLECTION, [], { field: 'name', direction: 'asc' });
};

export const getProductType = async (id) => {
  return await getDocument(COLLECTION, id);
};

export const createProductType = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || ''
  });
};

export const updateProductType = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteProductType = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
