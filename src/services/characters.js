import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

const COLLECTION = 'characters';

export const getCharacters = async () => {
  return await getCollection(COLLECTION, [], { field: 'name', direction: 'asc' });
};

export const getCharacter = async (id) => {
  return await getDocument(COLLECTION, id);
};

export const createCharacter = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || ''
  });
};

export const updateCharacter = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteCharacter = async (id) => {
  return await deleteDocument(COLLECTION, id);
};
