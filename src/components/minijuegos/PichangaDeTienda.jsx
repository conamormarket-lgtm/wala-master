import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useMonedasDelJuego from './useMonedasDelJuego';
import { trackMinigame } from '../../services/analytics/tracker';
import { PaginaPichanga } from '../../componentes/kit/paginas/Pichanga';

/*
 * La Pichanga de Kapi (/pichanga), fase 1: se juega sin servidor y sin
 * monedas. Todo el progreso (PROGRESO_PICHANGA: niveles, estrellas, racha,
 * ayudas guardadas, partidos y vestuario) se guarda en este aparato
 * (wala_pichanga_progreso). Se juega con o sin cuenta.
 * La analítica de inicio y fin (trackMinigame): el fin trae el modo, el nivel,
 * los toques, las estrellas y los tiros (lo que el servidor comprobará en la
 * fase 2, cuando dé monedas y arme el ranking).
 */

const CLAVE_AYUDA = 'wala_pichanga_ayuda_vista';
const CLAVE_PROGRESO = 'wala_pichanga_progreso';
const JUEGO = { gameId: 'pichanga', gameName: 'La Pichanga de Kapi' };

const leer = (clave, porDefecto) => {
  try { return localStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; }
};
const guardar = (clave, valor) => {
  try { localStorage.setItem(clave, valor); } catch { /* modo privado */ }
};
const progresoGuardado = () => {
  try { return JSON.parse(leer(CLAVE_PROGRESO, '{}')) || {}; } catch { return {}; }
};

export default function PichangaDeTienda() {
  const { user, loading } = useAuth();
  const monedas = useMonedasDelJuego();
  const [progreso] = useState(progresoGuardado);
  const [ayudaVista] = useState(() => leer(CLAVE_AYUDA, '0') === '1');
  const quien = () => ({ uid: user?.uid, email: user?.email, displayName: user?.displayName });

  useEffect(() => {
    if (loading) return;
    trackMinigame('start', JUEGO, quien()).catch(() => {});
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PaginaPichanga
      monedas={monedas}
      progreso={progreso}
      onProgreso={(p) => guardar(CLAVE_PROGRESO, JSON.stringify({ ...p, actualizado: Date.now() }))}
      onCompletar={(info) => {
        // Los tiros van como texto: la analítica guarda datos planos.
        const { tiros, ...resto } = info;
        trackMinigame('complete', { ...JUEGO, ...resto, ...(tiros ? { tiros: JSON.stringify(tiros) } : {}) }, quien()).catch(() => {});
      }}
      ayudaVista={ayudaVista}
      onAyudaVista={() => guardar(CLAVE_AYUDA, '1')}
    />
  );
}
