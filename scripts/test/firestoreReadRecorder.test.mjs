import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadRecorder, routeScreen, COUNT_NAMES } from '../../src/observability/firestore-read-recorder.mjs';
import receiver from '../../functions/clientReadMetrics.js';
const endpoint = 'https://us-central1-sistema-gestion-3b225.cloudfunctions.net/collectClientFirestoreReads';
const scope = { project: 'sistema-gestion-3b225', database: '(default)', collection: 'pedidos', originScreen: '/finanzas/registros' };
const memory = () => { const values = new Map(); return { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) }; };
function fixture(options = {}) {
  const sent = [], timers = new Map(); let i = 0, time = 1793203200000, screen = '/finanzas/registros';
  const recorder = createReadRecorder({ app: 'sistema-gestion', now: () => time, screen: () => screen,
    storage: options.storage || memory(), sessionStorage: options.sessionStorage || memory(),
    fetcher: options.fetcher || (async (_, request) => { sent.push(JSON.parse(request.body)); return { ok: true }; }),
    schedule: (f, ms) => { timers.set(++i, { f, ms }); return i; }, cancel: n => timers.delete(n), ...options });
  recorder.configure({ endpoint });
  return { recorder, sent, timers, advance: n => { time += n; }, screen: s => { screen = s; } };
}
test('attributes initiation and callback screens separately, groups counters by minute, never sends on observe', async () => {
  const f = fixture();
  f.recorder.observe(scope, 'getDocs', { readCalls: 1 });
  f.screen('/inventario');
  f.recorder.observe(scope, 'getDocs', { serverDocuments: 12250, successfulReadCalls: 1 });
  assert.equal(f.sent.length, 0);
  f.advance(60000);
  f.recorder.observe(scope, 'getDocs', { cacheDocuments: 5 });
  await f.recorder.flush();
  assert.equal(f.sent.length, 1);
  const rows = f.sent[0].rows;
  assert.equal(rows.length, 3);
  assert.equal(rows[1].originScreen, '/finanzas/registros');
  assert.equal(rows[1].activeScreen, '/inventario');
  assert.equal(rows[1].counts.serverDocuments, 12250);
  assert.notEqual(rows[1].minute, rows[2].minute);
});
test('normalizes routes, redacts arbitrary screen data and excludes unknown counter values', async () => {
  assert.equal(routeScreen('/producto/secret-phone?email=private', ['/producto/:id']), '/producto/:id');
  assert.equal(routeScreen('/unknown-customer', ['/tienda']), '/:other');
  const f = fixture(); f.screen('/private?email=secret');
  f.recorder.observe(scope, 'getDoc', { readCalls: 1, payload: 1, serverDocuments: -1 });
  await f.recorder.flush();
  assert.deepEqual(f.sent[0].rows[0].counts, { readCalls: 1 });
  assert.equal(f.sent[0].rows[0].activeScreen, '/:other');
  assert.ok(!JSON.stringify(f.sent).includes('secret'));
});
test('retries the same batch after failure and restores queued records across reloads', async () => {
  const store = memory(), deviceStore = memory(), received = [];
  const first = fixture({ sessionStorage: store, storage: deviceStore, fetcher: async (_, r) => { received.push(JSON.parse(r.body)); throw Error('offline'); } });
  first.recorder.observe(scope, 'getDocs', { readCalls: 1 });
  await first.recorder.flush();
  assert.equal(first.recorder.status().queuedBatches, 1);
  assert.ok([...first.timers.values()].some(t => t.ms >= 60000));
  const second = fixture({ sessionStorage: store, storage: deviceStore });
  await second.recorder.flush();
  assert.equal(second.sent[0].batch, received[0].batch);
  assert.equal(second.recorder.status().device, first.recorder.status().device);
  assert.notEqual(second.recorder.status().session, first.recorder.status().session);
  assert.equal(second.recorder.status().queuedBatches, 0);
});
test('bounded pending rows and retry queue survive disabled storage without affecting callers', async () => {
  const broken = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  const f = fixture({ storage: broken, sessionStorage: broken, fetcher: async () => { throw Error('offline'); } });
  for (let batch = 0; batch < 5; batch++) {
    for (let n = 0; n < 200; n++) f.recorder.observe({ ...scope, collection: `collection${n}` }, 'getDocs', { readCalls: 1 });
    f.recorder.checkpoint();
  }
  assert.ok(f.recorder.status().queuedBatches <= 8);
  assert.ok(f.recorder.status().dropped > 0);
  await f.recorder.flush();
  assert.equal(f.recorder.status().lastError, 'offline');
});
test('concurrent flushes never send a batch twice and an empty queue does no work', async () => {
  let release, calls = 0;
  const f = fixture({ fetcher: () => { calls++; return new Promise(r => { release = r; }); } });
  await f.recorder.flush(); assert.equal(calls, 0);
  f.recorder.observe(scope, 'getDoc', { readCalls: 1 });
  const inflight = f.recorder.flush();
  await Promise.resolve();
  await f.recorder.flush(); await f.recorder.flush();
  assert.equal(calls, 1);
  release({ ok: true }); await inflight;
  assert.equal(f.recorder.status().queuedBatches, 0);
});
test('disabled or unapproved endpoint never emits data', async () => {
  const f = fixture(); f.recorder.configure({ endpoint: 'https://other.example/collect' });
  f.recorder.observe(scope, 'getDocs', { readCalls: 1 }); await f.recorder.flush();
  assert.equal(f.sent.length, 0); assert.equal(f.recorder.status().enabled, false);
});
test('token timeout terminates diagnostics and cannot send a late token', async () => {
  let resolveToken;
  const f = fixture(); f.recorder.configure({ endpoint, token: () => new Promise(r => { resolveToken = r; }) });
  f.recorder.observe(scope, 'getDocs', { readCalls: 1 });
  const running = f.recorder.flush();
  const timeout = [...f.timers.values()].find(t => t.ms === 8000);
  timeout.f(); await running;
  resolveToken('never-send'); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.sent.length, 0); assert.equal(f.recorder.status().lastError, 'timeout');
});
test('transport payloads stay below the receiver limit even at maximum counter cardinality', async () => {
  const f = fixture(), counts = Object.fromEntries([...COUNT_NAMES].map(k => [k, 100000000]));
  for(let i=0;i<40;i++) f.recorder.observe({ ...scope, collection:'a'.repeat(150)+i, project:'p'.repeat(160), database:'d'.repeat(160), originScreen:'s'.repeat(160) }, 'o'.repeat(160),counts);
  await f.recorder.flush();
  assert.ok(JSON.stringify(f.sent[0]).length < 49152);
  assert.ok(f.recorder.status().queuedBatches > 0);
});
test('expired queues and permanently rejected payloads cannot block later diagnostics', async () => {
  const f = fixture({ fetcher:async () => ({ok:false,status:400}) });
  f.recorder.observe(scope,'getDocs',{readCalls:1}); await f.recorder.flush();
  assert.equal(f.recorder.status().queuedBatches,0); assert.equal(f.recorder.status().dropped,1);
  f.recorder.observe(scope,'getDocs',{readCalls:1}); f.recorder.checkpoint();
  f.advance(86400001); await f.recorder.flush();
  assert.equal(f.recorder.status().queuedBatches,0); assert.equal(f.recorder.status().dropped,2);
});
for (const app of ['wala', 'sistema-gestion']) test(`${app}: real client batch reaches the receiver and produces a central log without database calls`, async () => {
  const logs = [], now = () => 1793203200000;
  const handler = receiver.createMetricsHandler({ project: scope.project, now, verifyToken: async t => assert.equal(t,'test-token'), log: (message,data) => logs.push(data) });
  const f = fixture({ app, now, fetcher: async (_url, options) => {
    const req = { method:options.method, ip:'test', body:JSON.parse(options.body), get: k => ({origin:'https://www.wala.pe', 'content-type':options.headers['Content-Type'], authorization:options.headers.Authorization})[k] };
    const res = { set() { return this; }, status(n) { this.code = n; return this; }, end() { return this; } };
    await handler(req,res); return { ok:res.code === 204, status:res.code };
  } });
  f.recorder.configure({endpoint, token:async () => app === 'sistema-gestion' ? 'test-token' : null});
  f.recorder.observe(scope,'getDocs',{readCalls:1,serverDocuments:98051});
  await f.recorder.flush();
  assert.equal(logs.length,1); assert.equal(logs[0].app,app);
  assert.equal(logs[0].rows[0].counts.serverDocuments,98051);
  assert.equal(f.recorder.status().queuedBatches,0);
});
