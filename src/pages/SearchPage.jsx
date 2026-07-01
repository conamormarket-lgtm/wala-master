import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchCatalog, searchProductsFirestore } from '../services/search';
import { getCategories } from '../services/products';
import { getBrand } from '../services/brands';
import { FULFILLMENT_TYPES } from '../constants/marketplace';
import ProductCard from './Tienda/components/ProductCard/ProductCard';

// Página de búsqueda/descubrimiento — usa el servicio de búsqueda por Firestore
// (searchProductsFirestore) con paginación por cursor (limit + startAfter). Las
// FACETAS se conservan filtrando en CLIENTE sobre los resultados acumulados, igual
// que antes. Si Firestore no puede resolver la query (pre-backfill / sin índice /
// término vacío), el servicio cae solo a la búsqueda en memoria: la página no se
// entera y sigue funcionando.
const PAGE_SIZE = 24;

const priceOf = (p) => (p.salePrice != null ? p.salePrice : p.price) || 0;

// Ordenadores en cliente (la query Firestore ordena por nameLower; el orden visible
// se aplica aquí sobre los resultados acumulados, como las facetas).
const SORTERS = {
  newest: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  price: (a, b) => priceOf(a) - priceOf(b),
  'price-desc': (a, b) => priceOf(b) - priceOf(a),
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
};

// Filtro de facetas en cliente sobre la página/acumulado (espeja matchesFacets de search.js).
const matchesFacets = (p, f = {}) => {
  if (f.fulfillmentType && p.fulfillmentType !== f.fulfillmentType) return false;
  if (f.nicheId && p.nicheId !== f.nicheId) return false;
  if (f.vendorId && p.vendorId !== f.vendorId) return false;
  if (f.brandId && p.brandId !== f.brandId) return false;
  return true;
};

