// "🔥 Interés por producto": quién pasó tiempo en qué ficha de producto.
//
// Lee los `route_dwell` del período (índice type + clientTsMs ya existente en
// firestore.indexes.json), los agrupa por usuario logueado y producto, y se
// queda con los pares que superan un tiempo mínimo. Luego trae el perfil de
// esos usuarios (nombre, teléfono, permiso de WhatsApp) para poder escribirles.
import { getCollection, getDocument } from './firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES } from './analytics/schema';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { productIdFromPath } from './analytics/productInterest.mjs';

const EVENTS_LIMIT = 4000;
const MAX_LEADS = 80;

export async function getProductInterestLeads({ days = 7, minMs = 60000 } = {}) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const { data: events, error } = await getCollection(
    ANALYTICS_COLLECTIONS.EVENTS,
    [
      { field: 'type', operator: '==', value: ANALYTICS_EVENT_TYPES.ROUTE_DWELL },
      { field: 'clientTsMs', operator: '>=', value: since },
    ],
    { field: 'clientTsMs', direction: 'desc' },
    EVENTS_LIMIT
  );
  if (error) return { data: null, error };

  // uid|productId -> { uid, productId, dwellMs, visits, lastSeenMs }
  const pares = new Map();
  // productId -> { productId, dwellMs, users:Set }
  const porProducto = new Map();
  for (const e of events || []) {
    const productId = productIdFromPath(e.path);
    if (!productId) continue;
    const dwell = Number(e.dwellMs) || 0;
    const ts = Number(e.clientTsMs) || 0;

    if (!porProducto.has(productId)) porProducto.set(productId, { productId, dwellMs: 0, users: new Set(), anon: 0 });
    const prod = porProducto.get(productId);
    prod.dwellMs += dwell;
    if (e.uid) prod.users.add(e.uid);
    else prod.anon += 1;

    if (!e.uid) continue;
    const key = `${e.uid}|${productId}`;
    if (!pares.has(key)) pares.set(key, { uid: e.uid, productId, dwellMs: 0, visits: 0, lastSeenMs: 0, displayName: e.displayName || null });
    const par = pares.get(key);
    par.dwellMs += dwell;
    par.visits += 1;
    par.lastSeenMs = Math.max(par.lastSeenMs, ts);
  }

  const leads = [...pares.values()]
    .filter((p) => p.dwellMs >= minMs)
    .sort((a, b) => b.dwellMs - a.dwellMs)
    .slice(0, MAX_LEADS);

  // Un perfil por usuario (no por par): varios productos del mismo cliente
  // comparten la misma lectura.
  const uids = [...new Set(leads.map((l) => l.uid))];
  const perfiles = new Map();
  await Promise.all(uids.map(async (uid) => {
    const { data } = await getDocument(PORTAL_USERS_COLLECTION, uid);
    if (data) perfiles.set(uid, data);
  }));

  const ranking = [...porProducto.values()]
    .map((p) => ({ productId: p.productId, dwellMs: p.dwellMs, users: p.users.size, anon: p.anon }))
    .sort((a, b) => b.dwellMs - a.dwellMs)
    .slice(0, 12);

  return {
    data: {
      leads: leads.map((l) => ({ ...l, perfil: perfiles.get(l.uid) || null })),
      ranking,
      truncated: (events || []).length >= EVENTS_LIMIT,
      eventsRead: (events || []).length,
    },
    error: null,
  };
}
