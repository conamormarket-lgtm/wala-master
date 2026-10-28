import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import * as real from '../../src/services/firebase/observed.js';
import { topology } from '../../src/observability/firestore-telemetry.mjs';

async function fixture(extra = {}) {
  const observations = [], listeners = [], calls = [], db = {}, active = { listeners: 0, queries: 0 };
  let currentScreen = '/admin/gestion-pagos';
  const sdk = {
    collection: (firestore, path) => ({ firestore, path, type: 'collection' }),
    doc: (firestore, path) => ({ firestore, path, type: 'document' }),
    query: ref => ({ ...ref, type: 'query' }),
    queryEqual: (a,b) => a.path === b.path, refEqual: (a,b) => a.path === b.path,
    getDocs: async ref => { calls.push(ref); return snapshot(); },
    onSnapshot: (ref, ...args) => { const observer = args.find(a => typeof a === 'function' || a?.next); const entry = { ref, args, observer, stopped: false }; listeners.push(entry); return () => { entry.stopped = true; }; },
    ...extra,
  };
  const telemetry = {
    firestoreScope: (_, p) => ({ collection: p.split('/').filter((_,i) => i % 2 === 0).join('/'), originScreen: currentScreen }),
    observe: (scope, operation, counts) => observations.push({ scope, operation, counts }),
    listenerTopology: (a,b) => { active.listeners += a; active.queries += b; },
    registerFirestoreDatabase() {},
  };
  const context = vm.createContext({ console });
  const root = new vm.SourceTextModule(await readFile(new URL('../../src/services/firebase/observed.js', import.meta.url),'utf8'), { context });
  await root.link(specifier => {
    const values = specifier === 'firebase/firestore' ? sdk : telemetry;
    return new vm.SyntheticModule(Object.keys(values), function() { for(const k of Object.keys(values)) this.setExport(k,values[k]); }, { context });
  });
  await root.evaluate();
  const deliver = (n, snap) => typeof listeners[n].observer === 'function' ? listeners[n].observer(snap) : listeners[n].observer.next(snap);
  const count = key => observations.reduce((n,o) => n+(o.counts[key] || 0),0);
  return { api: root.namespace, db, observations, listeners, calls, active, deliver, count, screen: s => { currentScreen = s; } };
}
function snapshot(fromCache = false, changes = ['added'], pending = false) {
  const doc = { metadata: { hasPendingWrites: pending }, data() { throw Error('Must not inspect contents'); } };
  return { size: changes.length, metadata: { fromCache }, docs: changes.map(() => doc), docChanges: () => changes.map(type => ({ type, doc })) };
}
test('Wala returns exact results/errors, records original screen and performs only the requested reads', async () => {
  let resolve;
  const f = await fixture({ getDocs: () => new Promise(r => { resolve = r; }) });
  const promise = f.api.getDocs(f.api.collection(f.db,'pedidos'));
  f.screen('/tienda');
  const snap = snapshot(); resolve(snap);
  assert.equal(await promise, snap);
  assert.equal(f.count('readCalls'), 1); assert.equal(f.count('serverDocuments'), 1);
  assert.ok(f.observations.every(o => o.scope.originScreen === '/admin/gestion-pagos'));
  const error = new Error('offline'), g = await fixture({ getDocs: async () => { throw error; } });
  await assert.rejects(g.api.getDocs(g.api.collection(g.db,'pedidos')), e => e === error);
  assert.equal(g.count('failedReadCalls'),1);
});
test('Wala preserves listener options/binding, counts changed documents once and hands over on unsubscribe', async () => {
  const f = await fixture(), options = { includeMetadataChanges: true };
  const ref = f.api.collection(f.db,'pedidos');
  const observer = { seen: 0, next() { assert.equal(this,observer); this.seen++; } };
  const a = f.api.onSnapshot(ref,options,observer), b = f.api.onSnapshot(ref,() => {});
  assert.equal(f.listeners[0].args[0],options); assert.deepEqual(f.active,{ listeners: 2, queries: 1 });
  f.deliver(0,snapshot(true)); f.deliver(1,snapshot(true));
  const synchronized = snapshot(false,[]); synchronized.size = 12250;
  Object.defineProperty(synchronized,'docs',{ get() { throw Error('Do not materialize listener results'); } });
  f.deliver(0,synchronized); f.deliver(1,synchronized);
  assert.equal(f.count('initialServerDocuments'),12250); assert.equal(f.count('serverDocuments'),0);
  a(); f.deliver(1,snapshot(false,['modified','removed']));
  assert.equal(f.count('serverDocuments'),1); assert.equal(f.count('removedDocuments'),1);
  assert.equal(observer.seen,2); b(); assert.deepEqual(f.active,{ listeners:0, queries:0 });
});
test('telemetry metadata failure cannot prevent listener or one-off result delivery', async () => {
  const snap = snapshot(); snap.docChanges = () => { throw Error('diagnostic failure'); };
  const f = await fixture({ getDocs: async () => { const value = {}; Object.defineProperty(value,'docs',{ get() { throw Error('diagnostic failure'); } }); return value; } });
  let received;
  const stop = f.api.onSnapshot(f.api.collection(f.db,'pedidos'),s => { received = s; });
  f.deliver(0,snap); assert.equal(received,snap); stop();
  assert.ok(await f.api.getDocs(f.api.collection(f.db,'pedidos')));
});
test('Wala transaction retry stays inside SDK transaction and preserves write chaining', async () => {
  let reads = 0, writes = 0;
  const tx = { get: async () => { reads++; return { exists: () => true, metadata: { fromCache: false } }; }, set() { writes++; return this; }, update() { writes++; return this; } };
  const f = await fixture({ runTransaction: async (_db, update, options) => { assert.equal(options.maxAttempts,2); await update(tx); return update(tx); } });
  const ref = f.api.doc(f.db,'pedidos/private');
  const result = await f.api.runTransaction(f.db,async transaction => { await transaction.get(ref); assert.equal(transaction.set(ref,{}).update(ref,{}),transaction); return 42; },{ maxAttempts:2 });
  assert.equal(result,42); assert.equal(reads,2); assert.equal(writes,4); assert.equal(f.count('readCalls'),2);
});
test('real Wala Firebase SDK works offline with exact references and no extra listeners', async () => {
  const app = initializeApp({ projectId:'demo-read-observer', apiKey:'demo' },'read-observer-test');
  const db = real.initializeFirestore(app,{ localCache: real.memoryLocalCache() });
  await real.disableNetwork(db);
  try {
    const ref = real.collection(db,'pedidos');
    const cached = await real.getDocsFromCache(ref); assert.equal(cached.size,0);
    let a, b;
    await Promise.all([new Promise(resolve => { a = real.onSnapshot(ref,resolve); }),new Promise(resolve => { b = real.onSnapshot(ref,resolve); })]);
    assert.deepEqual(topology(),{ activeListeners:2, activeQueries:1 });
    a(); b(); assert.deepEqual(topology(),{ activeListeners:0, activeQueries:0 });
  } finally { await real.terminate(db); await deleteApp(app); }
});
