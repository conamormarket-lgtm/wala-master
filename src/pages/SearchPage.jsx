import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchCatalog } from '../services/search';
import { getCategories } from '../services/products';
import { FULFILLMENT_TYPES } from '../constants/marketplace';
import ProductCard from './Tienda/components/ProductCard/ProductCard';

// Página de búsqueda/descubrimiento (Fase 1) — usa searchCatalog (facetas + paginación).
// Reemplaza el filtrado client-side disperso por una sola entrada con facetas.
const PAGE_SIZE = 24;

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const term = params.get('q') || '';
  const [input, setInput] = useState(term);
  const [sort, setSort] = useState('newest');
  const [facets, setFacets] = useState({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCategories().then((r) => setCategories(r.data || [])); }, []);
  useEffect(() => { setInput(term); setPage(1); }, [term]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    searchCatalog({ term, facets, sort, page, pageSize: PAGE_SIZE }).then((r) => {
      if (active) { setResult(r); setLoading(false); }
    });
    return () => { active = false; };
  }, [term, facets, sort, page]);

  const submit = useCallback((e) => {
    e.preventDefault();
    setParams(input ? { q: input } : {});
  }, [input, setParams]);

  const toggleFacet = (key, value) => {
    setPage(1);
    setFacets((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));
  };

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '16px' };
  const chip = (active) => ({
    padding: '4px 10px', borderRadius: 16, border: '1px solid #ddd', cursor: 'pointer',
    background: active ? '#7C3AED' : '#fff', color: active ? '#fff' : '#333', fontSize: 13,
  });

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Buscar productos</h1>

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

      {/* Facetas: tipo de cumplimiento (personalizado vs stock) y por nicho/vendedor */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <span style={chip(facets.fulfillmentType === FULFILLMENT_TYPES.PRINT_ON_DEMAND)} onClick={() => toggleFacet('fulfillmentType', FULFILLMENT_TYPES.PRINT_ON_DEMAND)}>Personalizado</span>
        <span style={chip(facets.fulfillmentType === FULFILLMENT_TYPES.STOCK)} onClick={() => toggleFacet('fulfillmentType', FULFILLMENT_TYPES.STOCK)}>En stock</span>
        {result && Object.keys(result.facets.nicheId || {}).map((n) => (
          <span key={n} style={chip(facets.nicheId === n)} onClick={() => toggleFacet('nicheId', n)}>{n} ({result.facets.nicheId[n]})</span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
        <span style={{ color: '#666', fontSize: 14 }}>
          {loading ? 'Buscando…' : `${result?.total ?? 0} resultado(s)`}
        </span>
        <select value={sort} onChange={(e) => { setPage(1); setSort(e.target.value); }} style={{ padding: '6px 10px', borderRadius: 8 }}>
          <option value="newest">Más nuevos</option>
          <option value="price">Precio: menor a mayor</option>
          <option value="price-desc">Precio: mayor a menor</option>
          <option value="name">Nombre (A-Z)</option>
        </select>
      </div>

      {!loading && result && result.items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          Sin resultados. {result.total === 0 && '(Si el catálogo está vacío, conecta Firebase para cargar productos.)'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {result?.items.map((p) => (
          <ProductCard key={p.id} product={p} categories={categories} />
        ))}
      </div>

      {result && result.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '24px 0' }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '8px 14px' }}>‹ Anterior</button>
          <span style={{ padding: '8px 0' }}>Página {page} de {result.totalPages}</span>
          <button disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '8px 14px' }}>Siguiente ›</button>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link to="/" style={{ color: '#7C3AED' }}>← Volver a la tienda</Link>
      </div>
    </div>
  );
};

export default SearchPage;
