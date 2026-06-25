import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Zonas de envío del marketplace (Fase 3). Cada zona define un costo y un ETA
// para un departamento. Colección Firestore: 'shippingZones'.
const COLLECTION = 'shippingZones';

export const getShippingZones = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

export const getShippingZone = async (id) => await getDocument(COLLECTION, id);

export const createShippingZone = async (data) => {
  return await createDocument(COLLECTION, {
    name: (data.name || '').trim(),
    departamento: (data.departamento || '').trim(),
    cost: typeof data.cost === 'number' ? data.cost : Number(data.cost) || 0,
    etaDays: typeof data.etaDays === 'number' ? data.etaDays : Number(data.etaDays) || 0,
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : Number(data.order) || 0,
    createdAt: new Date().toISOString(),
  });
};

export const updateShippingZone = async (id, data) => {
  const payload = {};
  ['name', 'departamento', 'cost', 'etaDays', 'active', 'order'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  payload.updatedAt = new Date().toISOString();
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteShippingZone = async (id) => await deleteDocument(COLLECTION, id);
