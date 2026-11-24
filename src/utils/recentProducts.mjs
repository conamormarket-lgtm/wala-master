const KEY = 'wala-recent-products-v1';
const TTL = 30 * 864e5;
const valid = id => typeof id === 'string' && /^[\w-]{1,150}$/.test(id);
export function readRecentProducts(storage, now = Date.now()) {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) || '[]');
    return (Array.isArray(raw) ? raw : []).filter(x => valid(x?.id) && Number.isFinite(x.at) && x.at <= now && now - x.at < TTL).slice(0, 12);
  } catch { return []; }
}
export function rememberProduct(id, storage, now = Date.now()) {
  const old = readRecentProducts(storage, now);
  if (!valid(id)) return old.map(x => x.id);
  const rows = [{ id, at: now }, ...old.filter(x => x.id !== id)].slice(0, 12);
  try { storage?.setItem(KEY, JSON.stringify(rows)); } catch { /* Almacenamiento opcional. */ }
  return rows.filter(x => x.id !== id).map(x => x.id);
}
