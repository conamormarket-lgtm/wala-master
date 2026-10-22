import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAPACIDAD, COLORES, PRIMER_NIVEL, nivel, retoDelDia, puedeMover, mover, resuelto, resolver, pista,
  hayMovimientos, agregarTubo, volverA, tramo, tubosListos, obstaculosDelNivel, coloresDelNivel, azar,
  NIVELES_POR_MUNDO, mundoDe, esJefe, infoMundo, estrellasPara, metasEstrellas, premioCofre,
  comprobarPartida, semanaDe, LIMITES_PARTIDA,
} from './bolitasMotor.mjs';

const b = (c, extra = {}) => ({ id: `${c}-${Math.random().toString(36).slice(2, 8)}`, c, oculta: false, hielo: 0, ...extra });
const estadoDe = (tubos, cortinas = tubos.map(() => null)) => ({ capacidad: CAPACIDAD, tubos, cortinas });

/** Juega la solución con las reglas públicas: cada paso tiene que ser válido y el final, resuelto. */
function jugar(estado, solucion) {
  let s = estado;
  for (const [de, a] of solucion) {
    assert.ok(puedeMover(s, de, a), `movimiento inválido ${de}→${a}`);
    s = mover(s, de, a);
  }
  return s;
}

test('un movimiento lleva todo el tramo de arriba del mismo color que quepa', () => {
  const s = estadoDe([[b(0), b(1), b(1), b(1)], [b(1)], []]);
  assert.equal(tramo(s.tubos[0]), 3);
  const t = mover(s, 0, 1);
  assert.equal(t.movidas, 3);
  assert.equal(t.tubos[1].length, 4);
  assert.equal(t.tubos[0].length, 1);
  const u = mover(s, 0, 2);
  assert.equal(u.tubos[2].length, 3);
});

test('no se suelta sobre otro color ni en un tubo lleno', () => {
  const s = estadoDe([[b(0)], [b(1)], [b(0), b(0), b(0), b(0)], []]);
  assert.equal(puedeMover(s, 0, 1), false);
  assert.equal(puedeMover(s, 1, 2), false);
  assert.equal(puedeMover(s, 0, 3), true);
});

test('el hielo no deja mover la bolita y se derrite con cada movimiento', () => {
  const s = estadoDe([[b(0), b(1, { hielo: 2 })], [b(2)], [], []]);
  assert.equal(puedeMover(s, 0, 2), false);
  const t = mover(s, 1, 2);
  assert.equal(t.tubos[0][1].hielo, 1);
  const u = mover(t, 2, 3);
  assert.equal(u.tubos[0][1].hielo, 0);
  assert.equal(puedeMover(u, 0, 2), true);
});

test('la cortina se abre al completar su color', () => {
  const s = estadoDe([[b(0), b(0), b(0)], [b(0)], [b(1), b(2)]], [null, null, 0]);
  assert.equal(puedeMover(s, 2, 1), false);
  assert.equal(puedeMover(s, 0, 2), false);
  const t = mover(s, 1, 0);
  assert.equal(t.cortinas[2], null);
});

test('la bolita oculta se descubre al quedar arriba y deshacer no la vuelve a tapar', () => {
  const s = estadoDe([[b(0, { oculta: true }), b(1)], [], []]);
  const t = mover(s, 0, 1);
  assert.equal(t.tubos[0][0].oculta, false);
  const atras = volverA(s, t);
  assert.equal(atras.tubos[0][0].oculta, false);
  assert.equal(atras.tubos[0].length, 2);
});

test('sin movimientos, añadir tubo y la pista', () => {
  const s = estadoDe([[b(0), b(1), b(0), b(1)], [b(1), b(0), b(1), b(0)]]);
  assert.equal(hayMovimientos(s), false);
  assert.equal(resolver(s), null);
  const t = agregarTubo(s);
  assert.equal(t.tubos.length, 3);
  assert.equal(hayMovimientos(t), true);
  const casi = estadoDe([[b(0), b(0), b(0)], [b(0)], []]);
  const [de, a] = pista(casi);
  assert.ok(resuelto(mover(casi, de, a)));
});

