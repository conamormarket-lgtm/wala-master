// =========================================================================
// La Pichanga de Kapi — COPIA DE SERVIDOR
// -------------------------------------------------------------------------
// GENERADO por scripts/generar-motor-pichanga.js desde
// src/componentes/kit/piezas/pichangaProgreso.mjs. No editar a mano.
// =========================================================================

/*
 * El progreso del jugador en La Pichanga de Kapi y su vestuario: qué se
 * guarda, cómo se une lo del aparato con lo de la cuenta (para la fase 2) y
 * qué se desbloquea jugando. Nada se compra: todo se elige. Puro, con pruebas
 * (pichangaProgreso.test.mjs).
 */

export const PROGRESO_PICHANGA = {
  nivel: 1, // el nivel más alto abierto
  estrellas: {}, // { [nivel]: 1 a 3 }, la mejor
  racha: 0, // niveles seguidos ganados sin reiniciar ni abandonar
  guardadas: { vista: 0, repetir: 0, toque: 0 }, // ayudas de los cofres
  vistos: [], // obstáculos ya explicados
  reto: null, // el día del último reto hecho ('AAAA-MM-DD')
  goles: 0, // goles hechos en los niveles (y en los partidos ganados)
  partidos: { jugados: 0, ganados: 0 },
  dificultad: 'normal', // la del partido contra Kapi
  equipo: 'huellitas',
  pelota: 'clasica',
  estadio: 'barrio',
  sonido: true,
  vibracion: true,
  actualizado: 0, // cuándo cambió (ms): decide la racha y las ayudas al unir
};

const entero = (v, min = 0) => Math.max(min, Math.floor(Number(v)) || 0);
const DIFICULTADES = ['facil', 'normal', 'dificil'];

/* ── Las habilidades de las camisetas ────────────────── */
/*
 * Cada camiseta trae una habilidad (las que se abren jugando, dos o tres).
 * Solo valen en el partido contra Michi, y quedan fijas al empezarlo: los
 * niveles y el reto son iguales para todos (los rankings y lo que comprueba
 * el servidor no cambian). `efecto` son las ventajas que lee el motor
 * (canchaPartido, simularPartido, jugadaDeKapi).
 */
export const HABILIDADES_PICHANGA = {
  toque: { nombre: 'Toque de más', texto: 'Encadenas hasta 4 pases seguidos (los demás, 3).', efecto: { pases: 4 } },
  ojo: { nombre: 'Ojo de Kapi', texto: 'Al apuntar ves por dónde irá la pelota.', efecto: { ruta: true } },
  canon: { nombre: 'Cañonazo', texto: 'Tus tiros salen un 12 % más fuertes.', efecto: { potencia: 1.12 } },
  muralla: { nombre: 'Muralla', texto: 'Tu arquero es más grande y tapa más arco.', efecto: { portero: 48 } },
  candado: { nombre: 'Candado', texto: 'Tu arco es más chico: le cuesta más a Michi.', efecto: { arco: 176 } },
  despiste: { nombre: 'Despiste', texto: 'Michi se distrae y apunta peor.', efecto: { ruidoRival: 0.06 } },
  frio: { nombre: 'Viento frío', texto: 'Los tiros de Michi salen un 10 % más suaves.', efecto: { potenciaRival: 0.9 } },
};

/** Las ventajas que da una camiseta (para partidoNuevo). */
export function ventajasDe(equipo) {
  const v = {};
  for (const id of equipo?.habilidades || []) Object.assign(v, HABILIDADES_PICHANGA[id]?.efecto || {});
  return v;
}

/* ── El vestuario ─────────────────────────────────────── */
/*
 * Cada cosa con su forma de desbloquearse:
 *  - { tipo: 'inicio' } desde el principio
 *  - { tipo: 'estrellas', n } al juntar n estrellas
 *  - { tipo: 'jefe', mundo } al vencer al jefe de ese mundo
 *  - { tipo: 'partidos', n } al ganarle n partidos a Kapi
 *  - { tipo: 'goles', n } al hacer n goles
 * Las chapas (tapitas con su borde plateado): colores (fondo, detalle) y
 * dibujo ('huella' | 'liso' | 'franjas' | 'mitad' | 'banda' | 'estrella' | 'aro').
 */
