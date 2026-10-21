import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  claimBallSortReward, registrarPartidaBolitas, getRankingBolitas, leerProgresoBolitas, guardarProgresoBolitas, REWARD_AMOUNT,
} from '../../services/firebase/ballSort';
import { programarAvisoReto } from '../../services/bolitasNotifications';
import { trackMinigame } from '../../services/analytics/tracker';
import { limaTodayStr } from '../../utils/fechaLima';
import { diseno } from '../../utils/modoDiseno';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaBolitas, unirProgresos } from '../../componentes/kit/paginas/Bolitas';
import entregarMonedas from './entregarMonedas';

/*
 * Las Bolitas de Kapi (/ball-sort) con el kit (paso 6, JUEGOS.md). La misma
 * lógica que la página de antes:
 *  - el premio (+2) lo da el servidor una vez al día de Lima; "ya cobró hoy"
 *    sale del perfil (lastBallSortReward) o del modo diseño
 *    (?bolitas=completado, solo en local)
 *  - al cobrar, las monedas vuelan al contador y se refresca el perfil; la
 *    hoja no se cierra hasta que terminan de llegar
 *  - la analítica de inicio y fin (trackMinigame; el fin con el modo, el
 *    nivel o la fecha, los movimientos y las estrellas)
 *  - la ayuda se abre sola la primera vez (wala_bolitas_ayuda_vista)
 * Diferente: se juega sin cuenta (el premio invita a entrar) y la sesión
 * anónima no cuenta como cuenta. Si el servidor dice que ya cobró hoy, se
 * dice eso (antes salía como error).
 * Niveles, mundos, estrellas, racha y reto del día (2026-10-21): todo el
 * progreso (PROGRESO_BOLITAS) se guarda en este aparato
 * (wala_bolitas_progreso) y, con sesión, también en la cuenta
 * (bolitasProgreso/{uid}): al entrar se unen (unirProgresos), así se sigue
 * en otro celular o en la web.
 * Fase 2: cada victoria con sesión va al servidor
 * (registrarPartidaBolitasSecure), que comprueba la partida, paga el premio
 * del día si falta, marca la misión y anota el reto en el ranking
 * (getRankingBolitasSecure). Si esa función todavía no existe en el servidor
 * (la web se publicó antes que las funciones), se cobra con la de antes
 * (claimBallSortRewardSecure). En la app, un aviso local recuerda el reto.
 * Lo de antes: pages/Minijuegos/BallSortViejo.jsx (interruptor juegosViejo).
 */

const CLAVE_AYUDA = 'wala_bolitas_ayuda_vista';
const CLAVE_PROGRESO = 'wala_bolitas_progreso';
const JUEGO = { gameId: 'ball-sort', gameName: 'Las Bolitas de Kapi' };
const ESPERA_NUBE_MS = 3000; // si la cuenta tarda más, se juega con lo del aparato
const GUARDAR_NUBE_MS = 1500; // se junta lo que cambia seguido en una sola escritura

const ayudaYaVista = () => {
  try { return localStorage.getItem(CLAVE_AYUDA) === '1'; } catch { return true; }
};
const progresoGuardado = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE_PROGRESO)) || {}; } catch { return {}; }
};
const guardar = (clave, valor) => {
  try { localStorage.setItem(clave, valor); } catch { /* modo privado */ }
};
// La función nueva todavía no está en el servidor: se cobra con la de antes.
const faltaFuncion = (e) => e?.code === 'functions/not-found' || e?.code === 'functions/unimplemented';