test('la curva: aprendizaje, subida y meseta de 9 a 12 colores', () => {
  const rnd = azar(1);
  assert.equal(coloresDelNivel(1, rnd), 2);
  assert.equal(coloresDelNivel(10, rnd), 7);
  for (let n = 11; n <= 50; n += 1) { const c = coloresDelNivel(n, rnd); assert.ok(c >= 5 && c <= 7); }
  for (let n = 51; n <= 100; n += 1) { const c = coloresDelNivel(n, rnd); assert.ok(c >= 7 && c <= 9); }
  for (let n = 101; n <= 400; n += 1) { const c = coloresDelNivel(n, rnd); assert.ok(c >= 9 && c <= COLORES.length); }
});

test('cada obstáculo empieza solo en su nivel y después vuelve', () => {
  for (const [tipo, n] of Object.entries(PRIMER_NIVEL)) {
    assert.deepEqual(obstaculosDelNivel(n), [tipo]);
    for (let k = 1; k < n; k += 1) assert.ok(!obstaculosDelNivel(k).includes(tipo), `${tipo} antes de tiempo en ${k}`);
  }
  const despues = Array.from({ length: 60 }, (_, k) => obstaculosDelNivel(41 + k)).flat();
  for (const tipo of Object.keys(PRIMER_NIVEL)) assert.ok(despues.includes(tipo));
});

test('mundos de 20 niveles con su jefe al final', () => {
  assert.equal(NIVELES_POR_MUNDO, 20);
  assert.equal(mundoDe(1), 1);
  assert.equal(mundoDe(20), 1);
  assert.equal(mundoDe(21), 2);
  assert.deepEqual([infoMundo(2).desde, infoMundo(2).hasta], [21, 40]);
  assert.ok(infoMundo(9).nombre, 'los nombres vuelven a empezar');
  assert.ok(esJefe(20) && esJefe(40) && !esJefe(19) && !esJefe(0));
  for (const n of Object.values(PRIMER_NIVEL)) assert.ok(!esJefe(n), `la presentación del ${n} no puede ser un jefe`);
  // El jefe trae todos los obstáculos que ya salieron y un color más.
  assert.deepEqual(obstaculosDelNivel(20), ['ocultas']);
  assert.deepEqual(obstaculosDelNivel(40), ['ocultas', 'cortina']);
  assert.deepEqual(obstaculosDelNivel(60), ['ocultas', 'cortina', 'hielo']);
  const jefe = nivel(60);
  assert.ok(jefe.jefe);
  assert.equal(jefe.mundo, 3);
  assert.ok(resuelto(jugar(jefe.estado, jefe.solucion)));
});

test('estrellas: 3 igualando la solución del motor, 2 hasta un cuarto más, 1 si no', () => {
  assert.deepEqual(metasEstrellas(20), { tres: 20, dos: 25 });
  assert.equal(estrellasPara(18, 20), 3);
  assert.equal(estrellasPara(20, 20), 3);
  assert.equal(estrellasPara(25, 20), 2);
  assert.equal(estrellasPara(26, 20), 1);
  assert.equal(nivel(30).par, nivel(30).solucion.length);
});

test('el cofre trae una ayuda', () => {
  const tipos = new Set();
  for (let k = 0; k < 200; k += 1) {
    const p = premioCofre(azar(k));
    assert.ok(['pista', 'deshacer', 'tubo'].includes(p.tipo));
    assert.ok(p.cantidad >= 1);
    tipos.add(p.tipo);
  }
  assert.equal(tipos.size, 3);
  assert.equal(premioCofre(() => 0).tipo, 'pista');
  assert.equal(premioCofre(() => 0.999).tipo, 'tubo');
});

