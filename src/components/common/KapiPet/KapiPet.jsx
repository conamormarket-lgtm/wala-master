import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { scheduleKapiNotifications } from '../../../services/kapiNotifications';
import styles from './KapiPet.module.css';

const KapiPet = () => {
  const { user, userProfile, feedKapi } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);

  // Placeholders para las imágenes que luego proveerá el cliente
  const IMAGES = {
    happy: '/assets/kapi/kapi-happy.png',
    sad: '/assets/kapi/kapi-sad.png',
    hungry: '/assets/kapi/kapi-hungry.png'
  };

  useEffect(() => {
    if (userProfile) {
      scheduleKapiNotifications(userProfile);
    }
  }, [userProfile]);

  useEffect(() => {
    const handleOpenEvent = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-kapi-pet', handleOpenEvent);
    return () => window.removeEventListener('open-kapi-pet', handleOpenEvent);
  }, []);

  if (!user || !userProfile) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastClaim = userProfile.lastKapiClaimDate;
  const hasClaimedToday = lastClaim === todayStr;

  let kapiState = 'happy';
  if (!hasClaimedToday) {
    if (!lastClaim) {
      kapiState = 'hungry'; // Nunca reclamó
    } else {
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      const lastClaimDate = new Date(lastClaim);
      lastClaimDate.setHours(0,0,0,0);
      const diffTime = Math.abs(todayDate - lastClaimDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 1) {
        kapiState = 'hungry';
      }
    }
  }

  const handleFeed = async () => {
    if (hasClaimedToday || isFeeding) return;
    setIsFeeding(true);
    
    // Animación de comer local
    setTimeout(async () => {
      const res = await feedKapi();
      setIsFeeding(false);
      if (!res?.error) {
        // Lanzar animación de moneda global (para que se sume en el header visualmente)
        window.dispatchEvent(new CustomEvent('kapi-coins-animation-start', { detail: { amount: 1 } }));
      }
    }, 1500);
  };

  const handleToggle = () => setIsOpen(!isOpen);

  return (
    <>
      {!isOpen && (
        <div className={styles.fab} onClick={handleToggle} title="¡Tu Kapi Pet!">
          <div className={styles.fabIcon}>
            {kapiState === 'hungry' ? '🥺' : '😺'}
          </div>
          {!hasClaimedToday && <div className={styles.badge}>!</div>}
        </div>
      )}

      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
            
            <h2 className={styles.title}>Tu Mascota Kapi</h2>
            <p className={styles.subtitle}>
              Alimenta a Kapi todos los días para ganar Kapi Coins.
            </p>

            <div className={styles.petContainer}>
              <div className={`${styles.petImageWrapper} ${isFeeding ? styles.eating : ''}`}>
                {/* Fallback temporario con emoji si la imagen no carga, dado que no hay assets aún */}
                <div className={styles.emojiFallback}>
                   {kapiState === 'hungry' ? '😿' : (isFeeding ? '😻' : '😺')}
                </div>
                {/* <img src={IMAGES[kapiState]} alt={`Kapi ${kapiState}`} className={styles.petImage} style={{display: 'none'}} /> */}
              </div>
              
              <div className={styles.stats}>
                <span>Felicidad: {userProfile.kapiHappiness || 0}/100</span>
                <div className={styles.happinessBar}>
                  <div className={styles.happinessFill} style={{ width: `${Math.min(100, userProfile.kapiHappiness || 0)}%` }} />
                </div>
              </div>
            </div>

            <div className={styles.actionContainer}>
              {hasClaimedToday ? (
                <div className={styles.claimedText}>
                  ¡Kapi está lleno por hoy! Vuelve mañana.
                </div>
              ) : (
                <button 
                  className={`${styles.feedBtn} ${isFeeding ? styles.feedingBtn : ''}`}
                  onClick={handleFeed}
                  disabled={isFeeding}
                >
                  {isFeeding ? 'Alimentando...' : '🍖 Alimentar a Kapi (+1 Coin)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KapiPet;
