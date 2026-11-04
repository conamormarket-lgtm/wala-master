import test from 'node:test';
import assert from 'node:assert/strict';
import { idsParaRevisar, motivoNoDisponible } from './carritoDisponible.mjs';

const m = (o) => new Map(Object.entries(o));

test('las líneas que ya no se pueden comprar', () => {
  const productos = m({ a: { visible: true }, b: { deleted: true }, c: null, d: { visible: false }, combo: { isComboProduct: true }, pz: { visible: false }, pzBorrada: { deleted: true }, pack: { comboCrear: { publicado: true } }, prenda: { visible: true }, prendaOculta: { visible: false } });
  assert.equal(motivoNoDisponible({ productId: 'a' }, productos), '');
  assert.equal(motivoNoDisponible({ productId: 'b' }, productos), 'Ya no está disponible.');
  assert.equal(motivoNoDisponible({ productId: 'c' }, productos), 'Ya no está disponible.');
  assert.equal(motivoNoDisponible({ productId: 'd' }, productos), 'Ya no está disponible.');
  assert.equal(motivoNoDisponible({ productId: 'nadie' }, productos), '', 'sin saber, no se marca');
  assert.equal(motivoNoDisponible({ productId: 'combo', isComboProduct: true, comboItems: [{ productId: 'pz' }] }, productos), '', 'pieza oculta: vale');
  assert.match(motivoNoDisponible({ productId: 'combo', isComboProduct: true, comboItems: [{ productId: 'pzBorrada' }] }, productos), /combo ya no se vende/);
  const pack = (prendaId) => ({ productId: 'pack', customization: { tipo: 'comboCrear', piezas: [{ prendaId }] } });
  assert.equal(motivoNoDisponible(pack('prenda'), productos), '');
  assert.match(motivoNoDisponible(pack('prendaOculta'), productos), /pack ya no se vende/);
  assert.equal(motivoNoDisponible(pack('prenda'), m({ pack: { comboCrear: { publicado: false } } })), 'Este pack ya no se vende.');
  assert.deepEqual(idsParaRevisar([pack('prenda'), { productId: 'combo', isComboProduct: true, comboItems: [{ productId: 'pz' }] }]).sort(), ['combo', 'pack', 'prenda', 'pz']);
});
