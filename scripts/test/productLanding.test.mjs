import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRoutes } from 'react-router-dom';
import { PRODUCT_ROUTE, PRODUCT_LANDING_ROUTE, productRoute, isProductLandingPath, replacementProductLocation } from '../../src/utils/productRoute.mjs';
import { sinKapiFlotante, sinKapiEnPie } from '../../src/components/marco/kapiFlotante.js';
import { productIdFromPath } from '../../src/services/analytics/productInterest.mjs';

const routes = [{ path: PRODUCT_ROUTE }, { path: PRODUCT_LANDING_ROUTE }];
test('la ruta landing resuelve el mismo producto para la ficha, WhatsApp y medición', () => {
  for (const id of ['yoryo-crear-billetera', 'otro-producto-123']) {
    for (const suffix of ['', '/', '/landing', '/landing/']) {
      const pathname = `/producto/${id}${suffix}`;
      assert.equal(matchRoutes(routes, pathname)?.[0].params.id, id);
      assert.equal(productRoute(pathname).id, id);
      assert.equal(productIdFromPath(pathname), id);
      assert.equal(isProductLandingPath(pathname), suffix.includes('landing'));
    }
  }
  for (const pathname of ['/producto/', '/producto/p/landing/otra', '/tienda/landing', '/producto/p/landings']) {
    assert.equal(matchRoutes(routes, pathname), null);
    assert.equal(productRoute(pathname), null);
  }
});
test('Kapi no aparece en la landing ni en su pie y las otras vistas conservan sus reglas', () => {
  assert.equal(sinKapiFlotante('/producto/a/landing'), true);
  assert.equal(sinKapiEnPie('/producto/a/landing/', { sesion: false }), true);
  assert.equal(sinKapiEnPie('/producto/a/landing', { sesion: true }), true);
  assert.equal(sinKapiFlotante('/producto/a'), false);
  assert.equal(sinKapiEnPie('/producto/a', { sesion: true }), false);
  assert.equal(sinKapiFlotante('/crear/a'), true);
  assert.equal(isProductLandingPath('/checkout'), false);
});
test('un producto reemplazado conserva el modo landing, la campaña y el ancla', () => {
  const from = { pathname: '/producto/anterior/landing/', search: '?utm_source=instagram&ref=abc', hash: '#detalles-producto' };
  const to = replacementProductLocation('nuevo', from);
  assert.deepEqual(to, { pathname: '/producto/nuevo/landing', search: from.search, hash: from.hash });
  assert.equal(matchRoutes(routes, to)?.[0].params.id, 'nuevo');
  assert.equal(replacementProductLocation('nuevo', { ...from, pathname: '/producto/anterior' }).pathname, '/producto/nuevo');
});
