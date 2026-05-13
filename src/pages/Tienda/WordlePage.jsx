import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDailyWord, saveWordleResult, getWordleRanking, getWordleRankingToday } from '../../services/wordle';
import { VALID_GUESSES } from '../../data/wordleDictionary';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from './WordlePage.module.css';

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

const formatTime = (seconds) => {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const WordlePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
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

  // Evaluar letra
  const getLetterStatus = (letter, index, guessStr) => {
    if (targetWord[index] === letter) return 'correct';
    if (targetWord.includes(letter)) {
      // Manejar letras repetidas
      const targetCharCount = targetWord.split('').filter(c => c === letter).length;
      const currentGuessedCorrectCount = guessStr.split('').filter((c, i) => c === letter && targetWord[i] === letter).length;
      const previousOccurrencesInGuess = guessStr.substring(0, index).split('').filter(c => c === letter).length;
      
      if (previousOccurrencesInGuess < (targetCharCount - currentGuessedCorrectCount)) {
        return 'present';
      }
    }
    return 'absent';
  };

  const getKeyboardKeyStatus = (key) => {
    let status = 'default';
    for (const guess of guesses) {
      for (let i = 0; i < guess.length; i++) {
        if (guess[i] === key) {
          const charStatus = getLetterStatus(key, i, guess);
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
      } else if (newGuesses.length >= MAX_ATTEMPTS) {
        setGameStatus('lost');
        setShowResultModal(true);
        const timeSeconds = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
        if (user) saveResultMutation.mutate({ won: false, attempts: newGuesses.length, timeSeconds, word: targetWord, length: wordLength });
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
  }, [currentGuess, gameStatus, guesses, wordLength, targetWord, user, saveResultMutation, activeIndex, startTime]);

  // Escuchar teclado físico
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
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
  }, [onKeyPress]);


  if (isLoadingWord) {
    return <div className={styles.loading}>Cargando El Juego del Día...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}></div>
        <h1 className={styles.title}>La Palabra del Día</h1>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={() => setShowRanking(!showRanking)}>
            Ranking
          </button>
        </div>
      </header>

      {showRanking ? (
        <div className={styles.rankingContainer}>
          <h2>Ranking</h2>

          {/* Tabs */}
          <div className={styles.rankingTabs}>
            <button
              className={`${styles.rankingTab} ${rankingTab === 'today' ? styles.rankingTabActive : ''}`}
              onClick={() => setRankingTab('today')}
            >
              Hoy
            </button>
            <button
              className={`${styles.rankingTab} ${rankingTab === 'global' ? styles.rankingTabActive : ''}`}
              onClick={() => setRankingTab('global')}
            >
              Global
            </button>
          </div>

          {rankingTab === 'today' ? (
            <p className={styles.rankingDesc}>Jugadores que completaron el wordle de hoy, ordenados por intentos usados.</p>
          ) : (
            <p className={styles.rankingDesc}>Ordenado por la mayor racha de victorias seguidas (histórico).</p>
          )}
          
          {isLoadingRanking ? (
            <p>Cargando ranking...</p>
          ) : rankingData?.length === 0 ? (
            <p className={styles.rankingEmpty}>
              {rankingTab === 'today'
                ? 'Nadie ha completado el wordle de hoy todavía. ¡Sé el primero!'
                : 'No hay datos de ranking aún.'}
            </p>
          ) : (
            <table className={styles.rankingTable}>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Jugador</th>
                  {rankingTab === 'today' ? (
                    <>
                      <th>Intentos</th>
                      <th>Tiempo</th>
                      <th>Racha Actual</th>
                    </>
                  ) : (
                    <>
                      <th>Mejor Racha</th>
                      <th>Victorias Totales</th>
                      <th>Intentos Acum.</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rankingData?.map((p, index) => (
                  <tr key={p.id} className={user?.uid === p.id ? styles.currentUserRow : ''}>
                    <td>#{index + 1}</td>
                    <td>{p.displayName} {user?.uid === p.id && <strong>(Tú)</strong>}</td>
                    {rankingTab === 'today' ? (
                      <>
                        <td>{p.todayAttempts} / 6</td>
                        <td>{formatTime(p.timeSeconds)}</td>
                        <td><span className={styles.streakBadge}>{p.currentStreak}</span></td>
                      </>
                    ) : (
                      <>
                        <td><span className={styles.streakBadge}>{p.maxStreak}</span></td>
                        <td>{p.wins} / {p.played}</td>
                        <td>{p.totalAttempts || 0}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className={styles.primaryBtn} onClick={() => setShowRanking(false)}>Volver al Juego</button>
        </div>
      ) : (
        <main className={styles.gameContainer}>
          {/* Rejilla */}
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
                      const status = getLetterStatus(letter, colIndex, guesses[rowIndex]);
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

          {gameStatus !== 'playing' && !showResultModal && (
            <button className={styles.showResultBtn} onClick={() => setShowResultModal(true)}>
              Ver Resultados
            </button>
          )}

          {/* Modal de Resultado */}
          {showResultModal && (
            <div className={styles.resultOverlay} onClick={() => setShowResultModal(false)}>
              <div className={styles.resultCard} onClick={e => e.stopPropagation()}>
                <button className={styles.closeModalBtn} onClick={() => setShowResultModal(false)}>×</button>
                <h2>{gameStatus === 'won' ? '¡Felicidades!' : 'Fin del Juego'}</h2>
                {gameStatus === 'won' ? (
                  <p>Adivinaste la palabra en <strong>{guesses.length}</strong> intento{guesses.length !== 1 ? 's' : ''}.</p>
                ) : (
                  <p>La palabra era: <strong>{targetWord}</strong></p>
                )}
                
                {user ? (
                  <div className={styles.stats}>
                    <div className={styles.statBox}>
                      <span className={styles.statNumber}>{userStats?.wordlePlayed || 0}</span>
                      <span className={styles.statLabel}>Jugadas</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statNumber}>{userStats?.wordleWins || 0}</span>
                      <span className={styles.statLabel}>Victorias</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statNumber}>{userStats?.wordleCurrentStreak || 0}</span>
                      <span className={styles.statLabel}>Racha Actual</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statNumber}>{userStats?.wordleMaxStreak || 0}</span>
                      <span className={styles.statLabel}>Mejor Racha</span>
                    </div>
                  </div>
                ) : (
                  <p className={styles.loginPrompt}>Inicia sesión para guardar tus rachas y aparecer en el ranking.</p>
                )}
                
                <p style={{marginTop: '1.5rem', color: '#666'}}>Vuelve mañana para jugar una nueva palabra.</p>
              </div>
            </div>
          )}

          {/* Teclado */}
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
        </main>
      )}
    </div>
  );
};

export default WordlePage;
