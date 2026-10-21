import test from 'node:test';
import assert from 'node:assert/strict';
import { progresoBolitas, unirProgresos, PROGRESO_BOLITAS } from './bolitasProgreso.mjs';

test('un progreso vacío, viejo o roto queda completo y válido', () => {
  assert.deepEqual(progresoBolitas(), PROGRESO_BOLITAS);
  assert.deepEqual(progresoBolitas(null), PROGRESO_BOLITAS);
  const p = progresoBolitas({ nivel: '7', estrellas: { 3: 5, x: 2, 4: 0 }, guardadas: { pista: -2 }, vistos: 'ocultas', sonido: 0 });
  assert.equal(p.nivel, 7);
  assert.deepEqual(p.estrellas, { 3: 3 });
  assert.deepEqual(p.guardadas, { pista: 0, tubo: 0, deshacer: 0 });
  assert.deepEqual(p.vistos, []);
  assert.equal(p.sonido, true, 'solo false lo apaga');
});

test('al unir no se pierde lo ganado en ningún lado', () => {
  const aparato = { nivel: 12, estrellas: { 1: 3, 2: 1 }, vistos: ['ocultas'], reto: '2026-10-20', actualizado: 100 };
  const cuenta = { nivel: 30, estrellas: { 2: 2, 25: 3 }, vistos: ['cortina'], reto: '2026-10-21', actualizado: 50 };
  const u = unirProgresos(aparato, cuenta);
  assert.equal(u.nivel, 30);
  assert.deepEqual(u.estrellas, { 1: 3, 2: 2, 25: 3 });
  assert.deepEqual(u.vistos.sort(), ['cortina', 'ocultas']);
  assert.equal(u.reto, '2026-10-21');
  assert.equal(u.actualizado, 100);
});

test('la racha y las ayudas vienen del que cambió último, sin sumarse', () => {
  const viejo = { racha: 5, guardadas: { pista: 2 }, actualizado: 10 };
  const nuevo = { racha: 1, guardadas: { tubo: 1 }, actualizado: 20 };
  assert.equal(unirProgresos(viejo, nuevo).racha, 1);
  assert.deepEqual(unirProgresos(viejo, nuevo).guardadas, { pista: 0, tubo: 1, deshacer: 0 });
  assert.equal(unirProgresos(nuevo, viejo).racha, 1);
});

test('el sonido y la vibración son del aparato', () => {
  const u = unirProgresos({ sonido: false, vibracion: true }, { sonido: true, vibracion: false, actualizado: 99 });
  assert.equal(u.sonido, false);
  assert.equal(u.vibracion, true);
});
