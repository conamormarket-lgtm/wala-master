const crypto = require('node:crypto');
const positive = v => Number.isFinite(Number(v)) && Number(v) > 0;

function confirmedPayment(data, source) {
  if (!data || data.analyticsExcluded === true) return null;
  if (source === 'checkout') {
    if (data.status !== 'paid_order_created' || data.pedidoCreado !== true || !positive(data.pago?.montoPen) || !data.pago?.id || !data.pedidoWebId) return null;
    return { orderId: String(data.pedidoWebId), source, viaWhatsApp: data.whatsappSolicitado === true, method: ['culqi', 'paypal'].includes(data.pago.metodo) ? data.pago.metodo : 'online' };
  }
  if (source === 'erp' && data.webAprobado === true && data.origenPedidoWebId && positive(data.montoAdelanto) && !['anulado', 'cancelado', 'anulada', 'cancelada'].includes(String(data.estadoGeneral || '').toLowerCase())) {
    return { orderId: String(data.origenPedidoWebId), source, viaWhatsApp: data.whatsappSolicitado === true, method: data.whatsappSolicitado === true ? 'whatsapp' : 'erp' };
  }
  return null;
}
const receiptId = id => crypto.createHash('sha256').update(String(id)).digest('hex');

// Counts activity in the selected period; these are not a cohort conversion rate.
function productFunnel(events = [], receipts = []) {
  const out = { productViews: 0, videoPlays: 0, faqOpens: 0, helpClicks: 0, editorOpens: 0, editorSaves: 0, adds: 0, checkouts: 0, requests: 0, confirmedOrders: 0, whatsappPaid: 0 };
  const requests = new Set();
  const seenReceipts = new Set();
  for (const e of events) {
    const key = { product_view: 'productViews', add_to_cart: 'adds', checkout_start: 'checkouts', editor_open: 'editorOpens', editor_save: 'editorSaves' }[e.type];
    if (key) out[key] += 1;
    if (e.type === 'product_interaction') {
      const interaction = { video_play: 'videoPlays', faq_open: 'faqOpens', help_click: 'helpClicks' }[e.eventData?.action];
      if (interaction) out[interaction] += 1;
    }
    if (e.type === 'order_requested' && e.eventData?.orderId) requests.add(e.eventData.orderId);
  }
  out.requests = requests.size;
  for (const r of receipts) {
    if (!r.orderId || seenReceipts.has(r.orderId)) continue;
    seenReceipts.add(r.orderId); out.confirmedOrders += 1;
    if (r.viaWhatsApp === true || r.method === 'whatsapp') out.whatsappPaid += 1;
  }
  return out;
}
module.exports = { confirmedPayment, receiptId, productFunnel };