test('comprobar una partida: la solución pasa, las trampas no', () => {
  const lv = nivel(30);
  assert.deepEqual(comprobarPartida(lv, { movimientos: lv.solucion }), { ok: true, movimientos: lv.solucion.length });
  assert.equal(comprobarPartida(lv, { movimientos: lv.solucion.slice(0, -1) }).motivo, 'sin_resolver');
  assert.equal(comprobarPartida(lv, { movimientos: [] }).motivo, 'movimientos');
  assert.equal(comprobarPartida(lv, { movimientos: [[0, 0]] }).motivo, 'regla');
  assert.equal(comprobarPartida(lv, { movimientos: [['0', 1]] }).motivo, 'formato');
  assert.equal(comprobarPartida(lv, { movimientos: lv.solucion, tubos: LIMITES_PARTIDA.tubos + 1 }).motivo, 'tubos');
  assert.equal(comprobarPartida(lv, { movimientos: Array(LIMITES_PARTIDA.movimientos + 1).fill([0, 1]) }).motivo, 'movimientos');
  // Otro nivel no sirve para este.
  assert.equal(comprobarPartida(nivel(31), { movimientos: lv.solucion }).ok, false);
});

test('comprobar una partida con un tubo de más agregado a mitad del juego', () => {
  // Un tablero sin salida: solo se resuelve con el tubo de más.
  const armado = { estado: estadoDe([[b(0), b(1), b(0), b(1)], [b(1), b(0), b(1), b(0)]]) };
  const conTubo = resolver(agregarTubo(armado.estado));
  assert.ok(conTubo?.length);
  assert.ok(comprobarPartida(armado, { movimientos: conTubo, tubos: 1 }).ok);
  assert.equal(comprobarPartida(armado, { movimientos: conTubo }).motivo, 'regla', 'sin el tubo, los movimientos no valen');
});

test('la copia del servidor es igual a este motor', () => {
  const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const copia = leer('../../../../functions/bolitasMotor.mjs');
  const fin = copia.indexOf('\n\n', copia.indexOf('GENERADO')) + 2;
  assert.equal(copia.slice(fin), leer('./bolitasMotor.mjs'), 'corre: node scripts/generar-motor-bolitas.js');
});

test('la semana del ranking empieza el lunes', () => {
  assert.equal(semanaDe('2026-10-21'), '2026-10-19'); // miércoles
  assert.equal(semanaDe('2026-10-19'), '2026-10-19'); // lunes
  assert.equal(semanaDe('2026-10-25'), '2026-10-19'); // domingo
  assert.equal(semanaDe('2026-11-01'), '2026-10-26'); // cruza de mes
  assert.equal(semanaDe('2027-01-01'), '2026-12-28'); // cruza de año
});

test('el mismo número da el mismo nivel', () => {
  assert.deepEqual(nivel(37).estado, nivel(37).estado);
  assert.notDeepEqual(nivel(37).estado, nivel(38).estado);
  assert.deepEqual(retoDelDia('2026-10-21').estado, retoDelDia('2026-10-21').estado);
});

test('los niveles 1 a 200 y una muestra de los altos tienen solución y empiezan sin tubos listos', () => {
  const numeros = [...Array.from({ length: 200 }, (_, k) => k + 1), 250, 499, 1000, 2024, 5000, 9999, 15100];
  const inicio = Date.now();
  let peor = 0;
  for (const n of numeros) {
    const t0 = Date.now();
    const lv = nivel(n);
    peor = Math.max(peor, Date.now() - t0);
    assert.equal(tubosListos(lv.estado), 0, `nivel ${n} empieza con un tubo listo`);
    assert.ok(lv.estado.tubos.every((t) => !t.length || !t[t.length - 1].oculta), `nivel ${n}: una de arriba oculta`);
    assert.ok(resuelto(jugar(lv.estado, lv.solucion)), `nivel ${n} sin resolver`);
  }
  // En el celular se arma un nivel al entrar: tiene que ser rápido.
  console.log(`  ${numeros.length} niveles en ${Date.now() - inicio} ms (el más lento, ${peor} ms)`);
});

test('los retos de dos meses tienen solución y un obstáculo', () => {
  const dia = new Date(Date.UTC(2026, 9, 1));
  for (let k = 0; k < 60; k += 1) {
    const fecha = new Date(dia.getTime() + k * 86400000).toISOString().slice(0, 10);
    const reto = retoDelDia(fecha);
    assert.equal(reto.obstaculos.length, 1);
    assert.ok(reto.colores >= 10);
    assert.ok(resuelto(jugar(reto.estado, reto.solucion)), `reto ${fecha} sin resolver`);
  }
});
