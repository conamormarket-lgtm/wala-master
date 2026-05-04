import React, { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAuth } from '../../../contexts/AuthContext';
import { getDocument } from '../../../services/firebase/firestore';
import styles from './DailyReward.module.css';

const DailyReward = () => {
  const { user, userProfile, updateUserProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tapsLeft, setTapsLeft] = useState(10);
  const [isShaking, setIsShaking] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(1);
  const [isClaimed, setIsClaimed] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const hasClaimedToday = userProfile?.lastDailyReward === todayStr;

  const scheduleReminders = async (claimed) => {
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display !== 'granted') return;
      }

      await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });

      const notificationsConfigs = [
        { id: 1, hour: 6, title: "¡Tu Kapicoin te espera! 🪙", body: "Ven a reclamar tu Kapicoin el día de hoy." },
        { id: 2, hour: 13, title: "Recordatorio Diario ⏰", body: "¡No te olvides de reclamar tu Kapicoin del día de hoy antes que se haga tarde!" },
        { id: 3, hour: 22, title: "Última oportunidad 🏃‍♂️💨", body: "El día está por acabarse, ¡reclama tu Kapicoin ya y no pierdas la oportunidad de precios baratos!" }
      ];

      const now = new Date();
      const toSchedule = [];

      notificationsConfigs.forEach((conf) => {
        let fireDate = new Date(now);
        fireDate.setHours(conf.hour, 0, 0, 0);

        if (claimed) {
           fireDate.setDate(fireDate.getDate() + 1);
        } else {
           if (fireDate <= now) {
              fireDate.setDate(fireDate.getDate() + 1);
           }
        }

        toSchedule.push({
          id: conf.id,
          title: conf.title,
          body: conf.body,
          schedule: { at: fireDate, allowWhileIdle: true }
        });
      });

      await LocalNotifications.schedule({ notifications: toSchedule });
    } catch (e) {
      console.log("Notificaciones locales no disponibles o error:", e);
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      // Intentar obtener config de admin
      const { data } = await getDocument('app_settings', 'daily_reward');
      if (data && typeof data.amount === 'number') {
        setRewardAmount(data.amount);
      }
      setLoadingConfig(false);
    };

    if (user) {
      scheduleReminders(hasClaimedToday);
      if (!hasClaimedToday) {
        fetchConfig();
      } else {
        setLoadingConfig(false);
      }
    } else {
      setLoadingConfig(false);
    }
  }, [user, hasClaimedToday]);

  // Si no está autenticado, o ya lo reclamó, no mostramos nada
  if (!user || !userProfile || hasClaimedToday || loadingConfig) {
    return null;
  }

  const handleOpen = () => {
    setTapsLeft(10);
    setIsClaimed(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleTap = async () => {
    if (isClaimed) return;
    
    // Shake animation
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);

    const newTaps = tapsLeft - 1;
    setTapsLeft(newTaps);

    if (newTaps <= 0) {
      setIsClaimed(true);
      
      // Lanzar animación visual global (esto debe estar en App o Header normalmente)
      window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount: rewardAmount } }));

      // Actualizar perfil
      const currentMonedas = userProfile.monedas || 0;
      await updateUserProfile({
        monedas: currentMonedas + rewardAmount,
        lastDailyReward: todayStr
      });

      // Cerrar modal automáticamente después de mostrar el éxito por un ratito
      setTimeout(() => {
        setIsOpen(false);
      }, 2500);
    }
  };

  const progressPercentage = ((10 - tapsLeft) / 10) * 100;

  return (
    <>
      {!isOpen && (
        <div className={styles.dailyRewardFab} onClick={handleOpen} title="¡Tu Recompensa Diaria!">
          <svg viewBox="0 0 100 100" className={styles.fabIcon}>
            <path d="M20,60 Q20,30 50,30 Q80,30 80,60 Q80,80 65,90 Q50,95 35,90 Q20,80 20,60 Z" fill="#FFD700" />
            <circle cx="35" cy="55" r="4" fill="#6B4423" />
            <circle cx="65" cy="55" r="4" fill="#6B4423" />
            <path d="M45,70 Q50,75 55,70" stroke="#6B4423" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {isOpen && (
        <div className={styles.modalOverlay} onClick={isClaimed ? handleClose : undefined}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={handleClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <h2 className={styles.modalTitle}>¡Recompensa Diaria!</h2>
            <p className={styles.modalSubtitle}>
              ¡Toca la moneda mágica 10 veces para reclamar tu premio del día!
            </p>

            <div className={styles.gameArea}>
              {!isClaimed ? (
                <>
                  <svg 
                    viewBox="0 0 100 100" 
                    className={`${styles.targetItem} ${isShaking ? styles.shake : ''}`}
                    onClick={handleTap}
                  >
                    <path d="M20,60 Q20,30 50,30 Q80,30 80,60 Q80,80 65,90 Q50,95 35,90 Q20,80 20,60 Z" fill="#FFD700" />
                    <circle cx="35" cy="55" r="4" fill="#6B4423" />
                    <circle cx="65" cy="55" r="4" fill="#6B4423" />
                    <path d="M40,65 Q50,78 60,65" stroke="#6B4423" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                  
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar} style={{ width: `${progressPercentage}%` }}></div>
                  </div>
                  <div className={styles.tapCount}>{tapsLeft} toques restantes</div>
                </>
              ) : (
                <div className={styles.rewardText}>
                  ¡Felicidades! Has ganado:
                  <span className={styles.rewardValue}>+{rewardAmount} Kapicoin{rewardAmount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DailyReward;
