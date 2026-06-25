// ── Servicio de pagos a vendedores / payouts (Fase 3) ───────────────────────
// Colección Firestore: 'payouts' { vendorId, amount (number), status }.
// Lectura y escritura SOLO admin (ver firebase/firestore.rules → match /payouts).
// También agrega los montos a pagar leyendo 'subOrders' (vendorPayoutAmount) para
// que el admin vea cuánto debe a cada vendedor antes de registrar el pago.
import {
  getCollection,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from './firebase/firestore';

const COLLECTION = 'payouts';

// Estados válidos de un payout. 'pending' = registrado/por pagar; 'paid' = pagado.
export const PAYOUT_STATUSES = ['pending', 'paid', 'cancelled'];

// Lista los payouts registrados (más recientes primero por createdAt).
export const getPayouts = async () => {
  return await getCollection(COLLECTION, [], { field: 'createdAt', direction: 'desc' });
};

export const getPayout = async (id) => await getDocument(COLLECTION, id);

// Crea un registro de payout para un vendedor.
export const createPayout = async (data) => {
  return await createDocument(COLLECTION, {
    vendorId: (data.vendorId || '').trim(),
    amount: typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0,
    status: PAYOUT_STATUSES.includes(data.status) ? data.status : 'pending',
    note: (data.note || '').trim() || null,
  });
};

// Actualiza un payout (típicamente su estado o el monto).
export const updatePayout = async (id, data) => {
  const payload = {};
  ['vendorId', 'amount', 'status', 'note'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  return await updateDocument(COLLECTION, id, payload);
};

export const deletePayout = async (id) => await deleteDocument(COLLECTION, id);

// Agrega lo que se debe a cada vendedor a partir de subOrders.
// Suma vendorPayoutAmount de las subórdenes NO pagadas (status != 'paid').
// Devuelve { error, data: [{ vendorId, pendingAmount, subOrderCount }] }.
export const getVendorPayoutSummary = async () => {
  const { data, error } = await getCollection('subOrders', [], null);
  if (error) return { data: [], error };
  const byVendor = new Map();
  (data || []).forEach((s) => {
    if (!s.vendorId) return;
    if (s.status === 'paid') return; // ya liquidada
    const cur = byVendor.get(s.vendorId) || { vendorId: s.vendorId, pendingAmount: 0, subOrderCount: 0 };
    cur.pendingAmount += Number(s.vendorPayoutAmount) || 0;
    cur.subOrderCount += 1;
    byVendor.set(s.vendorId, cur);
  });
  const summary = Array.from(byVendor.values())
    .map((v) => ({ ...v, pendingAmount: +v.pendingAmount.toFixed(2) }))
    .sort((a, b) => b.pendingAmount - a.pendingAmount);
  return { data: summary, error: null };
};
