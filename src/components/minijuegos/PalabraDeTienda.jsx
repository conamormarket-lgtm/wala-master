import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDailyWord, saveWordleResult, getWordleRanking, getWordleRankingToday, getEstadoPartidaDeHoy, claimWordleReward,
} from '../../services/wordle';
import { VALID_GUESSES } from '../../data/wordleDictionary';
import { trackMinigame } from '../../services/analytics/tracker';
import { limaTodayStr, msHastaMananaLima } from '../../utils/fechaLima';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaPalabra } from '../../componentes/kit/paginas/Palabra';
import { normalizarPalabra } from '../../componentes/kit/piezas/Palabra';
import { useTexto } from '../../componentes/kit/Traduccion';
import entregarMonedas from './entregarMonedas';

/*
 * La Palabra del día (/palabra-del-dia) con el kit (paso 6, JUEGOS.md). La
 * misma lógica que la página de antes:
 *  - la palabra de hoy (getDailyWord, día de Lima) y el diccionario
 *  - quien manda sobre "ya jugaste hoy" es el servidor (getEstadoPartidaDeHoy):
 *    con partida, el día está cerrado (con el tablero si este navegador lo
 *    tiene); sin partida y con un tablero terminado aquí, el tablero es basura
 *    (se reinició desde el panel) y se borra; una partida a medias se sigue
 *    (wala_wordle_{fecha}: guesses, gameStatus, startTime)
 *  - al terminar: saveWordleResult (racha, ranking y la partida que valida
 *    el cobro) y, si ganó, claimWordleRewardSecure; las monedas vuelan y la
 *    hoja no se cierra hasta que llegan; el ranking se vuelve a pedir
 *  - la analítica de inicio y fin, la ayuda la primera vez
 *    (wala_wordle_ayuda_vista)
 * Diferente: las estadísticas salen del perfil (antes, de este navegador: en
 * otro equipo salían en 0) y el navegador ya no guarda el perfil; si el cobro
 * falla, se dice (antes, nada); la sesión anónima juega como invitada y no
 * guarda la partida; la partida se guarda con la palabra tal cual (antes, sin
 * tildes: con una palabra con tilde del admin, el servidor no pagaba).
 * Lo de antes: pages/Tienda/WordleViejo.jsx (interruptor juegosViejo).
 */

const CLAVE_AYUDA = 'wala_wordle_ayuda_vista';
const JUEGO = { gameId: 'wordle', gameName: 'La Palabra del Día' };
const INTENTOS = 6;

const leerLocal = (clave) => {
  try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch { return null; }
};
const guardarLocal = (clave, valor) => {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado */ }
};
const ayudaYaVista = () => {
  try { return localStorage.getItem(CLAVE_AYUDA) === '1'; } catch { return true; }
};

