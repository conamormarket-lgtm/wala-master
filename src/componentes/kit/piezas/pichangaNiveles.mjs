/*
 * Los niveles de La Pichanga de Kapi: dónde está cada cosa. La cancha mide
 * 600 × 900 y el arco que se ataca está arriba (ver pichangaMotor.mjs).
 * Cada nivel tiene una solución comprobada en pichangaSoluciones.mjs (la
 * arma `npm run gen:pichanga`): de ahí salen el par (las 3 estrellas) y los
 * toques que hay. Si cambias un nivel, vuelve a correrlo; la prueba avisa si
 * una solución ya no mete gol.
 *
 * Mundo 1, la canchita del barrio: rivales desde el 5, conos desde el 8,
 * Kapi de arquero desde el 12 y penales contra Kapi en el 20 (el jefe).
 * Mundo 2, invierno en el potrero: barro desde el 21, hielo desde el 26, arco
 * chico desde el 31 y penales más difíciles en el 40.
 */
import { armarNivel } from './pichangaMotor.mjs';
import { SOLUCIONES_PICHANGA } from './pichangaSoluciones.mjs';

const K = (x, vel, rango = 60, fase = 0) => ({ x, y: 42, rango, vel, fase });
const barro = (x, y, w, h) => ({ tipo: 'barro', x, y, w, h });
const hielo = (x, y, w, h) => ({ tipo: 'hielo', x, y, w, h });

