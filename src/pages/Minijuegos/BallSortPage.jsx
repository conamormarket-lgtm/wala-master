import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { claimBallSortReward } from '../../services/firebase/ballSort';
import { trackMinigame } from '../../services/analytics/tracker';
import { limaTodayStr } from '../../utils/fechaLima';
import { diseno } from '../../utils/modoDiseno';
import { HelpCircle, Coins, Check } from 'lucide-react';
import { volarMonedasGanadas } from '../../utils/animations';
import { useEntregaMonedas } from '../../hooks/useEntregaMonedas';
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

// Tubo en miniatura para la leyenda de la ayuda. Usa la MISMA clase de bolita
// que el tablero: si cambia el aspecto del juego, la ayuda cambia con el.
const MiniTubo = ({ colores = [], estado }) => (
  <span className={`${styles.miniTubo} ${estado === 'ok' ? styles.miniTuboOk : styles.miniTuboNo}`}>
    {colores.map((color, i) => (
      <span key={i} className={`${styles.ball} ${styles.miniBola}`} style={{ '--bola': color }} />
    ))}
  </span>
);

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
  // Mientras se acredita el premio y las monedas vuelan al contador, el modal no
  // se puede cerrar: cerrarlo a media entrega deja al usuario sin saber si cobró.
  const { entregando, empezarEntrega, terminarEntrega } = useEntregaMonedas();
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

  // Cerrado bloqueado: mientras el servidor confirma el premio (claiming) y
  // mientras las monedas vuelan al contador.
  const bloqueado = claimState === 'claiming' || entregando;

  // Escape cierra la ayuda, como en el resto de modales de la Zona Arcade.
  useEffect(() => {
    if (!ayudaAbierta && !mostrarVictoria) return;
    const alPulsar = (e) => {
      if (e.key !== 'Escape') return;
      if (bloqueado) return;
      if (ayudaAbierta) cerrarAyuda();
      else setMostrarVictoria(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
    // `bloqueado` va en las dependencias a proposito: sin el, el manejador se
    // queda con el valor del momento en que se abrio el modal (bloqueado) y
    // Escape seguiria sin funcionar despues de acreditar el premio.
  }, [ayudaAbierta, mostrarVictoria, bloqueado]);

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
      empezarEntrega();
      // Las monedas solo vuelan al header si de verdad se acreditaron. Antes
      // esto lanzaba a mano 'coins-animation-start', que solo RESERVA: no volaba
      // ninguna moneda, el contador nunca subía y la reserva se quedaba abierta.
      volarMonedasGanadas(null, Number(result.reward) || 2);
      // Refrescar el perfil: si no, el saldo del header y el estado del hub
      // quedan desactualizados y una segunda partida vuelve a intentar cobrar.
      await reloadProfile();
    } else {
      setClaimState('error');
      setError(result.error);
      // Sin premio no hay vuelo, así que nadie va a soltar el bloqueo.
      terminarEntrega();
    }
  }, [user, userProfile, hasClaimedToday, reloadProfile, empezarEntrega, terminarEntrega]);

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

  // Misma condicion que aplica handleTubeClick al mover. Solo sirve para
  // pintar: hace visible una regla que antes habia que adivinar probando.
  const puedeSoltarEn = (destIndex) => {
    if (selectedTubeIndex === null || destIndex === selectedTubeIndex) return false;
    const origen = tubes[selectedTubeIndex];
    const destino = tubes[destIndex];
    if (!origen?.length) return false;
    const bola = origen[origen.length - 1];
    return destino.length < TUBE_CAPACITY
      && (destino.length === 0 || destino[destino.length - 1].color === bola.color);
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
                  className={`${styles.tubeWrapper} ${selectedTubeIndex === index ? styles.selected : ''} ${isComplete ? styles.tubeComplete : ''} ${puedeSoltarEn(index) ? styles.tubeDestino : ''}`}
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
                          style={{ '--bola': ball.color }}
                          layout="position"
                          // El levantado lo anima framer-motion, NO una clase CSS.
                          // Con las dos cosas escribiendo `transform` sobre el
                          // mismo elemento se pisaban: al soltar la bolita y
                          // volver a tocar el mismo tubo, ya no subia.
                          animate={{
                            y: isSelectedTube && isTopBall ? -26 : 0,
                            scale: isSelectedTube && isTopBall ? 1.06 : 1,
                          }}
                          transition={{
                            layout: {
                              type: 'spring',
                              stiffness: 300,
                              damping: 25,
                              mass: 0.8,
                            },
                            y: { type: 'spring', stiffness: 420, damping: 24 },
                            scale: { duration: 0.18 },
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
                <strong><T>+2 monedas</T></strong>{' '}
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

      {/* Los modales se montan en <body> con un portal. Dentro de la pagina, su
          z-index no servia de nada: <main> lleva opacity<1 por la transicion de
          pagina, y eso crea un contexto de apilado que encierra el 1100 por
          debajo del Header. Se veia la capa oscura sobre el contenido, pero el
          Header seguia encima y se podia usar con el modal abierto. */}
      {createPortal(
      <AnimatePresence>
        {ayudaAbierta && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cerrarAyuda}
          role="presentation"
        >
          <motion.div
            className={styles.ayudaCard}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Cómo se juega"
          >
            <button className={styles.cerrarModal} onClick={cerrarAyuda} aria-label="Cerrar">×</button>

            <h2 className={styles.ayudaTitulo}><T>Cómo se juega</T></h2>

            <p className={styles.ayudaObjetivo}>
              <T>Hay</T> <strong>{COLORS.length}</strong> <T>colores repartidos en</T>{' '}
              <strong>{NUM_TUBES}</strong> <T>tubos. Los dos tubos vacíos son tu espacio para maniobrar.</T>
            </p>

            <ol className={styles.ayudaPasos}>
              <li><T>Toca un tubo para levantar su bolita de arriba.</T></li>
              <li><T>Toca otro tubo para soltarla ahí.</T></li>
              <li>
                <T>Un tubo está listo cuando tiene sus</T> <strong>{TUBE_CAPACITY}</strong>{' '}
                <T>bolitas del mismo color. Ganas cuando lo están todos.</T>
              </li>
            </ol>

            <p className={styles.ayudaSubtitulo}><T>¿Dónde puedes soltar una bolita roja?</T></p>

            <ul className={styles.leyenda}>
              <li>
                <MiniTubo colores={[]} estado="ok" />
                <span><strong><T>Sí</T></strong> — <T>el tubo está vacío.</T></span>
              </li>
              <li>
                <MiniTubo colores={[COLORS[0], COLORS[0]]} estado="ok" />
                <span><strong><T>Sí</T></strong> — <T>arriba hay otra roja.</T></span>
              </li>
              <li>
                <MiniTubo colores={[COLORS[0], COLORS[1]]} estado="no" />
                <span><strong><T>No</T></strong> — <T>arriba hay otro color.</T></span>
              </li>
            </ul>

            <p className={styles.ayudaPie}>
              <T>Mientras tienes una bolita levantada, los tubos donde sí puedes soltarla se marcan en verde.</T>
              {' '}
              <T>Si te atascas, «Reiniciar nivel» reparte las bolitas otra vez y no te cuesta el premio: los</T>{' '}
              <strong><T>+2 monedas</T></strong> <T>se ganan una vez al día y siguen en juego.</T>
            </p>

            <button type="button" className={styles.ayudaBtn} onClick={cerrarAyuda}>
              <T>Entendido, a jugar</T>
            </button>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>,
      document.body)}

      {/* ── Cartel de victoria ────────────────────────────────────────────
          Antes era una tarjeta suelta flotando sobre el tablero, sin fondo que
          la separase y sin forma de cerrarla: la unica salida era irse del
          juego. Ahora es un modal como los de La Palabra del Dia, con su capa
          oscura, se puede cerrar para mirar el nivel resuelto, y resume la
          partida y el estado del premio. */}
      {createPortal(
      <AnimatePresence>
        {mostrarVictoria && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!bloqueado) setMostrarVictoria(false); }}
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
              {!bloqueado && (
                <button
                  className={styles.cerrarModal}
                  onClick={() => setMostrarVictoria(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              )}

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
                    <span><strong><T>+2 monedas</T></strong> <T>acreditadas.</T></span>
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
                  <T>Inicia sesión para ganar monedas con este juego.</T>
                )}
              </div>

              <div className={styles.winAcciones}>
                <button type="button" className={styles.winPrimario} onClick={restartGame}>
                  <T>Jugar otra vez</T>
                </button>
                <Link to="/minijuegos" className={styles.winSecundario}>
                  <T>Ver otros juegos</T>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </ArcadeShell>
  );
};

export default BallSortPage;