const facetCounts = (items, key) => {
  const counts = {};
  for (const p of items) {
    const v = p[key];
    if (v == null || v === '') continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
};

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const term = params.get('q') || '';
  // Filtro OPCIONAL de marca (multimarca): ?brand=<id de tienda_brands>. Lo agrega
  // el Header cuando la búsqueda se dispara DESDE una página de marca (brandActual),
  // para que el usuario no sea expulsado al catálogo global. Sin este parámetro
  // (búsqueda global / Con Amor) el comportamiento queda EXACTO como hoy.
  const brandFilter = params.get('brand') || '';
  const [input, setInput] = useState(term);
  const [sort, setSort] = useState('newest');
  const [facets, setFacets] = useState({});

  // Resultados ACUMULADOS por cursor + estado de paginación Firestore.
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  // Doc de la marca del filtro (solo para mostrar su nombre en el indicador). Sin
  // brandFilter no se pide nada (retrocompatible: sin marca = búsqueda global).
  const [brandInfo, setBrandInfo] = useState(null);

  // Token de petición: evita que respuestas viejas (de un término anterior)
  // sobrescriban las nuevas si llegan fuera de orden.
  const reqRef = useRef(0);

  useEffect(() => { getCategories().then((r) => setCategories(r.data || [])); }, []);
  useEffect(() => { setInput(term); }, [term]);

  useEffect(() => {
    if (!brandFilter) { setBrandInfo(null); return; }
    let mounted = true;
    getBrand(brandFilter).then((r) => { if (mounted) setBrandInfo(r?.data || null); });
    return () => { mounted = false; };
  }, [brandFilter]);

  // Al cambiar el término: reinicia acumulado y trae la primera página por cursor.
  useEffect(() => {
    const myReq = ++reqRef.current;
    setLoading(true);
    setItems([]);
    setCursor(null);
    setHasMore(false);
    searchProductsFirestore({ term, cursor: null, pageSize: PAGE_SIZE }).then((r) => {
      if (myReq !== reqRef.current) return; // respuesta obsoleta
      setItems(r.items || []);
      setCursor(r.lastDoc || null);
      setHasMore(Boolean(r.hasMore));
      setLoading(false);
    });
  }, [term]);

  // "Cargar más": siguiente página por cursor, se concatena al acumulado.
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const myReq = reqRef.current;
    setLoading(true);
    searchProductsFirestore({ term, cursor, pageSize: PAGE_SIZE }).then((r) => {
      if (myReq !== reqRef.current) return;
      setItems((prev) => prev.concat(r.items || []));
      setCursor(r.lastDoc || null);
      setHasMore(Boolean(r.hasMore));
      setLoading(false);
    });
  }, [term, cursor, hasMore, loading]);

  const submit = useCallback((e) => {
    e.preventDefault();
    // Conserva el filtro de marca (si vino en la URL) al re-buscar, para que el
    // usuario no "salga" de su tienda al escribir un nuevo término.
    const next = {};
    if (input) next.q = input;
    if (brandFilter) next.brand = brandFilter;
    setParams(next);
  }, [input, brandFilter, setParams]);

  const toggleFacet = (key, value) => {
    setFacets((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));
  };

  // Facetado + orden EN CLIENTE sobre el acumulado (conserva el comportamiento de antes).
  // Si hay brandFilter (?brand=), se acota además a esa marca (client-side, sin
  // índices nuevos). Sin brandFilter, queda exactamente igual que hoy (global).
  const visible = useMemo(() => {
    const filtered = items.filter((p) =>
      p.visible !== false &&
      matchesFacets(p, facets) &&
      (!brandFilter || p.brandId === brandFilter)
    );
    return SORTERS[sort] ? filtered.slice().sort(SORTERS[sort]) : filtered;
  }, [items, facets, sort, brandFilter]);

  const facetData = useMemo(() => ({
    nicheId: facetCounts(items, 'nicheId'),
  }), [items]);

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '16px' };
  const chip = (active) => ({
    padding: '4px 10px', borderRadius: 16, border: '1px solid #ddd', cursor: 'pointer',
    background: active ? '#7C3AED' : '#fff', color: active ? '#fff' : '#333', fontSize: 13,
  });

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Buscar productos</h1>

      {/* Indicador de búsqueda acotada a marca (?brand=). Sin brandFilter no se
          renderiza nada, quedando la página EXACTA a como estaba (búsqueda global). */}
      {brandFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: '#666' }}>
          <span>
            Buscando en: <strong style={{ color: '#7C3AED' }}>{brandInfo?.name || 'tu tienda'}</strong>
          </span>
          <Link to={term ? `/buscar?q=${encodeURIComponent(term)}` : '/buscar'} style={{ color: '#7C3AED' }}>
            Buscar en todo el catálogo
          </Link>
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="¿Qué buscas? (polo, taza, gorro...)"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '10px 18px', borderRadius: 8, background: '#7C3AED', color: '#fff', border: 0 }}>
          Buscar
        </button>
      </form>

      {/* Facetas: tipo de cumplimiento (personalizado vs stock) y por nicho */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <span style={chip(facets.fulfillmentType === FULFILLMENT_TYPES.PRINT_ON_DEMAND)} onClick={() => toggleFacet('fulfillmentType', FULFILLMENT_TYPES.PRINT_ON_DEMAND)}>Personalizado</span>
        <span style={chip(facets.fulfillmentType === FULFILLMENT_TYPES.STOCK)} onClick={() => toggleFacet('fulfillmentType', FULFILLMENT_TYPES.STOCK)}>En stock</span>
        {Object.keys(facetData.nicheId || {}).map((n) => (
          <span key={n} style={chip(facets.nicheId === n)} onClick={() => toggleFacet('nicheId', n)}>{n} ({facetData.nicheId[n]})</span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
        <span style={{ color: '#666', fontSize: 14 }}>
          {loading && items.length === 0 ? 'Buscando…' : `${visible.length} resultado(s)${hasMore ? '+' : ''}`}
        </span>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8 }}>
          <option value="newest">Más nuevos</option>
          <option value="price">Precio: menor a mayor</option>
          <option value="price-desc">Precio: mayor a menor</option>
          <option value="name">Nombre (A-Z)</option>
        </select>
      </div>

      {!loading && visible.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          Sin resultados. {items.length === 0 && '(Si el catálogo está vacío, conecta Firebase para cargar productos.)'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} categories={categories} />
        ))}
      </div>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
          <button disabled={loading} onClick={loadMore} style={{ padding: '10px 22px', borderRadius: 8, background: '#fff', border: '1px solid #7C3AED', color: '#7C3AED', cursor: 'pointer' }}>
            {loading ? 'Cargando…' : 'Cargar más'}
          </button>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link to="/" style={{ color: '#7C3AED' }}>← Volver a la tienda</Link>
      </div>
    </div>
  );
};

export default SearchPage;
