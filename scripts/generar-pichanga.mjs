// Busca y guarda una solución comprobada para cada nivel de La Pichanga de
// Kapi (src/componentes/kit/piezas/pichangaSoluciones.mjs).
//
// Para cada nivel prueba tiros con cada chapa (hacia la pelota y en todas las
// direcciones, con varias fuerzas) y se queda con el camino más corto que
// mete gol: primero de un toque; si no hay, de dos, tres o cuatro, siguiendo
// las jugadas que más acercan la pelota al arco. Un gol solo vale si es
// "holgado": la mayoría de los tiros parecidos (un poco más a un lado, un
// poco más fuerte o más suave) también entran, para que la persona pueda
// repetirlo con el dedo. En los penales busca un gol por tiro.
//
// De aquí salen el par (las 3 estrellas) y los toques de cada nivel. Si un
// nivel no tiene solución, se dice y no se guarda nada: hay que mover algo.
//
// También resuelve los retos del día (claves r1, r2…).
//
// Uso: node scripts/generar-pichanga.mjs [nivel… | rN… | retos]   (sin nada: todos)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NIVELES_PICHANGA, RETOS_PICHANGA } from '../src/componentes/kit/piezas/pichangaNiveles.mjs';
import { SOLUCIONES_PICHANGA } from '../src/componentes/kit/piezas/pichangaSoluciones.mjs';
import {
  armarNivel, partidaNivel, jugarTiro, tiroDesdeAngulo, chapasDe, indicePelota, comprobarPartida, MAX_TIRO, ANCHO,
} from '../src/componentes/kit/piezas/pichangaMotor.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, 'src', 'componentes', 'kit', 'piezas', 'pichangaSoluciones.mjs');

const GRADO = Math.PI / 180;
const FUERZAS = [0.35, 0.5, 0.65, 0.8, 1];
const BEAM = [0, 30, 18, 10];

/** Los tiros que se prueban desde una mesa. */
function candidatos(mesa) {
  const p = mesa.cuerpos[indicePelota(mesa)];
  const lista = [];
  for (const i of chapasDe(mesa, 'mia')) {
    const c = mesa.cuerpos[i];
    const base = Math.atan2(p.y - c.y, p.x - c.x);
    for (let g = -60; g <= 60; g += 2.5) {
      for (const f of FUERZAS) lista.push(tiroDesdeAngulo(i, base + g * GRADO, f));
    }
    for (let g = 0; g < 360; g += 15) {
      for (const f of [0.5, 1]) lista.push(tiroDesdeAngulo(i, g * GRADO, f));
    }
  }
  return lista.filter(Boolean);
}

/** ¿Los tiros parecidos también meten gol? (de 6 variantes, al menos 4). */
function holgado(lv, partida, [i, dx, dy]) {
  const angulo = Math.atan2(dy, dx);
  const fuerza = Math.sqrt(dx * dx + dy * dy) / MAX_TIRO;
  const variantes = [
    [angulo - 1.2 * GRADO, fuerza], [angulo + 1.2 * GRADO, fuerza],
    [angulo - 2.5 * GRADO, fuerza], [angulo + 2.5 * GRADO, fuerza],
    [angulo, Math.min(1, fuerza * 1.06)], [angulo, fuerza * 0.94],
  ];
  let goles = 0;
  for (const [a, f] of variantes) {
    const tiro = tiroDesdeAngulo(i, a, f);
    if (tiro && jugarTiro(lv, partida, tiro).sim.gol === 'arriba') goles += 1;
  }
  return goles >= 4;
}

/** Qué tan bien quedó la pelota (menos, mejor): cerca del arco y no pegada a la banda. */
function distancia(mesa) {
  const p = mesa.cuerpos[indicePelota(mesa)];
  const dx = p.x - ANCHO / 2;
  return Math.sqrt(dx * dx + p.y * p.y) + (p.x < 40 || p.x > ANCHO - 40 ? 120 : 0);
}