export const EQUIPOS_PICHANGA = [
  { id: 'huellitas', nombre: 'Las Huellitas', colores: ['#1d4ed8', '#ffffff'], dibujo: 'huella', habilidades: ['toque'], desbloqueo: { tipo: 'inicio' } },
  { id: 'wala', nombre: 'Walá', colores: ['#7c3aed', '#ffffff'], dibujo: 'liso', habilidades: ['ojo'], desbloqueo: { tipo: 'inicio' } },
  { id: 'celeste', nombre: 'Los Celestes', colores: ['#38bdf8', '#ffffff'], dibujo: 'franjas', habilidades: ['canon'], desbloqueo: { tipo: 'inicio' } },
  { id: 'barrio', nombre: 'Los Naranjas', colores: ['#f97316', '#ffffff'], dibujo: 'banda', habilidades: ['muralla'], desbloqueo: { tipo: 'inicio' } },
  { id: 'verde', nombre: 'Verdolagas', colores: ['#16a34a', '#facc15'], dibujo: 'mitad', habilidades: ['candado'], desbloqueo: { tipo: 'inicio' } },
  { id: 'rosado', nombre: 'Las Rosadas', colores: ['#ec4899', '#fdf2f8'], dibujo: 'aro', habilidades: ['despiste', 'toque'], desbloqueo: { tipo: 'goles', n: 15 } },
  { id: 'dorado', nombre: 'Walá Dorado', colores: ['#f59e0b', '#7c3aed'], dibujo: 'estrella', habilidades: ['canon', 'ojo'], desbloqueo: { tipo: 'estrellas', n: 30 } },
  { id: 'invierno', nombre: 'Copos FC', colores: ['#e0f2fe', '#0ea5e9'], dibujo: 'estrella', habilidades: ['frio', 'candado'], desbloqueo: { tipo: 'jefe', mundo: 1 } },
  { id: 'noche', nombre: 'Estrellas de la noche', colores: ['#1e1b4b', '#fde047'], dibujo: 'estrella', habilidades: ['ojo', 'muralla'], desbloqueo: { tipo: 'estrellas', n: 60 } },
  { id: 'goleador', nombre: 'Los Goleadores', colores: ['#111827', '#f472b6'], dibujo: 'franjas', habilidades: ['canon', 'toque'], desbloqueo: { tipo: 'partidos', n: 3 } },
  { id: 'campeon', nombre: 'Campeones del potrero', colores: ['#065f46', '#fbbf24'], dibujo: 'aro', habilidades: ['candado', 'muralla', 'despiste'], desbloqueo: { tipo: 'jefe', mundo: 2 } },
  { id: 'leyenda', nombre: 'Leyendas', colores: ['#ffffff', '#f59e0b'], dibujo: 'estrella', habilidades: ['canon', 'muralla', 'ojo'], desbloqueo: { tipo: 'estrellas', n: 110 } },
];

/** Las pelotas: color de fondo y de los parches. */
export const PELOTAS_PICHANGA = [
  { id: 'clasica', nombre: 'Clásica', colores: ['#ffffff', '#1f2937'], desbloqueo: { tipo: 'inicio' } },
  { id: 'wala', nombre: 'Violeta', colores: ['#ede9fe', '#7c3aed'], desbloqueo: { tipo: 'inicio' } },
  { id: 'naranja', nombre: 'Naranja', colores: ['#fed7aa', '#ea580c'], desbloqueo: { tipo: 'goles', n: 30 } },
  { id: 'dorada', nombre: 'Dorada', colores: ['#fde68a', '#b45309'], desbloqueo: { tipo: 'estrellas', n: 45 } },
  { id: 'fuego', nombre: 'De fuego', colores: ['#fecaca', '#dc2626'], desbloqueo: { tipo: 'partidos', n: 5 } },
  { id: 'hielo', nombre: 'De hielo', colores: ['#e0f2fe', '#0284c7'], desbloqueo: { tipo: 'jefe', mundo: 2 } },
];

/** Las canchas del partido contra Kapi: pasto (dos franjas) y líneas. */
export const ESTADIOS_PICHANGA = [
  { id: 'barrio', nombre: 'La canchita del barrio', pasto: ['#4caf50', '#43a047'], linea: 'rgba(255,255,255,0.75)', desbloqueo: { tipo: 'inicio' } },
  { id: 'invierno', nombre: 'El potrero en invierno', pasto: ['#7cb38a', '#6fa77e'], linea: 'rgba(255,255,255,0.85)', desbloqueo: { tipo: 'jefe', mundo: 1 } },
  { id: 'noche', nombre: 'Estadio de noche', pasto: ['#1f6f43', '#1b6440'], linea: 'rgba(255,255,255,0.9)', desbloqueo: { tipo: 'partidos', n: 1 } },
  { id: 'violeta', nombre: 'Cancha Walá', pasto: ['#6d28d9', '#5b21b6'], linea: 'rgba(255,255,255,0.8)', desbloqueo: { tipo: 'estrellas', n: 75 } },
];

const NIVELES_POR_MUNDO = 20;

/** Cuántas estrellas lleva en total. */
export const estrellasTotales = (p) => Object.values(p.estrellas || {}).reduce((t, e) => t + e, 0);

