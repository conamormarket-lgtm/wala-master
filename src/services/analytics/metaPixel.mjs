const sent = new Set();
const PIXEL_ID = '1696511731424872';

// Analytics must never interrupt payment confirmation. Browser deduplication is
// best effort; this is not server-side delivery or a guarantee of receipt by Meta.
function purchase(provider, id, value, currency) {
  if (!id || !Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(currency || '')) return false;
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return false;
  const eventID = `${provider}_${id}`;
  const key = `wala:meta:${PIXEL_ID}:purchase:${eventID}`;
  try {
    if (sent.has(key)) return false;
    try { if (window.localStorage.getItem(key)) return false; } catch { /* private mode */ }
    window.fbq('trackSingle', PIXEL_ID, 'Purchase', { value, currency }, { eventID });
    sent.add(key);
    try { window.localStorage.setItem(key, '1'); } catch { /* memory guard remains */ }
    return true;
  } catch { return false; }
}

export function trackCulqiPurchase(result, currency) {
  if (result?.success !== true) return false;
  return purchase('culqi', result.charge_id, Number(result.amount) / 100, currency);
}

export function trackPaypalPurchase(result) {
  if (result?.status !== 'COMPLETED') return false;
  if (result.success === true) {
    return purchase('paypal', result.captureId, Number(result.amountUsd), 'USD');
  }
  // Legacy SDK flow: use completed captures, never the approval/order amount.
  let tracked = false;
  for (const unit of result.purchase_units || []) {
    for (const capture of unit.payments?.captures || []) {
      if (capture.status === 'COMPLETED') {
        tracked = purchase('paypal', capture.id, Number(capture.amount?.value), capture.amount?.currency_code) || tracked;
      }
    }
  }
  return tracked;
}
