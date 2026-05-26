import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { claimBallSortReward } from '../../services/firebase/ballSort';
import styles from './BallSortPage.module.css';

// Colores disponibles
const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']; // Red, Blue, Green, Yellow
const TUBE_CAPACITY = 4;
const NUM_TUBES = 6; // 4 llenos, 2 vacíos

// Función para generar un nivel aleatorio (pero que siempre tenga 4 de cada color)
const generateLevel = () => {
  let allBalls = [];
  COLORS.forEach(color => {
    for (let i = 0; i < TUBE_CAPACITY; i++) {
      allBalls.push(color);
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

const checkWinCondition = (tubes) => {
  for (let tube of tubes) {
    if (tube.length > 0) {
      // Si no está lleno o si no son todos del mismo color, no ha ganado aún
      if (tube.length !== TUBE_CAPACITY) return false;
      const firstColor = tube[0];
      if (!tube.every(color => color === firstColor)) return false;
    }
  }
  return true;
};

const BallSortPage = () => {
  const { user, userProfile } = useAuth();
  const [tubes, setTubes] = useState([]);
  const [selectedTubeIndex, setSelectedTubeIndex] = useState(null);
  const [hasWon, setHasWon] = useState(false);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const hasClaimedToday = userProfile?.lastBallSortReward === todayStr;

  useEffect(() => {
    // Inicializar juego
    setTubes(generateLevel());
  }, []);

  const handleTubeClick = (index) => {
    if (hasWon) return;

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
         (destTube.length === 0 || destTube[destTube.length - 1] === ballToMove)) {
        
        // Mover
        const newTubes = [...tubes];
        newTubes[selectedTubeIndex] = sourceTube.slice(0, -1);
        newTubes[index] = [...destTube, ballToMove];
        
        setTubes(newTubes);
        setSelectedTubeIndex(null);

        // Chequear victoria
        if (checkWinCondition(newTubes)) {
          handleWin();
        }
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

  const handleWin = async () => {
    setHasWon(true);
    
    // Disparar confeti básico si hay alguna librería o simplemente monedas
    window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount: 2 } }));

    if (!user || hasClaimedToday) return;

    setClaiming(true);
    const result = await claimBallSortReward(user.uid, userProfile);
    setClaiming(false);

    if (!result.success) {
      setError(result.error);
    }
  };

  const restartGame = () => {
    setTubes(generateLevel());
    setSelectedTubeIndex(null);
    setHasWon(false);
    setError('');
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
        
        <div className={styles.tubesContainer}>
          {tubes.map((tube, index) => (
            <div 
              key={index} 
              className={`${styles.tubeWrapper} ${selectedTubeIndex === index ? styles.selected : ''}`}
              onClick={() => handleTubeClick(index)}
            >
              <div className={styles.tube}>
                {/* Renderizar las bolitas de abajo hacia arriba */}
                {tube.map((color, bIndex) => {
                  const isTopBall = bIndex === tube.length - 1;
                  const isSelectedTube = selectedTubeIndex === index;
                  return (
                    <div 
                      key={`${bIndex}-${color}`} 
                      className={`${styles.ball} ${isSelectedTube && isTopBall ? styles.selectedBall : ''}`} 
                      style={{ background: `radial-gradient(circle at 30% 30%, ${color} 0%, #000 150%)` }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.controls}>
          <button className={`${styles.btn} ${styles.resetBtn}`} onClick={restartGame}>
            Reiniciar Nivel
          </button>
        </div>
      </div>

      {hasWon && (
        <div className={styles.winBanner}>
          <h2>¡Nivel Completado! 🎉</h2>
          {hasClaimedToday ? (
            <p>¡Bien hecho! Ya reclamaste tus Wala Coins hoy, vuelve mañana para ganar más.</p>
          ) : (
            <p>{claiming ? 'Reclamando premio...' : '¡Has ganado 2 Wala Coins!'}</p>
          )}
          <Link to="/minijuegos" className={styles.actionBtn}>
            Volver al Hub
          </Link>
        </div>
      )}
    </div>
  );
};

export default BallSortPage;
