// eslint-disable-next-line no-unused-vars
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRuletaEligibility } from '../../services/firebase/ruleta';
import { limaTodayStr } from '../../utils/fechaLima';
import styles from './MinijuegosPage.module.css';
import { T } from '../../i18n/useTranslatedText';

const MinijuegosPage = () => {
  // eslint-disable-next-line no-unused-vars
  const { user, userProfile } = useAuth();

  // El día lo decide el servidor en hora de Lima. Antes aquí se usaba UTC, así
  // que de 19:00 a 23:59 el hub ofrecía premios ya reclamados y el servidor los
  // rechazaba.
  const todayStr = limaTodayStr();
  // La moneda diaria la acredita feedKapiSecure, que marca lastKapiClaimDate.
  const hasClaimedToday = userProfile?.lastKapiClaimDate === todayStr;
  const hasClaimedBallSort = userProfile?.lastBallSortReward === todayStr;

  const {
    isUnlocked: isRuletaUnlocked,
    days: ruletaDays,
    hasLost,
    hasSpun,
    esPendienteAnterior,
  } = getRuletaEligibility(userProfile);

  const handleProtectedPlay = (e) => {
    if (!user) {
      e.preventDefault();
      alert("Debes iniciar sesión para jugar y ganar recompensas.");
    }
  };

  const handleOpenDailyReward = () => {
    if (!user) {
      alert("Debes iniciar sesión para jugar y ganar recompensas.");
      return;
    }
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
          <h1 className={styles.title}><T>Zona Arcade</T></h1>
          <p className={styles.subtitle}><T>Juega, diviértete y gana recompensas exclusivas.</T></p>
        </div>
      </header>

      <div className={styles.gridContainer}>
        {/* Card 1: Wordle */}
        <div className={`${styles.gameCard} ${styles.wordleCard}`}>
          <div className={styles.cardContent}>
            <div className={styles.gameIcon}>A</div>
            <h2 className={styles.gameTitle}><T>Palabra del Día</T></h2>
            <p className={styles.gameDesc}><T>Adivina la palabra oculta en 6 intentos y compite en el ranking global.</T></p>
            <Link to="/palabra-del-dia" className={styles.playButton} onClick={handleProtectedPlay}><T>Jugar Ahora</T></Link>
          </div>
          <div className={styles.cardBg}></div>
        </div>

        {/* Card 2: Daily Reward */}
        <div className={`${styles.gameCard} ${styles.dailyCard}`}>
          <div className={styles.cardContent}>
            <div className={styles.gameIcon}>🪙</div>
            <h2 className={styles.gameTitle}><T>Alimenta a Kapi</T></h2>
            <p className={styles.gameDesc}><T>Reclama tu Kapicoin gratis cada día para ahorrar en tus compras.</T></p>
            <button 
              onClick={handleOpenDailyReward} 
              className={`${styles.playButton} ${hasClaimedToday ? styles.disabledBtn : ''}`}
            >
              <T>{hasClaimedToday ? 'Reclamado hoy ✓' : 'Reclamar Moneda'}</T>
            </button>
          </div>
          <div className={styles.cardBg}></div>
        </div>

        {/* Card 3: Ruleta Semanal */}
        <div className={`${styles.gameCard} ${styles.rouletteCard} ${!isRuletaUnlocked ? styles.lockedCard : ''}`}>
          <div className={styles.cardContent}>
            <div className={styles.gameIcon}>🎰</div>
            <h2 className={styles.gameTitle}><T>Ruleta Semanal</T></h2>
            <p className={styles.gameDesc}><T>Reclama tu moneda los 7 días para girar la ruleta y ganar premios increíbles.</T></p>
            
            <div className={styles.progressSection}>
              <div className={styles.progressText}>
                <span><T>Días reclamados</T></span>
                <span>{ruletaDays}/7</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${(ruletaDays / 7) * 100}%` }}></div>
              </div>
            </div>

            {/* El giro ganado la semana pasada sigue disponible durante esta.
                Sin este aviso, la barra de progreso (que va de la semana en
                curso) haría pensar que la ruleta está bloqueada. */}
            {esPendienteAnterior && (
              <p className={styles.pendingNote}>
                <T>¡Tienes un giro pendiente de la semana pasada!</T>
              </p>
            )}

            {isRuletaUnlocked ? (
              <Link to="/ruleta" className={styles.playButton} onClick={handleProtectedPlay}><T>Girar Ruleta</T></Link>
            ) : (
              <button className={`${styles.playButton} ${styles.lockedBtn}`} disabled>
                <T>{hasSpun ? 'Ya giraste esta semana' : 'Bloqueado'}</T>
              </button>
            )}
          </div>
          {/* Overlay si está bloqueado */}
          {!isRuletaUnlocked && (
            <div className={styles.lockedOverlay}>
              <div className={styles.lockIcon}>{hasSpun ? '✅' : (hasLost ? '❌' : '🔒')}</div>
              <p>
                <T>
                  {hasSpun
                    ? '¡Ya giraste la ruleta esta semana! Vuelve el próximo lunes.'
                    : (hasLost
                      ? 'Perdiste un día esta semana. ¡La próxima no falles!'
                      : 'Reclama 7 días seguidos para desbloquear')}
                </T>
              </p>
            </div>
          )}
          <div className={styles.cardBg}></div>
        </div>

        {/* Card 4: Ball Sort */}
        <div className={`${styles.gameCard}`}>
          <div className={styles.cardContent}>
            <div className={styles.gameIcon}>🧪</div>
            <h2 className={styles.gameTitle}><T>Las Bolitas de Kapi</T></h2>
            <p className={styles.gameDesc}><T>Ordena los colores en los tubos para ganar 2 Wala Coins diarios.</T></p>
            {hasClaimedBallSort ? (
              <button className={`${styles.playButton} ${styles.disabledBtn}`} disabled>
                <T>Completado hoy ✓</T>
              </button>
            ) : (
              <Link to="/ball-sort" className={styles.playButton} style={{ background: '#3b82f6', color: 'white', textDecoration: 'none' }} onClick={handleProtectedPlay}><T>Jugar Ahora</T></Link>
            )}
          </div>
          <div className={styles.cardBg}></div>
        </div>

      </div>
    </div>
  );
};

export default MinijuegosPage;
