import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { normalizeDetailComposition, validateDetailComposition, validateDetailFile, moveDetailItem, initialDetailComposition } from '../../src/utils/productDetails.mjs';
import { normalizeProductCommerce, validateProductCommerce, commerceLink } from '../../src/utils/productCommerce.mjs';
import { readRecentProducts, rememberProduct } from '../../src/utils/recentProducts.mjs';

const media = { id: 'photo', type: 'image', url: 'https://example.test/photo.jpg', alt: 'Detalle', caption: 'Acabado' };
const composition = () => normalizeDetailComposition({ version: 1, visible: true, heading: 'Detalles', blocks: [
  { id: 'a', kind: 'split', title: 'Bolsillos', text: 'Texto <script>alert(1)</script>', side: 'right', media: [media] },
  { id: 'b', kind: 'gallery', columns: 3, mobileColumns: 2, ratio: 'portrait', media: [media, { id: 'video', type: 'video', url: 'https://example.test/demo.mp4', alt: 'En uso' }] },
] });

test('conserva composición, orden y opciones; distingue ausencia, vacío y oculto', () => {
  const value = composition();
  assert.equal(validateDetailComposition(value), null);
  assert.deepEqual(normalizeDetailComposition(JSON.parse(JSON.stringify(value))), value);
  assert.equal(value.blocks[0].side, 'right');
  assert.equal(value.blocks[1].mobileColumns, 2);
  assert.equal(normalizeDetailComposition(undefined), null);
  assert.equal(normalizeDetailComposition({ version: 2, blocks: [] }), null);
  assert.deepEqual(normalizeDetailComposition({ version: 1, visible: false, blocks: [] }).blocks, []);
  assert.equal(normalizeDetailComposition({ version: 1, visible: false, blocks: [] }).visible, false);
  const moved = moveDetailItem(value.blocks, 1, -1);
  assert.equal(moved[0].id, 'b');
  assert.equal(value.blocks[0].id, 'a');
  assert.equal(moveDetailItem(value.blocks, 0, -1), value.blocks);
});

test('rechaza contenido incompleto, URLs temporales y esquemas ejecutables al guardar', () => {
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,a', 'blob:tmp', 'http://example.test/a.png', 'https://user:pass@example.test/a.png', 'local:asset']) {
    const value = composition(); value.blocks[0].media[0].url = url;
    assert.ok(validateDetailComposition(value), url);
    assert.equal(normalizeDetailComposition(value).blocks[0].media.length, 0);
  }
  const local = composition(); local.blocks[0].media[0].url = 'local:asset';
  assert.equal(validateDetailComposition(local, { allowLocal: true }), null);
  assert.equal(normalizeDetailComposition(local, { allowLocal: true }).blocks[0].media[0].url, 'local:asset');
  assert.ok(validateDetailComposition({ version: 1, blocks: [{ kind: 'image', media: [] }] }));
  assert.ok(validateDetailComposition({ version: 1, blocks: [{ kind: 'text', title: '', text: '' }] }));
  assert.ok(validateDetailComposition({ version: 1, blocks: Array(25).fill({ kind: 'text', text: 'a' }) }));
  const wrongType = composition(); wrongType.blocks[0].kind = 'video';
  assert.ok(validateDetailComposition(wrongType));
});

test('valida tamaños y tipos de fotos/vídeos antes de subir', () => {
  assert.equal(validateDetailFile({ type: 'image/webp', size: 1024 }), null);
  assert.equal(validateDetailFile({ type: 'video/mp4', size: 1024 }), null);
  for (const file of [{ type: 'image/svg+xml', size: 10 }, { type: 'image/jpeg', size: 0 }, { type: 'image/png', size: 21 * 1024 * 1024 }, { type: 'video/webm', size: 101 * 1024 * 1024 }]) assert.ok(validateDetailFile(file));
});

