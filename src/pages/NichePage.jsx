import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { searchCatalog } from '../services/search';
import { getNiches } from '../services/niches';
import { getCategories } from '../services/products';
import ProductCard from './Tienda/components/ProductCard/ProductCard';
import { useAuth } from '../contexts/AuthContext';
import { trackCollectionView } from '../services/analytics/tracker';

// Página de NICHO (Fase 1): /nicho/:slug. Filtra el catálogo por nicheId usando
// searchCatalog. El slug se usa como nicheId; si existe un doc en 'niches' con ese
// slug, se muestra su nombre. Funciona con el nicho por defecto ('regala-con-amor')
// aunque la colección 'niches' aún esté vacía.
const PAGE_SIZE = 24;

const NichePage = () => {
  const { slug } = useParams();
  const [niche, setNiche] = useState(null);
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => { getCategories().then((r) => setCategories(r.data || [])); }, []);

  // Analytics aditivo (fire-and-forget): registra la vista de la colección/nicho al montar.
  // El nicho funciona como agrupación tipo colección; se usa su id/slug y nombre reales.
  // Guard por slug: se emite UNA sola vez por nicho (evita duplicar collection_view en re-render).
  const trackedSlugRef = useRef(null);
  useEffect(() => {
    if (!slug || trackedSlugRef.current === slug) return;
    trackedSlugRef.current = slug;
    try {
      trackCollectionView(
        { collectionId: niche?.id || slug, collectionName: niche?.name || slug },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }
      ).catch(() => {});
    } catch {}
  }, [slug, niche, user]);

  useEffect(() => {
    getNiches().then((r) => {
      const found = (r.data || []).find((n) => n.slug === slug || n.id === slug);
      setNiche(found || null);
    });
  }, [slug]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    searchCatalog({ facets: { nicheId: slug }, sort: 'newest', page: 1, pageSize: PAGE_SIZE }).then((r) => {
      if (active) { setResult(r); setLoading(false); }
    });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    let active = true;
    searchCatalog({ facets: { nicheId: slug }, sort: 'newest', page, pageSize: PAGE_SIZE }).then((r) => {
      if (active) setResult(r);
    });
    return () => { active = false; };
  }, [page, slug]);

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '16px' };
  const title = niche?.name || slug;

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>{title}</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        {loading ? 'Cargando…' : `${result?.total ?? 0} producto(s) en este nicho`}
      </p>

      {!loading && result && result.items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          Aún no hay productos en este nicho. {result.total === 0 && '(Conecta Firebase para cargar el catálogo.)'}
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
        <Link to="/buscar" style={{ color: '#7C3AED', marginRight: 16 }}>Buscar productos</Link>
        <Link to="/" style={{ color: '#7C3AED' }}>← Volver a la tienda</Link>
      </div>
    </div>
  );
};

export default NichePage;
