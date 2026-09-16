import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Misiones diarias (Fase 2). Lectura pública (el cliente arma su lista de hoy),
// escritura solo admin (ver firestore.rules). Colección Firestore: 'missions'.
// Forma del doc: { title, description, rewardPoints (number, en monedas),
//                  active (bool), order (number), type: 'daily', actionKey }.
// `type` siempre 'daily': es el único valor que lee getDailyMissionsSecure
// (functions/index.js), así que no se expone como campo del formulario.
// `actionKey` (opcional, ver src/constants/missionActions.js): si está
// seteado, completeMissionSecure exige que esa acción ya haya ocurrido de
// verdad hoy antes de pagar la recompensa. Vacío = misión de auto-reporte
// (el cliente la marca él mismo, sin comprobación).
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
    actionKey: data.actionKey || '',
  });
};

export const updateMission = async (id, data) => {
  const payload = {};
  ['title', 'description', 'rewardPoints', 'active', 'order', 'actionKey'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteMission = async (id) => await deleteDocument(COLLECTION, id);
