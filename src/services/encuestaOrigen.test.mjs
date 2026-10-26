import test from 'node:test';
import assert from 'node:assert/strict';
import { configConOrigenCompra, preguntaVisible, cambiarRespuestaEncuesta, OPCION_COMPRA, CAMPO_MARCA_COMPRA } from './encuestaOrigen.mjs';
import { resumenEncuesta, fichaCliente, csvRespuestas } from './surveyResponses.mjs';

const configAnterior = {
  basicDataPanel: { title: 'Sobre ti', fields: [
    { id: 'como_nos_conociste', type: 'select', label: '¿Cómo nos conociste?', options: ['Instagram', 'Otro'] },
    { id: 'otra', type: 'text', label: 'Otra pregunta' },
  ] },
};

test('completa una configuración guardada sin sobrescribir preguntas ni duplicar opciones', () => {
  const original = structuredClone(configAnterior);
  const config = configConOrigenCompra(configAnterior);
  const fields = config.basicDataPanel.fields;
  assert.equal(config.basicDataPanel.title, 'Sobre ti');
  assert.deepEqual(fields.map((f) => f.id), ['como_nos_conociste', CAMPO_MARCA_COMPRA, 'otra']);
  assert.deepEqual(fields[0].options, ['Instagram', 'Otro', OPCION_COMPRA]);
  assert.deepEqual(configConOrigenCompra(config), config);
  assert.deepEqual(configAnterior, original, 'no modifica el documento leído');
  assert.deepEqual(configConOrigenCompra({}), {}, 'no repone preguntas que se eliminaron');
});

test('las marcas vienen de la tienda y conservan la configuración de la pregunta', () => {
  const config = configConOrigenCompra(configAnterior, [{ name: 'Con Amor' }, { name: 'Yoryo' }, { name: 'Con Amor' }, { name: '' }]);
  const pregunta = config.basicDataPanel.fields[1];
  assert.deepEqual(pregunta.options, ['Con Amor', 'Yoryo']);
  pregunta.enEncuesta = false;
  pregunta.label = '¿Dónde compraste?';
  const actualizada = configConOrigenCompra(config, [{ name: 'Otra marca' }]);
  assert.equal(actualizada.basicDataPanel.fields[1].label, '¿Dónde compraste?');
  assert.equal(actualizada.basicDataPanel.fields[1].enEncuesta, false);
  assert.deepEqual(actualizada.basicDataPanel.fields[1].options, ['Otra marca']);
});

test('solo pregunta la marca al elegir una compra previa y limpia una respuesta obsoleta', () => {
  const fields = configConOrigenCompra(configAnterior).basicDataPanel.fields;
  const marca = fields[1];
  assert.equal(preguntaVisible(marca, {}, fields), false);
  assert.equal(preguntaVisible(marca, { como_nos_conociste: 'Instagram' }, fields), false);
  const respuestas = { como_nos_conociste: OPCION_COMPRA, marca_compra: 'Con Amor' };
  assert.equal(preguntaVisible(marca, respuestas, fields), true);
  assert.equal(preguntaVisible(marca, respuestas, [{ ...fields[0], enEncuesta: false }]), false);
  assert.equal(preguntaVisible(marca, respuestas, []), false);
  const cambiadas = cambiarRespuestaEncuesta(respuestas, 'como_nos_conociste', 'Instagram');
  assert.equal(cambiadas.marca_compra, '');
  assert.equal(respuestas.marca_compra, 'Con Amor');
  assert.equal(cambiarRespuestaEncuesta(respuestas, 'otra', 'Sí').marca_compra, 'Con Amor');
});

test('la marca elegida sale en resumen, ficha y CSV aunque la config guardada sea anterior', () => {
  const usuario = { id: 'cliente', hasCompletedSurvey: true, surveyBasicData: { como_nos_conociste: OPCION_COMPRA, marca_compra: 'Con Amor' } };
  const resumen = resumenEncuesta([usuario], configAnterior);
  const marca = resumen.basicos.find((f) => f.id === CAMPO_MARCA_COMPRA);
  assert.equal(marca.respondieron, 1);
  assert.deepEqual(marca.opciones, [{ valor: 'Con Amor', total: 1 }]);
  assert.ok(fichaCliente(usuario, configAnterior).basicos.some((f) => f.valor === 'Con Amor'));
  const csv = csvRespuestas([usuario], configAnterior);
  assert.ok(csv.includes('¿En cuál de nuestras marcas compraste?'));
  assert.ok(csv.includes('Con Amor'));
});
