import React, { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { createCheckoutPreference, confirmPayment } from '../services/payments';

// ── Página demo de checkout con split de pago (Fase 3) ──────────────────────
// Ruta pública: /checkout-demo  (y /pago-demo/:orderId como destino del init_point
// simulado cuando no hay MERCADOPAGO_ACCESS_TOKEN en el entorno).
//
// Flujo:
//  1) Toma un carrito de ejemplo (items editables, o vía ?items=productId:qty,productId:qty).
//  2) Llama createCheckoutPreference(items, shippingZoneId) → crea la orden
//     (status 'pending_payment') + subOrders en el servidor y devuelve un init_point.
//  3) Si simulated:true → muestra "Simular pago aprobado" que llama confirmPayment(orderId)
//     y muestra el resultado (order paid + payouts creados).
//     Si simulated:false → muestra el enlace init_point real de Mercado Pago.
//
// Estilos inline simples a propósito (página de demostración / QA).

// Parsea ?items=prod1:2,prod2:1 → [{ productId:'prod1', qty:2 }, ...]
function parseItemsParam(raw) {
  if (!raw) return null;
  const parsed = raw
    .split(',')
    .map((chunk) => {
      const [productId, qtyStr] = chunk.split(':');
      const id = (productId || '').trim();
      const qty = Math.max(1, parseInt(qtyStr, 10) || 1);
      return id ? { productId: id, qty } : null;
    })
    .filter(Boolean);
  return parsed.length ? parsed : null;
}

const box = {
  maxWidth: 640,
  margin: '32px auto',
  padding: 24,
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  color: '#222',
};
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: '#fff',
};
const btn = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#7c3aed',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
const btnSecondary = { ...btn, background: '#059669' };
const input = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  width: '100%',
  boxSizing: 'border-box',
};

const CheckoutDemoPage = () => {
  const { orderId: orderIdFromRoute } = useParams();
  const [searchParams] = useSearchParams();

  // Items: del query (?items=...) o un carrito de ejemplo editable.
  const initialItems = useMemo(
    () => parseItemsParam(searchParams.get('items')) || [{ productId: 'demo-product-1', qty: 1 }],
    [searchParams],
  );
  const [items, setItems] = useState(initialItems);
  const [shippingZoneId, setShippingZoneId] = useState(searchParams.get('zone') || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preference, setPreference] = useState(null); // { orderId, init_point, simulated }
  const [confirming, setConfirming] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null); // { orderId, status, payoutsCreated, alreadyPaid }

  // Si entramos por /pago-demo/:orderId podemos confirmar directamente esa orden.
  const orderId = preference?.orderId || orderIdFromRoute || null;

  const updateItem = (idx, field, value) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, [field]: field === 'qty' ? Math.max(1, parseInt(value, 10) || 1) : value } : it,
      ),
    );
  };
  const addItem = () => setItems((prev) => [...prev, { productId: '', qty: 1 }]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCreatePreference = async () => {
    setError(null);
    setPaymentResult(null);
    setPreference(null);
    const cleaned = items
      .map((it) => ({ productId: (it.productId || '').trim(), qty: Number(it.qty) || 0 }))
      .filter((it) => it.productId && it.qty > 0);
    if (!cleaned.length) {
      setError('Agrega al menos un ítem con productId y cantidad válidos.');
      return;
    }
    setLoading(true);
    const { data, error: err } = await createCheckoutPreference(cleaned, shippingZoneId || undefined);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setPreference(data);
  };

  const handleConfirmPayment = async () => {
    if (!orderId) return;
    setError(null);
    setConfirming(true);
    const { data, error: err } = await confirmPayment(orderId);
    setConfirming(false);
    if (err) {
      setError(err);
      return;
    }
    setPaymentResult(data);
  };

  return (
    <div style={box}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Checkout demo — Split de pago</h1>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Crea una orden con sub-pedidos por vendedor y simula el pago aprobado (Mercado Pago marketplace).
        Los precios se recalculan en el servidor; aquí solo se envían productId y cantidad.
      </p>

      {/* ── Carrito de ejemplo (editable) ─────────────────────────────── */}
      <div style={card}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Carrito</h2>
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <div style={{ flex: 3 }}>
              <label style={{ fontSize: 12, color: '#6b7280' }}>productId</label>
              <input
                style={input}
                value={it.productId}
                onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                placeholder="ID de productos_wala"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: '#6b7280' }}>cantidad</label>
              <input
                style={input}
                type="number"
                min={1}
                value={it.qty}
                onChange={(e) => updateItem(idx, 'qty', e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              style={{ ...btn, background: '#ef4444', alignSelf: 'flex-end' }}
              disabled={items.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} style={{ ...btn, background: '#374151', marginTop: 4 }}>
          + Añadir ítem
        </button>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: '#6b7280' }}>shippingZoneId (opcional)</label>
          <input
            style={input}
            value={shippingZoneId}
            onChange={(e) => setShippingZoneId(e.target.value)}
            placeholder="ID de shippingZones"
          />
        </div>

        <button type="button" onClick={handleCreatePreference} style={{ ...btn, marginTop: 16 }} disabled={loading}>
          {loading ? 'Creando preferencia…' : 'Crear preferencia de pago'}
        </button>
      </div>

      {error && (
        <div style={{ ...card, borderColor: '#fca5a5', background: '#fef2f2', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* ── Resultado de la preferencia ────────────────────────────────── */}
      {preference && (
        <div style={card}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Orden creada</h2>
          <p style={{ margin: '4px 0' }}>
            <strong>orderId:</strong> <code>{preference.orderId}</code>
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>modo:</strong>{' '}
            {preference.simulated ? 'Simulado (local / emulador, sin token Mercado Pago)' : 'Mercado Pago real'}
          </p>

          {preference.simulated ? (
            <>
              <p style={{ color: '#6b7280' }}>
                No hay token de Mercado Pago en el entorno. Puedes simular el pago aprobado: marcará la orden
                como <strong>paid</strong> y creará los <strong>payouts</strong> a cada vendedor.
              </p>
              <button type="button" onClick={handleConfirmPayment} style={btnSecondary} disabled={confirming}>
                {confirming ? 'Procesando…' : 'Simular pago aprobado'}
              </button>
            </>
          ) : (
            <p>
              <a href={preference.init_point} target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontWeight: 600 }}>
                Ir a pagar en Mercado Pago →
              </a>
            </p>
          )}
        </div>
      )}

      {/* ── Confirmación directa cuando entramos por /pago-demo/:orderId ── */}
      {!preference && orderIdFromRoute && (
        <div style={card}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Pago demo</h2>
          <p style={{ margin: '4px 0' }}>
            <strong>orderId:</strong> <code>{orderIdFromRoute}</code>
          </p>
          <button type="button" onClick={handleConfirmPayment} style={btnSecondary} disabled={confirming}>
            {confirming ? 'Procesando…' : 'Simular pago aprobado'}
          </button>
        </div>
      )}

      {/* ── Resultado del pago ─────────────────────────────────────────── */}
      {paymentResult && (
        <div style={{ ...card, borderColor: '#86efac', background: '#f0fdf4' }}>
          <h2 style={{ fontSize: 16, marginTop: 0, color: '#15803d' }}>Pago confirmado</h2>
          <p style={{ margin: '4px 0' }}>
            <strong>orderId:</strong> <code>{paymentResult.orderId}</code>
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>status:</strong> {paymentResult.status}
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>payouts creados:</strong> {paymentResult.payoutsCreated ?? 0}
            {paymentResult.alreadyPaid ? ' (la orden ya estaba pagada — idempotente, sin duplicados)' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default CheckoutDemoPage;
