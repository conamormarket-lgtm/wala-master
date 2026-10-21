import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { claimBallSortReward, REWARD_AMOUNT } from '../../services/firebase/ballSort';
import { trackMinigame } from '../../services/analytics/tracker';
import { limaTodayStr } from '../../utils/fechaLima';
import { diseno } from '../../utils/modoDiseno';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaBolitas } from '../../componentes/kit/paginas/Bolitas';
import entregarMonedas from './entregarMonedas';

/*
 * Las Bolitas de Kapi (/ball-sort) con el kit (paso 6, JUEGOS.md). La misma
 * lógica que la página de antes:
 *  - el premio (+2) lo da el servidor (claimBallSortRewardSecure) una vez al
 *    día de Lima; "ya cobró hoy" sale del perfil (lastBallSortReward) o del
 *    modo diseño (?bolitas=completado, solo en local)
 *  - al cobrar, las monedas vuelan al contador y se refresca el perfil; la
 *    hoja no se cierra hasta que terminan de llegar
 *  - la analítica de inicio y fin (trackMinigame; el fin con el modo, el
 *    nivel o la fecha, los movimientos y las estrellas)
 *  - la ayuda se abre sola la primera vez (wala_bolitas_ayuda_vista)
 * Diferente: se juega sin cuenta (el premio invita a entrar) y la sesión
 * anónima no cuenta como cuenta. Si el servidor dice que ya cobró hoy, se
 * dice eso (antes salía como error).
 * Niveles, mundos, estrellas, racha y reto del día (2026-10-21): todo el
 * progreso (PROGRESO_BOLITAS: nivel, estrellas, racha, ayudas guardadas,
 * obstáculos vistos, reto hecho, sonido y vibración) se guarda en este
 * aparato, en wala_bolitas_progreso. El premio sigue igual: +2 una vez al
 * día, al pasar un nivel o el reto.
 * Lo de antes: pages/Minijuegos/BallSortViejo.jsx (interruptor juegosViejo).
 */

const CLAVE_AYUDA = 'wala_bolitas_ayuda_vista';
const CLAVE_PROGRESO = 'wala_bolitas_progreso';
const JUEGO = { gameId: 'ball-sort', gameName: 'Las Bolitas de Kapi' };

const ayudaYaVista = () => {
  try { return localStorage.getItem(CLAVE_AYUDA) === '1'; } catch { return true; }
};
const progresoGuardado = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE_PROGRESO)) || {}; } catch { return {}; }
};
const guardar = (clave, valor) => {
  try { localStorage.setItem(clave, valor); } catch { /* modo privado */ }
};

export default function BolitasDeTienda() {
  const { user, userProfile, loading, reloadProfile } = useAuth();
  const sesion = tieneCuenta(user);
  const forzar = diseno('bolitas');
  const yaHoy = forzar ? forzar === 'completado' : userProfile?.lastBallSortReward === limaTodayStr();
  const [ayudaVista] = useState(ayudaYaVista);
  const [progreso] = useState(progresoGuardado);
  const hoy = limaTodayStr();
  const quien = () => ({ uid: user?.uid, email: user?.email, displayName: user?.displayName });

  useEffect(() => {
    if (loading) return;
    trackMinigame('start', JUEGO, quien()).catch(() => {});
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const ganar = async () => {
    const r = await claimBallSortReward();
    if (!r.success) {
      if (r.code === 'functions/already-exists') {
        reloadProfile?.();
        return { ya: true };
      }
      throw new Error(r.error);
    }
    const monto = Number(r.reward) || REWARD_AMOUNT;
    // Refrescar el perfil: el saldo de la cabecera y "ya cobró hoy" en la Zona Arcade.
    await Promise.all([entregarMonedas(monto), reloadProfile?.()]);
    return { monto };
  };

  return (
    <PaginaBolitas
      estado={loading ? 'cargando' : undefined}
      sesion={sesion}
      yaHoy={yaHoy}
      monto={REWARD_AMOUNT}
      onGanar={ganar}
      onCompletar={(info) => { trackMinigame('complete', { ...JUEGO, ...info }, quien()).catch(() => {}); }}
      hoy={hoy}
      progreso={progreso}
      onProgreso={(p) => guardar(CLAVE_PROGRESO, JSON.stringify(p))}
      ayudaVista={ayudaVista}
      onAyudaVista={() => guardar(CLAVE_AYUDA, '1')}
      urlLogin="/login?redirect=%2Fball-sort"
    />
  );
}