export default function BolitasDeTienda() {
  const { user, userProfile, loading, reloadProfile } = useAuth();
  const sesion = tieneCuenta(user);
  const uid = sesion ? user.uid : null;
  const forzar = diseno('bolitas');
  const hoy = limaTodayStr();
  const yaHoy = forzar ? forzar === 'completado' : userProfile?.lastBallSortReward === hoy;
  const [ayudaVista] = useState(ayudaYaVista);
  // null mientras se trae lo de la cuenta; después, lo que se juega.
  const [progreso, setProgreso] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [cargandoRanking, setCargandoRanking] = useState(false);
  const pendiente = useRef(null);
  const quien = () => ({ uid: user?.uid, email: user?.email, displayName: user?.displayName });

  useEffect(() => {
    if (loading) return;
    trackMinigame('start', JUEGO, quien()).catch(() => {});
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // El progreso: el del aparato, unido con el de la cuenta si hay sesión.
  useEffect(() => {
    if (loading) return undefined;
    let vigente = true;
    const local = progresoGuardado();
    if (!uid) {
      setProgreso(local);
      return undefined;
    }
    setProgreso(null);
    const tarde = new Promise((r) => { setTimeout(() => r(null), ESPERA_NUBE_MS); });
    Promise.race([leerProgresoBolitas(uid).catch(() => null), tarde]).then((nube) => {
      if (!vigente) return;
      const unido = unirProgresos(local, nube);
      setProgreso(unido);
      guardar(CLAVE_PROGRESO, JSON.stringify(unido));
      guardarProgresoBolitas(uid, unido).catch(() => {});
    });
    return () => { vigente = false; };
  }, [loading, uid]);

  // Lo que quedó sin subir a la cuenta se sube al salir.
  useEffect(() => () => {
    if (pendiente.current) {
      clearTimeout(pendiente.current.id);
      guardarProgresoBolitas(pendiente.current.uid, pendiente.current.progreso).catch(() => {});
    }
  }, []);

  // El aviso local del reto (solo en la app y con permiso).
  useEffect(() => {
    if (progreso) programarAvisoReto({ retoHecho: progreso.reto === hoy });
  }, [Boolean(progreso)]); // eslint-disable-line react-hooks/exhaustive-deps

  const alCambiarProgreso = (p) => {
    const conHora = { ...p, actualizado: Date.now() };
    guardar(CLAVE_PROGRESO, JSON.stringify(conHora));
    if (p.reto === hoy && progreso?.reto !== hoy) programarAvisoReto({ retoHecho: true });
    if (!uid) return;
    if (pendiente.current) clearTimeout(pendiente.current.id);
    const id = setTimeout(() => {
      pendiente.current = null;
      guardarProgresoBolitas(uid, conHora).catch(() => {});
    }, GUARDAR_NUBE_MS);
    pendiente.current = { id, uid, progreso: conHora };
  };

  const pedirRanking = async () => {
    setCargandoRanking(true);
    try {
      setRanking(await getRankingBolitas());
    } catch {
      /* sin ranking: la página dice que no hay datos */
    } finally {
      setCargandoRanking(false);
    }
  };

  const registrar = async (partida) => {
    const r = await registrarPartidaBolitas(partida);
    if (partida.modo === 'reto') pedirRanking();
    return r;
  };

  // La partida comprobada paga el premio si hoy no se cobró.
  const ganar = async ({ partida }) => {
    let reward;
    try {
      reward = (await registrar(partida)).reward;
    } catch (e) {
      if (!faltaFuncion(e)) throw e;
      const viejo = await claimBallSortReward();
      if (!viejo.success) {
        if (viejo.code === 'functions/already-exists') { reloadProfile?.(); return { ya: true }; }
        throw new Error(viejo.error);
      }
      reward = viejo.reward;
    }
    if (!reward) {
      reloadProfile?.();
      return { ya: true };
    }
    const monto = Number(reward) || REWARD_AMOUNT;
    // Refrescar el perfil: el saldo de la cabecera y "ya cobró hoy" en la Zona Arcade.
    await Promise.all([entregarMonedas(monto), reloadProfile?.()]);
    return { monto };
  };

  return (
    <PaginaBolitas
      // La página toma el progreso al montarse: se vuelve a montar cuando llega.
      key={`${uid || 'invitado'}-${progreso ? 'listo' : 'cargando'}`}
      estado={loading || !progreso ? 'cargando' : undefined}
      sesion={sesion}
      yaHoy={yaHoy}
      monto={REWARD_AMOUNT}
      onGanar={ganar}
      onRegistrar={registrar}
      onCompletar={(info) => { trackMinigame('complete', { ...JUEGO, ...info }, quien()).catch(() => {}); }}
      hoy={hoy}
      progreso={progreso || undefined}
      onProgreso={alCambiarProgreso}
      ranking={ranking}
      cargandoRanking={cargandoRanking}
      onPedirRanking={pedirRanking}
      ayudaVista={ayudaVista}
      onAyudaVista={() => guardar(CLAVE_AYUDA, '1')}
      urlLogin="/login?redirect=%2Fball-sort"
    />
  );
}
