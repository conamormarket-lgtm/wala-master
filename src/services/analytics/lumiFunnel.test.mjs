import test from 'node:test';
import assert from 'node:assert/strict';
import { createLumiFunnelTracker, aggregateLumiFunnel, LUMI_JOURNEY_MAX_MS } from './lumiFunnel.mjs';
import { isLumiCart, isLumiProduct } from '../../utils/catalogLanding.mjs';
import { rutaCompra } from '../../utils/checkoutOrigin.mjs';

function browser() {
  let time = 1000, id = 0, fail = false;
  const values = new Map(), events = [];
  const options = { storage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) }, now: () => time,
    newId: () => `journey-${++id}`, send: async event => { if (fail) throw Error('offline'); events.push(event); return { id: String(events.length) }; } };
  let record = createLumiFunnelTracker(options);
  return { events, step: (step, details, anonymousId = 'visitor-a') => record({ step, details, anonymousId }),
    tick: (ms = 1000) => { time += ms; }, reload: () => { record = createLumiFunnelTracker(options); }, fail: value => { fail = value; } };
}

test('visita completa, recarga y render concurrente cuentan un solo navegador; WhatsApp no es un pago', async () => {
  const b = browser();
  await Promise.all([b.step('catalog'), b.step('catalog')]);
  b.reload();
  await b.step('catalog');
  assert.equal(b.events.length, 1);
  for (const step of ['product', 'add', 'cart', 'payment', 'whatsapp']) { b.tick(); await b.step(step); }
  const data = aggregateLumiFunnel([...b.events, ...b.events]);
  assert.deepEqual(data.total, { catalog: 1, product: 1, add: 1, cart: 1, payment: 1, whatsapp: 1 });
  assert.equal(data.visitors.length, 1);
  assert.equal(data.visitors[0].lastStep, 'whatsapp');
  assert.ok(!('paid' in data.total));
});

test('volver al catálogo conserva el máximo avance y muestra la última acción real', async () => {
  const b = browser();
  for (const step of ['catalog', 'add', 'cart', 'payment', 'copy_account', 'payment_close', 'catalog']) { b.tick(); await b.step(step); }
  const data = aggregateLumiFunnel(b.events);
  assert.equal(data.visitors[0].lastStep, 'catalog');
  assert.equal(data.visitors[0].furthest, 'payment');
  assert.equal(data.total.product, 0, 'agregar desde el catálogo no inventa una ficha vista');
  assert.equal(data.total.whatsapp, 0, 'copiar una cuenta no abre WhatsApp');
});

test('requiere entrada al catálogo y medios de pago reales; errores no avanzan el embudo', async () => {
  const b = browser();
  assert.equal(await b.step('cart'), false);
  await b.step('catalog');
  assert.equal(await b.step('payment'), false);
  assert.equal(await b.step('whatsapp'), false);
  await b.step('cart');
  await b.step('payment_error', { reason: 'Stock insuficiente' });
  const data = aggregateLumiFunnel(b.events);
  assert.equal(data.total.payment, 0);
  assert.equal(data.visitors[0].lastStep, 'payment_error');
});

test('un fallo de escritura se reintenta y un snapshot posterior recupera etapas; sin datos personales', async () => {
  const b = browser();
  b.fail(true);
  assert.equal(await b.step('catalog'), false);
  b.fail(false);
  assert.equal(await b.step('catalog'), true);
  b.fail(true);
  await b.step('cart');
  b.fail(false);
  b.tick();
  await b.step('payment', { total: 104, email: 'private@example.test', phone: 'secret', receipt: 'secret' });
  const data = aggregateLumiFunnel(b.events);
  assert.equal(data.total.cart, 1);
  assert.deepEqual(data.visitors[0].details, { total: 104 });
  assert.ok(!JSON.stringify(b.events).includes('secret'));
});

test('rango por entrada y fin, caducidad de 24 horas, nueva visita y navegador diferente', async () => {
  const b = browser();
  await b.step('catalog');
  b.tick(); await b.step('cart');
  assert.equal(aggregateLumiFunnel(b.events, { endDateMs: 1000 }).total.cart, 0);
  assert.equal(aggregateLumiFunnel(b.events, { startDateMs: 1001 }).total.catalog, 0);
  b.tick(LUMI_JOURNEY_MAX_MS);
  assert.equal(await b.step('payment'), false);
  await b.step('catalog');
  assert.equal(aggregateLumiFunnel(b.events).visitors[0].furthest, 'catalog');
  assert.equal(aggregateLumiFunnel(b.events).total.catalog, 1);
  assert.equal(aggregateLumiFunnel(b.events).total.cart, 1);
  assert.equal(await b.step('cart', {}, 'visitor-b'), false);
  await b.step('catalog', {}, 'visitor-b');
  assert.equal(aggregateLumiFunnel(b.events).total.catalog, 2);
});

test('snapshots corruptos, orden temporal inválido y otras métricas no generan avances', async () => {
  const b = browser(); await b.step('catalog');
  const base = b.events[0];
  const bad = { ...base, eventData: { ...base.eventData, seq: 2, step: 'whatsapp', reached: { catalog: 1000, cart: 1000, payment: 2000, whatsapp: 1000 } } };
  const data = aggregateLumiFunnel([base, bad, { ...base, type: 'purchase_complete' }]);
  assert.equal(data.total.whatsapp, 0);
  assert.equal(data.visitors[0].lastStep, 'catalog');
});

test('el origen explícito sigue desde producto hasta carrito Lumi, sin afectar Walá ni otras landings', () => {
  const location = path => new URL(path, 'https://www.wala.pe');
  assert.ok(isLumiProduct(location('/producto/anua?catalogo=lumi')));
  assert.ok(isLumiCart(location(rutaCompra(location('/producto/anua?catalogo=lumi')))));
  assert.equal(rutaCompra(location('/producto/anua')), '/checkout');
  assert.equal(rutaCompra(location('/producto/anua/landing')), '/checkout?landing=anua');
  assert.equal(isLumiProduct(location('/tienda?catalogo=lumi')), false);
  assert.equal(isLumiCart(location('/carrito')), false);
});
