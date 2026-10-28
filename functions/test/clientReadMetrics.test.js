const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBatch, createMetricsHandler } = require('../clientReadMetrics');
const time = 1793203200000, project = 'sistema-gestion-3b225';
const batch = () => ({ schema: 1, app: 'wala', device: 'device-12345', session: 'session-12345', batch: 'batch-12345', createdAt: time, dropped: 0,
  rows: [{ minute: time, project, database: '(default)', collection: 'pedidos', operation: 'getDocs', originScreen: '/admin/gestion-pagos', activeScreen: '/admin/gestion-pagos', counts: { serverDocuments: 12250 } }] });
function fixture(options = {}) {
  const logged = [], tokens = [];
  const handler = createMetricsHandler({ project, now: () => time, verifyToken: async t => { tokens.push(t); if (t !== 'valid') throw Error('invalid'); }, log: (m,d) => logged.push(d), ...options });
  async function send(body = batch(), headers = {}, extra = {}) {
    const req = { method: 'POST', ip: 'test-ip', body, get: k => ({ origin: 'https://www.wala.pe', 'content-type': 'application/json', ...headers })[k], ...extra };
    const res = { code: 0, headers: {}, set(k,v) { this.headers[k] = v; return this; }, status(n) { this.code = n; return this; }, end() { return this; } };
    await handler(req, res); return res;
  }
  return { send, logged, tokens };
}
test('accepts bounded public storefront counters and deduplicates retries without database dependencies', async () => {
  const f = fixture();
  assert.equal((await f.send()).code, 204); assert.equal((await f.send()).code, 204);
  assert.equal(f.logged.length, 1); assert.deepEqual(f.tokens, []);
  assert.equal(f.logged[0].authenticated, false);
});
test('ERP requires an existing project ID token, with no Firestore permission lookup', async () => {
  const f = fixture(), b = batch(); b.app = 'sistema-gestion';
  assert.equal((await f.send(b, { origin: 'https://erp.example' })).code, 401);
  assert.equal((await f.send(b, { origin: 'https://erp.example', authorization: 'Bearer invalid' })).code, 401);
  assert.equal((await f.send(b, { origin: 'https://erp.example', authorization: 'Bearer valid' })).code, 204);
  assert.equal(f.logged[0].authenticated, true);
  assert.ok(!JSON.stringify(f.logged).includes('valid'));
});
test('rejects foreign origins, oversize payloads, stale events, raw contents and unknown counters', async () => {
  const f = fixture();
  assert.equal((await f.send(batch(), { origin: 'https://foreign.example' })).code, 401);
  assert.equal((await f.send(batch(), {}, { rawBody: Buffer.alloc(50000) })).code, 413);
  const stale = batch(); stale.createdAt -= 86400001;
  assert.equal((await f.send(stale)).code, 400);
  const raw = batch(); raw.rows[0].data = { email: 'private' };
  assert.equal((await f.send(raw)).code, 400);
  const count = batch(); count.rows[0].counts.secret = 1;
  assert.equal((await f.send(count)).code, 400);
  const otherProject = batch(); otherProject.rows[0].project = 'another-project';
  assert.equal(validateBatch(otherProject, project, time), null);
  assert.equal(f.logged.length, 0);
});
test('CORS preflight does no auth work and log failures remain retryable', async () => {
  const f = fixture({ log() { throw Error('unavailable'); } });
  assert.equal((await f.send(null, {}, { method: 'OPTIONS' })).code, 204);
  assert.equal(f.tokens.length, 0);
  assert.equal((await f.send()).code, 503);
  assert.equal((await f.send()).code, 503);
});
test('per-instance rate brake bounds log traffic', async () => {
  const f = fixture();
  for (let i = 0; i < 120; i++) await f.send();
  assert.equal((await f.send()).code, 429);
  assert.equal(f.logged.length, 1);
});
