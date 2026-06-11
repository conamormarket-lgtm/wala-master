import React, { useState } from 'react';
import { createDocument } from '../../services/firebase/firestore';

const AdminGeneradorPagos = () => {
  const [concepto, setConcepto] = useState('');
  const [moneda, setMoneda] = useState('PEN');
  const [monto, setMonto] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || isNaN(monto) || Number(monto) <= 0) {
      setError('Por favor, ingresa un concepto válido y un monto mayor a 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedLink(null);

    const payload = {
      concepto: concepto.trim(),
      moneda: moneda,
      monto: Number(monto),
      // Mantenemos montoUSD o montoPEN por retrocompatibilidad/referencia
      ...(moneda === 'USD' ? { montoUSD: Number(monto) } : { montoPEN: Number(monto) }),
      estado: 'pendiente'
    };

    const { id, error: dbError } = await createDocument('enlaces_pago', payload);

    if (dbError) {
      setError(`Error al crear el enlace: ${dbError}`);
    } else if (id) {
      const link = `${window.location.origin}/pago-rapido/${id}`;
      setGeneratedLink(link);
      setConcepto('');
      setMonto('');
    }

    setLoading(false);
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      alert('¡Enlace copiado al portapapeles!');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#1e293b' }}>Generador de Enlaces de Pago</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Crea enlaces únicos para cobrar a clientes por conceptos que no son pedidos de la tienda (ej. saldos extras, envíos internacionales). 
        Los cobros en <strong>Soles (PEN)</strong> usarán Culqi y los cobros en <strong>Dólares (USD)</strong> usarán PayPal.
      </p>

      {error && (
        <div style={{ padding: '1rem', background: '#fef2f2', color: '#ef4444', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>
            Concepto del Pago
          </label>
          <input 
            type="text" 
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Diferencia de envío a España"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>
              Moneda
            </label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff' }}
            >
              <option value="PEN">Soles (S/)</option>
              <option value="USD">Dólares ($)</option>
            </select>
          </div>
          
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>
              Monto
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                {moneda === 'PEN' ? 'S/' : '$'}
              </span>
              <input 
                type="number" 
                step="0.01"
                min="0.10"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                required
              />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            marginTop: '0.5rem',
            padding: '0.85rem', 
            background: loading ? '#94a3b8' : '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '1rem', 
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {loading ? 'Generando...' : 'Generar Enlace Seguro'}
        </button>
      </form>

      {generatedLink && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#166534', fontSize: '1.1rem' }}>¡Enlace Generado con Éxito!</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              readOnly 
              value={generatedLink} 
              style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem' }}
            />
            <button 
              onClick={copyToClipboard}
              style={{ padding: '0.75rem 1.5rem', background: '#166534', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              Copiar
            </button>
          </div>
          <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: '#15803d' }}>
            Envía este enlace a tu cliente. Solo se puede usar una vez.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminGeneradorPagos;
