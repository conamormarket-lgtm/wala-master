import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRuletaPrizes, spinRuleta, getRuletaEligibility } from '../../services/firebase/ruleta';
import styles from './RuletaPage.module.css';

const RuletaPage = () => {
  const { user, userProfile } = useAuth();
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

  const { isUnlocked, hasLost } = getRuletaEligibility(userProfile);

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
    const prizeIndex = prizes.findIndex(p => p.id === winningPrize.id);
    
    // Calcular ángulo de parada
    const sliceAngle = 360 / prizes.length;
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
      // Disparar confeti/kapi-coins
      if (winningPrize.type === 'Monedas') {
        window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount: Number(winningPrize.amount) } }));
      }
    }, 4100);
  };

  if (!user) return <div className={styles.loading}>Inicia sesión para jugar.</div>;
  if (loading) return <div className={styles.loading}>Cargando ruleta...</div>;

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <Link to="/minijuegos" className={styles.backBtn}>← Volver</Link>
        <h1>Ruleta Semanal</h1>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

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
            <h2>¡Felicidades!</h2>
            <p>Has ganado: <strong>{result.name}</strong></p>
            <button className={styles.shareBtn} onClick={() => alert("Compartiendo... (Feature en desarrollo)")}>
              Compartir Resultado 🎉
            </button>
            <Link to="/minijuegos" className={styles.secondaryBtn}>Volver al Hub</Link>
          </div>
        ) : (
          <button 
            className={`${styles.spinBtn} ${(!isUnlocked || spinning) ? styles.disabled : ''}`}
            onClick={handleSpin}
            disabled={!isUnlocked || spinning}
          >
            {spinning ? 'Girando...' : (isUnlocked ? '¡GIRAR RULETA!' : (hasLost ? 'Semana Perdida ❌' : 'Ruleta Bloqueada 🔒'))}
          </button>
        )}
      </div>

      {/* Kapi Mascot Animation Container */}
      <div className={`${styles.kapiMascot} ${spinning ? styles.kapiCheering : ''} ${result ? styles.kapiCelebrating : ''}`}>
        <img src="/assets/kapi_happy.png" alt="Kapi Mascot" onError={(e) => e.target.style.display = 'none'} />
        {/* Fallback emoji si no hay imagen */}
        {!spinning && !result && <div className={styles.kapiEmoji}>🐶</div>}
        {spinning && <div className={styles.kapiEmoji}>🤩</div>}
        {result && <div className={styles.kapiEmoji}>🥳</div>}
      </div>
    </div>
  );
};

export default RuletaPage;