/** ¿Ya lo desbloqueó? */
export function desbloqueado(item, p) {
  const d = item?.desbloqueo || { tipo: 'inicio' };
  switch (d.tipo) {
    case 'inicio': return true;
    case 'estrellas': return estrellasTotales(p) >= d.n;
    case 'jefe': return Boolean(p.estrellas?.[d.mundo * NIVELES_POR_MUNDO]);
    case 'partidos': return (p.partidos?.ganados || 0) >= d.n;
    case 'goles': return (p.goles || 0) >= d.n;
    default: return false;
  }
}

/** Cómo se desbloquea, en texto ("Junta 30 estrellas"). */
export function textoDesbloqueo(item) {
  const d = item?.desbloqueo || { tipo: 'inicio' };
  switch (d.tipo) {
    case 'estrellas': return `Junta ${d.n} estrellas`;
    case 'jefe': return `Vence al jefe del mundo ${d.mundo}`;
    case 'partidos': return d.n === 1 ? 'Gánale un partido a Michi' : `Gánale ${d.n} partidos a Michi`;
    case 'goles': return `Haz ${d.n} goles`;
    default: return 'Desde el inicio';
  }
}

/** Lo que se acaba de desbloquear al pasar de un progreso a otro: [{ clase, item }]. */
export function nuevosDesbloqueos(antes, despues) {
  const lista = [];
  for (const [clase, items] of [['equipo', EQUIPOS_PICHANGA], ['pelota', PELOTAS_PICHANGA], ['estadio', ESTADIOS_PICHANGA]]) {
    for (const item of items) {
      if (!desbloqueado(item, antes) && desbloqueado(item, despues)) lista.push({ clase, item });
    }
  }
  return lista;
}

const elegido = (lista, id, p) => {
  const item = lista.find((i) => i.id === id);
  return item && desbloqueado(item, p) ? item.id : lista[0].id;
};

/** Completa un progreso guardado (o viejo, o roto) con lo que le falte. */
export function progresoPichanga(p = {}) {
  const base = p && typeof p === 'object' ? p : {};
  const estrellas = {};
  for (const [n, e] of Object.entries(base.estrellas || {})) {
    if (/^[1-9]\d*$/.test(n) && e >= 1) estrellas[n] = Math.min(3, entero(e));
  }
  const limpio = {
    ...PROGRESO_PICHANGA,
    ...base,
    nivel: Math.max(1, entero(base.nivel, 1)),
    estrellas,
    racha: entero(base.racha),
    guardadas: {
      vista: entero(base.guardadas?.vista),
      repetir: entero(base.guardadas?.repetir),
      toque: entero(base.guardadas?.toque),
    },
    vistos: Array.isArray(base.vistos) ? base.vistos.filter((v) => typeof v === 'string') : [],
    reto: typeof base.reto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(base.reto) ? base.reto : null,
    goles: entero(base.goles),
    partidos: { jugados: entero(base.partidos?.jugados), ganados: entero(base.partidos?.ganados) },
    dificultad: DIFICULTADES.includes(base.dificultad) ? base.dificultad : 'normal',
    sonido: base.sonido !== false,
    vibracion: base.vibracion !== false,
    actualizado: entero(base.actualizado),
  };
  // Lo elegido tiene que estar desbloqueado (si no, el primero).
  limpio.equipo = elegido(EQUIPOS_PICHANGA, base.equipo, limpio);
  limpio.pelota = elegido(PELOTAS_PICHANGA, base.pelota, limpio);
  limpio.estadio = elegido(ESTADIOS_PICHANGA, base.estadio, limpio);
  return limpio;
}

/**
 * Une el progreso del aparato con el de la cuenta: lo ganado no se pierde
 * (nivel, estrellas, goles, partidos, vistos); la racha, las ayudas guardadas,
 * el vestuario y la dificultad, del que cambió último; el sonido y la
 * vibración son de este aparato.
 */
export function unirProgresos(aparato, cuenta) {
  const a = progresoPichanga(aparato);
  const c = progresoPichanga(cuenta);
  const estrellas = { ...c.estrellas };
  for (const [n, e] of Object.entries(a.estrellas)) estrellas[n] = Math.max(e, estrellas[n] || 0);
  const reciente = c.actualizado > a.actualizado ? c : a;
  return progresoPichanga({
    ...a,
    nivel: Math.max(a.nivel, c.nivel),
    estrellas,
    racha: reciente.racha,
    guardadas: reciente.guardadas,
    vistos: [...new Set([...a.vistos, ...c.vistos])],
    reto: [a.reto, c.reto].filter(Boolean).sort().pop() || null,
    goles: Math.max(a.goles, c.goles),
    partidos: {
      jugados: Math.max(a.partidos.jugados, c.partidos.jugados),
      ganados: Math.max(a.partidos.ganados, c.partidos.ganados),
    },
    dificultad: reciente.dificultad,
    equipo: reciente.equipo,
    pelota: reciente.pelota,
    estadio: reciente.estadio,
    actualizado: Math.max(a.actualizado, c.actualizado),
  });
}
