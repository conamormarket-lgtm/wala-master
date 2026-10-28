import test from 'node:test';
import assert from 'node:assert/strict';
import { esProductoDeTienda, rutaDeCrear } from './enTienda.mjs';

test('los productos normales salen en la tienda mientras estén visibles', () => {
  assert.equal(esProductoDeTienda({ id: 'a' }), true);
  assert.equal(esProductoDeTienda({ id: 'a', visible: false }), false);
  assert.equal(esProductoDeTienda({ id: 'a', deleted: true }), false);
  assert.equal(esProductoDeTienda(null), false);
});

test('una prenda de Crear sale en la tienda solo con enTienda y publicada', () => {
  assert.equal(esProductoDeTienda({ id: 'p', esPrendaBase: true }), false);
  assert.equal(esProductoDeTienda({ id: 'p', esPrendaBase: true, enTienda: true }), true);
  // Borrador (visible: false = no publicada en Crear): tampoco en la tienda.
  assert.equal(esProductoDeTienda({ id: 'p', esPrendaBase: true, enTienda: true, visible: false }), false);
  assert.equal(esProductoDeTienda({ id: 'p', esPrendaBase: true, enTienda: true, deleted: true }), false);
});

test('un combo de Crear sale en la tienda solo con enTienda y publicado', () => {
  const combo = { id: 'c', esComboCrear: true, visible: false, comboCrear: { publicado: true } };
  assert.equal(esProductoDeTienda(combo), false);
  assert.equal(esProductoDeTienda({ ...combo, enTienda: true }), true);
  assert.equal(esProductoDeTienda({ ...combo, enTienda: true, comboCrear: { publicado: false } }), false);
  assert.equal(esProductoDeTienda({ ...combo, enTienda: true, deleted: true }), false);
});

test('la ruta del estudio de cada producto de Crear', () => {
  assert.equal(rutaDeCrear({ id: 'p', esPrendaBase: true }), '/crear/p');
  assert.equal(rutaDeCrear({ id: 'c', esComboCrear: true }), '/combo/c');
  assert.equal(rutaDeCrear({ id: 'a' }), null);
});