export const NIVELES_PICHANGA = [
  /* ── Mundo 1: La canchita del barrio ── */
  // 1-4: tirar, apuntar, usar dos chapas, rebotar en la banda.
  { mias: [[300, 640]], pelota: [300, 520] },
  { mias: [[200, 660]], pelota: [260, 500] },
  { mias: [[430, 700]], pelota: [380, 430] },
  { mias: [[150, 700], [450, 720]], pelota: [480, 330] },
  // 5-7: rivales (las chapas de Kapi) en el camino.
  { mias: [[300, 700]], pelota: [300, 560], rivales: [[300, 300]] },
  { mias: [[200, 720], [400, 720]], pelota: [300, 520], rivales: [[245, 270], [355, 270]] },
  { mias: [[130, 760]], pelota: [95, 420], rivales: [[300, 230]] },
  // 8-11: conos fijos.
  { mias: [[300, 720]], pelota: [300, 560], conos: [[300, 330], [235, 300], [365, 300]] },
  { mias: [[150, 740], [450, 740]], pelota: [300, 600], conos: [[220, 260], [380, 260], [300, 400]], rivales: [[300, 190]] },
  { mias: [[300, 790]], pelota: [300, 690], rivales: [[225, 410], [375, 410], [300, 250]] },
  { mias: [[100, 620], [500, 620]], pelota: [300, 470], conos: [[300, 310]], rivales: [[200, 200], [400, 200]] },
  // 12-19: Kapi de arquero.
  { mias: [[300, 650]], pelota: [300, 500], kapi: K(300, 1.5) },
  { mias: [[200, 690], [400, 690]], pelota: [300, 530], conos: [[300, 340]], kapi: K(300, 2) },
  { mias: [[300, 760]], pelota: [450, 460], rivales: [[320, 300]], kapi: K(300, 2, 60, 30) },
  { mias: [[120, 710], [480, 710]], pelota: [300, 430], rivales: [[240, 260], [360, 260]], kapi: K(300, 2) },
  { mias: [[300, 790], [150, 610]], pelota: [150, 460], conos: [[210, 280], [300, 250], [390, 280]], kapi: K(300, 2.5) },
  { mias: [[460, 770]], pelota: [520, 320], rivales: [[410, 200]], kapi: K(300, 2, 70, 70) },
  { mias: [[200, 770], [400, 770], [300, 640]], pelota: [300, 490], rivales: [[250, 310], [350, 310], [300, 205]], kapi: K(300, 2) },
  { mias: [[100, 790], [500, 790]], pelota: [300, 330], conos: [[200, 430], [400, 430]], kapi: K(300, 2.5, 60, 120) },
  // 20: el jefe, penales contra Kapi (3 goles en 5 tiros).
  { mias: [[300, 300]], pelota: [300, 235], kapi: K(300, 2.5, 65), penales: { tiros: 5, goles: 3 } },

  /* ── Mundo 2: Invierno en el potrero ── */
  // 21-25: barro (frena).
  { mias: [[300, 700]], pelota: [300, 560], zonas: [barro(180, 290, 240, 130)] },
  { mias: [[200, 720], [400, 720]], pelota: [300, 520], zonas: [barro(150, 370, 300, 90)], rivales: [[300, 240]] },
  { mias: [[300, 770]], pelota: [210, 520], zonas: [barro(0, 260, 600, 80)] },
  { mias: [[300, 720]], pelota: [300, 560], zonas: [barro(60, 380, 200, 140), barro(340, 380, 200, 140)], kapi: K(300, 2) },
  { mias: [[160, 740], [440, 740]], pelota: [300, 560], zonas: [barro(200, 180, 200, 120)], conos: [[230, 400], [370, 400]], rivales: [[300, 330]] },
  // 26-30: hielo (resbala).
  { mias: [[300, 780]], pelota: [300, 650], zonas: [hielo(100, 220, 400, 380)] },
  { mias: [[150, 760], [450, 760]], pelota: [150, 520], zonas: [hielo(0, 300, 600, 300)], rivales: [[300, 260]] },
  { mias: [[300, 780]], pelota: [460, 600], zonas: [hielo(330, 150, 270, 600)], conos: [[300, 300]], kapi: K(300, 2) },
  { mias: [[200, 760], [400, 760]], pelota: [300, 600], zonas: [hielo(0, 420, 600, 160), barro(150, 200, 300, 90)], kapi: K(300, 2, 60, 60) },
  { mias: [[100, 700], [500, 700]], pelota: [300, 640], zonas: [hielo(200, 300, 200, 300)], rivales: [[230, 280], [370, 280]], conos: [[300, 180]] },
  // 31-39: arco chico.
  { mias: [[300, 680]], pelota: [300, 520], arcos: { arriba: 120 } },
  { mias: [[200, 720], [400, 720]], pelota: [300, 540], arcos: { arriba: 120 }, rivales: [[300, 300]] },
  { mias: [[300, 760]], pelota: [130, 460], arcos: { arriba: 130 }, conos: [[240, 260], [360, 260]], kapi: K(300, 1.5, 40) },
  { mias: [[300, 770]], pelota: [300, 620], arcos: { arriba: 130 }, zonas: [barro(150, 330, 300, 100)], kapi: K(300, 2, 40) },
  { mias: [[160, 770], [440, 770]], pelota: [300, 600], arcos: { arriba: 130 }, zonas: [hielo(0, 250, 600, 250)], rivales: [[250, 300], [350, 300]] },
  { mias: [[300, 790], [140, 640], [460, 640]], pelota: [300, 520], arcos: { arriba: 130 }, conos: [[200, 330], [400, 330], [300, 250]], kapi: K(300, 2, 40, 40) },
  { mias: [[470, 780]], pelota: [530, 420], arcos: { arriba: 130 }, rivales: [[430, 220]], zonas: [barro(0, 120, 250, 300)], kapi: K(300, 2, 40) },
  { mias: [[200, 780], [400, 780]], pelota: [300, 460], arcos: { arriba: 130 }, zonas: [hielo(100, 520, 400, 200)], rivales: [[240, 280], [360, 280], [300, 360]], kapi: K(300, 2, 40) },
  { mias: [[120, 790], [480, 790], [300, 700]], pelota: [300, 420], arcos: { arriba: 130 }, zonas: [barro(0, 200, 160, 300), barro(440, 200, 160, 300)], conos: [[230, 300], [370, 300]], kapi: K(300, 2.5, 40, 20) },
  // 40: el jefe, penales más difíciles (arco chico, Kapi rápido, 3 de 5).
  { mias: [[300, 300]], pelota: [300, 235], arcos: { arriba: 150 }, kapi: K(300, 3, 50), penales: { tiros: 5, goles: 3 } },
];

export const TOTAL_NIVELES_PICHANGA = NIVELES_PICHANGA.length;

const armados = new Map();
/** El nivel n (1…TOTAL), armado con su solución. null si no existe. */
export function nivelPichanga(n) {
  const dato = NIVELES_PICHANGA[n - 1];
  if (!dato) return null;
  if (!armados.has(n)) armados.set(n, armarNivel(n, dato, SOLUCIONES_PICHANGA[n]));
  return armados.get(n);
}

/* ── El reto del día ───────────────────────────────────── */
/*
 * Jugadas de dificultad media, con un poco de todo. Cada una sale también en
 * espejo (izquierda ↔ derecha), así que hay el doble de retos; el del día se
 * elige por la fecha (el mismo para todos). Su solución está en
 * pichangaSoluciones.mjs con la clave `r{número}` (el espejo, después de los
 * originales: r13 es el espejo de r1).
 */
