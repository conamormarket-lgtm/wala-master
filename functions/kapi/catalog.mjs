import { esProductoDeTienda, rutaDeCrear } from './visibility.mjs';
import giftLogic from '../giftLogic.js';
const { normalizar } = giftLogic;
import pricing from '../catalogPricing.js';

const FIELDS = ['name', 'description', 'price', 'salePrice', 'visible', 'deleted', 'reemplazadoPor',
  'esPrendaBase', 'esComboCrear', 'enTienda', 'comboCrear.publicado', 'inStock', 'mainImage', 'images',
  'galleryImages', 'comboPreviewImage', 'thumbnailWithDesignUrl', 'variants', 'mainSizes', 'sizes',
  'customizable', 'customizationViews', 'categories', 'category', 'tags', 'characters', 'collections', 'brandId'];
const TAXONOMIES = { tags: 'tags', characters: 'characters', collections: 'tienda_collections', categories: 'tienda_categories' };
export const cleanText = (value, max = 700) => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const strings = values => (Array.isArray(values) ? values : []).map(v => cleanText(typeof v === 'object' ? v?.name || v?.id : v, 80)).filter(Boolean).slice(0, 30);
const identifier = value => typeof value === 'string' && /^[\w-]{1,160}$/.test(value);
const safeImage = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
};
export function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
  return null;
}
function documentData(doc) {
  return { ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, decode(v)])), id: doc.name.split('/').pop() };
}
export function mapProduct(p, dicts = {}) {
  if (!esProductoDeTienda(p) || !identifier(p.id) || !cleanText(p.name)) return null;
  const labels = key => strings(p[key] || (key === 'categories' ? [p.category] : [])).map(id => dicts[key]?.[id] || id);
  const variants = (Array.isArray(p.variants) ? p.variants : []).slice(0, 16).map(v => ({
    name: cleanText(v.name, 60), sizes: strings(v.sizes),
  })).filter(v => v.name);
  const stock = p.inStock === false || p.inStock === 0 ? 'out'
    : p.inStock === true || (typeof p.inStock === 'number' && p.inStock > 0) ? 'available' : 'unknown';
  const price = p.price == null || p.price === '' ? null : pricing.precioDeCatalogo(p);
  const sizes = strings(p.mainSizes || p.sizes);
  const image = [p.comboPreviewImage, p.mainImage, p.thumbnailWithDesignUrl,
    ...(Array.isArray(p.variants) ? p.variants.flatMap(v => [v.imageUrl, ...(Array.isArray(v.images) ? v.images : [])]) : []),
    ...(Array.isArray(p.images) ? p.images : []), ...(Array.isArray(p.galleryImages) ? p.galleryImages : [])]
    .map(safeImage).find(Boolean) || '';
  return { id: p.id, name: cleanText(p.name, 140), description: cleanText(p.description),
    price: price !== null && price >= 0 ? price : null, currency: 'PEN', stock, sizes, variants,
    customizable: Boolean(p.customizable || p.customizationViews?.length || p.esPrendaBase || p.esComboCrear),
    categories: labels('categories'), tags: labels('tags'), characters: labels('characters'), collections: labels('collections'),
    image, path: rutaDeCrear(p) || `/producto/${p.id}` };
}
const STOP = new Set('de del la el los las un una unos unas para por con que me mi quiero busco regalo regalos recomendar recomiendame producto productos algo hasta menos soles s'.split(' '));
// Literal matching is only a complementary retrieval signal. Meaning is handled
// by semanticSearch.mjs; no per-product aliases or hand-maintained synonyms.
export function rankProducts(products, { query = '', min_price = null, max_price = null } = {}) {
  const words = [...new Set(normalizar(query).split(/\W+/).filter(w => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)))];
  return products.filter(p => p.stock !== 'out' && (min_price == null || (p.price != null && p.price >= min_price))
    && (max_price == null || (p.price != null && p.price <= max_price)))
    .map(p => {
      const strong = normalizar([p.name, ...p.categories, ...p.tags, ...p.characters, ...p.collections].join(' '));
      const description = normalizar(p.description);
      const scores = words.map(word => strong.includes(word) ? 4 : description.includes(word) ? 1 : 0);
      return { product: p, score: scores.reduce((a, b) => a + b, 0), matches: scores.every(Boolean) };
    }).filter(item => item.matches)
    .sort((a, b) => b.score - a.score || (a.product.price ?? Infinity) - (b.product.price ?? Infinity))
    .map(item => item.product);
}
export const productFacts = ({ image, path, ...facts }) => facts;

export function createCatalog({ projectId, fetchImpl = fetch, ttl = 300000, limit = 800 }) {
  if (!/^[a-z0-9-]+$/.test(projectId || '')) throw Error('Invalid catalog project');
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  let cached, loading;
  const read = async (url, options = {}) => {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Error('CATALOG_UNAVAILABLE');
    return response.json();
  };
  const query = async (collection, fields, count) => {
    const result = await read(base + ':runQuery', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], select: { fields: fields.map(fieldPath => ({ fieldPath })) }, limit: count } }) });
    return result.filter(r => r.document).map(r => documentData(r.document));
  };
  async function snapshot() {
    if (cached && Date.now() - cached.timestamp < ttl) return cached;
    if (!loading) loading = (async () => {
      const [raw, ...taxonomies] = await Promise.all([query('productos_wala', FIELDS, limit + 1),
        ...Object.values(TAXONOMIES).map(collection => query(collection, ['name'], 200))]);
      const dicts = Object.fromEntries(Object.keys(TAXONOMIES).map((key, i) => [key, Object.fromEntries(taxonomies[i].map(row => [row.id, row.name]))]));
      cached = { timestamp: Date.now(), partial: raw.length > limit, dicts,
        products: raw.slice(0, limit).map(p => mapProduct(p, dicts)).filter(Boolean) };
      return cached;
    })().finally(() => { loading = null; });
    return loading;
  }
  async function get(id) {
    if (!identifier(id)) return null;
    const mask = FIELDS.map(f => 'mask.fieldPaths=' + encodeURIComponent(f)).join('&');
    const response = await fetchImpl(`${base}/productos_wala/${encodeURIComponent(id)}?${mask}`, { signal: AbortSignal.timeout(12000) });
    if (response.status === 404) return null;
    if (!response.ok) throw Error('CATALOG_UNAVAILABLE');
    return mapProduct(documentData(await response.json()), cached?.dicts);
  }
  return {
    get, snapshot,
    async search(args) {
      const data = await snapshot();
      const matches = rankProducts(data.products, args);
      // Recheck the few candidates before quoting them; cached names never turn
      // an unpublished product or an old price into a recommendation.
      const current = (await Promise.all(matches.slice(0, 8).map(p => get(p.id)))).filter(Boolean);
      return { products: rankProducts(current, args), partial: data.partial, checkedAt: new Date().toISOString() };
    },
    status: () => ({ projectId, source: 'Catálogo publicado de Walá · solo lectura', loaded: Boolean(cached),
      count: cached?.products.length || 0, partial: cached?.partial || false }),
  };
}
