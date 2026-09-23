import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackCulqiPurchase, trackPaypalPurchase } from './metaPixel.mjs';

test('confirmed payments, currency conversion, deduplication and failure isolation', async () => {
  const events = [];
  const storage = new Map();
  globalThis.window = {
    fbq: (...args) => events.push(args),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  };
  assert.equal(trackCulqiPurchase({ success: false, charge_id: 'failed', amount: 2000 }, 'PEN'), false);
  assert.equal(trackPaypalPurchase({ status: 'APPROVED' }), false);
  assert.equal(trackPaypalPurchase({ success: true, status: 'COMPLETED', amountUsd: 20 }), false);
  assert.equal(events.length, 0);
  const charge = { success: true, charge_id: 'charge-1', amount: 4590 };
  assert.equal(trackCulqiPurchase(charge, 'PEN'), true);
  assert.deepEqual(events[0], ['trackSingle', '1696511731424872', 'Purchase', { value: 45.9, currency: 'PEN' }, { eventID: 'culqi_charge-1' }]);
  assert.equal(trackCulqiPurchase(charge, 'PEN'), false);
  const freshModule = await import('./metaPixel.mjs?reload');
  assert.equal(freshModule.trackCulqiPurchase(charge, 'PEN'), false);
  assert.equal(trackPaypalPurchase({ success: true, status: 'COMPLETED', captureId: 'cap-1', amountUsd: '20.00' }), true);
  assert.deepEqual(events[1][3], { value: 20, currency: 'USD' });
  const legacy = { status: 'COMPLETED', purchase_units: [{ payments: { captures: [
    { status: 'PENDING', id: 'pending', amount: { value: '5', currency_code: 'USD' } },
    { status: 'COMPLETED', id: 'cap-2', amount: { value: '12.50', currency_code: 'USD' } },
  ] } }] };
  assert.equal(trackPaypalPurchase(legacy), true);
  assert.equal(events.length, 3);
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'bad', amount: 'invalid' }, 'PEN'), false);
  window.localStorage.getItem = () => { throw new Error('blocked'); };
  window.localStorage.setItem = () => { throw new Error('blocked'); };
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'private' }, 'PEN'), true);
  window.fbq = () => { throw new Error('blocked'); };
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'error' }, 'PEN'), false);
  delete window.fbq;
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'missing' }, 'PEN'), false);
  delete globalThis.window;
});

function captureEvents(t) {
  const events = [];
  const storage = new Map();
  globalThis.window = {
    fbq: (...args) => events.push(args),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  };
  t.after(() => { delete globalThis.window; });
  return events;
}

const rosaditasId = 'factos-polo-adicto-rosaditas';
const rosaditas = { productoId: rosaditasId, producto: 'Polo Adicto a las Rosaditas', cantidad: 1, precio: 45 };

test('checkout sends catalog IDs with the charged total after coins and shipping, without customer data', t => {
  const events = captureEvents(t);
  const order = {
    id: 'intent-1', numeroPedido: 'pedido-1',
    customerName: 'Cliente de prueba', email: 'cliente@example.test', dni: '00000000',
    webOrderPayload: {
      portalPseudoOrderId: 'pedido-1', direccion: 'Dirección privada',
      productos: { item_0: { ...rosaditas, textoPersonalizado: 'Texto privado', disenoVistas: { private: true } } },
    },
    // The fixed order payload takes precedence over any stale display data.
    productos: { item_0: { ...rosaditas, productoId: 'stale-product' } },
  };
  const charge = { success: true, charge_id: 'discounted', amount: 4200, pedidoWebId: 'web-confirmed-1' };
  assert.equal(trackCulqiPurchase(charge, 'PEN', order), true);
  assert.deepEqual(events[0][3], {
    order_id: 'web-confirmed-1', content_type: 'product',
    content_ids: [rosaditasId], contents: [{ id: rosaditasId, quantity: 1 }],
    num_items: 1, content_name: rosaditas.producto, value: 42, currency: 'PEN',
  });
  assert.deepEqual(events[0][4], { eventID: 'culqi_discounted' });
  // A repeated response or different order context must not create another sale.
  assert.equal(trackCulqiPurchase(charge, 'PEN', { id: 'different' }), false);
  assert.equal(events.length, 1);
});

