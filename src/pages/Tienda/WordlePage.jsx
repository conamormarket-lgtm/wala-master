import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDailyWord, saveWordleResult, getWordleRanking, getWordleRankingToday } from '../../services/wordle';
import { VALID_GUESSES } from '../../data/wordleDictionary';
import { useAuth } from '../../contexts/AuthContext';
import { limaTodayStr } from '../../utils/fechaLima';
import { trackMinigame } from '../../services/analytics/tracker';
import { HelpCircle, Trophy, X } from 'lucide-react';
import ArcadeShell from '../Minijuegos/ArcadeShell';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import styles from './WordlePage.module.css';
import { T } from '../../i18n/useTranslatedText';

// Constantes
const MAX_ATTEMPTS = 6;
const LETTERS = 'QWERTYUIOPASDFGHJKLÑZXCVBNM'.split('');
const KEYS_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

const removeAccents = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

// Evalúa un intento completo contra la palabra objetivo (verde / amarillo / gris).
// Hay que hacerlo por fila entera, no letra a letra: cada letra de la palabra solo
// puede "gastarse" una vez. Primero se marcan los aciertos en su sitio y solo las
// letras que sobran quedan disponibles para los amarillos. Evaluándolo letra a
// letra, con CASAS/SALSA la última A salía gris en lugar de amarilla.
const evaluateGuess = (guess, target) => {
  const result = Array(guess.length).fill('absent');
  const disponibles = {};

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) result[i] = 'correct';
    else disponibles[target[i]] = (disponibles[target[i]] || 0) + 1;
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const letra = guess[i];
    if (disponibles[letra] > 0) {
      result[i] = 'present';
      disponibles[letra] -= 1;
    }
  }

  return result;
};

