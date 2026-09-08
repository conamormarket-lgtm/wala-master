import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { claimBallSortReward } from '../../services/firebase/ballSort';
import { trackMinigame } from '../../services/analytics/tracker';
import { limaTodayStr } from '../../utils/fechaLima';
import { diseno } from '../../utils/modoDiseno';
import { HelpCircle, Coins, Check } from 'lucide-react';
import ArcadeShell from './ArcadeShell';
import styles from './BallSortPage.module.css';
import { T } from '../../i18n/useTranslatedText';

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
  const { user, userProfile, reloadProfile } = useAuth();
  const [tubes, setTubes] = useState([]);
  const [selectedTubeIndex, setSelectedTubeIndex] = useState(null);
  const [hasWon, setHasWon] = useState(false);
  const [error, setError] = useState('');
  // Estado del premio de esta partida: 'idle' | 'claiming' | 'claimed' | 'already'
  const [claimState, setClaimState] = useState('idle');
  const [isAnimating, setIsAnimating] = useState(false);
  const [completedTubes, setCompletedTubes] = useState(new Set());
  // Contador de movimientos: es la unica medida de "que tan bien lo estoy
  // haciendo" que tiene este juego, y la pantalla no daba ninguna.
  const [movimientos, setMovimientos] = useState(0);
  // hasWon bloquea el tablero; esto solo controla si el cartel esta a la vista,
  // para poder cerrarlo y mirar el nivel resuelto.
  const [mostrarVictoria, setMostrarVictoria] = useState(false);
  // La ayuda se abre sola la primera visita y luego se recuerda cerrada.
  const [ayudaAbierta, setAyudaAbierta] = useState(() => {
    try { return localStorage.getItem('wala_bolitas_ayuda_vista') !== '1'; }
    catch { return true; }
  });

  const cerrarAyuda = () => {
    setAyudaAbierta(false);
    try { localStorage.setItem('wala_bolitas_ayuda_vista', '1'); } catch { /* modo privado */ }
  };

  // El servidor decide el día en hora de Lima; el cliente debe usar el mismo
  // criterio o de 19:00 a 23:59 creería que ya es mañana.
  // Se calcula del tablero, NO de completedTubes: ese Set solo lo actualizan
  // los dos tubos que toca cada movimiento (existe para disparar el confeti),
  // asi que como contador se quedaba corto.
  const tubosListos = tubes.filter((t) => isTubeComplete(t)).length;

  const hasClaimedToday = diseno('bolitas')
    ? diseno('bolitas') === 'completado' // modo diseño, solo en local
    : userProfile?.lastBallSortReward === limaTodayStr();

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

  // Escape cierra la ayuda, como en el resto de modales de la Zona Arcade.
  useEffect(() => {
    if (!ayudaAbierta && !mostrarVictoria) return;
    const alPulsar = (e) => {
      if (e.key !== 'Escape') return;
      if (ayudaAbierta) cerrarAyuda();
      else setMostrarVictoria(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [ayudaAbierta, mostrarVictoria]);

  const handleWin = useCallback(async () => {
    setHasWon(true);
    setMostrarVictoria(true);

    // Analytics aditivo (fire-and-forget): fin del minijuego de bolitas.
    try {
      trackMinigame('complete', { gameId: 'ball-sort', gameName: 'Las Bolitas de Kapi' },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
    } catch {}

    if (!user) return;
    if (hasClaimedToday) {
      setClaimState('already');
      return;
    }

    setClaimState('claiming');
    const result = await claimBallSortReward(user.uid, userProfile);

    if (result.success) {
      setClaimState('claimed');
      // Las monedas solo "vuelan" al header si de verdad se acreditaron.
      window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount: 2 } }));
      // Refrescar el perfil: si no, el saldo del header y el estado del hub
      // quedan desactualizados y una segunda partida vuelve a intentar cobrar.
      await reloadProfile();
    } else {
      setClaimState('error');
      setError(result.error);
    }
  }, [user, userProfile, hasClaimedToday, reloadProfile]);

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
      const sourceIndex = selectedTubeIndex;
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
        setMovimientos((n) => n + 1);

        // Desbloquear después de la animación layout
        setTimeout(() => {
          setIsAnimating(false);

          // Recalcular qué tubos están completos. Antes solo se añadían: si el
          // jugador vaciaba un tubo ya completo, seguía marcado como tal y el
          // render reventaba al leer el color de un tubo sin bolitas.
          setCompletedTubes(prev => {
            const next = new Set(prev);
            if (isTubeComplete(newTubes[index])) next.add(index);
            else next.delete(index);
            if (isTubeComplete(newTubes[sourceIndex])) next.add(sourceIndex);
            else next.delete(sourceIndex);
            return next;
          });

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
    setMovimientos(0);
    setHasWon(false);
    setMostrarVictoria(false);
    setError('');
    setClaimState('idle');
    setIsAnimating(false);
    setCompletedTubes(new Set());
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ArcadeShell
      back="/minijuegos"
      title="Las Bolitas de Kapi"
      className={styles.pageContainer}
      acciones={
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => (ayudaAbierta ? cerrarAyuda() : setAyudaAbierta(true))}
          aria-expanded={ayudaAbierta}
        >
          <HelpCircle size={16} aria-hidden="true" />
          <span className={styles.iconBtnTexto}><T>Cómo jugar</T></span>
        </button>
      }
    >
      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.layout}>
      <div className={styles.gameArea}>
        
        <LayoutGroup>
          <div className={styles.tubesContainer}>
            {tubes.map((tube, index) => {
              // Doble red de seguridad: nunca leer el color de un tubo vacío.
              const isComplete = completedTubes.has(index) && tube.length === TUBE_CAPACITY;
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
          {hasWon ? (
            <>
              <button className={`${styles.btn} ${styles.btnPrimario}`} onClick={restartGame}>
                <T>Jugar otra vez</T>
              </button>
              {!mostrarVictoria && (
                <button
                  className={`${styles.btn} ${styles.resetBtn}`}
                  onClick={() => setMostrarVictoria(true)}
                >
                  <T>Ver resultado</T>
                </button>
              )}
            </>
          ) : (
            <button className={`${styles.btn} ${styles.resetBtn}`} onClick={restartGame}>
              <T>Reiniciar Nivel</T>
            </button>
          )}
        </div>
      </div>

      {/* ── Panel de estado ──────────────────────────────────────────────
          La pantalla no decia por que se juega ni como va la partida: media
          pagina estaba vacia y el premio solo se mencionaba en el hub. */}
      <aside className={styles.panel}>
        <div className={styles.panelPremio}>
          <span className={styles.panelPremioIcono} aria-hidden="true">
            {hasClaimedToday ? <Check size={18} /> : <Coins size={18} />}
          </span>
          <span className={styles.panelPremioTexto}>
            {hasClaimedToday ? (
              <T>Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto.</T>
            ) : (
              <>
                <strong><T>+2 Wala Coins</T></strong>{' '}
                <T>al ordenar todos los tubos.</T>
              </>
            )}
          </span>
        </div>

        <dl className={styles.panelDatos}>
          <div className={styles.panelDato}>
            <dt><T>Movimientos</T></dt>
            <dd>{movimientos}</dd>
          </div>
          <div className={styles.panelDato}>
            <dt><T>Tubos listos</T></dt>
            <dd>{tubosListos}<span className={styles.panelTotal}>/{COLORS.length}</span></dd>
          </div>
        </dl>
      </aside>
      </div>

      {ayudaAbierta && (
        <div className={styles.overlay} onClick={cerrarAyuda} role="presentation">
          <div
            className={styles.ayudaCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Cómo se juega"
          >
            <button className={styles.cerrarModal} onClick={cerrarAyuda} aria-label="Cerrar">×</button>

            <h2 className={styles.ayudaTitulo}><T>Cómo se juega</T></h2>

            <ol className={styles.ayudaPasos}>
              <li><T>Toca un tubo para levantar su bolita de arriba.</T></li>
              <li><T>Toca otro tubo para soltarla ahí.</T></li>
              <li><T>Solo puedes soltarla si ese tubo está vacío o si su bolita de arriba es del mismo color.</T></li>
              <li><T>Ganas cuando cada tubo tenga un único color.</T></li>
            </ol>

            <p className={styles.ayudaPie}>
              <T>Si te atascas, «Reiniciar nivel» te reparte las bolitas otra vez. No gastas nada: el premio se puede ganar una vez al día y sigue en juego.</T>
            </p>

            <button type="button" className={styles.ayudaBtn} onClick={cerrarAyuda}>
              <T>Entendido, a jugar</T>
            </button>
          </div>
        </div>
      )}

      {/* ── Cartel de victoria ────────────────────────────────────────────
          Antes era una tarjeta suelta flotando sobre el tablero, sin fondo que
          la separase y sin forma de cerrarla: la unica salida era irse del
          juego. Ahora es un modal como los de La Palabra del Dia, con su capa
          oscura, se puede cerrar para mirar el nivel resuelto, y resume la
          partida y el estado del premio. */}
      <AnimatePresence>
        {mostrarVictoria && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMostrarVictoria(false)}
            role="presentation"
          >
            <motion.div
              className={styles.winCard}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <button
                className={styles.cerrarModal}
                onClick={() => setMostrarVictoria(false)}
                aria-label="Cerrar"
              >
                ×
              </button>

              <span className={styles.winEmoji} aria-hidden="true">🎉</span>
              <h2 className={styles.winTitulo}><T>¡Nivel completado!</T></h2>
              <p className={styles.winSub}>
                <T>Lo resolviste en</T> <strong>{movimientos}</strong>{' '}
                <T>{movimientos === 1 ? 'movimiento' : 'movimientos'}</T>.
              </p>

              <div
                className={`${styles.winPremio} ${claimState === 'error' ? styles.winPremioError : ''}`}
              >
                {claimState === 'claiming' && <T>Acreditando tus monedas...</T>}
                {claimState === 'claimed' && (
                  <>
                    <Coins size={16} aria-hidden="true" />
                    <span><strong><T>+2 Wala Coins</T></strong> <T>acreditadas.</T></span>
                  </>
                )}
                {claimState === 'already' && (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span><T>Ya ganaste tus monedas hoy. Vuelve mañana por las siguientes.</T></span>
                  </>
                )}
                {claimState === 'error' && (
                  <T>No pudimos acreditar tu premio. Inténtalo de nuevo más tarde.</T>
                )}
                {claimState === 'idle' && (
                  <T>Inicia sesión para ganar Wala Coins con este juego.</T>
                )}
              </div>

              <div className={styles.winAcciones}>
                <button type="button" className={styles.winPrimario} onClick={restartGame}>
                  <T>Jugar otra vez</T>
                </button>
                <Link to="/minijuegos" className={styles.winSecundario}>
                  <T>Volver al hub</T>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ArcadeShell>
  );
};

export default BallSortPage;
