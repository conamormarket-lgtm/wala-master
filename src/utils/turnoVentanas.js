import { useSyncExternalStore } from 'react';

/*
 * Una sola ventana grande a la vez (2026-11-11). Al crear una cuenta se abrían
 * juntas la semana de bienvenida, Walito con su recorrido y el popup de
 * campaña (la encuesta), una encima de otra. Ahora cada una pide su turno, en
 * este orden:
 *
 *   1. bienvenida — el aviso de la semana de bienvenida (BienvenidaDeTienda)
 *   2. walito     — Walito se abre solo la primera vez (marco/Kapi.jsx)
 *   3. campana    — el popup de campaña (AnuncioDeCampana)
 *
 * Las que se abren SOLAS esperan a que el turno esté libre y, al soltarse uno,
 * pasan PAUSA_MS antes de que se abra la siguiente: no salen en cadena. Lo que
 * abre la persona (tocar a Walito, la píldora) no pide turno.
 */

const PAUSA_MS = 15 * 1000;

let actual = null;
let libreDesde = 0;
const oyentes = new Set();
const avisar = () => oyentes.forEach((fn) => fn());

/** ¿Puede abrirse sola una ventana ahora? */
const libre = () => !actual && Date.now() - libreDesde >= PAUSA_MS;

/** Toma el turno si está libre (o ya es suyo). Devuelve si lo tiene. */
export function tomarTurno(id) {
  if (actual === id) return true;
  if (!libre()) return false;
  actual = id;
  avisar();
  return true;
}

/** Suelta el turno (solo si es suyo); la siguiente espera la pausa. */
export function soltarTurno(id) {
  if (actual !== id) return;
  actual = null;
  libreDesde = Date.now();
  avisar();
  setTimeout(avisar, PAUSA_MS + 50);
}

const escuchar = (fn) => {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
};

// Lo que ven los componentes: quién tiene el turno o, si nadie, si ya pasó la pausa.
const foto = () => (actual || (libre() ? null : 'pausa'));

/** null si una ventana puede abrirse sola ahora; si no, quién la ocupa ('pausa' entre una y otra). */
export function useTurnoVentanas() {
  return useSyncExternalStore(escuchar, foto, () => null);
}