test('el primer borrador reutiliza descripción, fotos y vídeos sin alterar los originales', () => {
  const source = { descripcion: '<p>Uno &amp; dos</p><p>Más detalles</p>', imagenes: [{ url: media.url }, { url: 'https://example.test/detail.jpg' }], videos: [{ url: 'https://example.test/video.mp4', nombre: 'En uso' }] };
  const value = initialDetailComposition(source);
  assert.equal(value.blocks[0].kind, 'split');
  assert.equal(value.blocks[0].media[0].url, source.imagenes[1].url);
  assert.match(value.blocks[0].text, /Uno & dos\nMás detalles/);
  assert.equal(value.blocks[1].media[0].type, 'video');
  assert.equal(source.imagenes.length, 2);
});

let server, ComposicionDetalles, DetallesProducto, fichaProductoDesde;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ ComposicionDetalles } = await server.ssrLoadModule('/src/componentes/kit/piezas/ComposicionDetalles.jsx'));
  ({ DetallesProducto } = await server.ssrLoadModule('/src/componentes/kit/piezas/DetallesProducto.jsx'));
  ({ fichaProductoDesde } = await server.ssrLoadModule('/src/componentes/kit/adaptadores.js'));
});
after(async () => server?.close());
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

test('conserva la alternativa móvil al guardar y la entrega como picture responsive', () => {
  const raw = composition();
  raw.blocks[0].media[0].mobileUrl = 'https://example.test/vertical.webp';
  const value = normalizeDetailComposition(JSON.parse(JSON.stringify(raw)));
  assert.equal(validateDetailComposition(value), null);
  assert.equal(value.blocks[0].media[0].mobileUrl, raw.blocks[0].media[0].mobileUrl);
  const html = render(ComposicionDetalles, { composicion: value });
  assert.match(html, /<source media="\(max-width: 620px\)" srcSet="https:\/\/example.test\/vertical.webp"/);
  raw.blocks[0].media[0].mobileUrl = 'javascript:alert(1)';
  assert.ok(validateDetailComposition(raw));
  assert.equal(normalizeDetailComposition(raw).blocks[0].media[0].mobileUrl, undefined);
});

test('mapea la composición del producto y muestra medios mixtos sin autoplay ni HTML ejecutable', () => {
  const value = composition();
  const ficha = fichaProductoDesde({ id: 'p', detailComposition: value });
  assert.equal(ficha.composicionDetalles.blocks[1].media[1].type, 'video');
  const html = render(ComposicionDetalles, { composicion: ficha.composicionDetalles });
  assert.match(html, /controls=""/);
  assert.match(html, /preload="metadata"/);
  assert.match(html, /--columnas-movil:2/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|autoplay/);
});

test('el visitante no recibe controles de edición y una sección oculta no vuelve al diseño anterior', () => {
  const html = render(DetallesProducto, { composicion: { ...composition(), visible: false }, descripcion: 'Descripción anterior' });
  assert.doesNotMatch(html, /Editar composición|Descripción anterior|Todos los detalles|example.test/);
  const admin = render(DetallesProducto, { composicion: composition(), editor: { guardar() {} } });
  assert.match(admin, /Editar composición/);
});

test('el mosaico mixto aplica ajustes por archivo y mantiene vídeo sin autoplay', () => {
  const value = normalizeDetailComposition({ version: 1, blocks: [{ id: 'mix', kind: 'mosaic', mosaicLayout: 'flexible', ratio: 'portrait34', fit: 'contain', media: [
    { ...media, ratio: 'landscape', fit: 'cover' },
    { id: 'v', type: 'video', url: 'https://example.test/v.mp4', ratio: 'auto', fit: 'contain' },
    { ...media, id: 'inherited' },
  ] }] });
  const html = render(ComposicionDetalles, { composicion: value });
  assert.match(html, /aspect-ratio:1\.7777777777777777/);
  assert.match(html, /--ajuste:cover/);
  assert.match(html, /data-media-id="v"/);
  assert.match(html, /preload="metadata"/);
  assert.match(html, /height:var\(--altura-heredada\)/);
  assert.doesNotMatch(html, /autoplay/);
});