export default function PalabraDeTienda() {
  const { user, userProfile, loading, reloadProfile } = useAuth();
  const queryClient = useQueryClient();
  const anonimo = useTexto('Anónimo');
  const sesion = tieneCuenta(user);
  const hoy = limaTodayStr();
  const clave = `wala_wordle_${hoy}`;
  const [ayudaVista] = useState(ayudaYaVista);
  const [inicial, setInicial] = useState(null);
  const [statsGuardadas, setStatsGuardadas] = useState(null);
  const quien = () => ({ uid: user?.uid, email: user?.email, displayName: user?.displayName });

  const { data: palabraDeHoy } = useQuery({ queryKey: ['daily-word', hoy], queryFn: () => getDailyWord(hoy) });
  const { data: rankingHoy, isLoading: cargandoHoy } = useQuery({
    queryKey: ['wordle-ranking-today', hoy], queryFn: getWordleRankingToday, staleTime: 0,
  });
  const { data: rankingGlobal, isLoading: cargandoGlobal } = useQuery({
    queryKey: ['wordle-ranking-global'], queryFn: getWordleRanking, staleTime: 5 * 60 * 1000,
  });
  const objetivo = palabraDeHoy ? normalizarPalabra(palabraDeHoy) : '';

  useEffect(() => {
    trackMinigame('start', JUEGO, quien()).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo jugado hoy: el servidor manda; el navegador solo guarda la partida a medias.
  useEffect(() => {
    if (!objetivo || loading) return undefined;
    let vivo = true;
    (async () => {
      const guardado = leerLocal(clave);
      const terminadaAqui = Boolean(guardado?.gameStatus) && guardado.gameStatus !== 'playing';
      const tablero = guardado ? { filas: guardado.guesses || [], inicio: guardado.startTime || null } : {};
      // Sin cuenta no hay a quién preguntar: manda este navegador.
      const { estado, partida } = sesion ? await getEstadoPartidaDeHoy() : { estado: 'sin-sesion' };
      if (!vivo) return;
      if (estado === 'jugada') {
        setInicial({
          ...(terminadaAqui ? tablero : {}),
          terminada: { gano: Boolean(partida.won), intentos: Number(partida.attempts) || 0, palabra: objetivo },
        });
        return;
      }
      if (terminadaAqui && estado === 'sin-partida') {
        try { localStorage.removeItem(clave); } catch { /* modo privado */ }
        setInicial({});
        return;
      }
      setInicial(tablero);
    })();
    return () => { vivo = false; };
  }, [objetivo, loading, sesion, clave]);

  const perfil = statsGuardadas || userProfile || {};
  const estadisticas = {
    jugadas: perfil.wordlePlayed || 0,
    victorias: perfil.wordleWins || 0,
    racha: perfil.wordleCurrentStreak || 0,
    mejorRacha: perfil.wordleMaxStreak || 0,
  };

  const ranking = useMemo(() => ({
    hoy: (rankingHoy || []).map((p) => ({
      id: p.id, nombre: p.displayName || anonimo, intentos: p.todayAttempts, segundos: p.timeSeconds, racha: p.currentStreak || 0, yo: Boolean(user && p.id === user.uid),
    })),
    global: (rankingGlobal || []).map((p) => ({
      id: p.id, nombre: p.displayName || anonimo, victorias: p.wins, jugadas: p.played, mejorRacha: p.maxStreak, yo: Boolean(user && p.id === user.uid),
    })),
  }), [rankingHoy, rankingGlobal, user, anonimo]);

  const intento = ({ palabras, inicio }) => {
    const ultima = palabras[palabras.length - 1];
    const gameStatus = ultima === objetivo ? 'won' : palabras.length >= INTENTOS ? 'lost' : 'playing';
    guardarLocal(clave, { guesses: palabras, gameStatus, startTime: inicio });
  };

  const terminar = async ({ gano, intentos, segundos }) => {
    trackMinigame('complete', { ...JUEGO, won: gano, attempts: intentos, timeSeconds: segundos }, quien()).catch(() => {});
    if (!sesion) return null;
    // La palabra tal cual la tiene el servidor (con sus tildes): es contra la
    // que compara al pagar.
    const res = await saveWordleResult(gano, intentos, segundos, palabraDeHoy, [...objetivo].length);
    if (res.guest) return null;
    if (res.error) {
      throw new Error('No pudimos guardar esta partida. Revisa tu conexión: no entró al ranking ni se acreditaron monedas.');
    }
    if (res.stats) setStatsGuardadas(res.stats);
    queryClient.invalidateQueries({ queryKey: ['wordle-ranking-today', hoy] });
    queryClient.invalidateQueries({ queryKey: ['wordle-ranking-global'] });
    if (!gano) return null;
    // El cobro va DESPUÉS de guardar: el servidor valida leyendo la partida de hoy.
    const cobro = await claimWordleReward();
    if (cobro.error) {
      throw new Error('Tu partida quedó guardada, pero no pudimos acreditar tus monedas. Escríbenos y lo revisamos.');
    }
    if (!(cobro.reward > 0)) return { ya: true };
    await Promise.all([entregarMonedas(cobro.reward), reloadProfile?.()]);
    return { monto: cobro.reward, rapido: cobro.rapido };
  };

  const listo = Boolean(objetivo) && !loading && inicial;

  return (
    <PaginaPalabra
      // Al llegar lo jugado hoy (o cambiar de cuenta), el tablero empieza de ahí.
      key={listo ? `${user?.uid || 'invitado'}-${hoy}` : 'cargando'}
      estado={listo ? undefined : 'cargando'}
      objetivo={objetivo}
      esValida={(p) => VALID_GUESSES.size <= 10 || VALID_GUESSES.has(normalizarPalabra(p))}
      inicial={inicial || {}}
      sesion={sesion}
      estadisticas={estadisticas}
      ranking={ranking}
      cargandoRanking={cargandoHoy || cargandoGlobal}
      hasta={new Date(Date.now() + msHastaMananaLima()).toISOString()}
      onIntento={intento}
      onTerminar={terminar}
      ayudaVista={ayudaVista}
      onAyudaVista={() => { try { localStorage.setItem(CLAVE_AYUDA, '1'); } catch { /* modo privado */ } }}
      urlLogin="/login?redirect=%2Fpalabra-del-dia"
    />
  );
}
