import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

// Carga los servicios reales con un SDK simulado. No usa credenciales ni red.
async function loadService(file, mocks, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  const modules = new Map();
  async function load(id) {
    if (modules.has(id)) return modules.get(id);
    let module;
    if (Object.hasOwn(mocks, id)) {
      const values = mocks[id];
      module = new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context, identifier: id });
    } else {
      module = new vm.SourceTextModule(await readFile(id, 'utf8'), {
        context, identifier: id,
        initializeImportMeta(meta) { meta.env = { PROD: false, DEV: false }; },
        importModuleDynamically: async (specifier, parent) => {
          const child = await resolve(specifier, parent);
          if (child.status === 'unlinked') await child.link(resolve);
          if (child.status === 'linked') await child.evaluate();
          return child;
        },
      });
    }
    modules.set(id, module);
    return module;
  }
  function resolve(specifier, parent) {
    if (Object.hasOwn(mocks, specifier)) return load(specifier);
    const resolved = path.resolve(path.dirname(parent.identifier), specifier);
    return load(path.extname(resolved) ? resolved : `${resolved}.js`);
  }
  const root = await load(path.resolve(file));
  await root.link(resolve);
  await root.evaluate();
  return root.namespace;
}

const unused = () => { throw Error('Unexpected SDK call'); };
const sdk = {
  collection: (db, name) => ({ db, name }),
  query: (collection, ...constraints) => ({ ...collection, constraints }),
  where: (field, operator, value) => ({ field, operator, value }),
  doc: unused, getDoc: unused, getDocs: unused, addDoc: unused, setDoc: unused,
  updateDoc: unused, deleteField: unused, orderBy: unused, limit: unused,
  startAfter: unused, serverTimestamp: unused, getFirestore: unused,
  connectFirestoreEmulator: unused, setLogLevel: () => {},
};

async function productFixture() {
  const requests = [];
  const storage = new Map();
  const api = await loadService('src/services/products.js', {
    './firebase/firestore': {
      getCollection: (...args) => new Promise(resolve => requests.push({ args, resolve })),
      getDocument: unused, getCollectionPaginated: unused, createDocument: unused,
      updateDocument: unused, deleteDocument: unused, setDocument: unused,
    },
    'firebase/firestore': sdk,
    './firebase/config': { db: {} },
  }, { localStorage: {
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } });
  return { api, requests, storage };
}

test('real product service shares catalog reads while isolating public/history output', async () => {
  const { api, requests } = await productFixture();
  const publicRead = api.getProducts();
  const historyRead = api.getProducts([], null, null, { includeHidden: true });
  await Promise.resolve();
  assert.equal(requests.length, 1);
  requests[0].resolve({ data: [{ id: 'visible' }, { id: 'hidden', visible: false }, { id: 'deleted', deleted: true }], error: null });
  const [visible, history] = await Promise.all([publicRead, historyRead]);
  assert.deepEqual(Array.from(visible.data, p => p.id), ['visible']);
  assert.equal(history.data.length, 3);
  assert.deepEqual(Array.from(api.getCachedProducts(), p => p.id), ['visible']);
});

test('real product service does not overwrite post-edit cache with a stale response', async () => {
  const { api, requests } = await productFixture();
  const old = api.getProducts();
  await Promise.resolve();
  api.clearProductCaches();
  const fresh = api.getProducts();
  await Promise.resolve();
  assert.equal(requests.length, 2);
  requests[1].resolve({ data: [{ id: 'new' }], error: null });
  await fresh;
  requests[0].resolve({ data: [{ id: 'old' }], error: null });
  await old;
  assert.deepEqual(Array.from(api.getCachedProducts(), p => p.id), ['new']);
});

test('filtered product requests do not reuse an unfiltered response', async () => {
  const { api, requests } = await productFixture();
  const full = api.getProducts();
  const filtered = api.getProducts([{ field: 'brandId', operator: '==', value: 'brand' }]);
  await Promise.resolve();
  assert.equal(requests.length, 2);
  for (const request of requests) request.resolve({ data: [], error: null });
  await Promise.all([full, filtered]);
});

async function erpFixture({ project = 'same', portalProject = 'same', emulator = false, getDocs = unused, mirror = [] } = {}) {
  const portal = { options: { projectId: portalProject } };
  const portalDb = {};
  const created = [];
  const api = await loadService('src/services/erp/firebase.js', {
    'firebase/app': {
      getApps: () => [portal],
      initializeApp: (config, name) => { const app = { options: config, name }; created.push(app); return app; },
    },
    'firebase/firestore': { ...sdk, getDocs, getFirestore: app => ({ app }) },
    '../firebase/config': { default: portal, db: portalDb, USE_EMULATORS: emulator },
    '../walaOrders': { getWalaMirrorOrders: async () => mirror },
  }, { process: { env: { REACT_APP_FIREBASE_API_KEY: 'test', REACT_APP_FIREBASE_PROJECT_ID: project } } });
  return { api, portalDb, created };
}

test('ERP shares portal instance for same project and preview; preserves separate project support', async () => {
  for (const options of [{}, { emulator: true, portalProject: 'demo-wala', project: 'production' }]) {
    const { api, portalDb, created } = await erpFixture(options);
    assert.equal(api.erpDb, portalDb);
    assert.equal(created.length, 0);
  }
  const different = await erpFixture({ project: 'erp', portalProject: 'portal' });
  assert.notEqual(different.api.erpDb, different.portalDb);
  assert.equal(different.created.length, 1);
  assert.equal(different.created[0].options.projectId, 'erp');
});

test('real order lookup keeps mirror-only orders and enriches matching live orders', async () => {
  const { api } = await erpFixture({
    getDocs: async query => ({ docs: query.name === 'pedidos' ? [{
      id: '0001', data: () => ({ numeroPedido: '0001', createdAt: 1, web: true }),
    }] : [] }),
    mirror: [
      { id: 'mirror1', numeroPedido: '0001', estadoWala: 'pagado', pagado: true },
      { id: 'mirror2', numeroPedido: '0002', createdAt: 2 },
    ],
  });
  const result = await api.searchOrdersByDniInERP(' 00123 ', { userId: 'user' });
  assert.equal(result.error, null);
  assert.deepEqual(Array.from(result.data, p => p.numeroPedido), ['0002', '0001']);
  assert.equal(result.data[1]._walaEstado, 'pagado');
  assert.equal(result.data[1]._walaPagado, true);
  assert.equal(result.data[0]._esWalaMirror, true);
});

test('prefetch survives effect cleanup/replay and never requests the entire catalog', async () => {
  const idle = new Map();
  const keys = [];
  let cleanup, next = 0;
  const api = await loadService('src/hooks/usePrefetchStoreData.js', {
    react: { useEffect: fn => { cleanup = fn(); } },
    '@tanstack/react-query': { useQueryClient: () => ({ prefetchQuery: options => keys.push(Array.from(options.queryKey)) }) },
    '../services/products': { getCategories: unused, getFeaturedProducts: unused },
    '../services/messages': { getMessage: unused },
    '../pages/Tienda/services/storefront': { getStorefrontConfig: unused },
  }, { window: {
    requestIdleCallback: fn => { idle.set(++next, fn); return next; },
    cancelIdleCallback: id => idle.delete(id),
  } });
  api.usePrefetchStoreData();
  cleanup();
  api.usePrefetchStoreData();
  for (const fn of idle.values()) fn();
  assert.deepEqual(keys, [['storefront-config', 'home'], ['categories'], ['featured-products', null], ['store-messages']]);
});
