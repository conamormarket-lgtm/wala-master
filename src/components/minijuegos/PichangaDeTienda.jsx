import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useMonedasDelJuego from './useMonedasDelJuego';
import entregarMonedas from './entregarMonedas';
import {
  registrarPartidaPichanga, getRankingPichanga, leerProgresoPichanga, guardarProgresoPichanga, PREMIO_PICHANGA,
} from '../../services/firebase/pichanga';
import { trackMinigame } from '../../services/analytics/tracker';
import { limaTodayStr } from '../../utils/fechaLima';
import { diseno } from '../../utils/modoDiseno';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaPichanga, unirProgresos } from '../../componentes/kit/paginas/Pichanga';

/*
 * La Pichanga de Kapi (/pichanga), con el mismo esquema que Las Bolitas:
 *  - el premio (+2) lo da el servidor una vez al día de Lima, al comprobar
 *    una partida ganada (registrarPartidaPichangaSecure: repite los tiros);
 *    "ya cobró hoy" sale del perfil (lastPichangaReward) o del modo diseño
 *    (?pichanga=completado, solo en local). Las monedas vuelan al contador y
 *    se refresca el perfil; la hoja no se cierra hasta que llegan
 *  - cada victoria con sesión va al servidor: la misión del día, el reto y los
 *    rankings (reto de hoy y de la semana, top de niveles, goleadores del mes)
 *  - el progreso (PROGRESO_PICHANGA) se guarda en el aparato
 *    (wala_pichanga_progreso) y, con sesión, en la cuenta
 *    (progresoPichangaSecure): al entrar se unen, así se sigue en otro celular
 *  - la analítica de inicio y fin (trackMinigame)
 * Se juega sin cuenta (el premio invita a entrar); la sesión anónima no cuenta.
 */

const CLAVE_AYUDA = 'wala_pichanga_ayuda_vista';
const CLAVE_PROGRESO = 'wala_pichanga_progreso';
const JUEGO = { gameId: 'pichanga', gameName: 'La Pichanga de Kapi' };
const ESPERA_NUBE_MS = 3000; // si la cuenta tarda más, se juega con lo del aparato
const GUARDAR_NUBE_MS = 2500; // lo que cambia seguido se sube en una sola llamada
const URL_LOGIN = '/login?redirect=%2Fpichanga';

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
  const { user, userProfile, loading, reloadProfile } = useAuth();
  const monedas = useMonedasDelJuego();
  const sesion = tieneCuenta(user);
  const uid = sesion ? user.uid : null;
  const hoy = limaTodayStr();
  const forzar = diseno('pichanga');
  const yaHoy = forzar ? forzar === 'completado' : userProfile?.lastPichangaReward === hoy;
  const [ayudaVista] = useState(() => leer(CLAVE_AYUDA, '0') === '1');
  // null mientras se trae lo de la cuenta; después, lo que se juega.
  const [progreso, setProgreso] = useState(null);
  const [rankings, setRankings] = useState({});
  const [cargandoRankings, setCargandoRankings] = useState({});
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
    Promise.race([leerProgresoPichanga().catch(() => null), tarde]).then((nube) => {
      if (!vigente) return;
      const unido = unirProgresos(local, nube);
      setProgreso(unido);
      guardar(CLAVE_PROGRESO, JSON.stringify(unido));
      guardarProgresoPichanga(unido).catch(() => {});
    });
    return () => { vigente = false; };
  }, [loading, uid]);

  // Lo que quedó sin subir a la cuenta se sube al salir.
  useEffect(() => () => {
    if (pendiente.current) {
      clearTimeout(pendiente.current.id);
      guardarProgresoPichanga(pendiente.current.progreso).catch(() => {});
    }
  }, []);

  const alCambiarProgreso = (p) => {
    const conHora = { ...p, actualizado: Date.now() };
    guardar(CLAVE_PROGRESO, JSON.stringify(conHora));
    if (!uid) return;
    if (pendiente.current) clearTimeout(pendiente.current.id);
    const id = setTimeout(() => {
      pendiente.current = null;
      guardarProgresoPichanga(conHora).catch(() => {});
    }, GUARDAR_NUBE_MS);
    pendiente.current = { id, progreso: conHora };
  };

  const pedirRanking = async (tabla) => {
    setCargandoRankings((c) => ({ ...c, [tabla]: true }));
    try {
      const r = await getRankingPichanga(tabla);
      setRankings((todos) => ({ ...todos, [tabla]: r }));
    } catch {
      // Sin ranking: la tabla dice que no hay datos.
      setRankings((todos) => ({ ...todos, [tabla]: todos[tabla] || {} }));
    } finally {
      setCargandoRankings((c) => ({ ...c, [tabla]: false }));
    }
  };

  /** Registra una victoria y refresca los rankings que pudo cambiar. */
  const registrar = async (partida) => {
    const r = await registrarPartidaPichanga(partida);
    if (partida.modo === 'reto') pedirRanking('reto');
    if (r.record && rankings.niveles) pedirRanking('niveles');
    if (rankings.goleadores) pedirRanking('goleadores');
    return r;
  };

  const ganar = async ({ partida }) => {
    const { reward } = await registrar(partida);
    if (!reward) {
      reloadProfile?.();
      return { ya: true };
    }
    const monto = Number(reward) || PREMIO_PICHANGA;
    // Refrescar el perfil: el saldo de la cabecera y "ya cobró hoy" en la Zona Arcade.
    await Promise.all([entregarMonedas(monto), reloadProfile?.()]);
    return { monto };
  };

  return (
    <PaginaPichanga
      monedas={monedas}
      // La página toma el progreso al montarse: se vuelve a montar cuando llega.
      key={`${uid || 'invitado'}-${progreso ? 'listo' : 'cargando'}`}
      estado={loading || !progreso ? 'cargando' : undefined}
      sesion={sesion}
      yaHoy={yaHoy}
      monto={PREMIO_PICHANGA}
      onGanar={ganar}
      onRegistrar={registrar}
      hoy={hoy}
      progreso={progreso || undefined}
      onProgreso={alCambiarProgreso}
      rankings={rankings}
      cargandoRankings={cargandoRankings}
      onPedirRanking={pedirRanking}
      onCompletar={(info) => {
        // Los tiros van como texto: la analítica guarda datos planos.
        const { tiros, ...resto } = info;
        trackMinigame('complete', { ...JUEGO, ...resto, ...(tiros ? { tiros: JSON.stringify(tiros) } : {}) }, quien()).catch(() => {});
      }}
      ayudaVista={ayudaVista}
      onAyudaVista={() => guardar(CLAVE_AYUDA, '1')}
      urlLogin={URL_LOGIN}
    />
  );
}