test('mixed carts aggregate variants of the same catalog product in one purchase', t => {
  const events = captureEvents(t);
  const cholasId = 'factos-polo-adicto-cholas';
  const order = { numeroPedido: 'mixed-order', webOrderPayload: { productos: {
    item_0: { ...rosaditas, talla: 'S' },
    item_1: { ...rosaditas, cantidad: 2, talla: 'M' },
    item_2: { productoId: cholasId, producto: 'Polo Adicto a las Cholas', cantidad: 1 },
  } } };
  trackCulqiPurchase({ success: true, charge_id: 'mixed-cart', amount: 18000 }, 'PEN', order);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0][3].content_ids, [rosaditasId, cholasId]);
  assert.deepEqual(events[0][3].contents, [{ id: rosaditasId, quantity: 3 }, { id: cholasId, quantity: 1 }]);
  assert.equal(events[0][3].num_items, 4);
  assert.equal(events[0][3].order_id, 'mixed-order');
  assert.equal(events[0][3].value, 180);
});

test('combos use the parent catalog ID, and landing advances retain the amount actually paid', t => {
  const events = captureEvents(t);
  const combo = {
    productoId: 'combo-1', producto: 'Combo de regalo', cantidad: 1, precio: 100,
    esCombo: true, subProductos: { subItem_0: rosaditas, subItem_1: { productoId: 'billetera', cantidad: 1 } },
  };
  // Landing paymentPedido contains only the commercial line, without the
  // informational wallet line included in the fulfillment payload.
  trackCulqiPurchase({ success: true, charge_id: 'advance', amount: 2000 }, 'PEN', {
    id: 'landing-order', productos: { item_0: combo }, montoDeuda: 20,
  });
  assert.deepEqual(events[0][3].content_ids, ['combo-1']);
  assert.deepEqual(events[0][3].contents, [{ id: 'combo-1', quantity: 1 }]);
  assert.equal(events[0][3].num_items, 1);
  assert.equal(events[0][3].value, 20);
});

test('PayPal secure and SDK captures keep USD amounts and receive the same order products', t => {
  const events = captureEvents(t);
  const order = { id: 'local-order', productos: [rosaditas] };
  trackPaypalPurchase({ success: true, status: 'COMPLETED', captureId: 'usd-secure', amountUsd: '12.34', pedidoWebId: 'server-order' }, order, 'fallback-order');
  const legacy = { status: 'COMPLETED', purchase_units: [{ payments: { captures: [
    { status: 'PENDING', id: 'usd-pending', amount: { value: '12.34', currency_code: 'USD' } },
    { status: 'COMPLETED', id: 'usd-sdk', amount: { value: '12.34', currency_code: 'USD' } },
  ] } }] };
  trackPaypalPurchase(legacy, order, 'web-order');
  assert.equal(events.length, 2);
  assert.equal(events[0][3].order_id, 'server-order');
  assert.equal(events[1][3].order_id, 'web-order');
  for (const event of events) {
    assert.equal(event[3].currency, 'USD');
    assert.equal(event[3].value, 12.34);
    assert.deepEqual(event[3].content_ids, [rosaditasId]);
    // PEN catalog prices must not be labelled as USD item prices.
    assert.deepEqual(event[3].contents, [{ id: rosaditasId, quantity: 1 }]);
  }
});

test('missing or invalid product data never fabricates catalog IDs or blocks a confirmed payment', t => {
  const events = captureEvents(t);
  trackCulqiPurchase({ success: true, charge_id: 'invalid-items', amount: 2000 }, 'PEN', { id: 'order-invalid', productos: [
    null, { producto: 'Nombre sin ID', cantidad: 1 },
    { productoId: 'zero', cantidad: 0 }, { productoId: 'negative', cantidad: -1 },
    { productoId: 'fraction', cantidad: 1.5 }, { productoId: 'missing-quantity' },
    { productoId: {}, cantidad: 1 },
  ] });
  assert.deepEqual(events[0][3], { order_id: 'order-invalid', value: 20, currency: 'PEN' });
  const brokenOrder = { get webOrderPayload() { throw new Error('unavailable'); } };
  assert.equal(trackCulqiPurchase({ success: true, charge_id: 'broken-context', amount: 2000 }, 'PEN', brokenOrder), true);
  assert.deepEqual(events[1][3], { value: 20, currency: 'PEN' });
  assert.equal(trackPaypalPurchase({ success: false, status: 'PENDING' }, { productos: [rosaditas] }), false);
  assert.equal(events.length, 2);
});
