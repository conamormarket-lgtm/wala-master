import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDailyWord, saveWordleResult, getWordleRanking } from '../../services/wordle';
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

const WordlePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const storageKey = `wala_wordle_${todayStr}`;

  // Estado del juego
  const [targetWord, setTargetWord] = useState('');
  const [wordLength, setWordLength] = useState(5);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'lost'
  const [userStats, setUserStats] = useState(null);
  const [showRanking, setShowRanking] = useState(false);

  // Obtener la palabra del día
  const { data: dailyWord, isLoading: isLoadingWord } = useQuery({
    queryKey: ['daily-word', todayStr],
    queryFn: () => getDailyWord(todayStr)
  });

  // Obtener ranking
  const { data: rankingData, isLoading: isLoadingRanking } = useQuery({
    queryKey: ['wordle-ranking'],
    queryFn: getWordleRanking
  });

  // Mutación para guardar el resultado
  const saveResultMutation = useMutation({
    mutationFn: ({ won, attempts }) => saveWordleResult(won, attempts),
    onSuccess: (res) => {
      if (res.success && res.stats) {
        setUserStats(res.stats);
        queryClient.invalidateQueries({ queryKey: ['wordle-ranking'] });
      }
    }
  });

  // Inicializar estado desde LocalStorage o nueva partida
  useEffect(() => {
    if (dailyWord) {
      const cleanTarget = removeAccents(dailyWord);
      setTargetWord(cleanTarget);
      setWordLength(cleanTarget.length);

      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          setGuesses(parsed.guesses || []);
          setGameStatus(parsed.gameStatus || 'playing');
          if (parsed.userStats) setUserStats(parsed.userStats);
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
        userStats
      }));
    }
  }, [guesses, gameStatus, userStats, storageKey, targetWord]);

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

    if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
      return;
    }

    if (key === 'ENTER') {
      if (currentGuess.length !== wordLength) {
        // Podría mostrar un toast "Faltan letras"
        return;
      }
      
      const newGuesses = [...guesses, currentGuess];
      setGuesses(newGuesses);
      setCurrentGuess('');

      if (currentGuess === targetWord) {
        setGameStatus('won');
        if (user) saveResultMutation.mutate({ won: true, attempts: newGuesses.length });
      } else if (newGuesses.length >= MAX_ATTEMPTS) {
        setGameStatus('lost');
        if (user) saveResultMutation.mutate({ won: false, attempts: newGuesses.length });
      }
      return;
    }

    if (LETTERS.includes(key) && currentGuess.length < wordLength) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, gameStatus, guesses, wordLength, targetWord, user, saveResultMutation]);

  // Escuchar teclado físico
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (key === 'ENTER') onKeyPress('ENTER');
      if (key === 'BACKSPACE') onKeyPress('BACKSPACE');
      if (LETTERS.includes(key) || key === 'Ñ') onKeyPress(key);
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
        <div className={styles.headerLeft}>
          <a href="/" className={styles.backLink}>← Volver a la tienda</a>
        </div>
        <h1 className={styles.title}>La Palabra del Día</h1>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={() => setShowRanking(!showRanking)}>
            🏆 Ranking
          </button>
        </div>
      </header>

      {showRanking ? (
        <div className={styles.rankingContainer}>
          <h2>Ranking Global (Top 50)</h2>
          <p className={styles.rankingDesc}>Ordenado por la mayor racha de victorias seguidas.</p>
          
          {isLoadingRanking ? (
            <p>Cargando ranking...</p>
          ) : (
            <table className={styles.rankingTable}>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Jugador</th>
                  <th>Mejor Racha</th>
                  <th>Victorias Totales</th>
                </tr>
              </thead>
              <tbody>
                {rankingData?.map((p, index) => (
                  <tr key={p.id} className={user?.uid === p.id ? styles.currentUserRow : ''}>
                    <td>#{index + 1}</td>
                    <td>{p.displayName} {user?.uid === p.id && "(Tú)"}</td>
                    <td><span className={styles.streakBadge}>🔥 {p.maxStreak}</span></td>
                    <td>{p.wins} / {p.played}</td>
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
              const guessStr = isPastRow ? guesses[rowIndex] : (isCurrentRow ? currentGuess : '');

              return (
                <div key={rowIndex} className={styles.row} style={{ gridTemplateColumns: `repeat(${wordLength}, 1fr)` }}>
                  {Array.from({ length: wordLength }).map((_, colIndex) => {
                    const letter = guessStr[colIndex] || '';
                    let statusClass = styles.emptyCell;
                    
                    if (isPastRow) {
                      const status = getLetterStatus(letter, colIndex, guessStr);
                      statusClass = styles[status];
                    } else if (letter) {
                      statusClass = styles.filledCell;
                    }

                    return (
                      <div key={colIndex} className={`${styles.cell} ${statusClass} ${letter && isCurrentRow ? styles.pop : ''}`}>
                        {letter}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Modal de Resultado */}
          {gameStatus !== 'playing' && (
            <div className={styles.resultOverlay}>
              <div className={styles.resultCard}>
                <h2>{gameStatus === 'won' ? '¡Felicidades!' : 'Fin del Juego'}</h2>
                {gameStatus === 'lost' && (
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
