import React, { useEffect, useState } from 'react';
import { getCollection, updateDocument } from '../../services/firebase/firestore';

const estadoBadge = (estado) => {
  const map = {
    pendiente: { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
    respondido: { bg: '#dcfce7', color: '#166534', label: 'Respondido' },
  };
  const s = map[estado] || map.pendiente;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600 }}>
      {s.label}
    </span>
  );
};

const fmtFecha = (createdAt) => {
  if (!createdAt) return '—';
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString('es-PE');
};

const AdminLibroReclamaciones = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [respuestas, setRespuestas] = useState({}); // id -> texto
  const [guardando, setGuardando] = useState(null);

  const cargar = async () => {
    setLoading(true);
    const { data, error: err } = await getCollection(
      'libro_reclamaciones',
      [],
      { field: 'createdAt', direction: 'desc' }
    );
    if (err) setError(err);
    else setItems(data);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const marcarRespondido = async (item) => {
    const texto = (respuestas[item.id] || '').trim();
    if (!texto) { alert('Escribe la respuesta antes de marcar como respondido.'); return; }
    setGuardando(item.id);
    const { error: err } = await updateDocument('libro_reclamaciones', item.id, {
      estado: 'respondido',
      respuestaProveedor: texto,
      respondidoEn: new Date().toISOString(),
    });
    setGuardando(null);
    if (err) { alert(`Error al guardar: ${err}`); return; }
    await cargar();
  };

  const visibles = items.filter((i) => filtro === 'todos' || i.estado === filtro);
  const pendientes = items.filter((i) => i.estado === 'pendiente').length;

  return (
    <div style={{ maxWidth: 900, margin: '1.5rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.6rem', color: '#1e293b', marginBottom: 4 }}>Libro de Reclamaciones</h1>
      <p style={{ color: '#64748b', marginBottom: 20 }}>
        {pendientes > 0
          ? `Tienes ${pendientes} reclamación(es) pendiente(s) de respuesta.`
          : 'No hay reclamaciones pendientes.'}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['todos', 'pendiente', 'respondido'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
              background: filtro === f ? '#4f46e5' : '#fff',
              color: filtro === f ? '#fff' : '#334155',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
        <button onClick={cargar} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
          ↻ Refrescar
        </button>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Cargando…</p>}
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 12, borderRadius: 8 }}>{error}</div>}
      {!loading && !error && visibles.length === 0 && (
        <p style={{ color: '#94a3b8' }}>No hay reclamaciones en esta vista.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visibles.map((item) => (
          <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: '#0f172a' }}>{item.codigo || item.id}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: 10 }}>{fmtFecha(item.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                  {item.reclamo?.tipo === 'queja' ? 'Queja' : 'Reclamo'}
                </span>
                {estadoBadge(item.estado)}
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
              <p style={{ margin: '2px 0' }}>
                <strong>Consumidor:</strong> {item.consumidor?.nombre} — {item.consumidor?.tipoDocumento} {item.consumidor?.numeroDocumento}
              </p>
              <p style={{ margin: '2px 0' }}>
                <strong>Contacto:</strong> {item.consumidor?.email} · {item.consumidor?.telefono}
              </p>
              <p style={{ margin: '2px 0' }}>
                <strong>Bien ({item.bien?.tipo}):</strong> {item.bien?.descripcion}
                {item.bien?.montoReclamado ? ` · S/ ${Number(item.bien.montoReclamado).toFixed(2)}` : ''}
              </p>
              <p style={{ margin: '8px 0 2px' }}><strong>Detalle:</strong> {item.reclamo?.detalle}</p>
              <p style={{ margin: '2px 0' }}><strong>Pedido del consumidor:</strong> {item.reclamo?.pedido}</p>
            </div>

            {item.estado === 'respondido' ? (
              <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                <strong style={{ color: '#166534', fontSize: '0.85rem' }}>Respuesta enviada:</strong>
                <p style={{ margin: '6px 0 0', color: '#15803d', fontSize: '0.9rem' }}>{item.respuestaProveedor}</p>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <textarea
                  placeholder="Escribe la respuesta al consumidor…"
                  value={respuestas[item.id] || ''}
                  onChange={(e) => setRespuestas((p) => ({ ...p, [item.id]: e.target.value }))}
                  style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
                <button
                  onClick={() => marcarRespondido(item)}
                  disabled={guardando === item.id}
                  style={{ marginTop: 8, padding: '8px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: guardando === item.id ? 0.6 : 1 }}
                >
                  {guardando === item.id ? 'Guardando…' : 'Marcar como respondido'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminLibroReclamaciones;
