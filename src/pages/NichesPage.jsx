import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNiches } from '../services/niches';

// Directorio público de NICHOS: /nichos. Lista todos los nichos en un grid de
// tarjetas; cada tarjeta enlaza a /nicho/<slug> (o /nicho/<id> si no hay slug).
// Estilo inline, como src/pages/NichePage.jsx (sin css module).
const NichesPage = () => {
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getNiches().then((r) => {
      if (active) {
        setNiches(r.data || []);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '16px' };

  const typeLabel = (type) => {
    if (type === 'personalizados') return 'Personalizados';
    if (type === 'general') return 'General';
    return type || 'General';
  };

  const cardStyle = {
    display: 'block',
    border: '1px solid #eee',
    borderRadius: 12,
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Explora por nicho</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        {loading ? 'Cargando…' : `${niches.length} nicho(s) disponibles`}
      </p>

      {!loading && niches.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          Aún no hay nichos; créalos en el panel admin.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {niches.map((n) => {
          const to = `/nicho/${n.slug || n.id}`;
          return (
            <Link key={n.id || n.slug} to={to} style={cardStyle}>
              {n.imageUrl ? (
                <img
                  src={n.imageUrl}
                  alt={n.name || n.slug}
                  style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: 140,
                    background: 'linear-gradient(135deg, #EDE9FE, #F5F3FF)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#7C3AED',
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  {(n.name || n.slug || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {n.name || n.slug}
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 12,
                    color: '#7C3AED',
                    background: '#F5F3FF',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  {typeLabel(n.type)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <Link to="/buscar" style={{ color: '#7C3AED', marginRight: 16 }}>Buscar productos</Link>
        <Link to="/" style={{ color: '#7C3AED' }}>← Volver a la tienda</Link>
      </div>
    </div>
  );
};

export default NichesPage;
