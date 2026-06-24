import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { searchCatalog } from '../services/search';
import { getVendors } from '../services/vendors';
import { getCategories } from '../services/products';
import ProductCard from './Tienda/components/ProductCard/ProductCard';

// TIENDA PÚBLICA DE UN VENDEDOR (Fase 1): /tienda-vendedor/:slug.
// Busca el vendedor por slug (getVendors) y muestra su displayName/logoUrl. Lista sus
// productos con searchCatalog filtrando por vendorId (el id del vendedor encontrado o,
// si no hay match, el propio slug — útil para el vendedor 'casa' por defecto cuyo
// vendorId puede coincidir con el slug aunque la colección 'vendors' esté vacía).
const PAGE_SIZE = 24;

const VendorStorefrontPage = () => {
  const { slug } = useParams();
  const [vendor, setVendor] = useState(null);
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCategories().then((r) => setCategories(r.data || [])); }, []);

  // Resolver el vendedor por slug. Si no hay match, dejamos vendor=null y filtramos por
  // vendorId === slug más abajo (vendedor 'casa' por defecto).
  useEffect(() => {
    let active = true;
    getVendors().then((r) => {
      if (!active) return;
      const found = (r.data || []).find((v) => v.slug === slug || v.id === slug);
      setVendor(found || null);
    });
    return () => { active = false; };
  }, [slug]);

  // vendorId efectivo: id del vendedor encontrado, o el propio slug como fallback.
  const vendorId = vendor?.id || slug;

  // Reset de página cuando cambia el vendedor/slug.
  useEffect(() => { setPage(1); }, [slug]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    searchCatalog({ facets: { vendorId }, sort: 'newest', page, pageSize: PAGE_SIZE }).then((r) => {
      if (active) { setResult(r); setLoading(false); }
    });
    return () => { active = false; };
  }, [vendorId, page]);

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '16px' };
  const title = vendor?.displayName || vendor?.name || slug;

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        {vendor?.logoUrl && (
          <img
            src={vendor.logoUrl}
            alt={title}
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee', flexShrink: 0 }}
          />
        )}
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>{title}</h1>
          <p style={{ color: '#666', margin: 0 }}>
            {loading ? 'Cargando…' : `${result?.total ?? 0} producto(s) de este vendedor`}
          </p>
        </div>
      </div>

      {!loading && result && result.items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          Este vendedor aún no tiene productos publicados.
          {result.total === 0 && ' (Conecta Firebase para cargar el catálogo.)'}
          <div style={{ marginTop: 12 }}>
            <Link to="/buscar" style={{ color: '#7C3AED' }}>Explorar otros productos</Link>
          </div>
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

export default VendorStorefrontPage;
