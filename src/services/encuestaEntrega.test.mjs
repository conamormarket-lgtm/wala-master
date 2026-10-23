import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenEntregas } from './encuestaEntrega.mjs';

test('promedio, contentos, estrellas, qué mejorar y comentarios', () => {
  const r = resumenEntregas([
    { estrellas: 5, mejorar: ['Todo estuvo bien'], comentario: '', fecha: 1 },
    { estrellas: 4, mejorar: ['Empaque'], comentario: 'Llegó bien', fecha: 3 },
    { estrellas: 2, mejorar: ['Tiempo de entrega', 'Empaque'], comentario: 'Tardó', fecha: 2 },
    { estrellas: 9 },
  ], ['Tiempo de entrega', 'Empaque', 'Precio', 'Todo estuvo bien']);
  assert.equal(r.total, 3);
  assert.equal(r.promedio, 3.7);
  assert.equal(r.contentos, 67);
  assert.deepEqual(r.porEstrellas.map((x) => x.total), [1, 1, 0, 1, 0]);
  assert.deepEqual(r.mejorar[0], { valor: 'Empaque', total: 2 });
  assert.ok(r.mejorar.some((x) => x.valor === 'Precio' && x.total === 0), 'las opciones sin votos también salen');
  assert.deepEqual(r.comentarios.map((c) => c.comentario), ['Llegó bien', 'Tardó']);
});

test('sin respuestas no divide entre cero', () => {
  const r = resumenEntregas([], []);
  assert.equal(r.promedio, 0);
  assert.equal(r.contentos, 0);
});
