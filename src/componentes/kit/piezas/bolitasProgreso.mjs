/*
 * El progreso del jugador en Las Bolitas de Kapi: qué se guarda y cómo se
 * une lo del aparato con lo de la cuenta. Puro, con pruebas
 * (bolitasProgreso.test.mjs).
 */

export const PROGRESO_BOLITAS = {
  nivel: 1, // el nivel más alto abierto
  estrellas: {}, // { [nivel]: 1 a 3 }, la mejor
  racha: 0, // niveles seguidos ganados sin reiniciar ni abandonar
  guardadas: { pista: 0, tubo: 0, deshacer: 0 }, // ayudas de los cofres
  vistos: [], // obstáculos ya explicados
  reto: null, // el día del último reto hecho
  cuponReto: null, // el día del último cupón ganado en un reto patrocinado
  sonido: true,
  vibracion: true,
  actualizado: 0, // cuándo cambió (ms): decide la racha y las ayudas al unir
};

const entero = (v, min = 0) => Math.max(min, Math.floor(Number(v)) || 0);

/** Completa un progreso guardado (o viejo, o roto) con lo que le falte. */
export function progresoBolitas(p = {}) {
  const base = p && typeof p === 'object' ? p : {};
  const estrellas = {};
  for (const [n, e] of Object.entries(base.estrellas || {})) {
    if (/^[1-9]\d*$/.test(n) && e >= 1) estrellas[n] = Math.min(3, entero(e));
  }
  return {
    ...PROGRESO_BOLITAS,
    ...base,
    nivel: Math.max(1, entero(base.nivel, 1)),
    estrellas,
    racha: entero(base.racha),
    guardadas: {
      pista: entero(base.guardadas?.pista),
      tubo: entero(base.guardadas?.tubo),
      deshacer: entero(base.guardadas?.deshacer),
    },
    vistos: Array.isArray(base.vistos) ? base.vistos.filter((v) => typeof v === 'string') : [],
    reto: typeof base.reto === 'string' ? base.reto : null,
    cuponReto: typeof base.cuponReto === 'string' ? base.cuponReto : null,
    sonido: base.sonido !== false,
    vibracion: base.vibracion !== false,
    actualizado: entero(base.actualizado),
  };
}

/**
 * Une el progreso del aparato con el de la cuenta (otro celular, la web):
 * lo que se gana no se pierde (el nivel más alto, la mejor estrella de cada
 * nivel, los obstáculos vistos, el último reto); la racha y las ayudas
 * guardadas vienen del que cambió último (no se suman: serían ayudas
 * duplicadas); el sonido y la vibración son de este aparato.
 */
export function unirProgresos(aparato, cuenta) {
  const a = progresoBolitas(aparato);
  const c = progresoBolitas(cuenta);
  const estrellas = { ...c.estrellas };
  for (const [n, e] of Object.entries(a.estrellas)) estrellas[n] = Math.max(e, estrellas[n] || 0);
  const reciente = c.actualizado > a.actualizado ? c : a;
  return {
    ...a,
    nivel: Math.max(a.nivel, c.nivel),
    estrellas,
    racha: reciente.racha,
    guardadas: reciente.guardadas,
    vistos: [...new Set([...a.vistos, ...c.vistos])],
    reto: [a.reto, c.reto].filter(Boolean).sort().pop() || null,
    cuponReto: [a.cuponReto, c.cuponReto].filter(Boolean).sort().pop() || null,
    actualizado: Math.max(a.actualizado, c.actualizado),
  };
}
