import { isEmulatorDetailUrl } from './detailMediaEnvironment.mjs';
const text = (v, max = 400) => typeof v === 'string' ? v.slice(0, max) : '';
const rows = (v, max, keys) => (Array.isArray(v) ? v : []).slice(0, max).map((r, i) => Object.fromEntries([['id', /^[\w-]{1,90}$/.test(r?.id || '') ? r.id : `row-${i}`], ...keys.map(k => [k, text(r?.[k], k === 'answer' ? 2400 : 400)])]));

export function commerceLink(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (/^\/(?!\/)[^\\\s]*$/.test(url) && ![...url].some(c => c.charCodeAt(0) < 32)) return url;
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && url.length <= 2048 ? u.href : ''; } catch { return ''; }
}

/** Contenido informativo por producto. Precios, stock y cobros siguen en el catálogo/checkout. */
export function normalizeProductCommerce(value = {}, { allowLocal = false } = {}) {
  const v = value && typeof value === 'object' ? value : {};
  return {
    primaryAction: ['add', 'buy', 'personalize'].includes(v.primaryAction) ? v.primaryAction : 'add',
    stickyAction: ['add', 'buy', 'personalize'].includes(v.stickyAction) ? v.stickyAction : v.primaryAction === 'personalize' ? 'personalize' : 'buy',
    subtitle: text(v.subtitle, 240), highlights: rows(v.highlights, 6, ['text']),
    priceNote: text(v.priceNote), personalizationNote: text(v.personalizationNote, 800),
    paymentNote: text(v.paymentNote, 800), steps: rows(v.steps, 5, ['text']),
    specifications: rows(v.specifications, 16, ['label', 'value']),
    information: text(v.information, 1200), informationTitle: text(v.informationTitle, 120) || 'Características',
    warrantyTitle: text(v.warrantyTitle, 120) || 'Garantía y cambios', deliveryTitle: text(v.deliveryTitle, 120) || 'Tiempo de entrega',
    delivery: text(v.delivery, 1200), warranty: text(v.warranty, 1200), policyUrl: commerceLink(v.policyUrl),
    showShippingRate: v.showShippingRate === true,
    faqMode: ['default', 'custom', 'hidden'].includes(v.faqMode) ? v.faqMode : 'default',
    faqTitle: text(v.faqTitle, 160) || '¿Te queda alguna duda?', faqs: rows(v.faqs, 16, ['question', 'answer']),
    collection: { enabled: v.collection?.enabled === true, title: text(v.collection?.title, 160), text: text(v.collection?.text, 800), href: commerceLink(v.collection?.href), label: text(v.collection?.label, 80) || 'Explorar colección', image: isEmulatorDetailUrl(v.collection?.image) ? v.collection.image : allowLocal && /^local:[\w-]{1,90}$/.test(v.collection?.image || '') ? v.collection.image : /^https:\/\//.test(v.collection?.image || '') ? commerceLink(v.collection.image) : '' },
    showReviews: v.showReviews !== false, showRelated: v.showRelated !== false,
    relatedTitle: text(v.relatedTitle, 160) || 'También te puede gustar',
    relatedIds: [...new Set((Array.isArray(v.relatedIds) ? v.relatedIds : []).filter(id => typeof id === 'string' && /^[\w-]{1,150}$/.test(id)))].slice(0, 12),
    showRecent: v.showRecent === true, recentTitle: text(v.recentTitle, 160) || 'Vistos recientemente',
    showHelp: v.showHelp !== false, helpLabel: text(v.helpLabel, 120) || 'Consultar por WhatsApp',
    showTrust: v.showTrust !== false, showSticky: v.showSticky !== false,
    storyMediaId: text(v.storyMediaId, 181),
  };
}

export function validateProductCommerce(value, { allowLocal = false } = {}) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'La ficha de venta no tiene un formato válido.';
  for (const [key, limit, fields] of [['highlights', 6, ['text']], ['steps', 5, ['text']], ['specifications', 16, ['label', 'value']], ['faqs', 16, ['question', 'answer']]]) {
    if (value[key] != null && (!Array.isArray(value[key]) || value[key].length > limit)) return `Revisa la lista de ${key}: máximo ${limit}.`;
    if ((value[key] || []).some(r => fields.some(f => typeof r?.[f] !== 'string' || !r[f].trim()))) return 'Completa los textos de beneficios, pasos, especificaciones y preguntas, o elimina las filas vacías.';
  }
  for (const url of [value.policyUrl, value.collection?.href]) {
    if (url && !commerceLink(url)) return 'Usa enlaces HTTPS o rutas internas válidas.';
  }
  if (value.collection?.image && !isEmulatorDetailUrl(value.collection.image) && !(allowLocal && /^local:[\w-]{1,90}$/.test(value.collection.image)) && !(value.collection.image.trim().startsWith('https://') && commerceLink(value.collection.image))) return 'La imagen de colección necesita una URL HTTPS.';
  if (value.collection?.enabled && (!value.collection.title?.trim() || !value.collection.href)) return 'La colección destacada necesita un título y un enlace.';
  if (value.faqMode === 'custom' && !value.faqs?.length) return 'Añade al menos una pregunta o elige ocultar las preguntas.';
  return null;
}
