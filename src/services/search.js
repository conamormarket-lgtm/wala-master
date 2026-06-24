import { getProducts, getCachedProducts } from './products';

// Capa de BÚSQUEDA / DESCUBRIMIENTO con facetas y paginación (Fase 1).
//
// HOY: filtra/ordena/pagina en memoria sobre el catálogo cacheado — funciona ya en
// local sin servicio externo y soporta facetas (nicho, vendedor, tipo de cumplimiento,
// categoría, marca, precio, personalizable).
//
// SEAM (Fase 3): cuando el catálogo crezca, reemplazar `fetchAll()` por un adaptador
// Algolia/Typesense/Meilisearch alimentado on-write por Cloud Functions. La firma de
// `searchCatalog()` NO cambia, así que los consumidores no se tocan.

async function fetchAll() {
  const cached = getCachedProducts();
  if (cached && cached.length) return cached;
  const { data } = await getProducts();
  return data || [];
}

function priceOf(p) {
  return (p.salePrice != null ? p.salePrice : p.price) || 0;
}

function matchesFacets(p, f = {}) {
  if (f.nicheId && p.nicheId !== f.nicheId) return false;
  if (f.vendorId && p.vendorId !== f.vendorId) return false;
  if (f.fulfillmentType && p.fulfillmentType !== f.fulfillmentType) return false;
  if (f.category && !(Array.isArray(p.categories) && p.categories.includes(f.category))) return false;
  if (f.collection && !(Array.isArray(p.collections) && p.collections.includes(f.collection))) return false;
  if (f.brandId && p.brandId !== f.brandId) return false;
  if (f.tag && !(Array.isArray(p.tags) && p.tags.includes(f.tag))) return false;
  if (typeof f.minPrice === 'number' && priceOf(p) < f.minPrice) return false;
  if (typeof f.maxPrice === 'number' && priceOf(p) > f.maxPrice) return false;
  if (f.customizable !== undefined && Boolean(p.customizable) !== Boolean(f.customizable)) return false;
  return true;
}

function matchesTerm(p, term) {
  if (!term) return true;
  const t = String(term).toLowerCase();
  return [p.name, p.description, ...(p.tags || []), ...(p.categories || [])]
    .filter(Boolean)
    .some((s) => String(s).toLowerCase().includes(t));
}

const SORTERS = {
  newest: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  price: (a, b) => priceOf(a) - priceOf(b),
  'price-desc': (a, b) => priceOf(b) - priceOf(a),
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
};

// Cuenta resultados por valor de faceta (para construir filtros tipo MercadoLibre).
function facetCounts(items, key) {
  const counts = {};
  for (const p of items) {
    const v = p[key];
    if (v == null || v === '') continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

/**
 * @param {{ term?: string, facets?: object, sort?: string, page?: number, pageSize?: number }} opts
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number, totalPages: number, facets: object }>}
 */
export async function searchCatalog({ term = '', facets = {}, sort = 'newest', page = 1, pageSize = 24 } = {}) {
  const all = (await fetchAll()).filter((p) => p.visible !== false);
  let results = all.filter((p) => matchesTerm(p, term) && matchesFacets(p, facets));
  if (SORTERS[sort]) results = results.slice().sort(SORTERS[sort]);

  const total = results.length;
  const start = (page - 1) * pageSize;
  return {
    items: results.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    facets: {
      nicheId: facetCounts(results, 'nicheId'),
      vendorId: facetCounts(results, 'vendorId'),
      fulfillmentType: facetCounts(results, 'fulfillmentType'),
      brandId: facetCounts(results, 'brandId'),
    },
  };
}
