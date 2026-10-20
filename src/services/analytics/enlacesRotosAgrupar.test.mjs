import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIN_ORIGEN,
  agruparEnlacesRotos,
  direccionDeRuta,
  origenDeReferrer,
  slugDeDireccion,
} from './enlacesRotosAgrupar.mjs';

test('direccionDeRuta quita query, ancla y la barra final', () => {
  assert.equal(direccionDeRuta('/Promo/?utm=1#x'), '/Promo');
  assert.equal(direccionDeRuta('/'), '/');
  assert.equal(direccionDeRuta(''), '/');
  assert.equal(direccionDeRuta('/producto/abc/'), '/producto/abc');
});

test('slugDeDireccion solo para un tramo', () => {
  assert.equal(slugDeDireccion('/Navidad'), 'navidad');
  assert.equal(slugDeDireccion('/d%C3%ADa-madre'), 'día-madre');
  assert.equal(slugDeDireccion('/producto/abc'), null);
  assert.equal(slugDeDireccion('/'), null);
});

test('origenDeReferrer', () => {
  assert.equal(origenDeReferrer(''), SIN_ORIGEN);
  assert.equal(origenDeReferrer('https://www.instagram.com/stories/x'), 'instagram.com');
  assert.equal(origenDeReferrer('https://wala.pe/tienda/abc?x=1', 'www.wala.pe'), 'En la tienda: /tienda/abc');
});

test('agruparEnlacesRotos cuenta, junta mayúsculas y marca las resueltas', () => {
  const eventos = [
    { path: '/Promo', eventData: { ruta: '/Promo?utm=ig', desde: 'https://l.instagram.com/' }, anonymousId: 'a', clientTsMs: 10 },
    { path: '/promo', eventData: { ruta: '/promo', desde: null }, anonymousId: 'a', clientTsMs: 30 },
    { path: '/promo', eventData: { ruta: '/promo', desde: 'https://l.instagram.com/' }, uid: 'u1', clientTsMs: 20 },
    { path: '/vieja', eventData: { ruta: '/vieja' }, anonymousId: 'b', clientTsMs: 40 },
    { path: '/producto/x', eventData: { ruta: '/producto/x' }, anonymousId: 'c', clientTsMs: 50 },
  ];
  const landings = [{ slug: 'nueva', slugsAnteriores: ['vieja'] }];
  const filas = agruparEnlacesRotos(eventos, { landings });

  assert.equal(filas.length, 3);
  assert.deepEqual(
    { direccion: filas[0].direccion, visitas: filas[0].visitas, personas: filas[0].personas, ultimaMs: filas[0].ultimaMs, slug: filas[0].slug },
    { direccion: '/Promo', visitas: 3, personas: 2, ultimaMs: 30, slug: 'promo' }
  );
  assert.deepEqual(filas[0].origenes, [
    { origen: 'l.instagram.com', visitas: 2 },
    { origen: SIN_ORIGEN, visitas: 1 },
  ]);
  assert.equal(filas[0].resueltaA, null);
  // Empate a 1 visita: la más reciente primero.
  assert.equal(filas[1].direccion, '/producto/x');
  assert.equal(filas[1].slug, null);
  assert.equal(filas[2].resueltaA, 'nueva');
});
