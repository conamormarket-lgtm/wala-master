const test = require('node:test');
const assert = require('node:assert/strict');
const mobile = require('../mobileCheckout');
const { totalEsperadoCheckout } = require('../checkoutTotals');
const address = { customerName: 'Cliente de prueba', docType: 'DNI', dni: '12345678', phone: '912345678', country: 'PE', city: 'Lima', department: '', province: '', district: 'Miraflores', address: 'Calle de prueba 123' };
const input = (price = 149.7) => ({ contract: 'mobile-v1', requestId: 'abcdefghijklmnopqrst', expectedUid: 'a', items: [{ productId: 'polo', quantity: 1, selection: { variantId: null, size: null, pieces: {} } }], address, email: 'cliente@wala.test', expectedTotal: price + mobile.shipping(price) });
const read = (extra = {}) => async (ids) => new Map(ids.map((id) => [id, { name: 'Polo', price: 149.7, inStock: 5, ...extra }]));
test('nuevo contrato cobra S/15 entre 100 y 200; el contrato anterior sigue en 100', async () => {
  assert.equal((await mobile.build(input(), 'a', read())).payload.montoTotal, 164.7);
  assert.equal(totalEsperadoCheckout({ subtotal: 149.7, envioEstandar: 15, envioGratisDesde: 100 }).total, 149.7);
  assert.equal(mobile.shipping(200), 15); assert.equal(mobile.shipping(200.01), 0);
});
test('el pedido usa datos del servidor y no privilegios ni precios inyectados', async () => {
  const raw = { ...input(), role: 'admin', userId: 'otra', pagado: true };
  const result = await mobile.build(raw, 'a', read());
  assert.equal(result.payload.userId, 'a'); assert.equal(result.payload.pagado, undefined); assert.equal(result.payload.role, undefined);
  assert.equal(result.payload.productos.item_0.precio, 149.7); assert.equal(result.meta.input.role, undefined);
  await assert.rejects(mobile.build({ ...raw, expectedTotal: 1 }, 'a', read()));
});
test('idempotencia es por cuenta e intento y detecta cambios de datos', () => {
  const first = mobile.identity(input(), 'a');
  assert.deepEqual(mobile.identity(input(), 'a'), first);
  assert.notEqual(mobile.identity({ ...input(), expectedUid: 'b' }, 'b').id, first.id);
  assert.notEqual(mobile.identity({ ...input(), email: 'otra@wala.test' }, 'a').hash, first.hash);
  assert.throws(() => mobile.identity(input(), 'b'));
});
test('revalida talla, color y stock general en el backend', async () => {
  await assert.rejects(mobile.build(input(), 'a', read({ inStock: 0 })));
  const variants = [{ id: 'negro', name: 'Negro', sizes: ['M'] }];
  await assert.rejects(mobile.build(input(), 'a', read({ hasVariants: true, variants })));
  const selected = { ...input(), items: [{ ...input().items[0], quantity: 2, selection: { variantId: 'negro', size: 'M', pieces: {} } }], expectedTotal: 299.4 };
  assert.equal((await mobile.build(selected, 'a', read({ hasVariants: true, variants }))).meta.summary.items[0].selection.size, 'M');
  await assert.rejects(mobile.build({ ...selected, items: [{ ...selected.items[0], quantity: 6 }], expectedTotal: 898.2 }, 'a', read({ hasVariants: true, variants })));
});
test('estado de pago no implica pedido creado hasta confirmación del backend', () => {
  const intent = { status: 'paid_order_created', pedidoCreado: false, mobile: { contract: 'mobile-v1', requestId: input().requestId, summary: {} } };
  assert.equal(mobile.view('id', intent).state, 'order-pending');
  assert.equal(mobile.view('id', { ...intent, pedidoCreado: true }).state, 'paid');
  assert.equal(mobile.view('id', { ...intent, status: 'cobrando' }).state, 'processing');
  assert.equal(mobile.view('id', { ...intent, status: 'prepared', mobilePending3DS: true }).state, 'challenge');
});
test('3DS solo deja pasar los campos documentados, sin dar por válido un objeto vacío', () => {
  assert.throws(() => mobile.threeDS({}));
  assert.deepEqual(mobile.threeDS({ eci: '05', xid: 'id', cavv: 'value', protocolVersion: '2.1.0', extra: 'drop' }), { eci: '05', xid: 'id', cavv: 'value', protocolVersion: '2.1.0' });
});
