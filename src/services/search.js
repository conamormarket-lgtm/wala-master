import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from './firebase/config';
import { getProducts, getCachedProducts, normalizeSearchText, normalizeProductForRead } from './products';

const COLLECTION = 'productos_wala';

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

// ── BÚSQUEDA POR FIRESTORE (escala · solo Firestore, sin Algolia/Typesense) ──
//
// A diferencia de searchCatalog (que filtra TODO el catálogo en memoria), aquí
// la query la resuelve Firestore usando los campos derivados en write-time
// (nameLower + searchTokens, ver products.js). Dos estrategias:
//
//   1) PREFIJO (modo por defecto): where('nameLower','>=',q) &
//      where('nameLower','<', q+'') con orderBy('nameLower') + paginación
//      por cursor (limit + startAfter). '' es un code point muy alto, así
//      que el rango cubre todo lo que EMPIEZA por q. Requiere índice nameLower asc.
//
//   2) TOKEN: where('searchTokens','array-contains', q) con orderBy('nameLower')
//      — encuentra q como prefijo de CUALQUIER palabra (nombre+marca), no solo del
//      inicio del nombre. Requiere índice array-contains + nameLower.
//
// FALLBACK: si los docs aún no tienen searchTokens/nameLower (pre-backfill), o la
// query falla (falta de índice, etc.), o devuelve 0 en la primera página, se cae
// a la búsqueda en memoria (searchCatalog) para NO romper /buscar. La firma de
// retorno es {items, lastDoc, hasMore} en ambos caminos.

// Tope superior del rango de prefijo: code point alto que ordena después de
// cualquier carácter normal, así el rango [q, q+SENTINEL) cubre todo lo que
// empieza por q.
const PREFIX_SENTINEL = '';

// Camino de respaldo: reusa searchCatalog (memoria) y adapta su salida paginada
// {items,total,...} al contrato por cursor {items,lastDoc,hasMore}. Se pagina por
// número de página (no por cursor) porque la fuente es una lista en memoria; el
// "cursor" que devolvemos es el índice de la siguiente página.
async function memoryFallback({ term, pageSize, cursor }) {
  const page = (typeof cursor === 'number' && cursor > 0) ? cursor : 1;
  const r = await searchCatalog({ term, sort: 'name', page, pageSize });
  const hasMore = page < r.totalPages;
  return {
    items: r.items,
    lastDoc: hasMore ? page + 1 : null,
    hasMore,
    source: 'memory',
  };
}

/**
 * Búsqueda por Firestore con paginación por cursor.
 *
 * @param {Object}  params
 * @param {string}  params.term       término del usuario (se normaliza igual que en write)
 * @param {('prefix'|'token')} [params.mode='prefix']  estrategia de query
 * @param {*}       [params.cursor]   DocumentSnapshot de la página anterior (lastDoc) o null
 * @param {number}  [params.pageSize] tamaño de página (def. 24)
 * @returns {Promise<{ items: object[], lastDoc: *, hasMore: boolean, source: string }>}
 */
export async function searchProductsFirestore({ term = '', mode = 'prefix', cursor = null, pageSize = 24 } = {}) {
  const q = normalizeSearchText(term);

  // Sin término, sin Firestore, o continuando una búsqueda que YA cayó a memoria
  // (cursor numérico = índice de página en memoria): mantener UNA sola fuente por
  // búsqueda. Si no, el cursor numérico se cruzaría a startAfter() de Firestore (que lo
  // interpreta como valor de campo y NO lanza) → "Cargar más" devolvería resultados
  // arbitrarios en estado pre-backfill. Por eso enrutamos a memoria cuando cursor es number.
  if (!q || !db || typeof cursor === 'number') {
    return memoryFallback({ term, pageSize, cursor });
  }

  try {
    let qry;
    if (mode === 'token') {
      // array-contains sobre searchTokens; orden estable por nameLower para cursor.
      qry = query(
        collection(db, COLLECTION),
        where('searchTokens', 'array-contains', q),
        orderBy('nameLower'),
      );
    } else {
      // Prefijo sobre nameLower: [q, q+SENTINEL).
      qry = query(
        collection(db, COLLECTION),
        where('nameLower', '>=', q),
        where('nameLower', '<', q + PREFIX_SENTINEL),
        orderBy('nameLower'),
      );
    }

    qry = cursor ? query(qry, startAfter(cursor), limit(pageSize)) : query(qry, limit(pageSize));

    const snap = await getDocs(qry);
    const rawCount = snap.docs.length;

    // PRE-BACKFILL / sin resultados en la 1ª página: no asumimos "vacío", caemos a
    // memoria (los docs viejos no tienen nameLower/searchTokens y Firestore los
    // EXCLUYE de estas queries). En páginas siguientes (cursor) sí respetamos vacío.
    if (cursor == null && rawCount === 0) {
      return memoryFallback({ term, pageSize, cursor: null });
    }

    const items = snap.docs
      .map((d) => normalizeProductForRead({ id: d.id, ...d.data() }))
      .filter((p) => p.visible !== false);

    const lastDoc = snap.docs[snap.docs.length - 1] || null;
    return {
      items,
      lastDoc,
      hasMore: rawCount === pageSize,
      source: 'firestore',
    };
  } catch (e) {
    // Falta de índice u otro error: no rompemos /buscar, caemos a memoria.
    return memoryFallback({ term, pageSize, cursor });
  }
}
