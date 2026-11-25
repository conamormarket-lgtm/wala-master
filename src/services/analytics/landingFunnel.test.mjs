import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandingFunnelTracker, aggregateLandingFunnel, LANDING_JOURNEY_MAX_MS } from './landingFunnel.mjs';

function setup({ storage, send } = {}) {
  const values = new Map();
  storage ||= { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  let time = Date.parse('2026-11-25T10:00:00-05:00');
  let id = 0;
  const events = [];
  const deps = { storage, now: () => time, newId: () => `journey-${++id}`, send: send || (async e => { events.push(e); return { id: String(events.length) }; }) };
  let tracker = createLandingFunnelTracker(deps);
  return {
    events, storage, now: () => time,
    record: (step, landingId = 'wallet', anonymousId = 'person-a') => tracker({ step, landingId, anonymousId, productName: landingId === 'wallet' ? 'Billetera' : 'Otro producto' }),
    advance: (ms = 100) => { time += ms; },
    reload: () => { tracker = createLandingFunnelTracker(deps); },
  };
}

test('recorrido completo: personas únicas, recargas, retrocesos y dos medios sin duplicar el total', async () => {
  const s = setup();
  await Promise.all([s.record('landing'), s.record('landing')]);
  for (const step of ['cart', 'shipping', 'payment', 'card', 'whatsapp']) { s.advance(); await s.record(step); }
  s.reload();
  for (const step of ['landing', 'cart', 'shipping', 'payment', 'card', 'whatsapp']) await s.record(step);
  assert.equal(s.events.length, 6);
  const r = aggregateLandingFunnel([...s.events, ...s.events]);
  assert.deepEqual(r.total, { landing: 1, cart: 1, shipping: 1, payment: 1, card: 1, whatsapp: 1, paypal: 0, selected: 1, directShipping: 0 });
  assert.equal(r.products[0].name, 'Billetera');
});

test('comprar ahora permite llegar al pago sin inventar una visita al carrito', async () => {
  const s = setup();
  for (const step of ['landing', 'shipping', 'payment', 'whatsapp']) { s.advance(); await s.record(step); }
  const r = aggregateLandingFunnel(s.events).total;
  assert.equal(r.cart, 0);
  assert.equal(r.directShipping, 1);
  assert.equal(r.selected, 1);
});

test('no atribuye checkout directo, otras landings ni métodos antes de mostrar opciones', async () => {
  const s = setup();
  assert.equal(await s.record('shipping'), false);
  await s.record('landing');
  assert.equal(await s.record('payment'), false);
  assert.equal(await s.record('card'), false);
  assert.equal(await s.record('cart', 'different'), false);
  assert.equal(await s.record('invalid'), false);
  assert.equal(s.events.length, 1);
});

test('visitas de una misma persona a dos landings: total único y avance separado', async () => {
  const s = setup();
  await s.record('landing');
  for (const step of ['landing', 'shipping', 'payment', 'card']) { s.advance(); await s.record(step, 'other'); }
  await s.record('landing', 'wallet', 'person-b');
  const r = aggregateLandingFunnel(s.events);
  assert.equal(r.total.landing, 2);
  assert.equal(r.products.find(p => p.landingId === 'wallet').counts.landing, 2);
  assert.equal(r.products.find(p => p.landingId === 'wallet').counts.selected, 0);
  assert.equal(r.products.find(p => p.landingId === 'other').counts.card, 1);
});

test('rango por fecha de entrada: cruce de medianoche, corte del avance y sin sumar únicos diarios', async () => {
  const s = setup();
  const start = s.now();
  await s.record('landing');
  s.advance(12 * 3600000);
  await s.record('shipping');
  const cut = s.now();
  s.advance();
  await s.record('payment');
  await s.record('whatsapp');
  assert.equal(aggregateLandingFunnel(s.events, { startDateMs: start, endDateMs: cut }).total.payment, 0);
  assert.equal(aggregateLandingFunnel(s.events, { startDateMs: start, endDateMs: s.now() }).total.selected, 1);
  assert.equal(aggregateLandingFunnel(s.events, { startDateMs: start + 1 }).total.landing, 0);
});

test('caduca a las 24 horas y una nueva entrada permite una nueva compra sin duplicar personas', async () => {
  const s = setup();
  await s.record('landing');
  s.advance(LANDING_JOURNEY_MAX_MS);
  assert.equal(await s.record('shipping'), false);
  await s.record('landing');
  await s.record('shipping');
  assert.notEqual(s.events[0].eventData.journeyId, s.events[1].eventData.journeyId);
  assert.equal(aggregateLandingFunnel(s.events).total.landing, 1);
  assert.equal(aggregateLandingFunnel(s.events).total.shipping, 1);
});

test('un fallo de escritura se puede reintentar; una fase posterior conserva los pasos vistos', async () => {
  const saved = [];
  let fails = true;
  const s = setup({ send: async e => { if (fails) return { error: 'offline' }; saved.push(e); return { id: 'ok' }; } });
  assert.equal(await s.record('landing'), false);
  fails = false;
  await s.record('shipping');
  assert.equal(aggregateLandingFunnel(saved).total.landing, 1);
  assert.equal(aggregateLandingFunnel(saved).total.shipping, 1);
  await s.record('landing');
  assert.equal(saved.length, 2);
});

test('sin almacenamiento y con rechazos de red nunca interrumpe la compra', async () => {
  const s = setup({ storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
  await s.record('landing');
  await s.record('shipping');
  assert.equal(aggregateLandingFunnel(s.events).total.shipping, 1);
  const rejected = setup({ send: async () => { throw Error('network'); } });
  assert.equal(await rejected.record('landing'), false);
});

test('no combina pasos de recorridos distintos ni acepta una secuencia invertida', async () => {
  const s = setup();
  await s.record('landing');
  const entry = s.events[0];
  const bad = { ...entry, eventData: { ...entry.eventData, journeyId: 'another', reached: { payment: s.now(), card: s.now() } } };
  assert.equal(aggregateLandingFunnel([entry, bad]).total.selected, 0);
  const wrongOrder = { ...entry, clientTsMs: s.now() + 20, eventData: { ...entry.eventData, reached: { landing: s.now(), shipping: s.now() + 10, payment: s.now() + 5, card: s.now() + 20 } } };
  const r = aggregateLandingFunnel([wrongOrder]).total;
  assert.equal(r.shipping, 1);
  assert.equal(r.payment, 0);
  assert.equal(r.selected, 0);
});

test('PayPal es otra selección y ningún evento de compra general entra en el embudo', async () => {
  const s = setup();
  for (const step of ['landing', 'shipping', 'payment', 'paypal']) await s.record(step);
  const r = aggregateLandingFunnel([...s.events, { ...s.events[0], anonymousId: 'someone', type: 'purchase_complete' }]).total;
  assert.equal(r.landing, 1);
  assert.equal(r.paypal, 1);
  assert.equal(r.selected, 1);
  assert.equal(r.card, 0);
});
