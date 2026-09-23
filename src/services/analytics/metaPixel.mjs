const sent = new Set();
const PIXEL_ID = '1696511731424872';

function identifier(value) {
  return typeof value === 'string' ? value.trim()
    : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

// Only allow product/order metadata. Never spread the order/customer payload
// into Meta: it also contains contact details, addresses and custom designs.
function orderParameters(order, confirmedOrderId) {
  const parameters = {};
  const orderId = identifier(confirmedOrderId)
    || identifier(order?.pedidoWebId)
    || identifier(order?.webOrderPayload?.portalPseudoOrderId)
    || identifier(order?.numeroPedido)
    || identifier(order?.id);
  if (orderId) parameters.order_id = orderId;

  // The checkout snapshot is fixed before payment; don't read the live cart,
  // which the success callback may clear. ERP orders expose productos directly.
  const source = order?.webOrderPayload?.productos ?? order?.productos;
  if (!source || typeof source !== 'object') return parameters;
  const products = new Map();
  for (const item of Object.values(source)) {
    const id = identifier(item?.productoId);
    const quantity = Number(item?.cantidad);
    if (!id || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
    const previous = products.get(id);
    const totalQuantity = (previous?.quantity || 0) + quantity;
    if (!Number.isSafeInteger(totalQuantity)) continue;
    products.set(id, {
      id,
      quantity: totalQuantity,
      name: previous?.name || (typeof item.producto === 'string' ? item.producto.trim() : ''),
    });
    // A combo is one catalog product. Its subProductos are fulfillment details.
  }
  if (!products.size) return parameters;
  const items = [...products.values()];
  parameters.content_type = 'product';
  parameters.content_ids = items.map(item => item.id);
  parameters.contents = items.map(({ id, quantity }) => ({ id, quantity }));
  parameters.num_items = items.reduce((sum, item) => sum + item.quantity, 0);
  const names = [...new Set(items.map(item => item.name).filter(Boolean))];
  if (names.length) parameters.content_name = names.join(', ');
  // No item_price: catalog amounts are PEN, while PayPal captures are USD;
  // discounts, shipping and advances also make them different from value.
  return parameters;
}

// Analytics must never interrupt payment confirmation. Browser deduplication is
// best effort; this is not server-side delivery or a guarantee of receipt by Meta.
function purchase(provider, id, value, currency, order, confirmedOrderId) {
  if (!id || !Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(currency || '')) return false;
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return false;
  const eventID = `${provider}_${id}`;
  const key = `wala:meta:${PIXEL_ID}:purchase:${eventID}`;
  try {
    if (sent.has(key)) return false;
    try { if (window.localStorage.getItem(key)) return false; } catch { /* private mode */ }
    let details = {};
    try { details = orderParameters(order, confirmedOrderId); } catch { /* keep confirmed payment */ }
    window.fbq('trackSingle', PIXEL_ID, 'Purchase', { ...details, value, currency }, { eventID });
    sent.add(key);
    try { window.localStorage.setItem(key, '1'); } catch { /* memory guard remains */ }
    return true;
  } catch { return false; }
}

export function trackCulqiPurchase(result, currency, order) {
  if (result?.success !== true) return false;
  return purchase('culqi', result.charge_id, Number(result.amount) / 100, currency, order, result.pedidoWebId);
}

export function trackPaypalPurchase(result, order, webOrderId) {
  if (result?.status !== 'COMPLETED') return false;
  if (result.success === true) {
    return purchase('paypal', result.captureId, Number(result.amountUsd), 'USD', order, result.pedidoWebId || result.pedidoId || webOrderId);
  }
  // Legacy SDK flow: use completed captures, never the approval/order amount.
  let tracked = false;
  for (const unit of result.purchase_units || []) {
    for (const capture of unit.payments?.captures || []) {
      if (capture.status === 'COMPLETED') {
        tracked = purchase('paypal', capture.id, Number(capture.amount?.value), capture.amount?.currency_code, order, webOrderId) || tracked;
      }
    }
  }
  return tracked;
}
