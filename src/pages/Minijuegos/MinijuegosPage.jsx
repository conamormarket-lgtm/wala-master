import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRuletaEligibility } from '../../services/firebase/ruleta';
import styles from './MinijuegosPage.module.css';

const MinijuegosPage = () => {
  const { user, userProfile } = useAuth();
  
  const todayStr = new Date().toISOString().split('T')[0];
  const hasClaimedToday = userProfile?.lastDailyReward === todayStr;

  const { isUnlocked: isRuletaUnlocked, days: ruletaDays, hasLost } = getRuletaEligibility(userProfile);

  const handleOpenDailyReward = () => {
    if (hasClaimedToday) {
      alert("¡Ya alimentaste a Kapi hoy! Vuelve mañana.");
      return;
    }
    window.dispatchEvent(new CustomEvent('open-kapi-pet'));
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <div className={styles.titleWrapper}>
          <h1 className={styles.title}>Zona Arcade</h1>
          <p className={styles.subtitle}>Juega, diviértete y gana recompensas exclusivas.</p>
        </div>
      </header>

      <div className={styles.gridContainer}>
        {/* Card 1: Wordle */}
        <div className={`${styles.gameCard} ${styles.wordleCard}`}>
          <div className={styles.cardContent}>
            <div className={styles.gameIcon}>A</div>
            <h2 className={styles.gameTitle}>Palabra del Día</h2>
            <p className={styles.gameDesc}>Adivina la palabra oculta en 6 intentos y compite en el ranking global.</p>
            <Link to="/palabra-del-dia" className={styles.playButton}>Jugar Ahora</Link>
          </div>
          <div className={styles.cardBg}></div>
        </div>

        {/* Card 2: Daily Reward */}
        <div className={`${styles.gameCard} ${styles.dailyCard}`}>
          <div className={styles.cardContent}>
            <div className={styles.gameIcon}>🪙</div>
            <h2 className={styles.gameTitle}>Alimenta a Kapi</h2>
            <p className={styles.gameDesc}>Reclama tu Kapicoin gratis cada día para ahorrar en tus compras.</p>
            <button 
              onClick={handleOpenDailyReward} 
              className={`${styles.playButton} ${hasClaimedToday ? styles.disabledBtn : ''}`}
            >
              {hasClaimedToday ? 'Reclamado hoy ✓' : 'Reclamar Moneda'}
            </button>
          </div>
          <div className={styles.cardBg}></div>
        </div>

        {/* Card 3: Ruleta Semanal */}
        <div className={`${styles.gameCard} ${styles.rouletteCard} ${!isRuletaUnlocked ? styles.lockedCard : ''}`}>
          <div className={styles.cardContent}>
            <div className={styles.gameIcon}>🎰</div>
            <h2 className={styles.gameTitle}>Ruleta Semanal</h2>
            <p className={styles.gameDesc}>Reclama tu moneda los 7 días para girar la ruleta y ganar premios increíbles.</p>
            
            <div className={styles.progressSection}>
              <div className={styles.progressText}>
                <span>Días reclamados</span>
                <span>{ruletaDays}/7</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${(ruletaDays / 7) * 100}%` }}></div>
              </div>
            </div>

            {isRuletaUnlocked ? (
              <Link to="/ruleta" className={styles.playButton}>Girar Ruleta</Link>
            ) : (
              <button className={`${styles.playButton} ${styles.lockedBtn}`} disabled>Bloqueado</button>
            )}
          </div>
          {/* Overlay si está bloqueado */}
          {!isRuletaUnlocked && (
            <div className={styles.lockedOverlay}>
              <div className={styles.lockIcon}>{hasLost ? '❌' : '🔒'}</div>
              <p>{hasLost ? 'Perdiste un día esta semana. ¡La próxima no falles!' : 'Reclama 7 días seguidos para desbloquear'}</p>
            </div>
          )}
          <div className={styles.cardBg}></div>
        </div>
      </div>
    </div>
  );
};

export default MinijuegosPage;
