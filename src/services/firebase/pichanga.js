import { getFunctions, httpsCallable } from 'firebase/functions';

/*
 * La Pichanga de Kapi: todo pasa por funciones del servidor (el celular no
 * lee ni escribe las colecciones del juego). Ver functions/index.js.
 */

export const PREMIO_PICHANGA = 2; // monedas por día (referencia de UI)

const llamar = async (nombre, datos) => {
  const res = await httpsCallable(getFunctions(), nombre)(datos);
  return res.data || {};
};

/**
 * Una partida ganada, para que el servidor la compruebe (repite los tiros):
 * paga el premio del día si falta, marca la misión y anota el reto y los
 * rankings.
 *  - partida: { modo: 'nivel' | 'reto', nivel | fecha, tiros: [[chapa, dx, dy]…], extras }
 * → { reward, ya, toques, estrellas, mejor, record, golesMes, cupon } (cupon:
 * el del reto patrocinado, si tocó). Si la partida
 * no vale o falla la red, lanza.
 */
export const registrarPartidaPichanga = (partida) => llamar('registrarPartidaPichangaSecure', partida);

/**
 * Un ranking: 'reto' → { hoy, semanal, yo }; 'niveles' → { top, yo };
 * 'goleadores' → { top, yo, mes }.
 */
export const getRankingPichanga = (tabla) => llamar('getRankingPichangaSecure', { tabla });

/** El progreso guardado en la cuenta (o null). */
export const leerProgresoPichanga = async () => (await llamar('progresoPichangaSecure', {})).progreso || null;

/** Guarda el progreso (se une con lo de la cuenta) → el progreso unido. */
export const guardarProgresoPichanga = async (progreso) => (await llamar('progresoPichangaSecure', { progreso })).progreso || null;

/**
 * El patrocinio del reto de hoy: { marcaId, marcaNombre, texto, quedan, ganado }
 * o null si no hay (o está apagado).
 */
export const leerPatrocinioPichanga = async () => (await llamar('patrocinioPichangaSecure', {})).patrocinio || null;

/**
 * /admin/pichanga (solo admin): 'metricas' { dias } · 'leerPremios' ·
 * 'guardarPremios' { activo, puestos } · 'premiarMes' { mes: 'AAAA-MM' } ·
 * 'listarPatrocinios' { desde } · 'guardarPatrocinio' { fecha, patrocinio } ·
 * 'borrarPatrocinio' { fecha }.
 */
export const adminPichanga = (accion, datos = {}) => llamar('adminPichangaSecure', { accion, ...datos });
