import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Entidad VENDEDOR del marketplace (Fase 1). Evoluciona de una simple etiqueta a una
// entidad real (ownerUid, comisión, payout, nichos). getVendors/createVendor({name})
// siguen funcionando para no romper a los llamadores actuales.
const COLLECTION = 'vendors';

export const getVendors = async () => {
  return await getCollection(COLLECTION, [], { field: 'name', direction: 'asc' });
};

export const getVendor = async (id) => await getDocument(COLLECTION, id);

export const createVendor = async (data) => {
  const payload = {
    name: data.name || '',
    displayName: data.displayName || data.name || '',
    ownerUid: data.ownerUid || null,
    status: data.status || 'active',   // 'active' | 'pending' | 'suspended'
    type: data.type || 'house',        // 'house' | 'pod' | 'reseller' | 'self-fulfill'
    niches: Array.isArray(data.niches) ? data.niches : [],
    commissionPct: typeof data.commissionPct === 'number' ? data.commissionPct : 0,
    payout: data.payout || null,       // { method, cci, walletPhone }
    slug: data.slug || '',
    logoUrl: data.logoUrl || '',
    createdAt: new Date().toISOString(),
  };
  const result = await createDocument(COLLECTION, payload);
  if (result.error) throw new Error(result.error);
  return result;
};

export const updateVendor = async (id, data) => {
  const payload = {};
  ['name', 'displayName', 'ownerUid', 'status', 'type', 'niches', 'commissionPct', 'payout', 'slug', 'logoUrl'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  payload.updatedAt = new Date().toISOString();
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteVendor = async (id) => await deleteDocument(COLLECTION, id);
