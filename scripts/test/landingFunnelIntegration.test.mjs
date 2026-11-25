import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import * as funnel from '../../src/services/analytics/landingFunnel.mjs';
import * as origin from '../../src/utils/checkoutOrigin.mjs';
import * as routes from '../../src/utils/productRoute.mjs';

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

async function browser() {
  const docs = [], values = new Map();
  let allowed = true;
  const window = { location: new URL('https://www.wala.pe/'), sessionStorage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) } };
  const api = await moduleWithMocks('../../src/services/analytics/landingFunnel.js', {
    '../../utils/checkoutOrigin.mjs': origin,
    '../../utils/productRoute.mjs': routes,
    './landingFunnel.mjs': funnel,
    '../firebase/firestore': { createDocument: async (collection, data) => { docs.push({ collection, data }); return { id: 'saved' }; } },
    './tracker': { debeRegistrarAnalitica: () => allowed, ensureAnalyticsSession: async () => 'session', getAnonymousId: () => 'browser', getClientType: () => 'WEB' },
  }, { window });
  return { docs, block: () => { allowed = false; }, async visit(step, path) {
    window.location = new URL(path, 'https://www.wala.pe');
    api.trackLandingFunnel(step);
    await new Promise(resolve => setImmediate(resolve));
  } };
}

test('adaptador real: solo landing explícita; carrito y envío conservan la misma atribución', async () => {
  const b = await browser();
  await b.visit('landing', '/producto/wallet');
  await b.visit('shipping', '/checkout?landing=wallet');
  assert.equal(b.docs.length, 0);
  await b.visit('landing', '/producto/wallet/landing?utm_source=instagram');
  await b.visit('cart', '/carrito?landing=wallet');
  await b.visit('shipping', '/checkout?landing=wallet');
  await b.visit('payment', '/checkout?landing=wallet');
  await b.visit('whatsapp', '/checkout?landing=wallet');
  assert.equal(b.docs.length, 5);
  assert.ok(b.docs.every(d => d.collection === 'analytics_events' && d.data.sessionId === 'session'));
  assert.equal(new Set(b.docs.map(d => d.data.eventData.journeyId)).size, 1);
  assert.equal(funnel.aggregateLandingFunnel(b.docs.map(d => d.data)).total.whatsapp, 1);
  assert.ok(b.docs.every(d => !('email' in d.data) && !('uid' in d.data)));
});

test('no contamina checkout normal, consulta de ayuda, otra landing ni navegación de admin', async () => {
  const b = await browser();
  await b.visit('landing', '/producto/wallet/landing');
  await b.visit('cart', '/carrito');
  await b.visit('shipping', '/checkout');
  await b.visit('whatsapp', '/producto/wallet/landing');
  await b.visit('shipping', '/checkout?landing=other');
  await b.visit('payment', '/tienda?landing=wallet');
  b.block();
  await b.visit('shipping', '/checkout?landing=wallet');
  assert.equal(b.docs.length, 1);
});

async function reader({ count = 0, fail = false } = {}) {
  const constraints = [];
  const make = kind => (...args) => { constraints.push([kind, ...args]); return { kind, args }; };
  const api = await moduleWithMocks('../../src/services/adminLandingFunnel.js', {
    './firebase/config': { db: {} },
    './analytics/landingFunnel.mjs': funnel,
    './firebase/observed': { collection: make('collection'), query: make('query'), where: make('where'), orderBy: make('orderBy'), limit: make('limit'),
      getDocs: async () => { if (fail) throw Error('permission-denied'); return { size: count, docs: [] }; } },
  });
  return { ...api, constraints };
}

test('consulta acotada por tipo y ambas fechas, índice existente y ningún escaneo general', async () => {
  const r = await reader();
  await r.getLandingFunnel({ startDateMs: 100, endDateMs: 200 });
  assert.deepEqual(r.constraints.filter(c => c[0] === 'where'), [
    ['where', 'type', '==', 'landing_funnel'], ['where', 'clientTsMs', '>=', 100], ['where', 'clientTsMs', '<=', 200],
  ]);
  assert.deepEqual(r.constraints.find(c => c[0] === 'orderBy'), ['orderBy', 'clientTsMs', 'desc']);
  assert.deepEqual(r.constraints.find(c => c[0] === 'limit'), ['limit', 12001]);
});

test('el panel nunca presenta datos parciales ni un fallo de permisos como cero visitantes', async () => {
  await assert.rejects((await reader({ count: 12001 })).getLandingFunnel({ startDateMs: 100, endDateMs: 200 }), /rango de fechas más corto/);
  await assert.rejects((await reader({ fail: true })).getLandingFunnel({ startDateMs: 100, endDateMs: 200 }), /permission-denied/);
});
