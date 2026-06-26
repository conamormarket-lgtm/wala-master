import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { claimBallSortReward } from '../../services/firebase/ballSort';
import { trackMinigame } from '../../services/analytics/tracker';
import styles from './BallSortPage.module.css';

// Colores disponibles
const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']; // Red, Blue, Green, Yellow
const TUBE_CAPACITY = 4;
const NUM_TUBES = 6; // 4 llenos, 2 vacíos

let _ballId = 0;
const nextBallId = () => `ball-${_ballId++}`;

// Función para generar un nivel aleatorio (pero que siempre tenga 4 de cada color)
// Ahora cada bolita tiene un ID único para que framer-motion pueda rastrearla
const generateLevel = () => {
  const allBalls = [];
  COLORS.forEach(color => {
    for (let i = 0; i < TUBE_CAPACITY; i++) {
      allBalls.push({ id: nextBallId(), color });
    }
  });

  // Mezclar array
  for (let i = allBalls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allBalls[i], allBalls[j]] = [allBalls[j], allBalls[i]];
  }

  // Repartir en tubos
  const tubes = Array.from({ length: NUM_TUBES }, () => []);
  let ballIndex = 0;
  for (let t = 0; t < NUM_TUBES - 2; t++) {
    for (let b = 0; b < TUBE_CAPACITY; b++) {
      tubes[t].push(allBalls[ballIndex]);
      ballIndex++;
    }
  }

  return tubes;
};

// Verifica si un tubo individual está completo (4 bolitas del mismo color)
const isTubeComplete = (tube) => {
  if (tube.length !== TUBE_CAPACITY) return false;
  const firstColor = tube[0].color;
  return tube.every(ball => ball.color === firstColor);
};

const checkWinCondition = (tubes) => {
  for (let tube of tubes) {
    if (tube.length > 0) {
      if (!isTubeComplete(tube)) return false;
    }
  }
  return true;
};

// Genera las partículas de confeti para un tubo completado
const CONFETTI_COUNT = 12;
const TubeConfetti = ({ color }) => {
  const particles = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const angle = (360 / CONFETTI_COUNT) * i + (Math.random() * 30 - 15);
    const distance = 40 + Math.random() * 35;
    const radians = (angle * Math.PI) / 180;
    const tx = Math.cos(radians) * distance;
    const ty = Math.sin(radians) * distance - 30; // sesgo hacia arriba
    const size = 5 + Math.random() * 4;
    const delay = Math.random() * 0.15;
    const rotation = Math.random() * 360;
    return (
      <span
        key={i}
        className={styles.confettiParticle}
        style={{
          '--tx': `${tx}px`,
          '--ty': `${ty}px`,
          '--rot': `${rotation}deg`,
          width: `${size}px`,
          height: `${size}px`,
          background: color,
          animationDelay: `${delay}s`,
        }}
      />
    );
  });
  return <div className={styles.confettiContainer}>{particles}</div>;
};

