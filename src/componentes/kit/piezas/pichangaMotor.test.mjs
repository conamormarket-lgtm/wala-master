import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTiro, MAX_TIRO, crearMesa, definirCancha, simular, posicionKapi, estrellasPara, partidaNivel, jugarTiro,
  comprobarPartida, tiroValido, partidoNuevo, despuesDelTiroPartido, jugadaDeKapi, azar, canchaPartido, chapasDe,
  GOLES_PARTIDO, premioCofre, obstaculosDe, ALTO, indicePelota, huboPase, toquesUsados, PASES_MAX, simularPartido, tiroDesdeAngulo, ANCHO, respuestaRival, tiroDirigido,
} from './pichangaMotor.mjs';
import {
  NIVELES_PICHANGA, TOTAL_NIVELES_PICHANGA, nivelPichanga, RETOS_PICHANGA, retoPichanga, indiceRetoDe, semanaDe, mesDe,
} from './pichangaNiveles.mjs';
import { armarNivel } from './pichangaMotor.mjs';
import { SOLUCIONES_PICHANGA } from './pichangaSoluciones.mjs';

test('cada reto del día tiene una solución que mete gol con el par', () => {
  assert.equal(RETOS_PICHANGA.length, 24);
  RETOS_PICHANGA.forEach((dato, k) => {
    const sol = SOLUCIONES_PICHANGA[`r${k + 1}`];
    assert.ok(sol, `reto ${k + 1} sin solución: corre npm run gen:pichanga retos`);
    const lv = armarNivel(0, dato, sol);
    const r = comprobarPartida(lv, sol.tiros);
    assert.ok(r.valida && r.ganada, `reto ${k + 1}: la solución ya no mete gol`);
    assert.equal(r.toques, sol.par);
  });
});

test('el reto de una fecha es siempre el mismo y cambia entre días', () => {
  const a = retoPichanga('2026-11-09');
  assert.equal(a.reto, '2026-11-09');
  assert.equal(a.numero, null);
  assert.deepEqual(retoPichanga('2026-11-09').def, a.def);
  assert.equal(retoPichanga('9 de noviembre'), null);
  const usados = new Set(Array.from({ length: 60 }, (_, k) => indiceRetoDe(`2026-12-${String((k % 28) + 1).padStart(2, '0')}`)));
  assert.ok(usados.size > 10);
  assert.equal(semanaDe('2026-11-09'), '2026-11-09'); // lunes
  assert.equal(semanaDe('2026-11-15'), '2026-11-09'); // domingo
  assert.equal(mesDe('2026-11-09'), '2026-11');
});

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
  assert.equal(comprobarPartida(lv, [[indicePelota(partidaNivel(lv).mesa), 0, -150]]).valida, false); // la pelota no es una chapa
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

test('ningún nivel ni reto empieza con algo encimado o fuera de la cancha', async () => {
  const { problemasDeCancha } = await import('./pichangaMotor.mjs');
  NIVELES_PICHANGA.forEach((d, k) => assert.deepEqual(problemasDeCancha(definirCancha(d)), [], `nivel ${k + 1}`));
  RETOS_PICHANGA.forEach((d, k) => assert.deepEqual(problemasDeCancha(definirCancha(d)), [], `reto ${k + 1}`));
});

test('un pase no gasta toque (hasta PASES_MAX por nivel)', () => {
  // La chapa empuja la pelota hacia su compañera: pase.
  const lv = armarNivel(1, { mias: [[300, 760], [300, 400]], pelota: [300, 620], arcos: { arriba: 0 } }, { par: 1 });
  const { partida, sim } = jugarTiro(lv, partidaNivel(lv), [0, 0, -120]);
  assert.ok(sim.tocaron.includes(1));
  assert.ok(huboPase(partidaNivel(lv).mesa, [0, 0, -120], sim));
  assert.equal(partida.pases, 1);
  assert.equal(toquesUsados(partida), 0);
  assert.equal(partida.ultimo.pase, true);
  // El imán: la pelota quedó pegada al receptor, del lado del arco de arriba,
  // y el próximo tiro tiene que ser con él.
  assert.equal(partida.receptor, 1);
  const rec = partida.mesa.cuerpos[1];
  const pel = partida.mesa.cuerpos[indicePelota(partida.mesa)];
  assert.ok(pel.y < rec.y, 'la pelota queda hacia el arco rival');
  assert.ok(Math.abs(Math.hypot(pel.x - rec.x, pel.y - rec.y) - (rec.r + pel.r + 1)) < 1);
  assert.equal(pel.vx, 0); assert.equal(pel.vy, 0);
  assert.equal(tiroValido(partida.mesa, [0, 0, -100], partida.receptor), false);
  assert.equal(tiroValido(partida.mesa, [1, 0, -100], partida.receptor), true);
  // Un tiro que solo toca la pelota (sin compañero) no es pase.
  const solo = armarNivel(1, { mias: [[300, 760]], pelota: [300, 620], arcos: { arriba: 0 } }, { par: 1 });
  assert.equal(jugarTiro(solo, partidaNivel(solo), [0, 0, -120]).partida.pases, 0);
});

test('un autogol vuelve la jugada atrás y gasta el toque', () => {
  const lv = armarNivel(1, { mias: [[300, 420]], pelota: [300, 640] }, { par: 1 });
  const inicio = partidaNivel(lv);
  const { partida, sim } = jugarTiro(lv, inicio, [0, 0, 150]);
  assert.equal(sim.gol, 'abajo');
  assert.equal(partida.ultimo.autogol, true);
  assert.equal(partida.ganada, false);
  assert.equal(toquesUsados(partida), 1);
  assert.deepEqual(partida.mesa.cuerpos.map((c) => [c.x, c.y]), inicio.mesa.cuerpos.map((c) => [c.x, c.y]));
});

