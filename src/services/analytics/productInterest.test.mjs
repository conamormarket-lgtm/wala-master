import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateProductInterest, productIdFromPath } from './productInterest.mjs';

test('productIdFromPath', () => {
  assert.equal(productIdFromPath('/producto/abc123'), 'abc123');
  assert.equal(productIdFromPath('/producto/abc123?x=1'), 'abc123');
  assert.equal(productIdFromPath('/producto/a%20b'), 'a b');
  assert.equal(productIdFromPath('/tienda'), null);
  assert.equal(productIdFromPath(null), null);
});

test('junta vistas y tiempo por producto y ordena por tiempo', () => {
  const events = [
    { type: 'product_view', path: '/producto/A', clientTsMs: 10, eventData: { productId: 'A', name: 'Taza', category: 'Hogar' } },
    { type: 'route_dwell', path: '/producto/A', dwellMs: 5000, clientTsMs: 20 },
    { type: 'product_view', path: '/producto/B', clientTsMs: 30, eventData: { productId: 'B', name: 'Polo' } },
    { type: 'product_view', path: '/producto/B', clientTsMs: 40, eventData: { productId: 'B', name: 'Polo' } },
    { type: 'route_dwell', path: '/producto/B', dwellMs: 90000, clientTsMs: 50 },
    { type: 'route_dwell', path: '/tienda', dwellMs: 999999, clientTsMs: 60 },
    { type: 'page_view', path: '/producto/A', clientTsMs: 70 },
  ];
  const r = aggregateProductInterest(events);
  assert.deepEqual(r.map((x) => x.productId), ['B', 'A']);
  assert.equal(r[0].views, 2);
  assert.equal(r[0].dwellMs, 90000);
  assert.equal(r[0].lastSeenMs, 50);
  assert.equal(r[1].name, 'Taza');
  assert.equal(r[1].category, 'Hogar');
});

test('tiempo sin vista registrada igual cuenta', () => {
  const r = aggregateProductInterest([{ type: 'route_dwell', path: '/producto/Z', dwellMs: 1200 }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].views, 0);
  assert.equal(r[0].name, null);
});

import { recomendarSimilares } from './productInterest.mjs';

test('recomendarSimilares: misma categoría, sin repetir lo visto ni lo oculto', () => {
  const catalogo = [
    { id: 'A', categories: ['tazas'] },
    { id: 'B', categories: ['polos'] },
    { id: 'C', categories: ['tazas'] },
    { id: 'D', categories: ['polos'] },
    { id: 'E', categories: ['tazas'], visible: false },
    { id: 'F', categories: ['gorras'] },
  ];
  const interest = [
    { productId: 'B', dwellMs: 120000, views: 3 },
    { productId: 'A', dwellMs: 5000, views: 1 },
  ];
  const r = recomendarSimilares(interest, catalogo, 5).map((p) => p.id);
  assert.deepEqual(r, ['D', 'C']);
});

test('recomendarSimilares sin historial devuelve vacío', () => {
  assert.deepEqual(recomendarSimilares([], [{ id: 'A', categories: ['x'] }]), []);
});