const RETOS_BASE = [
  { mias: [[160, 760], [440, 760]], pelota: [230, 520], rivales: [[300, 300], [380, 360]], kapi: K(300, 2) },
  { mias: [[300, 780]], pelota: [120, 470], conos: [[250, 300], [350, 300], [300, 420]], kapi: K(300, 2, 60, 40) },
  { mias: [[200, 760], [420, 700]], pelota: [300, 560], zonas: [barro(130, 300, 340, 110)], rivales: [[260, 200]], kapi: K(300, 2) },
  { mias: [[300, 790], [120, 650]], pelota: [460, 520], zonas: [hielo(0, 330, 600, 260)], conos: [[300, 260]] },
  { mias: [[150, 780], [450, 780]], pelota: [300, 640], arcos: { arriba: 130 }, rivales: [[240, 360], [360, 360]], kapi: K(300, 1.5, 40) },
  { mias: [[480, 760]], pelota: [520, 520], rivales: [[420, 300], [300, 220]], conos: [[180, 300]], kapi: K(300, 2, 60, 90) },
  { mias: [[300, 800], [160, 700], [440, 700]], pelota: [300, 600], conos: [[220, 420], [380, 420], [300, 330]], kapi: K(300, 2.5) },
  { mias: [[220, 770]], pelota: [300, 500], zonas: [barro(0, 380, 250, 200), hielo(350, 150, 250, 300)], rivales: [[300, 280]] },
  { mias: [[100, 780], [500, 780]], pelota: [150, 420], arcos: { arriba: 140 }, conos: [[300, 300]], kapi: K(300, 2, 45, 30) },
  { mias: [[300, 760]], pelota: [300, 620], rivales: [[240, 450], [360, 450], [300, 330]], zonas: [hielo(100, 480, 400, 120)], kapi: K(300, 2) },
  { mias: [[140, 760], [460, 760]], pelota: [470, 400], zonas: [barro(330, 150, 270, 180)], rivales: [[300, 260]], kapi: K(300, 2, 60, 120) },
  { mias: [[300, 790], [200, 690]], pelota: [380, 560], arcos: { arriba: 130 }, conos: [[250, 260], [350, 260]], zonas: [barro(100, 380, 400, 80)], kapi: K(300, 2, 40, 20) },
];

/** Una jugada en espejo (lo de la izquierda pasa a la derecha). */
const espejo = (d) => ({
  ...d,
  mias: (d.mias || []).map(([x, y]) => [600 - x, y]),
  rivales: (d.rivales || []).map(([x, y]) => [600 - x, y]),
  conos: (d.conos || []).map(([x, y]) => [600 - x, y]),
  pelota: [600 - d.pelota[0], d.pelota[1]],
  zonas: (d.zonas || []).map((z) => ({ ...z, x: 600 - z.x - z.w })),
});

export const RETOS_PICHANGA = [...RETOS_BASE, ...RETOS_BASE.map(espejo)];

/** Un número para cada fecha 'AAAA-MM-DD' (el mismo siempre). */
function semillaFecha(fecha) {
  let h = 2166136261;
  for (const ch of String(fecha)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Qué reto (1…RETOS_PICHANGA.length) toca en una fecha 'AAAA-MM-DD'. */
export const indiceRetoDe = (fecha) => (semillaFecha(fecha) % RETOS_PICHANGA.length) + 1;

/**
 * El reto de una fecha, armado como un nivel (numero null, reto: la fecha).
 * Toques: par + 2. null si la fecha no sirve.
 */
export function retoPichanga(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const k = indiceRetoDe(fecha);
  return { ...armarNivel(0, RETOS_PICHANGA[k - 1], SOLUCIONES_PICHANGA[`r${k}`]), numero: null, mundo: null, jefe: false, reto: fecha, indiceReto: k };
}

/** El lunes de la semana de una fecha 'AAAA-MM-DD' (para el ranking semanal). */
export function semanaDe(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d));
  const atras = (dia.getUTCDay() + 6) % 7;
  return new Date(dia.getTime() - atras * 86400000).toISOString().slice(0, 10);
}

/** El mes de una fecha ('AAAA-MM'): los goleadores del mes. */
export const mesDe = (fecha) => fecha.slice(0, 7);
