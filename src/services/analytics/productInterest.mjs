// Interés por producto de UN usuario a partir de sus eventos de analítica.
//
// El tiempo en una ficha se guarda como `route_dwell` con path
// "/producto/<id>" (sin el id como campo), y la vista como `product_view` con
// `eventData.productId/name/category`. Acá se juntan las dos por productId para
// responder "¿en qué productos pasa más tiempo?". Pura: sin Firebase.

const PRODUCT_PATH = /^\/producto\/([^/?#]+)/;

export function productIdFromPath(path) {
  const m = PRODUCT_PATH.exec(String(path || ''));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {Array} events  eventos de analytics_events del usuario
 * @returns {Array<{productId, name, category, categoryId, views, dwellMs, lastSeenMs}>}
 *          ordenado por tiempo (desc) y, a igual tiempo, por vistas.
 */
export function aggregateProductInterest(events) {
  const byId = new Map();
  const get = (id) => {
    if (!byId.has(id)) {
      byId.set(id, { productId: id, name: null, category: null, categoryId: null, views: 0, dwellMs: 0, lastSeenMs: 0 });
    }
    return byId.get(id);
  };

  for (const e of events || []) {
    if (!e) continue;
    const ts = num(e.clientTsMs);
    if (e.type === 'product_view') {
      const d = e.eventData || {};
      const id = d.productId || productIdFromPath(e.path);
      if (!id) continue;
      const row = get(String(id));
      row.views += 1;
      if (d.name && !row.name) row.name = d.name;
      if (d.category && !row.category) row.category = d.category;
      if (d.categoryId && !row.categoryId) row.categoryId = d.categoryId;
      row.lastSeenMs = Math.max(row.lastSeenMs, ts);
    } else if (e.type === 'route_dwell') {
      const id = productIdFromPath(e.path);
      if (!id) continue;
      const row = get(id);
      row.dwellMs += num(e.dwellMs);
      row.lastSeenMs = Math.max(row.lastSeenMs, ts);
    }
  }

  return [...byId.values()].sort((a, b) => (b.dwellMs - a.dwellMs) || (b.views - a.views));
}

/**
 * Productos para recomendar a partir de lo que el usuario más miró: otros
 * productos del catálogo que comparten categoría con los vistos, puntuados por
 * cuánto tiempo pasó en los vistos de esa categoría. Excluye lo ya visto.
 * @param {Array} interest  salida de aggregateProductInterest
 * @param {Array} catalogo  productos (id, categories[], visible, deleted)
 */
export function recomendarSimilares(interest, catalogo, n = 6) {
  const porId = new Map((catalogo || []).map((p) => [String(p.id), p]));
  const vistos = new Set((interest || []).map((r) => String(r.productId)));
  const pesoCategoria = new Map();
  (interest || []).slice(0, 10).forEach((r, i) => {
    const p = porId.get(String(r.productId));
    const cats = Array.isArray(p?.categories) ? p.categories : (r.categoryId ? [r.categoryId] : []);
    // Tiempo en segundos + un punto por vista; los primeros pesan algo más.
    const peso = (r.dwellMs / 1000 + r.views) * (1 + (10 - i) / 10);
    cats.forEach((c) => pesoCategoria.set(c, (pesoCategoria.get(c) || 0) + peso));
  });
  if (pesoCategoria.size === 0) return [];

  return (catalogo || [])
    .filter((p) => p && !vistos.has(String(p.id)) && p.visible !== false && !p.deleted)
    .map((p) => ({
      producto: p,
      score: (Array.isArray(p.categories) ? p.categories : []).reduce((acc, c) => acc + (pesoCategoria.get(c) || 0), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.producto);
}
