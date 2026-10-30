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

// ── Creaciones de Crear (prendas base con el diseño del cliente) ───────────────
// El celular solo manda { designId, quantity, size }. Todo lo demás (precio, archivos, vistas) se lee aquí del
// diseño guardado y de la prenda, como lo arma pedidoCheckout.js en la web.
const validDesignId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const precioBase = (p) => { const price = Number(p && p.price); const sale = Number(p && p.salePrice);
  return Number.isFinite(sale) && sale > 0 && sale < price ? sale : Number.isFinite(price) ? price : 0; };
const urlsUnicas = (urls) => [...new Set((urls || []).filter((u) => typeof u === 'string' && /^https:\/\//i.test(u.trim())).map((u) => u.trim()))];
// Solo archivos del propio comprador (los copia congelarDisenos al crear el pedido).
const esArchivoPropio = (url, uid) => typeof url === 'string' && url.includes(`designs%2F${encodeURIComponent(uid)}%2F`);
// getDesignReferences de la web: imágenes, textos, vista previa, archivo de impresión y medida por zona.
function referenciasDeDiseno(d) {
  const refs = [d.previewUrl, d.imagenConjunta];
  const views = {};
  Object.entries(d.layersByView || {}).forEach(([zona, capas]) => {
    if (!Array.isArray(capas) || !capas.length) return;
    const imagenes = urlsUnicas(capas.filter((c) => c && c.type === 'image').map((c) => c.src));
    refs.push(...imagenes);
    views[zona] = { imagenes, textos: capas.filter((c) => c && c.type === 'text' && c.text).map((c) => String(c.text)) };
  });
  (d.vistasPrevias || []).forEach((previa) => {
    refs.push(previa && previa.url);
    (Array.isArray(previa && previa.zonas) ? previa.zonas : [previa && previa.vista]).forEach((zona) => {
      if (views[zona]) views[zona].vistaPrevia = (previa && previa.url) || '';
    });
  });
  (d.archivosImpresion || []).forEach((archivo) => {
    refs.push(archivo && archivo.url);
    if (!archivo || !views[archivo.vista]) return;
    views[archivo.vista].archivoImpresion = archivo.url || '';
    views[archivo.vista].medida = archivo.anchoCm ? `${archivo.anchoCm} x ${archivo.altoCm} cm` : `${archivo.ancho} x ${archivo.alto} px`;
    if (archivo.nombre) views[archivo.vista].zona = archivo.nombre;
    if (archivo.tecnica === 'laser') views[archivo.vista].tecnicaProduccion = 'laser';
  });
  return { images: urlsUnicas(refs), views };
}
async function creationLines(rows, uid, read, readDesigns) {
  if (!rows.length) return [];
  if (rows.length > 20 || rows.some((row) => !validDesignId(row && row.designId))) fail('Revisa tus creaciones del carrito.');
  const designs = await readDesigns([...new Set(rows.map((row) => row.designId))]);
  const productIds = [...new Set([...designs.values()].map((d) => d && d.productId).filter(validId))];
  const roots = productIds.length ? await read(productIds) : new Map();
  const seen = new Set();
  return rows.map((row) => {
    const d = designs.get(row.designId);
    if (!d || d.userId !== uid || d.tipo !== 'crear' || d.combo) fail('Una creación del carrito ya no está disponible. Actualiza tu carrito.');
    if (d.estado === 'borrador') fail('Una creación del carrito está como borrador: termínala antes de pagar.');
    const archivos = Array.isArray(d.archivosImpresion) ? d.archivosImpresion.filter((a) => a && a.url) : [];
    if (!archivos.length || !archivos.every((a) => esArchivoPropio(a.url, uid))) fail('Una creación no tiene sus archivos de impresión. Ábrela y vuelve a guardarla.');
    const raw = roots.get(d.productId);
    if (!raw || raw.esPrendaBase !== true || raw.deleted === true || raw.visible === false) fail('La prenda de una creación ya no está disponible.');
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) fail('Revisa las cantidades del carrito.');
    const colorId = d.color && d.color.id != null ? String(d.color.id) : '';
    const variant = (raw.variants || []).find((v) => String(v && v.id) === colorId) || null;
    const sizes = Array.isArray(variant && variant.sizes) ? variant.sizes.map(String) : [];
    const size = typeof row.size === 'string' ? row.size.trim() : '';
    if (sizes.length ? !sizes.includes(size) : size) fail('Elige una talla de las que hay para el color de tu creación.');
    const key = `${row.designId}:${size}`;
    if (seen.has(key)) fail('El carrito tiene la misma creación repetida. Actualízalo.');
    seen.add(key);
    const price = precioBase(raw);
    if (!(price > 0)) fail('La prenda de una creación no tiene precio.');
    const preview = (d.vistasPrevias || []).find((v) => v && v.url)?.url || d.previewUrl || d.imagenConjunta || '';
    return { designId: row.designId, design: d, raw, size, quantity: row.quantity, price, preview,
      vistasUsadas: Object.keys(d.layersByView || {}).filter((zona) => Array.isArray(d.layersByView[zona]) && d.layersByView[zona].length) };
  });
}

async function build(input, uid, read, readDesigns = async () => new Map()) {
  const key = identity(input, uid);
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) fail('Revisa los productos del carrito.');
  const address = cleanAddress(input.address || {}); const email = String(input.email || '').trim();
  assertAddress(address, email);
  const coupon = couponCode(input);
  const designRows = input.items.filter((item) => item && item.designId);
  const catalogRows = input.items.filter((item) => !(item && item.designId));
  const ids = [...new Set(catalogRows.map((item) => item && item.productId))];
  if (ids.some((id) => !validId(id))) fail('Un producto no es válido.');
  const roots = ids.length ? await read(ids) : new Map();
  const products = new Map(ids.map((id) => [id, roots.get(id) ? mapProduct(id, roots.get(id)) : null]));
  const componentIds = [...new Set([...products.values()].flatMap((p) => p?.combo?.pieces.map((piece) => piece.productId) || []))];
  if (componentIds.length > 200 || componentIds.some((id) => !validId(id))) fail('Revisa las piezas del pedido.');
  const rawComponents = componentIds.length ? await read(componentIds) : new Map();
  for (const product of products.values()) if (product?.combo) {
    product.combo.pieces = product.combo.pieces.map((piece) => ({ ...piece,
      product: rawComponents.get(piece.productId) ? mapProduct(piece.productId, rawComponents.get(piece.productId), { component: true }) : null }));
  }
  const quantities = new Map(); const lineIds = new Set();
  const items = catalogRows.map((row) => {
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
  const creations = await creationLines(designRows, uid, read, readDesigns);
  const subtotal = (items.reduce((sum, line) => sum + cents(line.product.price) * line.quantity, 0)
    + creations.reduce((sum, line) => sum + cents(line.price) * line.quantity, 0)) / 100;
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
  creations.forEach((line, index) => {
    const d = line.design;
    const refs = referenciasDeDiseno(d);
    productos[`item_${items.length + index}`] = { productoId: d.productId, producto: line.raw.name || d.productName || '', brandId: line.raw.brandId || null,
      urlImagen: line.preview, imagenReferencial: line.preview, imagenesReferencia: refs.images, imagenesPorLado: [],
      cantidad: line.quantity, talla: line.size, color: (d.color && d.color.nombre) || '', colorHex: (d.color && d.color.hex) || '',
      precio: line.price, subtotal: cents(line.price) * line.quantity / 100, personalizado: true, textoPersonalizado: '',
      urlImagenPersonalizada: d.previewUrl || line.preview, disenoVistas: refs.views, designId: line.designId,
      vistasPersonalizadas: line.vistasUsadas, colorPrenda: (d.color && d.color.nombre) || '', prendaNombre: line.raw.name || d.productName || '' };
  });
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
    esPersonalizado: creations.length > 0, esMostacero: false, esPrioridad: false, importado: false,
    // prepareCheckoutPayment lo revalida con el cupón de la cuenta y descuenta en el servidor.
    ...(coupon ? { cuponCode: coupon } : {}),
  };
  return { key, payload, meta: { contract: CONTRACT, requestId: input.requestId, requestHash: key.hash,
    input: { contract: CONTRACT, requestId: input.requestId, expectedTotal: total, address, email, ...(coupon ? { couponCode: coupon } : {}),
      items: [...items.map((line) => ({ productId: line.product.id, quantity: line.quantity, selection: selectionFromChosen(line.selection) })),
        ...creations.map((line) => ({ designId: line.designId, quantity: line.quantity, size: line.size }))] },
    summary: { address, email, items, creations: creations.map((line) => ({ designId: line.designId, productId: line.design.productId,
      name: line.design.name || line.raw.name || 'Mi creación', productName: line.raw.name || '', imageUrl: line.preview, size: line.size,
      color: (line.design.color && line.design.color.nombre) || '', price: line.price, quantity: line.quantity })),
    totals: { subtotal, shipping: envio, total }, currency: 'PEN' } } };
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
