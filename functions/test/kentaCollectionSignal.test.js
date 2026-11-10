const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { buildSignal, deliver, instantVersion } = require('../kentaCollectionSignal');
const config = { owner: 'wala-owner', project: 'test-project' };
const stamp = { seconds: 1794000000, nanoseconds: 123456789 };
const ctx = { eventId: 'stable-event', timestamp: '2026-11-08T01:02:03.123456789Z', params: { pedidoId: 'exact-doc' } };
const data = { tenant_id: config.owner, clienteContacto: '900000000', deudaTotal: 100, estadoGeneral: 'En Produccion' };
const snap = (value) => ({ exists: value !== null, data: () => value, updateTime: stamp });
const change = (before, after) => ({ before: snap(before), after: snap(after) });

test('sales origin changes use trigger snapshots, with no extra database read', () => {
  const signal = buildSignal(change(data, { ...data, whatsappOrigen: ' C.D. 01 ' }), ctx, config);
  assert.equal(signal.order.sales_origin, 'C.D. 01');
  assert.equal(buildSignal(change(null, { ...data, whatsappOrigen: 'x'.repeat(121) }), ctx, config).order.sales_origin, null);
  assert.equal(buildSignal(change(null, { ...data, whatsappOrigen: { id: 'wrong' } }), ctx, config).order.sales_origin, null);
  assert.equal(buildSignal(change(data, { ...data, whatsappOrigen: '' }), ctx, config), null);
});

test('ignores unrelated owner and irrelevant changes, without a database object', () => {
  assert.equal(buildSignal(change(null, { ...data, tenant_id: 'other' }), ctx, config), null);
  assert.equal(buildSignal(change(data, { ...data, comprobantes: ['large'], productos: [1], updatedAt: 'x' }), ctx, config), null);
  assert.throws(() => buildSignal(change(null, data), ctx, { ...config, owner: '' }));
});
test('stable exact source identity and nanosecond version survive retries', () => {
  const first = buildSignal(change(data, { ...data, deudaTotal: 25 }), ctx, config);
  assert.deepEqual(first, buildSignal(change(data, { ...data, deudaTotal: 25 }), ctx, config));
  assert.equal(first.version, '1794000000123456789');
  assert.equal(first.order.debt, '25');
  assert.equal(first.order_id, 'exact-doc');
  assert.ok(Buffer.byteLength(JSON.stringify(first)) < 650);
});
test('creation, deletion, cancellation and owner changes emit terminal state', () => {
  assert.ok(buildSignal(change(null, data), ctx, config));
  for (const after of [null, { ...data, tenant_id: 'other' }])
    assert.equal(buildSignal(change(data, after), ctx, config).order.deleted, true);
  assert.equal(buildSignal(change(data, { ...data, estadoGeneral: 'Anulado' }), ctx, config).order.cancelled, true);
  assert.equal(instantVersion(ctx.timestamp), '1794099723123456789');
});
test('missing or malformed balance cannot silently become zero', () => {
  for (const debt of [undefined, null, false, NaN, Infinity, {}])
    assert.equal(buildSignal(change(data, { ...data, deudaTotal: debt }), ctx, config).order.debt, null);
  assert.equal(buildSignal(change(data, { ...data, deudaTotal: 0 }), ctx, config).order.debt, '0');
});
test('signs the exact minimal bytes and requires a durable ACK; failures retry', async () => {
  const signal = buildSignal(change(null, data), ctx, config);
  const result = await deliver(signal, { url: 'https://example.test', secret: 'test-secret', fetchImpl: async (url, request) => {
    const h = request.headers;
    assert.equal(h['x-wala-signature'], crypto.createHmac('sha256', 'test-secret').update(`${h['x-wala-timestamp']}.${request.body}`).digest('hex'));
    return { ok: true, json: async () => ({ ok: true, status: 'created' }) };
  } });
  assert.equal(result.firestore_reads, 0);
  await assert.rejects(deliver(signal, { url: 'x', secret: 'x', fetchImpl: async () => ({ ok: false, status: 503 }) }));
  await assert.rejects(deliver(signal, { url: 'x', secret: 'x', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }));
});
