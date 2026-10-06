import test from 'node:test';
import assert from 'node:assert/strict';
import { armarFechaEvento, partesFechaEvento, textoFechaEvento, proximaOcurrencia, ANIO_DESCONOCIDO } from './fechaEvento.mjs';
import { edadDe } from './giftRecommender.mjs';

test('armar: año opcional y fechas imposibles', () => {
  assert.equal(armarFechaEvento({ dia: 27, mes: 7, anio: 2005 }), '2005-07-27');
  assert.equal(armarFechaEvento({ dia: 27, mes: 7, anio: '' }), `${ANIO_DESCONOCIDO}-07-27`);
  assert.equal(armarFechaEvento({ dia: 31, mes: 4 }), '', '31 de abril no existe');
  assert.equal(armarFechaEvento({ dia: 29, mes: 2 }), '0000-02-29', '29 de febrero sin año, sí');
  assert.equal(armarFechaEvento({ dia: 29, mes: 2, anio: 2023 }), '', '2023 no es bisiesto');
  assert.equal(armarFechaEvento({ dia: 5, mes: '' }), '');
});

test('partes y texto', () => {
  assert.deepEqual(partesFechaEvento('0000-07-27'), { dia: 27, mes: 7, anio: null });
  assert.deepEqual(partesFechaEvento('1990-12-12'), { dia: 12, mes: 12, anio: 1990 });
  assert.equal(partesFechaEvento('basura'), null);
  assert.equal(textoFechaEvento('2005-07-27'), '27 de julio de 2005');
  assert.equal(textoFechaEvento('0000-07-27'), '27 de julio');
  assert.equal(textoFechaEvento('2005-07-27', { conAnio: false }), '27 de julio');
});

test('próxima ocurrencia (para entregas): nunca el año de nacimiento', () => {
  assert.equal(proximaOcurrencia('2005-07-27', '2026-10-06'), '2027-07-27');
  assert.equal(proximaOcurrencia('0000-12-12', '2026-10-06'), '2026-12-12');
  assert.equal(proximaOcurrencia('', '2026-10-06'), '');
});

test('sin año no hay edad (y no se toma como un anciano de 2026 años)', () => {
  assert.equal(edadDe({ events: [{ type: 'Cumpleaños', date: '0000-07-27' }] }, new Date(2026, 9, 6)), null);
  assert.equal(edadDe({ events: [{ type: 'Cumpleaños', date: '2018-07-27' }] }, new Date(2026, 9, 6)), 8);
});
