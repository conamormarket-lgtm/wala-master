import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getProducts } from '../services/products';
import { DEFAULT_VENDOR_ID } from '../constants/marketplace';

// Panel del VENDEDOR (scaffold Fase 1): lista los productos del vendedor logueado
// (por userProfile.vendorId). El rol `vendor` por custom claims y el CRUD completo
// llegan en Fase 3; por ahora es la base visible del área multi-vendor.
const VendorPanel = () => {
  const { user, userProfile, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vendedor efectivo: el del perfil; los admin ven el vendedor "casa" por defecto.
  const vendorId = userProfile?.vendorId || (isAdmin ? DEFAULT_VENDOR_ID : null);

  useEffect(() => {
    let active = true;
    if (!vendorId) { setLoading(false); return; }
    setLoading(true);
    getProducts().then(({ data }) => {
      if (!active) return;
      setItems((data || []).filter((p) => p.vendorId === vendorId));
      setLoading(false);
    });
    return () => { active = false; };
  }, [vendorId]);

  const wrap = { maxWidth: 1000, margin: '0 auto', padding: '16px' };

  if (!user) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 22 }}>Panel de vendedor</h1>
        <p style={{ color: '#666' }}>Inicia sesión para acceder a tu área de vendedor.</p>
        <Link to="/login" style={{ color: '#7C3AED' }}>Iniciar sesión</Link>
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 22 }}>Panel de vendedor</h1>
        <p style={{ color: '#666' }}>
          Tu cuenta aún no está asociada a un vendedor. El alta de vendedores (rol <code>vendor</code>)
          se habilita en la Fase 3 del marketplace.
        </p>
        <Link to="/" style={{ color: '#7C3AED' }}>← Volver a la tienda</Link>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 22 }}>Panel de vendedor · <span style={{ color: '#7C3AED' }}>{vendorId}</span></h1>
        <Link to="/admin/productos/nuevo" style={{ padding: '8px 14px', background: '#7C3AED', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
          + Nuevo producto
        </Link>
      </div>
      <p style={{ color: '#666', marginBottom: 16 }}>
        {loading ? 'Cargando…' : `${items.length} producto(s) de este vendedor`}
      </p>

      {!loading && items.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>
          Sin productos para este vendedor. (Conecta Firebase para cargar el catálogo.)
        </div>
      )}

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
              <th style={{ padding: 8 }}>Producto</th>
              <th style={{ padding: 8 }}>Nicho</th>
              <th style={{ padding: 8 }}>Tipo</th>
              <th style={{ padding: 8 }}>Precio</th>
              <th style={{ padding: 8 }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8 }}>{p.name}</td>
                <td style={{ padding: 8 }}>{p.nicheId}</td>
                <td style={{ padding: 8 }}>{p.fulfillmentType}</td>
                <td style={{ padding: 8 }}>S/ {p.salePrice ?? p.price}</td>
                <td style={{ padding: 8 }}>{p.inStock ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 24 }}>
        <Link to="/" style={{ color: '#7C3AED' }}>← Volver a la tienda</Link>
      </div>
    </div>
  );
};

export default VendorPanel;
