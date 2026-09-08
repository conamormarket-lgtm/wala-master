import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { diseno } from '../../utils/modoDiseno';
import { getRuletaPrizes, spinRuleta, getRuletaEligibility } from '../../services/firebase/ruleta';
import { trackMinigame } from '../../services/analytics/tracker';
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

  useEffect(() => {
    const fetchPrizes = async () => {
      const p = await getRuletaPrizes();
      if (p.length > 0) {
        setPrizes(p);
      } else {
        setError('No hay premios configurados en este momento.');
      }
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

  if (!user) return <div className={styles.loading}><T>Inicia sesión para jugar.</T></div>;
  if (loading) return <div className={styles.loading}><T>Cargando ruleta...</T></div>;

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <Link to="/minijuegos" className={styles.backBtn}><T>← Volver</T></Link>
        <h1><T>Ruleta Semanal</T></h1>
      </header>

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
            <Link to="/minijuegos" className={styles.secondaryBtn}><T>Volver al Hub</T></Link>
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
        <img src="/assets/kapi/kapi-happy.png" alt="Kapi Mascot" onError={(e) => e.target.style.display = 'none'} />
        {/* Fallback emoji si no hay imagen */}
        {!spinning && !result && <div className={styles.kapiEmoji}>🐶</div>}
        {spinning && <div className={styles.kapiEmoji}>🤩</div>}
        {result && <div className={styles.kapiEmoji}>🥳</div>}
      </div>
    </div>
  );
};

export default RuletaPage;
