"use strict";

// Versioned customer-only contract. SDKs/payment credentials stay in index.js.
const { createHash } = require('node:crypto');
const { mapProduct } = require('./mobile-domain/product-mapper');
const { resolveSelection, selectionFromChosen } = require('./mobile-domain/product-selection');
const { cleanAddress, assertAddress } = require('./mobile-domain/address');
const countries = require('./mobile-domain/countries.json');
const CONTRACT = 'mobile-v1';
const fail = (message) => { const error = new Error(message); error.code = 'invalid-argument'; throw error; };
const cents = (amount) => Math.round(amount * 100);
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
// El código de un cupón de userCoupons (mayúsculas, como buscarCupon); vacío si no se mandó.
function couponCode(input) {
  if (input?.couponCode == null || input.couponCode === '') return '';
  const code = String(input.couponCode).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) fail('Revisa el código del cupón.');
  return code;
}
function identity(input, uid) {
  if (!uid) fail('Inicia sesión para preparar el pago.');
  if (!input || !/^[A-Za-z0-9_-]{16,80}$/.test(input.requestId || '') || input.contract !== CONTRACT) fail('El intento de pago no es válido.');
  if (input.expectedUid !== undefined && input.expectedUid !== uid) fail('La sesión cambió. Vuelve a preparar el pago desde tu cuenta actual.');
  // Sin cupón el cuerpo es el de siempre: los intentos ya preparados conservan su huella.
  const coupon = couponCode(input);
  const body = JSON.stringify(stable({ items: input.items, address: input.address, email: input.email, expectedTotal: input.expectedTotal,
    ...(coupon ? { couponCode: coupon } : {}) }));
  if (!body || body.length > 128_000) fail('El pedido supera el tamaño permitido.');
  return { id: `MC-${createHash('sha256').update(`${uid}:${input.requestId}`).digest('hex').slice(0, 28)}`,
    hash: createHash('sha256').update(body).digest('hex') };
}
function shipping(subtotal) { return cents(subtotal) > 20_000 ? 0 : 15; }
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 200 && !id.includes('/');
const chosenId = (id, s) => JSON.stringify([id, s.variantId, s.size, s.pieces.map((p) => [p.key, p.productId, p.variantId, p.size])]);