function resolverNormal(lv) {
  const abierto = { ...lv, toques: 99 };
  let capa = [{ partida: partidaNivel(abierto), tiros: [] }];
  for (let prof = 1; prof <= 4; prof += 1) {
    const siguientes = [];
    for (const nodo of capa) {
      for (const tiro of candidatos(nodo.partida.mesa)) {
        const { partida, sim } = jugarTiro(abierto, nodo.partida, tiro);
        if (sim.gol === 'arriba') {
          if (holgado(abierto, nodo.partida, tiro)) return [...nodo.tiros, tiro];
          continue;
        }
        siguientes.push({ partida, tiros: [...nodo.tiros, tiro], d: distancia(partida.mesa) });
      }
    }
    if (prof === 4) break;
    siguientes.sort((a, b) => a.d - b.d);
    // Sin repetir mesas casi iguales (la pelota en el mismo lugar).
    const vistos = new Set();
    capa = [];
    for (const n of siguientes) {
      const p = n.partida.mesa.cuerpos[indicePelota(n.partida.mesa)];
      const llave = `${Math.round(p.x / 12)},${Math.round(p.y / 12)}`;
      if (vistos.has(llave)) continue;
      vistos.add(llave);
      capa.push(n);
      if (capa.length >= BEAM[prof]) break;
    }
  }
  return null;
}

function resolverPenales(lv) {
  let partida = partidaNivel(lv);
  const tiros = [];
  while (!partida.ganada && !partida.perdida) {
    const gol = candidatos(partida.mesa).find((t) => jugarTiro(lv, partida, t).sim.gol === 'arriba' && holgado(lv, partida, t));
    if (!gol) return null;
    tiros.push(gol);
    ({ partida } = jugarTiro(lv, partida, gol));
  }
  return partida.ganada ? tiros : null;
}

// Lo que se resuelve: los niveles (clave = número) y los retos (clave rN).
const TAREAS = [
  ...NIVELES_PICHANGA.map((dato, k) => ({ clave: String(k + 1), numero: k + 1, dato, nombre: `Nivel ${k + 1}` })),
  ...RETOS_PICHANGA.map((dato, k) => ({ clave: `r${k + 1}`, numero: 0, dato, nombre: `Reto ${k + 1}` })),
];
const args = process.argv.slice(2);
const elegidas = args.length
  ? TAREAS.filter((t) => args.includes(t.clave) || (args.includes('retos') && t.clave.startsWith('r')))
  : TAREAS;
const soluciones = { ...SOLUCIONES_PICHANGA };
let fallos = 0;
for (const tarea of elegidas) {
  const inicio = Date.now();
  const borrador = armarNivel(tarea.numero, tarea.dato, null);
  const tiros = borrador.penales ? resolverPenales(borrador) : resolverNormal(borrador);
  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  if (!tiros) {
    fallos += 1;
    delete soluciones[tarea.clave];
    console.log(`${tarea.nombre}: SIN SOLUCIÓN (${seg} s)`);
    continue;
  }
  const lv = armarNivel(tarea.numero, tarea.dato, { par: tiros.length, tiros });
  const r = comprobarPartida(lv, tiros);
  if (!r.ganada) throw new Error(`${tarea.nombre}: la solución no se comprueba`);
  // El par cuenta los toques gastados: un pase no gasta toque.
  soluciones[tarea.clave] = { par: r.toques, tiros };
  console.log(`${tarea.nombre}: ${r.toques} ${r.toques === 1 ? 'toque' : 'toques'}${r.pases ? ` (+${r.pases} pase${r.pases > 1 ? 's' : ''})` : ''} (${seg} s)`);
}

const orden = (k) => (k.startsWith('r') ? 1000 + Number(k.slice(1)) : Number(k));
const cuerpo = Object.keys(soluciones).sort((a, b) => orden(a) - orden(b))
  .map((k) => `  ${k}: { par: ${soluciones[k].par}, tiros: ${JSON.stringify(soluciones[k].tiros)} },`).join('\n');
writeFileSync(destino, `// GENERADO por scripts/generar-pichanga.mjs (npm run gen:pichanga). No editar a mano.
// Una solución comprobada por nivel (clave: su número) y por reto del día
// (clave rN): { par: toques, tiros: [[chapa, dx, dy]…] }.
export const SOLUCIONES_PICHANGA = {
${cuerpo}
};
`, 'utf8');
console.log(fallos ? `${fallos} sin solución.` : 'Todo tiene solución.');
process.exitCode = fallos ? 1 : 0;
