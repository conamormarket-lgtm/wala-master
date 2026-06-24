import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Nichos del marketplace (Fase 1). Cada nicho agrupa catálogo/vendedores (p.ej.
// "ropa personalizada", "marketplace general"). Colección Firestore: 'niches'.
const COLLECTION = 'niches';

export const getNiches = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

export const getNiche = async (id) => await getDocument(COLLECTION, id);

export const createNiche = async (data) => {
  return await createDocument(COLLECTION, {
    slug: (data.slug || '').trim(),
    name: data.name || '',
    type: data.type || 'general',          // 'personalizados' | 'general' | ...
    commissionPct: typeof data.commissionPct === 'number' ? data.commissionPct : 0,
    imageUrl: data.imageUrl || '',
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : 0,
    createdAt: new Date().toISOString(),
  });
};

export const updateNiche = async (id, data) => {
  const payload = {};
  ['slug', 'name', 'type', 'commissionPct', 'imageUrl', 'active', 'order'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  payload.updatedAt = new Date().toISOString();
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteNiche = async (id) => await deleteDocument(COLLECTION, id);
