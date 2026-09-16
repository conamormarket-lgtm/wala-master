import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Misiones diarias (Fase 2). Lectura pública (el cliente arma su lista de hoy),
// escritura solo admin (ver firestore.rules). Colección Firestore: 'missions'.
// Forma del doc: { title, description, rewardPoints (number, en monedas),
//                  active (bool), order (number), type: 'daily' }.
// `type` siempre 'daily': es el único valor que lee getDailyMissionsSecure
// (functions/index.js), así que no se expone como campo del formulario.
const COLLECTION = 'missions';

export const getMissions = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

export const getMission = async (id) => await getDocument(COLLECTION, id);

export const createMission = async (data) => {
  return await createDocument(COLLECTION, {
    title: data.title || '',
    description: data.description || '',
    rewardPoints: typeof data.rewardPoints === 'number' ? data.rewardPoints : 0,
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : 0,
    type: 'daily',
  });
};

export const updateMission = async (id, data) => {
  const payload = {};
  ['title', 'description', 'rewardPoints', 'active', 'order'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteMission = async (id) => await deleteDocument(COLLECTION, id);