test('el partido: un pase da otro turno, hasta PASES_MAX seguidos', () => {
  let pt = partidoNuevo();
  const companero = 1; // otra chapa tuya
  const pase = { gol: null, tocaron: [companero], mesa: pt.mesa, pasos: 5 };
  for (let k = 1; k <= PASES_MAX; k += 1) {
    pt = despuesDelTiroPartido(pt, { ...pase, mesa: pt.mesa }, [0, 0, -100]);
    assert.equal(pt.turno, 'yo');
    assert.equal(pt.pases, k);
  }
  pt = despuesDelTiroPartido(pt, { ...pase, mesa: pt.mesa }, [0, 0, -100]);
  assert.equal(pt.turno, 'kapi');
  assert.equal(pt.pases, 0);
  // Seis chapas por lado, con arquero.
  assert.equal(chapasDe(pt.mesa, 'mia').length, 6);
  assert.equal(chapasDe(pt.mesa, 'rival').length, 6);
});

test('el pase: la pelota se pega sin saltar y el receptor la rodea hasta mirar al arco', () => {
  const pt = partidoNuevo();
  let encontrado = null;
  let tiroPase = null;
  for (const i of chapasDe(pt.mesa, 'mia')) {
    for (let g = 200; g < 340 && !encontrado; g += 2) {
      for (const f of [0.45, 0.6, 0.75, 0.9]) {
        const tiro = tiroDesdeAngulo(i, (g * Math.PI) / 180, f);
        const sim = tiro && simularPartido(pt, tiro, { cuadros: true });
        if (sim && sim.receptor != null && !sim.gol) { encontrado = sim; tiroPase = tiro; break; }
      }
    }
    if (encontrado) break;
  }
  assert.ok(encontrado, 'hay al menos un tiro que termina en pase');
  const kb = indicePelota(pt.mesa);
  // La pelota nunca salta: entre un paso y el siguiente se mueve poco.
  for (let k = 1; k < encontrado.cuadros.length; k += 1) {
    const [x0, y0] = encontrado.cuadros[k - 1][kb];
    const [x1, y1] = encontrado.cuadros[k][kb];
    assert.ok(Math.hypot(x1 - x0, y1 - y0) < 40, `salto en el paso ${k}`);
  }
  // Al final, el receptor quedó detrás de la pelota, mirando al arco de arriba.
  const rec = encontrado.mesa.cuerpos[encontrado.receptor];
  const pel = encontrado.mesa.cuerpos[kb];
  const [ax, ay] = [pel.x - rec.x, pel.y - rec.y];
  const [gx, gy] = [ANCHO / 2 - pel.x, 0 - pel.y];
  const alineado = (ax * gx + ay * gy) / (Math.hypot(ax, ay) * Math.hypot(gx, gy));
  assert.ok(alineado > 0.98, `alineado ${alineado}`);
  // Y el mismo pase da siempre lo mismo.
  assert.deepEqual(simularPartido(pt, tiroPase).mesa, encontrado.mesa);
});

test('en los niveles, Michi responde después de tu toque (siempre igual)', () => {
  const lv = armarNivel(5, { mias: [[300, 760]], pelota: [300, 620], rivales: [[300, 300]] }, { par: 1 });
  // Un toque suave que deja la pelota en la cancha: Michi responde.
  const a = jugarTiro(lv, partidaNivel(lv), [0, 0, -40], { cuadros: true });
  assert.ok(a.respuesta, 'Michi respondió');
  assert.equal(a.partida.mesa, a.respuesta.sim.mesa);
  assert.equal(a.partida.mesa.cuerpos[2].equipo, 'rival');
  // La misma jugada da siempre la misma respuesta.
  const b = jugarTiro(lv, partidaNivel(lv), [0, 0, -40]);
  assert.deepEqual(b.respuesta.tiro, a.respuesta.tiro);
  assert.deepEqual(b.partida.mesa, a.partida.mesa);
  assert.deepEqual(respuestaRival(a.sim.mesa, lv.def), a.respuesta.tiro);
  // Sin rivales no hay respuesta; tampoco en el último toque.
  const solo = armarNivel(1, { mias: [[300, 760]], pelota: [300, 620] }, { par: 1 });
  assert.equal(jugarTiro(solo, partidaNivel(solo), [0, 0, -40]).respuesta, null);
  let p = partidaNivel(lv);
  for (let k = 0; k < lv.toques - 1; k += 1) ({ partida: p } = jugarTiro(lv, p, [0, 0, 20]));
  assert.equal(jugarTiro(lv, p, [0, 0, 20]).respuesta, null);
});

test('un tiro dirigido manda la pelota hacia su objetivo', () => {
  const def = definirCancha({ mias: [[200, 700]], pelota: [300, 600], arcos: { arriba: 0, abajo: 0 } });
  const mesa = crearMesa(def);
  const tiro = tiroDirigido(mesa, 0, { x: 300, y: 0 }, 0.9);
  const sim = simular(mesa, def, tiro);
  const p = sim.mesa.cuerpos[indicePelota(sim.mesa)];
  assert.ok(p.y < 400, `la pelota subió (${p.y})`);
  assert.ok(Math.abs(p.x - 300) < 120, `y fue derecha (${p.x})`);
});

test('en el partido, Michi siempre toca la pelota', () => {
  const def = canchaPartido();
  const mesa = crearMesa(def);
  for (const dificultad of ['facil', 'normal', 'dificil']) {
    const tiro = jugadaDeKapi(mesa, def, { dificultad, rnd: azar(11) });
    const sim = simular(mesa, def, tiro, { iman: true });
    assert.ok(sim.tocaron.includes(tiro[0]) || sim.gol, dificultad);
  }
});