const formatTime = (seconds) => {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const WordlePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Misma fecha (hora Lima) que usa el servidor y que guarda el resultado: si no,
  // jugar de noche registraba la partida con la fecha del día siguiente.
  const todayStr = limaTodayStr();
  const storageKey = `wala_wordle_${todayStr}`;

  // Estado del juego
  const [targetWord, setTargetWord] = useState('');
  const [wordLength, setWordLength] = useState(5);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'lost'
  const [userStats, setUserStats] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [showRanking, setShowRanking] = useState(false);
  const [rankingTab, setRankingTab] = useState('today'); // 'today' | 'global'
  const [showResultModal, setShowResultModal] = useState(false);
  // La ayuda se abre sola la PRIMERA vez que alguien entra: un jugador nuevo
  // veía una rejilla vacía y un teclado, sin saber cuántos intentos tenía ni qué
  // significaban los colores. Arranca cerrada y la abre el efecto de más abajo,
  // que espera a saber si la partida de hoy sigue en juego.
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  // En movil el ranking se despliega BAJO el teclado, asi que al abrirlo hay que
  // llevar la vista hasta el; si no, parece que el boton no hizo nada.
  const rankingRef = useRef(null);
  const alternarRanking = () => {
    setShowRanking((abierto) => {
      const siguiente = !abierto;
      if (siguiente) {
        requestAnimationFrame(() => {
          rankingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      return siguiente;
    });
  };

  const cerrarAyuda = () => {
    setAyudaAbierta(false);
    try { localStorage.setItem('wala_wordle_ayuda_vista', '1'); } catch { /* modo privado */ }
  };

  const alternarAyuda = () => {
    if (ayudaAbierta) cerrarAyuda();
    else setAyudaAbierta(true);
  };

  // Obtener la palabra del día
  const { data: dailyWord, isLoading: isLoadingWord } = useQuery({
    queryKey: ['daily-word', todayStr],
    queryFn: () => getDailyWord(todayStr)
  });

  // Ranking del día (jugadores de hoy)
  const { data: rankingToday, isLoading: isLoadingToday } = useQuery({
    queryKey: ['wordle-ranking-today', todayStr],
    queryFn: getWordleRankingToday,
    staleTime: 0  // siempre fresco — el ranking cambia a medida que la gente juega
  });

  // Ranking global (rachas históricas)
  const { data: rankingGlobal, isLoading: isLoadingGlobal } = useQuery({
    queryKey: ['wordle-ranking-global'],
    queryFn: getWordleRanking,
    staleTime: 5 * 60 * 1000
  });

  const rankingData = rankingTab === 'today' ? rankingToday : rankingGlobal;
  const isLoadingRanking = rankingTab === 'today' ? isLoadingToday : isLoadingGlobal;

  // Mutación para guardar el resultado
  const saveResultMutation = useMutation({
    mutationFn: ({ won, attempts, timeSeconds, word, length }) => saveWordleResult(won, attempts, timeSeconds, word, length),
    onSuccess: (res) => {
      if (res.success && res.stats) {
        setUserStats(res.stats);
        queryClient.invalidateQueries({ queryKey: ['wordle-ranking-today', todayStr] });
        queryClient.invalidateQueries({ queryKey: ['wordle-ranking-global'] });
      }
    }
  });

  // Inicializar estado desde LocalStorage o nueva partida
  useEffect(() => {
    if (dailyWord) {
      const cleanTarget = removeAccents(dailyWord);
      setTargetWord(cleanTarget);
      setWordLength(cleanTarget.length);
      setCurrentGuess(Array(cleanTarget.length).fill(''));

      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          setGuesses(parsed.guesses || []);
          setGameStatus(parsed.gameStatus || 'playing');
          if (parsed.gameStatus && parsed.gameStatus !== 'playing') {
            setShowResultModal(true);
          }
          if (parsed.userStats) setUserStats(parsed.userStats);
          if (parsed.startTime) setStartTime(parsed.startTime);
        } catch (e) {
          console.error("Error parsing localstorage", e);
        }
      }
    }
  }, [dailyWord, storageKey]);

  // Apertura automática de la ayuda: solo la primera visita Y solo si la partida
  // de hoy sigue abierta. Si el día ya está jugado, el cartel de resultado se
  // muestra al entrar y los dos modales se apilaban uno encima del otro.
  useEffect(() => {
    if (!dailyWord || gameStatus !== 'playing') return;
    try {
      if (localStorage.getItem('wala_wordle_ayuda_vista') === '1') return;
    } catch { return; /* modo privado: no insistimos */ }
    setAyudaAbierta(true);
  }, [dailyWord, gameStatus]);

  // Guardar estado en LocalStorage en cada cambio
  useEffect(() => {
    if (targetWord) {
      localStorage.setItem(storageKey, JSON.stringify({
        guesses,
        gameStatus,
        userStats,
        startTime
      }));
    }
  }, [guesses, gameStatus, userStats, startTime, storageKey, targetWord]);

  // Analytics aditivo (fire-and-forget): inicio de la partida, igual que hacen
  // las Bolitas y la Ruleta. Sin esto el Wordle no aparecía en las analíticas.
  useEffect(() => {
    try {
      trackMinigame('start', { gameId: 'wordle', gameName: 'La Palabra del Día' },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fin de partida (ganada o perdida). Nunca debe romper el juego: va envuelto.
  const trackFin = useCallback((won, attempts, timeSeconds) => {
    try {
      trackMinigame('complete',
        { gameId: 'wordle', gameName: 'La Palabra del Día', won, attempts, timeSeconds },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
    } catch {}
  }, [user]);

  // Cada intento se evalúa una sola vez, por fila completa.
  const evaluaciones = useMemo(
    () => (targetWord ? guesses.map(g => evaluateGuess(g, targetWord)) : []),
    [guesses, targetWord]
  );

  const getKeyboardKeyStatus = (key) => {
    let status = 'default';
    for (let fila = 0; fila < guesses.length; fila++) {
      const guess = guesses[fila];
      for (let i = 0; i < guess.length; i++) {
        if (guess[i] === key) {
          const charStatus = evaluaciones[fila]?.[i];
          if (charStatus === 'correct') return 'correct';
          if (charStatus === 'present' && status !== 'correct') status = 'present';
          if (charStatus === 'absent' && status === 'default') status = 'absent';
        }
      }
    }
    return status;
  };

  const onKeyPress = useCallback((key) => {
    if (gameStatus !== 'playing') return;

    if (!startTime) {
      setStartTime(Date.now());
    }

    if (key === 'BACKSPACE') {
      setCurrentGuess(prev => {
        const newArr = [...prev];
        if (newArr[activeIndex] !== '') {
          newArr[activeIndex] = '';
        } else if (activeIndex > 0) {
          newArr[activeIndex - 1] = '';
          setActiveIndex(activeIndex - 1);
        }
        return newArr;
      });
      return;
    }

    if (key === 'ENTER') {
      if (currentGuess.includes('')) {
        // Faltan letras
        return;
      }
      
      const guessStr = currentGuess.join('');
      
      // Validar si la palabra existe en el diccionario (si el diccionario está cargado)
      if (VALID_GUESSES.size > 10 && !VALID_GUESSES.has(guessStr)) {
        alert("La palabra no está en el diccionario.");
        return;
      }

      const newGuesses = [...guesses, guessStr];
      setGuesses(newGuesses);
      setCurrentGuess(Array(wordLength).fill(''));
      setActiveIndex(0);

      if (guessStr === targetWord) {
        setGameStatus('won');
        setShowResultModal(true);
        const timeSeconds = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
        if (user) saveResultMutation.mutate({ won: true, attempts: newGuesses.length, timeSeconds, word: targetWord, length: wordLength });
        trackFin(true, newGuesses.length, timeSeconds);
      } else if (newGuesses.length >= MAX_ATTEMPTS) {
        setGameStatus('lost');
        setShowResultModal(true);
        const timeSeconds = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
        if (user) saveResultMutation.mutate({ won: false, attempts: newGuesses.length, timeSeconds, word: targetWord, length: wordLength });
        trackFin(false, newGuesses.length, timeSeconds);
      }
      return;
    }

    if (LETTERS.includes(key)) {
      setCurrentGuess(prev => {
        const newArr = [...prev];
        newArr[activeIndex] = key;
        return newArr;
      });
      if (activeIndex < wordLength - 1) {
        setActiveIndex(activeIndex + 1);
      }
    }
  }, [currentGuess, gameStatus, guesses, wordLength, targetWord, user, saveResultMutation, activeIndex, startTime, trackFin]);

  // Escuchar teclado físico
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();

      // Con un modal delante, el teclado cierra en vez de escribir: antes las
      // letras seguían cayendo en el tablero por detrás del cartel.
      if (ayudaAbierta || showResultModal) {
        if (key === 'ESCAPE') {
          if (ayudaAbierta) cerrarAyuda();
          else setShowResultModal(false);
        }
        return;
      }
      if (key === 'BACKSPACE') {
        e.preventDefault();
        onKeyPress('BACKSPACE');
      } else if (key === 'ENTER') {
        e.preventDefault();
        onKeyPress('ENTER');
      } else if (LETTERS.includes(key) || key === 'Ñ') {
        onKeyPress(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onKeyPress, ayudaAbierta, showResultModal]);


  if (isLoadingWord) {
    return (
      <ArcadeShell back="/minijuegos" title="La Palabra del Día">
        <p className={styles.loading}><T>Cargando El Juego del Día...</T></p>
      </ArcadeShell>
    );
  }

  // ── Panel de ranking ──────────────────────────────────────────────────────
  // Antes REEMPLAZABA al juego: al abrirlo desaparecían el tablero y el teclado.
  // Ahora es una columna lateral que en escritorio convive con la partida (hay
  // sitio de sobra) y en móvil se despliega bajo el teclado con el botón de la
  // cabecera, porque ahí el tablero necesita todo el ancho.
  const panelRanking = (
    <>
      <h2 className={styles.rankingTitulo}>
        <Trophy size={18} aria-hidden="true" />
        <T>Ranking</T>
      </h2>

      <div className={styles.rankingTabs} role="tablist">
        <button
          role="tab"
          aria-selected={rankingTab === 'today'}
          className={`${styles.rankingTab} ${rankingTab === 'today' ? styles.rankingTabActive : ''}`}
          onClick={() => setRankingTab('today')}
        >
          <T>Hoy</T>
        </button>
        <button
          role="tab"
          aria-selected={rankingTab === 'global'}
          className={`${styles.rankingTab} ${rankingTab === 'global' ? styles.rankingTabActive : ''}`}
          onClick={() => setRankingTab('global')}
        >
          <T>Global</T>
        </button>
      </div>

      <p className={styles.rankingDesc}>
        <T>
          {rankingTab === 'today'
            ? 'Quienes completaron la palabra de hoy, por intentos usados.'
            : 'Por la racha más larga de victorias seguidas (histórico).'}
        </T>
      </p>

      {isLoadingRanking ? (
        <p className={styles.rankingDesc}><T>Cargando ranking...</T></p>
      ) : rankingData?.length === 0 ? (
        <p className={styles.rankingEmpty}>
          <T>
            {rankingTab === 'today'
              ? 'Nadie ha completado la palabra de hoy todavía. ¡Sé el primero!'
              : 'No hay datos de ranking aún.'}
          </T>
        </p>
      ) : (
        /* Lista, no tabla: cinco columnas no caben en una columna lateral y la
           tabla salia con scroll horizontal, que es de lo peor que se puede
           pedir en movil. Cada jugador ocupa una fila con su puesto y su
           nombre arriba, y sus numeros debajo en texto corrido. */
        <ol className={styles.rankingLista}>
          {rankingData?.map((p, index) => (
            <li
              key={p.id}
              className={`${styles.rankingItem} ${user?.uid === p.id ? styles.rankingItemTuyo : ''}`}
            >
              <span className={styles.rankingPuesto}>{index + 1}</span>

              <div className={styles.rankingDatos}>
                <span className={styles.rankingNombre}>
                  {p.displayName}
                  {user?.uid === p.id && <span className={styles.rankingTu}><T>Tú</T></span>}
                </span>
                <span className={styles.rankingMetricas}>
                  {rankingTab === 'today' ? (
                    <>
                      <strong>{p.todayAttempts}/6</strong> <T>intentos</T>
                      <span aria-hidden="true"> · </span>
                      {formatTime(p.timeSeconds)}
                    </>
                  ) : (
                    <>
                      <strong>{p.wins}</strong>/{p.played} <T>victorias</T>
                      <span aria-hidden="true"> · </span>
                      {p.totalAttempts || 0} <T>intentos</T>
                    </>
                  )}
                </span>
              </div>

              <span
                className={styles.streakBadge}
                title={rankingTab === 'today' ? 'Racha actual' : 'Mejor racha'}
              >
                {rankingTab === 'today' ? p.currentStreak : p.maxStreak}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );

  return (
    <ArcadeShell
      back="/minijuegos"
      title="La Palabra del Día"
      acciones={
        <>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={alternarAyuda}
            aria-expanded={ayudaAbierta}
          >
            <HelpCircle size={16} aria-hidden="true" />
            <span className={styles.iconBtnTexto}><T>Cómo jugar</T></span>
          </button>
          {/* En escritorio el ranking ya está a la vista, así que este botón
              solo aparece en pantallas estrechas. */}
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.soloMovil}`}
            onClick={alternarRanking}
            aria-expanded={showRanking}
          >
            <Trophy size={16} aria-hidden="true" />
            <span className={styles.iconBtnTexto}><T>Ranking</T></span>
          </button>
        </>
      }
    >
      <div className={styles.layout}>
        <main className={styles.gameCol}>
          {/* ── Rejilla ─────────────────────────────────────────────────── */}
          <div className={styles.board} style={{ gridTemplateRows: `repeat(${MAX_ATTEMPTS}, 1fr)` }}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
              const isCurrentRow = rowIndex === guesses.length;
              const isPastRow = rowIndex < guesses.length;

              return (
                <div key={rowIndex} className={styles.row} style={{ gridTemplateColumns: `repeat(${wordLength}, 1fr)` }}>
                  {Array.from({ length: wordLength }).map((_, colIndex) => {
                    const letter = isPastRow ? guesses[rowIndex][colIndex] : (isCurrentRow ? currentGuess[colIndex] : '');
                    let statusClass = styles.emptyCell;

                    if (isPastRow) {
                      const status = evaluaciones[rowIndex]?.[colIndex] || 'absent';
                      statusClass = styles[status];
                    } else if (letter) {
                      statusClass = styles.filledCell;
                    }

                    const isFocused = isCurrentRow && activeIndex === colIndex;

                    return (
                      <div
                        key={colIndex}
                        className={`${styles.cell} ${statusClass} ${letter && isCurrentRow ? styles.pop : ''} ${isFocused ? styles.focusedCell : ''}`}
                        onClick={() => {
                          if (isCurrentRow) setActiveIndex(colIndex);
                        }}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ── Cierre de la partida ────────────────────────────────────
              Con el juego terminado el teclado no sirve para nada: no se puede
              escribir mas. En su sitio va el resumen y el boton de resultados,
              que antes quedaba encajado entre el tablero y un teclado muerto. */}
          {gameStatus !== 'playing' ? (
            <div className={styles.finPartida}>
              <p className={styles.finTexto}>
                {gameStatus === 'won' ? (
                  <>
                    <T>Lo lograste en</T> <strong>{guesses.length}</strong>{' '}
                    <T>{guesses.length === 1 ? 'intento' : 'intentos'}</T>.
                  </>
                ) : (
                  <><T>La palabra era</T> <strong>{targetWord}</strong>.</>
                )}
              </p>
              <p className={styles.finSub}><T>Vuelve mañana para una palabra nueva.</T></p>
              <button className={styles.showResultBtn} onClick={() => setShowResultModal(true)}>
                <T>Ver mis estadísticas</T>
              </button>
            </div>
          ) : (
          /* ── Teclado ───────────────────────────────────────────────── */
          <div className={styles.keyboard}>
            {KEYS_ROWS.map((row, rIdx) => (
              <div key={rIdx} className={styles.keyboardRow}>
                {row.map(key => {
                  const isAction = key === 'ENTER' || key === 'BACKSPACE';
                  const keyClass = isAction ? styles.actionKey : styles.key;
                  const statusClass = !isAction ? styles[`key_${getKeyboardKeyStatus(key)}`] : '';

                  return (
                    <button
                      key={key}
                      className={`${keyClass} ${statusClass}`}
                      onClick={() => onKeyPress(key)}
                    >
                      {key === 'BACKSPACE' ? '⌫' : key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          )}
        </main>

        <aside
          ref={rankingRef}
          className={`${styles.rankingCol} ${showRanking ? styles.rankingVisible : ''}`}
        >
          {panelRanking}
        </aside>
      </div>

      {/* ── Modal: cómo se juega ────────────────────────────────────────
          Va en <body> con un portal: dentro de la pagina el z-index no bastaba
          porque <main> lleva opacity<1 por la transicion de pagina, y eso
          encierra el apilado por debajo del Header. */}
      {createPortal(
      <>
      {ayudaAbierta && !showResultModal && (
        <div className={styles.resultOverlay} onClick={cerrarAyuda} role="presentation">
          <div
            className={`${styles.resultCard} ${styles.ayudaCard}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Cómo se juega"
          >
            <button className={styles.closeModalBtn} onClick={cerrarAyuda} aria-label="Cerrar">×</button>

            <h2 className={styles.ayudaTitulo}><T>Cómo se juega</T></h2>

            <ol className={styles.ayudaPasos}>
              <li>
                <T>Adivina la palabra oculta de</T>{' '}<strong>{wordLength}</strong>{' '}
                <T>letras. Tienes</T> <strong>6</strong> <T>intentos.</T>
              </li>
              <li><T>Escribe con el teclado de abajo (o con el de tu computadora) y pulsa ENTER.</T></li>
              <li><T>Cada intento tiene que ser una palabra que exista.</T></li>
            </ol>

            <p className={styles.ayudaSubtitulo}>
              <T>Después de cada intento, los colores te dicen qué tan cerca estuviste:</T>
            </p>

            <ul className={styles.leyenda}>
              <li>
                <span className={`${styles.celdaEjemplo} ${styles.correct}`}>M</span>
                <span><T>La letra está en la palabra y en el sitio correcto.</T></span>
              </li>
              <li>
                <span className={`${styles.celdaEjemplo} ${styles.present}`}>A</span>
                <span><T>La letra está en la palabra, pero en otro sitio.</T></span>
              </li>
              <li>
                <span className={`${styles.celdaEjemplo} ${styles.absent}`}>R</span>
                <span><T>La letra no está en la palabra.</T></span>
              </li>
            </ul>

            <p className={styles.ayudaPie}>
              <T>Hay una palabra nueva cada día a la medianoche (hora de Perú).</T>
              {!user && <> <T>Inicia sesión para guardar tu racha y aparecer en el ranking.</T></>}
            </p>

            <button type="button" className={styles.ayudaBtn} onClick={cerrarAyuda}>
              <T>Entendido, a jugar</T>
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de resultado ─────────────────────────────────────────── */}
      {showResultModal && (
        <div className={styles.resultOverlay} onClick={() => setShowResultModal(false)}>
          <div className={styles.resultCard} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModalBtn} onClick={() => setShowResultModal(false)}>×</button>
            <h2><T>{gameStatus === 'won' ? '¡Felicidades!' : 'Fin del Juego'}</T></h2>
            {gameStatus === 'won' ? (
              <p><T>Adivinaste la palabra en</T> <strong>{guesses.length}</strong> intento{guesses.length !== 1 ? 's' : ''}.</p>
            ) : (
              <p><T>La palabra era:</T> <strong>{targetWord}</strong></p>
            )}

            {user ? (
              <div className={styles.stats}>
                <div className={styles.statBox}>
                  <span className={styles.statNumber}>{userStats?.wordlePlayed || 0}</span>
                  <span className={styles.statLabel}><T>Jugadas</T></span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statNumber}>{userStats?.wordleWins || 0}</span>
                  <span className={styles.statLabel}><T>Victorias</T></span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statNumber}>{userStats?.wordleCurrentStreak || 0}</span>
                  <span className={styles.statLabel}><T>Racha Actual</T></span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statNumber}>{userStats?.wordleMaxStreak || 0}</span>
                  <span className={styles.statLabel}><T>Mejor Racha</T></span>
                </div>
              </div>
            ) : (
              <p className={styles.loginPrompt}><T>Inicia sesión para guardar tus rachas y aparecer en el ranking.</T></p>
            )}

            <p className={styles.resultPie}><T>Vuelve mañana para jugar una nueva palabra.</T></p>
          </div>
        </div>
      )}
      </>,
      document.body)}
    </ArcadeShell>
  );
};

export default WordlePage;