test('renderiza autoplay silencioso y bucle solo en los vídeos configurados', () => {
  const value = normalizeDetailComposition({ version: 1, blocks: [{ kind: 'mosaic', mosaicLayout: 'flexible', media: [
    { id: 'automatic', type: 'video', url: 'https://example.test/auto.mp4', autoPlay: true, loop: true },
    { id: 'manual', type: 'video', url: 'https://example.test/manual.mp4' },
  ] }] });
  const html = render(ComposicionDetalles, { composicion: value });
  const [automatic, manual] = html.match(/<video\b[^>]*>/g);
  for (const attr of ['autoplay', 'muted', 'loop', 'playsinline', 'controls']) assert.match(automatic, new RegExp(`${attr}=""`));
  assert.doesNotMatch(manual, /autoplay|muted|loop/);
});

test('ficha comercial: conserva campos, desactiva secciones y valida preguntas/enlaces sin inventar condiciones', () => {
  const legacy = normalizeProductCommerce();
  assert.equal(legacy.primaryAction, 'add'); assert.equal(legacy.stickyAction, 'buy');
  assert.equal(normalizeProductCommerce({ primaryAction: 'personalize' }).stickyAction, 'personalize');
  assert.equal(normalizeProductCommerce({ primaryAction: 'buy', stickyAction: 'add' }).stickyAction, 'add');
  assert.equal(normalizeProductCommerce({ stickyAction: 'invalid' }).stickyAction, 'buy');
  assert.equal(legacy.delivery, ''); assert.equal(legacy.warranty, ''); assert.equal(legacy.showShippingRate, false);
  const c = { ...legacy, subtitle: 'Tu billetera', highlights: [{ id: 'a', text: 'Elige tu color' }], specifications: [{ id: 's', label: 'Modelo', value: 'Cónsul' }], faqMode: 'custom', faqs: [{ id: 'f', question: '¿Se personaliza?', answer: 'Sí, desde Crear.' }], showReviews: false, showRelated: false, showRecent: true, showHelp: false, showSticky: false, collection: { enabled: true, title: 'Más regalos', href: '/tienda', label: 'Explorar', text: '', image: '' } };
  assert.equal(validateProductCommerce(c), null);
  const value = normalizeDetailComposition({ ...composition(), commerce: c });
  for (const stickyAction of ['add', 'buy', 'personalize']) {
    const saved = normalizeDetailComposition(JSON.parse(JSON.stringify({ ...value, commerce: { ...c, stickyAction } })));
    assert.equal(saved.commerce.stickyAction, stickyAction);
    assert.equal(saved.commerce.primaryAction, 'add');
  }
  assert.deepEqual(normalizeDetailComposition(JSON.parse(JSON.stringify(value))), value);
  const html = render(DetallesProducto, { composicion: value });
  assert.match(html, /¿Se personaliza\?/); assert.match(html, /Más regalos/);
  assert.doesNotMatch(html, /¿Cómo elijo mi producto\?/);
  const hidden = render(DetallesProducto, { composicion: { ...value, commerce: { ...c, faqMode: 'hidden', collection: { enabled: false } } } });
  assert.doesNotMatch(hidden, /¿Se personaliza\?|Más regalos/);
  for (const url of ['javascript:alert(1)', '//bad.test', '/\\bad.test', 'data:text/html,hi', 'https://name:pass@example.test', 'http://example.test']) { assert.equal(commerceLink(url), ''); assert.ok(validateProductCommerce({ policyUrl: url })); }
  assert.ok(validateProductCommerce({ faqMode: 'custom', faqs: [] }));
  assert.ok(validateProductCommerce({ specifications: [{ label: 'Peso', value: '' }] }));
});

