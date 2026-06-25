import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Ofertas flash del marketplace (Fase 5). Colección Firestore: 'flashOffers'.
// Lectura pública; la escritura la restringen las reglas al admin.
// Cada oferta: { title, productId?, discountPct(number), startsAt, endsAt, active(bool), order(number) }.
const COLLECTION = 'flashOffers';

// Todas las ofertas (uso admin), ordenadas por `order` ascendente.
export const getFlashOffers = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

// Solo las ofertas activas (uso público en /ofertas).
export const getActiveFlashOffers = async () => {
  return await getCollection(
    COLLECTION,
    [{ field: 'active', operator: '==', value: true }],
    { field: 'order', direction: 'asc' }
  );
};

export const getFlashOffer = async (id) => await getDocument(COLLECTION, id);

export const createFlashOffer = async (data) => {
  return await createDocument(COLLECTION, {
    title: data.title || '',
    productId: (data.productId || '').trim(),
    discountPct: typeof data.discountPct === 'number' ? data.discountPct : 0,
    startsAt: data.startsAt || '',
    endsAt: data.endsAt || '',
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : 0,
  });
};

export const updateFlashOffer = async (id, data) => {
  const payload = {};
  ['title', 'productId', 'discountPct', 'startsAt', 'endsAt', 'active', 'order'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteFlashOffer = async (id) => await deleteDocument(COLLECTION, id);
