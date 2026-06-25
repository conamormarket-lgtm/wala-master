import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Catálogo de recompensas canjeables con puntos ('monedas'). Fase 2b.
// Lectura pública (vitrina del cliente), escritura solo admin (ver firestore.rules).
// Colección Firestore: 'rewardsCatalog'.
// Forma del doc: { title, description, cost (number, en puntos), value (texto ref),
//                  active (bool), order (number) }.
const COLLECTION = 'rewardsCatalog';

export const getRewards = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

export const getReward = async (id) => await getDocument(COLLECTION, id);

export const createReward = async (data) => {
  return await createDocument(COLLECTION, {
    title: data.title || '',
    description: data.description || '',
    cost: typeof data.cost === 'number' ? data.cost : 0,
    value: data.value || '',
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : 0,
  });
};

export const updateReward = async (id, data) => {
  const payload = {};
  ['title', 'description', 'cost', 'value', 'active', 'order'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteReward = async (id) => await deleteDocument(COLLECTION, id);