test('mosaicos y carruseles retienen todos los medios, portadas y orden; validar impide mosaico incompleto', () => {
  for (const kind of ['mosaic', 'carousel']) {
    const value = normalizeDetailComposition({ version: 1, blocks: [{ id: 'b', kind, ratio: 'story', columns: 4, media: [media, { ...media, id: 'two' }, { id: 'v', type: 'video', url: 'https://example.test/v.mp4', poster: media.url }] }] });
    assert.equal(validateDetailComposition(value), null); assert.equal(value.blocks[0].media.length, 3);
    const html = render(ComposicionDetalles, { composicion: value });
    assert.match(html, /poster="https:\/\/example.test\/photo.jpg"/); assert.match(html, /9 \/ 16/); assert.doesNotMatch(html, /autoplay/);
    if (kind === 'carousel') assert.match(html, /Medios siguientes/);
    value.blocks[0].media[2].poster = 'javascript:alert(1)'; assert.ok(validateDetailComposition(value));
  }
  assert.ok(validateDetailComposition({ version: 1, blocks: [{ kind: 'mosaic', media: [media] }] }));
});

test('recientes: orden, exclusión del actual, límite, vencimiento y almacenamiento no disponible', () => {
  const map = new Map(); const storage = { getItem: k => map.get(k), setItem: (k,v) => map.set(k,v) };
  for (let i = 0; i < 15; i++) rememberProduct(`p${i}`, storage, 1000 + i);
  assert.equal(readRecentProducts(storage, 2000).length, 12);
  assert.deepEqual(rememberProduct('p13', storage, 2001).slice(0, 2), ['p14', 'p12']);
  assert.equal(readRecentProducts(storage, 40 * 864e5).length, 0);
  assert.deepEqual(rememberProduct('valid', { getItem() { throw Error(); }, setItem() { throw Error(); } }), []);
});

test('la tarifa informativa usa la misma regla del checkout y no promete entrega sin configuración', async () => {
  const { InformacionCompra } = await server.ssrLoadModule('/src/componentes/kit/piezas/InformacionCompra.jsx');
  const c = normalizeProductCommerce({ showShippingRate: true });
  assert.match(render(InformacionCompra, { config: c, subtotal: 200 }), /S\/ 15.00/);
  assert.match(render(InformacionCompra, { config: c, subtotal: 201 }), /gratis para este subtotal/);
  assert.doesNotMatch(render(InformacionCompra, { config: {} }), /Entrega|Garantía|90 días|24 horas/);
  assert.doesNotMatch(render(InformacionCompra, { config: { showHelp: false }, whatsapp: { numero: '51999999999' } }), /wa.me/);
});

test('información, garantía y entrega se guardan y aparecen como desplegables accesibles sin duplicar características', async () => {
  const { InformacionCompra } = await server.ssrLoadModule('/src/componentes/kit/piezas/InformacionCompra.jsx');
  const config = normalizeProductCommerce({ informationTitle: 'Conoce el producto', information: 'Información\npor producto', warrantyTitle: 'Nuestra garantía', warranty: 'Condiciones de este producto.', deliveryTitle: 'Cuándo llega', delivery: 'Consulta el plazo al comprar.', policyUrl: '/terminos-y-condiciones', specifications: [{ id: 'modelo', label: 'Modelo', value: 'Cónsul' }] });
  const compositionSaved = normalizeDetailComposition(JSON.parse(JSON.stringify({ ...composition(), commerce: config })));
  assert.deepEqual(compositionSaved.commerce, config);
  const html = render(InformacionCompra, { config: compositionSaved.commerce });
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 3);
  assert.equal((html.match(/role="region"/g) || []).length, 3);
  for (const text of ['Conoce el producto', 'Nuestra garantía', 'Cuándo llega', 'Cónsul', 'Condiciones de este producto.', 'Consultar condiciones']) assert.ok(html.includes(text));
  assert.match(html, /href="\/terminos-y-condiciones"/);
  assert.doesNotMatch(render(DetallesProducto, { composicion: compositionSaved }), /Cónsul/);
  assert.doesNotMatch(render(InformacionCompra, { config: {} }), /aria-expanded|Garantía|Tiempo de entrega/);
});