async function build(input, uid, read) {
  const key = identity(input, uid);
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) fail('Revisa los productos del carrito.');
  const address = cleanAddress(input.address || {}); const email = String(input.email || '').trim();
  assertAddress(address, email);
  const coupon = couponCode(input);
  const ids = [...new Set(input.items.map((item) => item && item.productId))];
  if (ids.some((id) => !validId(id))) fail('Un producto no es válido.');
  const roots = await read(ids);
  const products = new Map(ids.map((id) => [id, roots.get(id) ? mapProduct(id, roots.get(id)) : null]));
  const componentIds = [...new Set([...products.values()].flatMap((p) => p?.combo?.pieces.map((piece) => piece.productId) || []))];
  if (componentIds.length > 200 || componentIds.some((id) => !validId(id))) fail('Revisa las piezas del pedido.');
  const rawComponents = componentIds.length ? await read(componentIds) : new Map();
  for (const product of products.values()) if (product?.combo) {
    product.combo.pieces = product.combo.pieces.map((piece) => ({ ...piece,
      product: rawComponents.get(piece.productId) ? mapProduct(piece.productId, rawComponents.get(piece.productId), { component: true }) : null }));
  }
  const quantities = new Map(); const lineIds = new Set();
  const items = input.items.map((row) => {
    const product = products.get(row.productId);
    if (!product?.available || product.configurationIssue) fail('Un producto ya no está disponible. Actualiza tu carrito.');
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) fail('Revisa las cantidades del carrito.');
    if (JSON.stringify(row.selection || {}).length > 16_000 || Object.keys(row.selection?.pieces || {}).length > 12) fail('Revisa las opciones del producto.');
    const selection = resolveSelection(product, row.selection);
    const id = chosenId(product.id, selection);
    if (lineIds.has(id)) fail('El carrito tiene opciones repetidas. Actualízalo.');
    lineIds.add(id);
    quantities.set(product.id, (quantities.get(product.id) || 0) + row.quantity);
    return { id, product: { id: product.id, name: product.name, price: product.price, regularPrice: product.regularPrice, imageUrl: product.imageUrl },
      quantity: row.quantity, selection, status: 'valid', message: null, maxQuantity: Math.min(99, product.stock ?? 99) };
  });
  for (const [id, quantity] of quantities) if (products.get(id).stock !== null && quantity > products.get(id).stock) fail('El stock cambió. Actualiza tu carrito.');
  const subtotal = items.reduce((sum, line) => sum + cents(line.product.price) * line.quantity, 0) / 100;
  const envio = shipping(subtotal); const total = (cents(subtotal) + cents(envio)) / 100;
  if (!Number.isFinite(input.expectedTotal) || cents(total) !== cents(input.expectedTotal)) fail('El importe cambió. Vuelve a revisar el pedido antes de pagar.');
  if (cents(total) < 300 || cents(total) > 999900) fail('El importe está fuera del rango permitido para este pago con Culqi.');
  const isPeru = address.country === 'PE';
  const department = !isPeru ? countries.find((c) => c.code === address.country)?.name : address.city === 'Provincias' ? address.department : address.city;
  const province = !isPeru || address.city === 'Provincias' ? address.province : address.city === 'Lima' ? 'Lima Metropolitana' : 'Callao';
  const [first, ...last] = address.customerName.split(/\s+/);
  const documentType = isPeru ? address.docType : 'Documento de identidad nacional';
  const productos = Object.fromEntries(items.map((line, index) => {
    const raw = roots.get(line.product.id);
    const subProductos = Object.fromEntries(line.selection.pieces.map((piece, i) => [`subItem_${i}`, {
      productoId: piece.productId, producto: piece.name, talla: piece.size || '', color: piece.variantName || '',
    }]));
    return [`item_${index}`, { productoId: line.product.id, producto: line.product.name, brandId: raw.brandId || null,
      urlImagen: line.selection.imageUrl || line.product.imageUrl || '', imagenReferencial: line.selection.imageUrl || line.product.imageUrl || '',
      cantidad: line.quantity, talla: line.selection.size || '', color: line.selection.variantName || '', precio: line.product.price,
      subtotal: cents(line.product.price) * line.quantity / 100, personalizado: false,
      ...(line.selection.pieces.length ? { esCombo: true, combo: line.product.name, subProductos } : {}) }];
  }));
  const payload = {
    numeroPedido: key.id, portalPseudoOrderId: key.id, checkoutContract: CONTRACT,
    userId: uid, dni: address.dni, country: address.country,
    phoneIntl: !isPeru && !address.phone.startsWith('+') ? `${countries.find((c) => c.code === address.country)?.dialCode || ''}${address.phone}` : address.phone,
    clienteNombre: first, clienteApellidos: last.join(' '), clienteNombreCompleto: address.customerName,
    clienteNumeroDocumento: address.dni, clienteTipoDocumento: documentType, clienteContacto: address.phone, clienteContactoSecundario: '', clienteCorreo: email,
    clienteDepartamento: department, clienteProvincia: province, clienteDistrito: address.district, clienteDistritoReal: address.district,
    envioNombres: first, envioApellidos: last.join(' '), envioContacto: address.phone, envioNumeroDocumento: address.dni, envioTipoDocumento: documentType,
    envioDireccion: address.address, envioDistrito: address.district, envioDepartamento: department, envioProvincia: province,
    envioEsProvincia: !isPeru || address.city === 'Provincias' ? 'Sí' : 'No', tipoEnvio: isPeru && address.city !== 'Provincias' ? 'delivery' : 'agencia',
    canalVenta: 'Portal Web', web: true, activador: 'portal_web', vendedor: 'Portal Web', origen: 'wala_mobile',
    montoTotal: total, montoAdelanto: 0, montoPendiente: total, costoEnvio: envio,
    estadoGeneral: 'Nuevo', status: 'Nuevo', cantidad: items.reduce((sum, line) => sum + line.quantity, 0), productos,
    prendas: items.map((line) => `${line.product.name} x${line.quantity}`).join(', '),
    esPersonalizado: false, esMostacero: false, esPrioridad: false, importado: false,
    // prepareCheckoutPayment lo revalida con el cupón de la cuenta y descuenta en el servidor.
    ...(coupon ? { cuponCode: coupon } : {}),
  };
  return { key, payload, meta: { contract: CONTRACT, requestId: input.requestId, requestHash: key.hash,
    input: { contract: CONTRACT, requestId: input.requestId, expectedTotal: total, address, email, ...(coupon ? { couponCode: coupon } : {}),
      items: items.map((line) => ({ productId: line.product.id, quantity: line.quantity, selection: selectionFromChosen(line.selection) })) },
    summary: { address, email, items, totals: { subtotal, shipping: envio, total }, currency: 'PEN' } } };
}
function view(id, intent) {
  if (!intent?.mobile || intent.mobile.contract !== CONTRACT) fail('Este pago no pertenece a la app.');
  const state = intent.status === 'paid_order_created' ? intent.pedidoCreado === true ? 'paid' : 'order-pending'
    : intent.status === 'cobrando' ? 'processing' : ['vencida', 'reemplazada'].includes(intent.status) ? 'expired'
      : intent.mobilePending3DS ? 'challenge' : 'ready';
  return { intentId: id, requestId: intent.mobile.requestId, contract: CONTRACT, state,
    orderId: state === 'paid' ? intent.pedidoWebId || id : null, ...intent.mobile.summary };
}
function threeDS(data) {
  if (data == null) return null;
  const out = {};
  for (const key of ['eci', 'xid', 'cavv', 'protocolVersion', 'directoryServerTransactionId']) {
    if (key === 'directoryServerTransactionId' && data[key] == null) continue;
    if (typeof data[key] !== 'string' || !data[key] || data[key].length > 2048) fail('La autenticación del banco no es válida.');
    out[key] = data[key];
  }
  return out;
}
module.exports = { CONTRACT, identity, build, shipping, view, threeDS, couponCode };
