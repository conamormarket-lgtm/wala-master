import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import * as funnel from '../../src/services/analytics/lumiFunnel.mjs';
import * as routes from '../../src/utils/catalogLanding.mjs';

async function moduleWithMocks(file, mocks, globals = {}) {
  const context = createContext(globals);
  const module = new SourceTextModule(await readFile(new URL(file, import.meta.url), 'utf8'), { context });
  await module.link(name => {
    const exports = mocks[name];
    if (!exports) throw Error(`Unmocked import: ${name}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

test('adaptador real: sesión existente, exclusión admin y rutas explícitas de Lumi', async () => {
  const docs = [], values = new Map();
  let allowed = true;
  const window = { location: new URL('https://www.wala.pe/'), sessionStorage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) } };
  const api = await moduleWithMocks('../../src/services/analytics/lumiFunnel.js', {
    '../../utils/catalogLanding.mjs': routes, './lumiFunnel.mjs': funnel,
    '../firebase/firestore': { createDocument: async (collection, data) => { docs.push({ collection, data }); return { id: 'saved' }; } },
    './tracker': { debeRegistrarAnalitica: () => allowed, ensureAnalyticsSession: async () => 'session', getAnonymousId: () => 'browser', getClientType: () => 'WEB' },
  }, { window });
  const visit = async (step, path) => {
    window.location = new URL(path, 'https://www.wala.pe'); api.trackLumiFunnel(step);
    await new Promise(resolve => setImmediate(resolve));
  };
  await visit('catalog', '/lumi');
  await visit('cart', '/carrito?catalogo=lumi');
  assert.equal(docs.length, 0);
  await visit('catalog', '/lumi/landing');
  await visit('product', '/producto/anua');
  await visit('add', '/tienda');
  await visit('cart', '/carrito');
  await visit('payment', '/checkout');
  assert.equal(docs.length, 1);
  await visit('product', '/producto/anua?catalogo=lumi');
  await visit('add', '/producto/anua?catalogo=lumi');
  await visit('cart', '/carrito?catalogo=lumi');
  await visit('payment', '/carrito?catalogo=lumi');
  await visit('whatsapp', '/carrito?catalogo=lumi');
  assert.equal(docs.length, 6);
  assert.ok(docs.every(d => d.collection === 'analytics_events' && d.data.sessionId === 'session'));
  assert.equal(funnel.aggregateLumiFunnel(docs.map(d => d.data)).total.whatsapp, 1);
  allowed = false;
  await visit('payment_close', '/carrito?catalogo=lumi');
  assert.equal(docs.length, 6);
});

test('lectura administrativa acotada y errores visibles; nunca totales parciales', async () => {
  const constraints = [];
  let size = 0, fail = false;
  const make = kind => (...args) => { constraints.push([kind, ...args]); return {}; };
  const api = await moduleWithMocks('../../src/services/adminLumiFunnel.js', {
    './firebase/config': { db: {} }, './analytics/lumiFunnel.mjs': funnel,
    './firebase/observed': { collection: make('collection'), query: make('query'), where: make('where'), orderBy: make('orderBy'), limit: make('limit'),
      getDocs: async () => { if (fail) throw Error('permission-denied'); return { size, docs: [] }; } },
  });
  const range = { startDateMs: 100, endDateMs: 200 };
  await api.getLumiFunnel(range);
  assert.deepEqual(constraints.filter(c => c[0] === 'where'), [
    ['where', 'type', '==', 'lumi_funnel'], ['where', 'clientTsMs', '>=', 100], ['where', 'clientTsMs', '<=', 200],
  ]);
  assert.deepEqual(constraints.find(c => c[0] === 'limit'), ['limit', 9001]);
  size = 9001;
  await assert.rejects(api.getLumiFunnel(range), /rango de fechas más corto/);
  fail = true;
  await assert.rejects(api.getLumiFunnel(range), /permission-denied/);
});
