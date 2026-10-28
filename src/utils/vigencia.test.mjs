import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeVigencia, estaVigente } from './vigencia.mjs';

const ahora = Date.parse('2026-11-10T12:00:00-05:00');

test('sin fechas, siempre vigente', () => {
  assert.equal(estadoDeVigencia({}, ahora), 'vigente');
  assert.equal(estadoDeVigencia({ startTime: '', endTime: '' }, ahora), 'vigente');
  assert.equal(estadoDeVigencia(null, ahora), 'vigente');
});

test('antes de empezar está programada; al llegar la hora, vigente', () => {
  const foto = { startTime: '2026-11-23T05:00:00.000Z' };
  assert.equal(estadoDeVigencia(foto, ahora), 'programada');
  assert.equal(estadoDeVigencia(foto, Date.parse(foto.startTime)), 'vigente');
});

test('desde la hora de fin, vencida', () => {
  const foto = { endTime: '2026-11-09T05:00:00.000Z' };
  assert.equal(estadoDeVigencia(foto, ahora), 'vencida');
  assert.equal(estadoDeVigencia(foto, Date.parse(foto.endTime) - 1), 'vigente');
});

test('dentro del rango, vigente', () => {
  assert.equal(estaVigente({ startTime: '2026-11-01T05:00:00.000Z', endTime: '2026-12-01T05:00:00.000Z' }, ahora), true);
});

test('una fecha rota no esconde la foto', () => {
  assert.equal(estadoDeVigencia({ startTime: 'mañana', endTime: 'nunca' }, ahora), 'vigente');
});