const BallSortPage = () => {
  const { user, userProfile } = useAuth();
  const [tubes, setTubes] = useState([]);
  const [selectedTubeIndex, setSelectedTubeIndex] = useState(null);
  const [hasWon, setHasWon] = useState(false);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [completedTubes, setCompletedTubes] = useState(new Set());
  
  const _dbs = new Date();
  const todayStr = `${_dbs.getFullYear()}-${String(_dbs.getMonth()+1).padStart(2, '0')}-${String(_dbs.getDate()).padStart(2, '0')}`;
  const hasClaimedToday = userProfile?.lastBallSortReward === todayStr;

  useEffect(() => {
    // Inicializar juego
    setTubes(generateLevel());
    // Analytics aditivo (fire-and-forget): inicio del minijuego de bolitas.
    try {
      trackMinigame('start', { gameId: 'ball-sort', gameName: 'Las Bolitas de Kapi' },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWin = useCallback(async () => {
    setHasWon(true);

    // Analytics aditivo (fire-and-forget): fin del minijuego de bolitas.
    try {
      trackMinigame('complete', { gameId: 'ball-sort', gameName: 'Las Bolitas de Kapi' },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
    } catch {}

    // Disparar confeti básico si hay alguna librería o simplemente monedas
    window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount: 2 } }));

    if (!user || hasClaimedToday) return;

    setClaiming(true);
    const result = await claimBallSortReward(user.uid, userProfile);
    setClaiming(false);

    if (!result.success) {
      setError(result.error);
    }
  }, [user, userProfile, hasClaimedToday]);

  const handleTubeClick = (index) => {
    if (hasWon || isAnimating) return;

    // Si no hay tubo seleccionado
    if (selectedTubeIndex === null) {
      // Solo seleccionar si el tubo tiene al menos una bolita
      if (tubes[index].length > 0) {
        setSelectedTubeIndex(index);
      }
    } else {
      // Si hace click en el mismo tubo, deseleccionar
      if (selectedTubeIndex === index) {
        setSelectedTubeIndex(null);
        return;
      }

      // Intentar mover la bolita
      const sourceTube = tubes[selectedTubeIndex];
      const destTube = tubes[index];
      const ballToMove = sourceTube[sourceTube.length - 1];

      // Reglas de movimiento:
      // 1. El tubo destino debe tener espacio
      // 2. El tubo destino debe estar vacío O la bola superior debe ser del mismo color
      if (destTube.length < TUBE_CAPACITY && 
         (destTube.length === 0 || destTube[destTube.length - 1].color === ballToMove.color)) {
        
        // Bloquear clics durante la animación
        setIsAnimating(true);

        // Mover
        const newTubes = tubes.map(t => [...t]);
        newTubes[selectedTubeIndex] = sourceTube.slice(0, -1);
        newTubes[index] = [...destTube, ballToMove];
        
        setTubes(newTubes);
        setSelectedTubeIndex(null);

        // Desbloquear después de la animación layout
        setTimeout(() => {
          setIsAnimating(false);

          // Detectar si el tubo destino se acaba de completar
          if (isTubeComplete(newTubes[index]) && !completedTubes.has(index)) {
            setCompletedTubes(prev => new Set([...prev, index]));
          }

          // Chequear victoria
          if (checkWinCondition(newTubes)) {
            handleWin();
          }
        }, 350);

      } else {
        // Movimiento inválido, deseleccionar o cambiar selección
        if (tubes[index].length > 0) {
           setSelectedTubeIndex(index); // Seleccionar el nuevo tubo si tiene bolitas
        } else {
           setSelectedTubeIndex(null);
        }
      }
    }
  };

  const restartGame = () => {
    setTubes(generateLevel());
    setSelectedTubeIndex(null);
    setHasWon(false);
    setError('');
    setIsAnimating(false);
    setCompletedTubes(new Set());
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <Link to="/minijuegos" className={styles.backBtn}>← Volver</Link>
        <h1>Las Bolitas de Kapi</h1>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.gameArea}>
        <p style={{marginBottom: '2rem', textAlign: 'center', color: 'var(--gris-texto-secundario)'}}>
          Ordena los colores para que cada tubo contenga un solo color.
        </p>
        
        <LayoutGroup>
          <div className={styles.tubesContainer}>
            {tubes.map((tube, index) => {
              const isComplete = completedTubes.has(index);
              const tubeColor = isComplete ? tube[0].color : null;
              return (
                <div 
                  key={index} 
                  className={`${styles.tubeWrapper} ${selectedTubeIndex === index ? styles.selected : ''} ${isComplete ? styles.tubeComplete : ''}`}
                  onClick={() => handleTubeClick(index)}
                >
                  <div className={styles.tube}>
                    {/* Confeti al completar */}
                    {isComplete && <TubeConfetti color={tubeColor} />}
                    {/* Renderizar las bolitas de abajo hacia arriba */}
                    {tube.map((ball, bIndex) => {
                      const isTopBall = bIndex === tube.length - 1;
                      const isSelectedTube = selectedTubeIndex === index;
                      return (
                        <motion.div 
                          key={ball.id}
                          layoutId={ball.id}
                          className={`${styles.ball} ${isSelectedTube && isTopBall ? styles.selectedBall : ''}`} 
                          style={{ background: `radial-gradient(circle at 30% 30%, ${ball.color} 0%, #000 150%)` }}
                          layout="position"
                          transition={{
                            layout: {
                              type: 'spring',
                              stiffness: 300,
                              damping: 25,
                              mass: 0.8,
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </LayoutGroup>

        <div className={styles.controls}>
          <button className={`${styles.btn} ${styles.resetBtn}`} onClick={restartGame}>
            Reiniciar Nivel
          </button>
        </div>
      </div>

      <AnimatePresence>
        {hasWon && (
          <motion.div
            className={styles.winBanner}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <h2>¡Nivel Completado! 🎉</h2>
            {hasClaimedToday ? (
              <p>¡Bien hecho! Ya reclamaste tus Wala Coins hoy, vuelve mañana para ganar más.</p>
            ) : (
              <p>{claiming ? 'Reclamando premio...' : '¡Has ganado 2 Wala Coins!'}</p>
            )}
            <Link to="/minijuegos" className={styles.actionBtn}>
              Volver al Hub
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BallSortPage;
