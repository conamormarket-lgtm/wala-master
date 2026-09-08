import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { diseno } from '../../utils/modoDiseno';
import { getRuletaPrizes, spinRuleta, getRuletaEligibility } from '../../services/firebase/ruleta';
import { trackMinigame } from '../../services/analytics/tracker';
import ArcadeShell from './ArcadeShell';
import styles from './RuletaPage.module.css';
import { T } from '../../i18n/useTranslatedText';

const RuletaPage = () => {
  const { user, userProfile, reloadProfile } = useAuth();
  const { addToast } = useGlobalToast();
  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  
  const wheelRef = useRef(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  // El emoji es el respaldo de la imagen de Kapi; solo debe salir si la imagen
  // no carga. Antes se pintaban los dos a la vez (capibara + perrito).
  const [falloImagenKapi, setFalloImagenKapi] = useState(false);
  // La ayuda se abre sola la primera visita y luego se recuerda cerrada.
  const [ayudaAbierta, setAyudaAbierta] = useState(() => {
    try { return localStorage.getItem('wala_ruleta_ayuda_vista') !== '1'; }
    catch { return true; }
  });

  const cerrarAyuda = () => {
    setAyudaAbierta(false);
    try { localStorage.setItem('wala_ruleta_ayuda_vista', '1'); } catch { /* modo privado */ }
  };

  useEffect(() => {
    const fetchPrizes = async () => {
      const p = await getRuletaPrizes();
      // Sin premios NO es un error: es que el admin aun no los ha cargado en
      // /admin/ruleta. Se trata como estado vacio, no como fallo rojo.
      setPrizes(p);
      setLoading(false);
    };
    fetchPrizes();
  }, []);

  // Analytics aditivo (fire-and-forget): inicio del minijuego de ruleta al montar.
  useEffect(() => {
    try {
      trackMinigame('start', { gameId: 'ruleta', gameName: 'Ruleta Semanal' },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ayudaAbierta) return;
    const alPulsar = (e) => { if (e.key === 'Escape') cerrarAyuda(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [ayudaAbierta]);

  const elegibilidad = getRuletaEligibility(userProfile);
  // Modo diseño (solo en local): ?ruleta=desbloqueada|girada|pendiente|perdida
  const forzar = diseno('ruleta');
  const isUnlocked = forzar ? (forzar === 'desbloqueada' || forzar === 'pendiente') : elegibilidad.isUnlocked;
  const hasLost = forzar ? forzar === 'perdida' : elegibilidad.hasLost;
  const hasSpun = forzar ? forzar === 'girada' : elegibilidad.hasSpun;
  const esPendienteAnterior = forzar ? forzar === 'pendiente' : elegibilidad.esPendienteAnterior;

  const handleSpin = async () => {
    if (!isUnlocked || spinning || result) return;

    setSpinning(true);
    setError('');
    
    // Llamada al servidor para obtener el resultado
    const res = await spinRuleta(user.uid, userProfile);
    
    if (!res.success) {
      setError(res.error || 'Ocurrió un error al girar la ruleta.');
      setSpinning(false);
      return;
    }

    const winningPrize = res.prize;
    // Si el premio no está en la lista que cargó el cliente (un admin editó los
    // premios entre la carga y el giro), findIndex devuelve -1 y la rueda pararía
    // en una casilla que no corresponde. Recargamos la lista antes de animar y
    // calculamos el ángulo sobre esa misma lista (el estado aún no se ha aplicado).
    let listaPremios = prizes;
    let prizeIndex = listaPremios.findIndex(p => p.id === winningPrize.id);
    if (prizeIndex === -1) {
      const frescos = await getRuletaPrizes();
      if (frescos.length > 0) {
        listaPremios = frescos;
        setPrizes(frescos);
        prizeIndex = frescos.findIndex(p => p.id === winningPrize.id);
      }
      if (prizeIndex === -1) prizeIndex = 0; // último recurso: no dejar la rueda en un ángulo absurdo
    }

    // El servidor ya marcó el giro de esta semana: refrescar el perfil para que
    // el hub y el botón no sigan ofreciendo un giro que ya no existe.
    reloadProfile();

    // Calcular ángulo de parada
    const sliceAngle = 360 / listaPremios.length;
    // Se le suma 5 o 10 vueltas completas (360 * 5)
    const spins = 360 * 5; 
    // Calcular el ángulo del premio ganador (restando para que quede arriba)
    const stopAngle = spins + (360 - (prizeIndex * sliceAngle)) - (sliceAngle / 2);
    
    const finalRotation = currentRotation + stopAngle;
    setCurrentRotation(finalRotation);

    if (wheelRef.current) {
      wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
      wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;
    }

    // Esperar que termine la animación
    setTimeout(() => {
      setSpinning(false);
      setResult(winningPrize);
      // Analytics aditivo (fire-and-forget): fin del minijuego de ruleta con el premio obtenido.
      try {
        trackMinigame('complete',
          { gameId: 'ruleta', gameName: 'Ruleta Semanal', prizeId: winningPrize?.id, prizeName: winningPrize?.name },
          { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
      } catch {}
      // Disparar confeti/kapi-coins
      if (winningPrize.type === 'Monedas') {
        window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount: Number(winningPrize.amount) } }));
      }
    }, 4100);
  };

  // Compartir el premio: en móvil abre el diálogo nativo del sistema; en escritorio
  // (donde navigator.share no existe) copia el texto al portapapeles.
  const handleShare = async () => {
    if (!result) return;
    const texto = `¡Gané ${result.name} en la Ruleta Semanal de Walá! 🎰`;
    const url = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ruleta Semanal de Walá', text: texto, url });
        return;
      } catch (e) {
        // El usuario canceló el diálogo: no es un error que haya que avisar.
        if (e?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      addToast('Resultado copiado al portapapeles', 'success');
    } catch {
      addToast('No pudimos compartir el resultado', 'error');
    }
  };

  // Los estados de espera también viven dentro del shell: antes eran texto
  // suelto sobre el fondo gris y parecían un error de carga de la página.
  const botonAyuda = (
    <button
      type="button"
      className={styles.iconBtn}
      onClick={() => (ayudaAbierta ? cerrarAyuda() : setAyudaAbierta(true))}
      aria-expanded={ayudaAbierta}
    >
      <HelpCircle size={16} aria-hidden="true" />
      <span className={styles.iconBtnTexto}><T>Cómo jugar</T></span>
    </button>
  );

  const modalAyuda = createPortal(
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
              <T>La ruleta no se juega: se gana. Es el premio de mantener tu racha con Kapi toda la semana.</T>
            </p>

            <ol className={styles.ayudaPasos}>
              <li><T>Alimenta a Kapi todos los días, de lunes a domingo.</T></li>
              <li><T>Si te saltas un día, la semana se pierde y el contador vuelve a empezar el lunes.</T></li>
              <li><T>Al completar los 7 días ganas un giro.</T></li>
              <li><T>Un giro por semana: al girar, se acaba hasta la siguiente.</T></li>
            </ol>

            <p className={styles.ayudaPie}>
              <T>Si ganas el giro y no lo usas, no lo pierdes: sigue disponible durante la semana siguiente. El premio lo decide el servidor y se acredita solo en tu cuenta.</T>
            </p>

            <button type="button" className={styles.ayudaBtn} onClick={cerrarAyuda}>
              <T>Entendido</T>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  if (!user) {
    return (
      <ArcadeShell back="/minijuegos" title="Ruleta Semanal" acciones={botonAyuda}>
        <p className={styles.estado}><T>Inicia sesión para jugar.</T></p>
        {modalAyuda}
      </ArcadeShell>
    );
  }

  if (loading) {
    return (
      <ArcadeShell back="/minijuegos" title="Ruleta Semanal" acciones={botonAyuda}>
        <p className={styles.estado}><T>Cargando ruleta...</T></p>
        {modalAyuda}
      </ArcadeShell>
    );
  }

  // Sin premios cargados no hay ruleta que girar. Antes se pintaba igual: un
  // disco negro y un boton "¡GIRAR RULETA!" activo que, al pulsarlo, se iba al
  // servidor a fallar. Mejor decirlo y no ofrecer una accion que no existe.
  if (prizes.length === 0) {
    return (
      <ArcadeShell back="/minijuegos" title="Ruleta Semanal" className={styles.pageContainer} acciones={botonAyuda}>
        <div className={styles.vacio}>
          <span className={styles.vacioIcono} aria-hidden="true">🎡</span>
          <h2 className={styles.vacioTitulo}><T>La ruleta está en preparación</T></h2>
          <p className={styles.vacioTexto}>
            <T>Todavía no hay premios cargados. Tu progreso de los 7 días no se pierde: cuando la abramos, tu giro seguirá aquí esperándote.</T>
          </p>
          <Link to="/minijuegos" className={styles.vacioBtn}><T>Ver otros juegos</T></Link>
        </div>
        {modalAyuda}
      </ArcadeShell>
    );
  }

  return (
    <ArcadeShell back="/minijuegos" title="Ruleta Semanal" className={styles.pageContainer} acciones={botonAyuda}>
      {error && <div className={styles.errorBanner}><T>{error}</T></div>}

      <div className={styles.ruletaContainer}>
        <div className={styles.pointer}>▼</div>
        
        <div 
          className={styles.wheel} 
          ref={wheelRef}
          style={{
            background: prizes.length > 0 
              ? `conic-gradient(${prizes.map((p, i) => `${i % 2 === 0 ? '#8b5cf6' : '#6d28d9'} ${(i * 360) / prizes.length}deg ${((i + 1) * 360) / prizes.length}deg`).join(', ')})`
              : '#333'
          }}
        >
          {prizes.map((prize, i) => {
            const angle = (i * 360) / prizes.length + (360 / prizes.length) / 2;
            return (
              <div 
                key={prize.id} 
                className={styles.prizeSlice}
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <div className={styles.prizeText}>{prize.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.controls}>
        {result ? (
          <div className={styles.resultBox}>
            <h2><T>¡Felicidades!</T></h2>
            <p><T>Has ganado:</T> <strong>{result.name}</strong></p>
            <button className={styles.shareBtn} onClick={handleShare}>
              <T>Compartir Resultado 🎉</T>
            </button>
            <Link to="/minijuegos" className={styles.secondaryBtn}><T>Ver otros juegos</T></Link>
          </div>
        ) : (
          <>
            {/* Giro heredado de la semana pasada: se avisa para que no parezca
                un error que la ruleta esté abierta con el contador a cero. */}
            {esPendienteAnterior && (
              <p className={styles.pendingNote}>
                <T>Este giro es el que ganaste la semana pasada. ¡Aprovéchalo!</T>
              </p>
            )}
            <button
              className={`${styles.spinBtn} ${(!isUnlocked || spinning) ? styles.disabled : ''}`}
              onClick={handleSpin}
              disabled={!isUnlocked || spinning}
            >
              <T>
                {spinning
                  ? 'Girando...'
                  : (isUnlocked
                    ? '¡GIRAR RULETA!'
                    : (hasSpun
                      ? 'Ya giraste esta semana ✅'
                      : (hasLost ? 'Semana Perdida ❌' : 'Ruleta Bloqueada 🔒')))}
              </T>
            </button>
          </>
        )}
      </div>

      {/* Kapi Mascot Animation Container */}
      <div className={`${styles.kapiMascot} ${spinning ? styles.kapiCheering : ''} ${result ? styles.kapiCelebrating : ''}`}>
        {!falloImagenKapi && (
          <img
            src="/assets/kapi/kapi-happy.png"
            alt="Kapi"
            onError={() => setFalloImagenKapi(true)}
          />
        )}
        {/* Respaldo: solo si la imagen no cargo. */}
        {falloImagenKapi && (
          <div className={styles.kapiEmoji}>
            {spinning ? '🤩' : (result ? '🥳' : '🐶')}
          </div>
        )}
      </div>

      {modalAyuda}
    </ArcadeShell>
  );
};

export default RuletaPage;
