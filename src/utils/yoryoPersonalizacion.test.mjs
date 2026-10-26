import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import { YORYO_PACK_ID, YORYO_PIEZAS, productoConYoryo, datosYoryoVacios, validarDatosYoryo, medidasConfirmadas, faltaPersonalizacionYoryo, reemplazarDisenoCarrito } from './yoryoPersonalizacion.mjs';
import { crearArteYoryo } from '../pages/Crear/arteYoryo.mjs';

test('Yoryo conserva identificadores, precios y visibilidad; no afecta otros productos', () => {
  const original = { id: YORYO_PIEZAS[0].id, price: 120, inStock: 4, visible: true };
  const normal = productoConYoryo(original);
  assert.equal(normal.id, original.id);
  assert.equal(normal.price, 120);
  assert.equal(normal.inStock, 4);
  assert.equal(normal.visible, true);
  assert.equal(normal.personalizacionYoryo.tecnica, 'laser');
  assert.equal(normal.personalizacionYoryo.produccion.medidasConfirmadas, undefined);
  assert.deepEqual(original, { id: YORYO_PIEZAS[0].id, price: 120, inStock: 4, visible: true });
  const otro = { id: 'otro' };
  assert.equal(productoConYoryo(otro), otro);
  assert.deepEqual(productoConYoryo({ id: YORYO_PACK_ID }).comboCrear.piezas.map((p) => p.prendaId), YORYO_PIEZAS.map((p) => p.id));
});

test('cada técnica exige sus propios datos y las medidas nunca se inventan', () => {
  const datos = { ...datosYoryoVacios(), nombre: 'Daniel' };
  assert.equal(validarDatosYoryo(datos, 'laser'), '');
  assert.match(validarDatosYoryo({ ...datos, plantilla: 'escudo' }, 'laser'), /SVG/);
  assert.match(validarDatosYoryo(datos, 'impresion'), /foto/);
  assert.match(validarDatosYoryo({ ...datos, plantilla: 'collage', fotos: [{ url: 'una' }] }, 'impresion'), /tres/);
  assert.equal(medidasConfirmadas({ anchoMm: 80, altoMm: 100 }), false);
  assert.equal(medidasConfirmadas({ anchoMm: 80, altoMm: 100, medidasConfirmadas: true }), true);
  assert.equal(medidasConfirmadas({ anchoMm: 1000, altoMm: 100, medidasConfirmadas: true }), false);
});

test('el SVG del láser conserva geometría y convierte los textos a trazos', async () => {
  const buffer = await readFile(new URL('../../public/fonts/segoeui.ttf', import.meta.url));
  const fuente = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const datos = { ...datosYoryoVacios(), nombre: 'Daniel', frase: 'Blanquiazul de corazón' };
  const config = { tecnica: 'laser', proporcion: 1.25, produccion: { anchoMm: 80, altoMm: 100, medidasConfirmadas: true } };
  const svg = crearArteYoryo({ datos, config, fuente });
  assert.match(svg, /width="80mm" height="100mm"/);
  assert.match(svg, /<path/);
  assert.doesNotMatch(svg, /<image|<text/);
  const provisional = crearArteYoryo({ datos, config: { ...config, produccion: {} }, fuente });
  assert.doesNotMatch(provisional, /width="80mm"/);
  assert.notEqual(svg, crearArteYoryo({ datos: { ...datos, nombre: 'Carlos' }, config, fuente }));
});

test('editar el carrito reemplaza solo el diseño de esa fila, conserva cantidades y regalos', () => {
  const originales = [{ id: 'pack-a', productId: YORYO_PACK_ID, quantity: 2, selected: false, deliveryRecipient: 'Daniel', customization: { miComboId: 'anterior' } }, { id: 'pack-b', productId: YORYO_PACK_ID, customization: { miComboId: 'otro' } }];
  const nueva = { miComboId: 'nuevo', imageURL: 'preview' };
  const editados = reemplazarDisenoCarrito(originales, 'pack-a', YORYO_PACK_ID, nueva);
  assert.equal(editados.length, 2);
  assert.equal(editados[0].id, 'pack-a');
  assert.equal(editados[0].quantity, 2);
  assert.equal(editados[0].selected, false);
  assert.equal(editados[0].deliveryRecipient, 'Daniel');
  assert.equal(editados[1], originales[1]);
  assert.equal(originales[0].customization.miComboId, 'anterior');
  assert.deepEqual(reemplazarDisenoCarrito(originales, 'pack-a', 'producto-equivocado', nueva), originales);
  const suelto = [{ id: 'termo', productId: YORYO_PIEZAS[0].id, productName: 'Tomatodo · Daniel', quantity: 1 }];
  const cambiado = reemplazarDisenoCarrito(suelto, 'termo', YORYO_PIEZAS[0].id, { tipo: 'crear', nombre: 'Tomatodo · Carlos', prendaNombre: 'Termo Yoryo Personalizado' });
  assert.match(cambiado[0].productName, /Carlos/);
  assert.doesNotMatch(cambiado[0].productName, /Daniel/);
});

test('un pack incompleto o pendiente de producción no queda listo para pagar', () => {
  assert.match(faltaPersonalizacionYoryo({ productId: YORYO_PACK_ID }), /Completa/);
  const piezas = YORYO_PIEZAS.map((p) => ({ prendaId: p.id, datosYoryo: { nombre: 'Daniel' }, produccionYoryo: { lista: true, revision: 'v1', tecnica: p.tecnica }, archivosProduccion: [{ url: 'archivo', lista: true, revision: 'v1', tecnica: p.tecnica, formato: p.tecnica === 'laser' ? 'svg' : 'png' }], vistasPrevias: [{ url: 'previa', revision: 'v1' }] }));
  const item = { productId: YORYO_PACK_ID, customization: { piezas } };
  assert.equal(faltaPersonalizacionYoryo(item), '');
  piezas[0].produccionYoryo.lista = false;
  assert.match(faltaPersonalizacionYoryo(item), /pendiente/);
});
