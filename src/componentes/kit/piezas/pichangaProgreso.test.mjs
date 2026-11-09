import test from 'node:test';
import assert from 'node:assert/strict';
import {
  progresoPichanga, unirProgresos, desbloqueado, nuevosDesbloqueos, estrellasTotales, textoDesbloqueo,
  EQUIPOS_PICHANGA, PELOTAS_PICHANGA, ESTADIOS_PICHANGA,
} from './pichangaProgreso.mjs';

const equipo = (id) => EQUIPOS_PICHANGA.find((e) => e.id === id);

test('un progreso vacío o roto queda completo', () => {
  const p = progresoPichanga({ nivel: -3, estrellas: { 1: 5, x: 2, 2: 0 }, guardadas: null, dificultad: 'imposible', partidos: 'x' });
  assert.equal(p.nivel, 1);
  assert.deepEqual(p.estrellas, { 1: 3 });
  assert.deepEqual(p.guardadas, { vista: 0, repetir: 0, toque: 0 });
  assert.equal(p.dificultad, 'normal');
  assert.deepEqual(p.partidos, { jugados: 0, ganados: 0 });
  assert.equal(progresoPichanga(null).equipo, 'huellitas');
});

test('lo elegido tiene que estar desbloqueado', () => {
  assert.equal(progresoPichanga({ equipo: 'dorado' }).equipo, 'huellitas');
  const treinta = Object.fromEntries(Array.from({ length: 10 }, (_, k) => [k + 1, 3]));
  assert.equal(progresoPichanga({ equipo: 'dorado', estrellas: treinta }).equipo, 'dorado');
  assert.equal(progresoPichanga({ pelota: 'nada' }).pelota, 'clasica');
});

test('cada forma de desbloquear', () => {
  const base = progresoPichanga({});
  assert.ok(desbloqueado(equipo('huellitas'), base));
  assert.ok(!desbloqueado(equipo('invierno'), base));
  assert.ok(desbloqueado(equipo('invierno'), progresoPichanga({ estrellas: { 20: 1 } })));
  assert.ok(desbloqueado(equipo('goleador'), progresoPichanga({ partidos: { ganados: 3, jugados: 4 } })));
  assert.ok(desbloqueado(equipo('rosado'), progresoPichanga({ goles: 15 })));
  assert.equal(estrellasTotales({ estrellas: { 1: 3, 2: 2 } }), 5);
  assert.equal(textoDesbloqueo(equipo('dorado')), 'Junta 30 estrellas');
  // Todos los ids son únicos y hay algo desde el inicio en cada clase.
  for (const lista of [EQUIPOS_PICHANGA, PELOTAS_PICHANGA, ESTADIOS_PICHANGA]) {
    assert.equal(new Set(lista.map((i) => i.id)).size, lista.length);
    assert.equal(lista[0].desbloqueo.tipo, 'inicio');
  }
});

test('lo que se acaba de desbloquear', () => {
  const antes = progresoPichanga({ partidos: { ganados: 0 } });
  const despues = progresoPichanga({ partidos: { ganados: 1 } });
  assert.deepEqual(nuevosDesbloqueos(antes, despues).map((d) => d.item.id), ['noche']);
});

test('unir: lo ganado no se pierde; la racha y el vestuario, del último', () => {
  const aparato = { nivel: 5, estrellas: { 1: 3, 2: 1 }, racha: 2, goles: 9, equipo: 'celeste', actualizado: 100, sonido: false };
  const cuenta = { nivel: 8, estrellas: { 2: 3, 7: 2 }, racha: 0, goles: 4, partidos: { jugados: 3, ganados: 1 }, equipo: 'barrio', actualizado: 200 };
  const u = unirProgresos(aparato, cuenta);
  assert.equal(u.nivel, 8);
  assert.deepEqual(u.estrellas, { 1: 3, 2: 3, 7: 2 });
  assert.equal(u.racha, 0);
  assert.equal(u.goles, 9);
  assert.deepEqual(u.partidos, { jugados: 3, ganados: 1 });
  assert.equal(u.equipo, 'barrio');
  assert.equal(u.sonido, false);
  assert.equal(u.actualizado, 200);
});
