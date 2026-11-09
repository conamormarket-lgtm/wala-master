import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTiro, MAX_TIRO, crearMesa, definirCancha, simular, posicionKapi, estrellasPara, partidaNivel, jugarTiro,
  comprobarPartida, tiroValido, partidoNuevo, despuesDelTiroPartido, jugadaDeKapi, azar, canchaPartido, chapasDe,
  GOLES_PARTIDO, premioCofre, obstaculosDe, ALTO,
} from './pichangaMotor.mjs';
import { NIVELES_PICHANGA, TOTAL_NIVELES_PICHANGA, nivelPichanga } from './pichangaNiveles.mjs';

test('un tiro se normaliza a enteros, sin pasar del máximo', () => {
  assert.equal(normalizarTiro(3, 4), null); // muy corto
  assert.deepEqual(normalizarTiro(0, -80.4), [0, -80]);
  const [x, y] = normalizarTiro(900, -900);
  assert.ok(x * x + y * y <= MAX_TIRO * MAX_TIRO);
  assert.ok(Number.isInteger(x) && Number.isInteger(y));
});

test('el mismo tiro da siempre lo mismo', () => {
  const def = definirCancha({ mias: [[200, 700], [400, 700]], pelota: [300, 520], rivales: [[300, 300]], conos: [[250, 200]], kapi: { x: 300, y: 42, rango: 60, vel: 2 } });
  const a = simular(crearMesa(def), def, [0, 60, -140]);
  const b = simular(crearMesa(def), def, [0, 60, -140]);
  assert.deepEqual(a, b);
  assert.ok(a.pasos > 0);
});

test('todo se detiene y nada sale de la cancha', () => {
  const def = definirCancha({ mias: [[300, 700]], pelota: [300, 500], arcos: { arriba: 0 } });
  const r = simular(crearMesa(def), def, [0, 37, -150]);
  assert.equal(r.gol, null);
  for (const c of r.mesa.cuerpos) {
    assert.equal(c.vx, 0); assert.equal(c.vy, 0);
    assert.ok(c.x >= c.r - 1e-6 && c.x <= 600 - c.r + 1e-6);
    assert.ok(c.y >= c.r - 1e-6 && c.y <= ALTO - c.r + 1e-6);
  }
});

test('Kapi de arquero no sale de su rango', () => {
  const k = { x: 300, y: 42, rango: 60, vel: 2.5, fase: 30 };
  for (let t = 0; t < 500; t += 0.37) {
    const p = posicionKapi(k, t);
    assert.ok(p.x >= 240 - 1e-9 && p.x <= 360 + 1e-9, `t=${t} x=${p.x}`);
  }
});

test('las estrellas según los toques', () => {
  assert.equal(estrellasPara(1, 1), 3);
  assert.equal(estrellasPara(2, 1), 2);
  assert.equal(estrellasPara(3, 1), 1);
  assert.equal(estrellasPara(2, 3), 3);
});

test('cada nivel tiene una solución que mete gol con el par', () => {
  assert.equal(TOTAL_NIVELES_PICHANGA, 40);
  for (let n = 1; n <= TOTAL_NIVELES_PICHANGA; n += 1) {
    const lv = nivelPichanga(n);
    assert.ok(lv.solucion, `nivel ${n} sin solución: corre npm run gen:pichanga`);
    const r = comprobarPartida(lv, lv.solucion);
    assert.ok(r.valida && r.ganada, `nivel ${n}: la solución ya no mete gol (npm run gen:pichanga)`);
    assert.equal(r.toques, lv.par, `nivel ${n}`);
    assert.equal(lv.toques, lv.penales ? lv.penales.tiros : lv.par + 2);
  }
});

test('los jefes son penales y los obstáculos llegan en orden', () => {
  assert.ok(nivelPichanga(20).penales && nivelPichanga(20).jefe);
  assert.ok(nivelPichanga(40).penales && nivelPichanga(40).jefe);
  const primero = {};
  NIVELES_PICHANGA.forEach((d, k) => {
    for (const o of obstaculosDe(definirCancha(d))) if (!primero[o]) primero[o] = k + 1;
  });
  assert.deepEqual(primero, { rivales: 5, conos: 8, kapi: 12, barro: 21, hielo: 26, arcoChico: 31 });
});

test('una partida no vale con tiros de más, de otra chapa o después de ganar', () => {
  const lv = nivelPichanga(1);
  const [gol] = lv.solucion;
  assert.equal(comprobarPartida(lv, [gol, gol]).valida, false); // seguir después de ganar
  assert.equal(comprobarPartida(lv, [[1, 0, -150]]).valida, false); // la pelota no es una chapa
  assert.equal(comprobarPartida(lv, [[0, 1, 1]]).valida, false); // sin fuerza
  assert.equal(tiroValido(partidaNivel(lv).mesa, [0, 0, -100]), true);
  // Sin gol en los toques que hay: perdida.
  let p = partidaNivel(lv);
  for (let k = 0; k < lv.toques; k += 1) ({ partida: p } = jugarTiro(lv, p, [0, 0, 20]));
  assert.equal(p.perdida, true);
  assert.equal(comprobarPartida(lv, Array(lv.toques + 1).fill([0, 0, 20])).valida, false);
});

test('los penales vuelven todo a su lugar después de cada tiro', () => {
  const lv = nivelPichanga(20);
  let p = partidaNivel(lv);
  ({ partida: p } = jugarTiro(lv, p, [0, 0, 30]));
  const inicio = partidaNivel(lv).mesa.cuerpos.map((c) => [c.x, c.y]);
  assert.deepEqual(p.mesa.cuerpos.map((c) => [c.x, c.y]), inicio);
  assert.ok(p.mesa.t > 0); // el reloj de Kapi sigue
  assert.equal(p.goles, 0);
});

test('el partido: goles, autogoles, turno y fin', () => {
  let pt = partidoNuevo();
  const gol = (lado) => ({ gol: lado, mesa: pt.mesa, pasos: 10 });
  pt = despuesDelTiroPartido(pt, gol('arriba'));
  assert.deepEqual(pt.goles, { yo: 1, kapi: 0 });
  assert.equal(pt.turno, 'kapi');
  pt = despuesDelTiroPartido(pt, gol('arriba')); // autogol de Kapi
  assert.deepEqual(pt.goles, { yo: 2, kapi: 0 });
  for (let k = 0; k < GOLES_PARTIDO; k += 1) pt = despuesDelTiroPartido(pt, gol('abajo'));
  assert.equal(pt.fin, 'kapi');
});

test('Kapi elige un tiro de sus chapas', () => {
  const def = canchaPartido();
  const mesa = crearMesa(def);
  for (const dificultad of ['facil', 'normal', 'dificil']) {
    const tiro = jugadaDeKapi(mesa, def, { dificultad, rnd: azar(7) });
    assert.ok(chapasDe(mesa, 'rival').includes(tiro[0]));
    assert.ok(normalizarTiro(tiro[1], tiro[2]));
  }
});

test('un cofre trae una ayuda conocida', () => {
  const rnd = azar(3);
  for (let k = 0; k < 50; k += 1) assert.ok(['vista', 'repetir', 'toque'].includes(premioCofre(rnd).tipo));
});
