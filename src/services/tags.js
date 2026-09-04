import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'tags';

export const getTags = async () => {
  return await getCollection(COLLECTION, [], { field: 'name', direction: 'asc' });
};

export const getTag = async (id) => {
  return await getDocument(COLLECTION, id);
};

export const createTag = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || '',
    brandIds: Array.isArray(data.brandIds) ? data.brandIds.filter(Boolean) : []
  });
};

export const updateTag = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.brandIds !== undefined) {
    payload.brandIds = Array.isArray(data.brandIds) ? data.brandIds.filter(Boolean) : [];
  }
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteTag = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
