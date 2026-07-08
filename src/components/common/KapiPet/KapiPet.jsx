import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { showFlyingCoins } from '../../../utils/animations';
import { scheduleKapiNotifications } from '../../../services/kapiNotifications';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import styles from './KapiPet.module.css';

const KapiPet = () => {
  const { user, userProfile, feedKapi, activeWeeklyChallenge } = useAuth();
  // En landing pages el header se oculta (LayoutContext). Ahí NO mostramos ni
  // auto-abrimos a Kapi: el login anónimo del checkout dispararía el modal encima
  // del pago y espantaría la venta.
  const layout = useLayoutContext();
  const onLandingPage = layout && layout.isHeaderVisible === false;
  const [isOpen, setIsOpen] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submittingEv, setSubmittingEv] = useState(false);

  // Placeholders para las imágenes que luego proveerá el cliente
  // eslint-disable-next-line no-unused-vars
  const IMAGES = {
    happy: process.env.PUBLIC_URL + '/assets/kapi/kapi-happy.png',
    sad: process.env.PUBLIC_URL + '/assets/kapi/kapi_sad.png',
    hungry: process.env.PUBLIC_URL + '/assets/kapi/kapi-hungry.png'
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
    const handleChallengeCompleted = () => {
      // Usar alerta o animación CSS sencilla sin librerías de terceros
      console.log('¡Reto completado!');
      setIsOpen(true); // Abre Kapi para mostrar la celebración
    };

    window.addEventListener('open-kapi-pet', handleOpenEvent);
    window.addEventListener('weekly-challenge-completed', handleChallengeCompleted);
    return () => {
      window.removeEventListener('open-kapi-pet', handleOpenEvent);
      window.removeEventListener('weekly-challenge-completed', handleChallengeCompleted);
    };
  }, []);

  // Hook para reto de visita diaria (se dispara 1 vez al cargar Kapi si el reto está activo)
  useEffect(() => {
    if (activeWeeklyChallenge && activeWeeklyChallenge.actionType === 'daily_visit' && userProfile) {
      // Nota: Idealmente validaríamos que no se haya disparado hoy. 
      // Por ahora, usamos processChallengeEvent pero cuidado con recargas.
      // Para un tracker real de "5 días seguidos", se requerirá un campo en AuthContext.
      const _d1 = new Date();
      const today = `${_d1.getFullYear()}-${String(_d1.getMonth()+1).padStart(2, '0')}-${String(_d1.getDate()).padStart(2, '0')}`;
      if (userProfile.lastDailyVisitChallenge !== today) {
         // Firing hook would go here. For now it's just prepared.
         // feedKapi() is a good analog for daily tracking.
      }
    }
  }, [activeWeeklyChallenge, userProfile]);

  // Hook para disparar Onboarding Tutorial a usuarios nuevos
  useEffect(() => {
    if (onLandingPage) return; // no auto-abrir Kapi en landings/checkout
    if (userProfile) {
      const tutorialCompleted = localStorage.getItem('kapiTutorialCompleted');
      if (!tutorialCompleted) {
        // Abrir modal automáticamente si no ha completado el tutorial
        setIsOpen(true);
      }
    }
  }, [userProfile, onLandingPage]);

  useEffect(() => {
    if (isOpen) {
      const tutorialCompleted = localStorage.getItem('kapiTutorialCompleted');
      if (!tutorialCompleted) {
        setTimeout(() => {
          const driverObj = driver({
            showProgress: true,
            animate: true,
            nextBtnText: 'Siguiente',
            prevBtnText: 'Atrás',
            doneBtnText: '¡Entendido!',
            steps: [
              { element: '#kapi-pet-container', popover: { title: 'Conoce a Kapi', description: '¡Esta es tu mascota virtual! Crecerá contigo mientras usas la app.', side: "top" } },
              { element: '#kapi-stats', popover: { title: 'Felicidad de Kapi', description: 'Kapi necesita atención. Si olvidas alimentarlo, se pondrá triste y su barra de felicidad bajará.', side: "bottom" } },
              { element: '#kapi-feed-btn', popover: { title: '¡A comer!', description: 'Aliméntalo todos los días aquí. A cambio, él te premiará con KapiCoins que puedes canjear por recompensas reales.', side: "top" } }
            ],
            onDestroyed: () => {
              localStorage.setItem('kapiTutorialCompleted', 'true');
            }
          });
          driverObj.drive();
        }, 500); // 500ms para asegurar que el DOM cargó los IDs del modal
      }
    }
  }, [isOpen]);

  if (onLandingPage) return null; // Kapi no aparece en landings (protege la conversión del checkout)
  if (!user || !userProfile) return null;

  const _d2 = new Date();
  const todayStr = `${_d2.getFullYear()}-${String(_d2.getMonth()+1).padStart(2, '0')}-${String(_d2.getDate()).padStart(2, '0')}`;
  const lastClaim = userProfile.lastKapiClaimDate;
  const hasClaimedToday = lastClaim === todayStr;

  // Ya no retornamos null aquí, para que la mascota siempre esté visible (feliz si ya comió)
  // if (hasClaimedToday) return null;

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
        // Obtener posición del botón para la animación
        const feedBtn = document.getElementById('kapi-feed-btn');
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        if (feedBtn) {
          const rect = feedBtn.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top;
        }
        // Lanzar animación visual de monedas volando al header
        showFlyingCoins(x, y, 1);
        // También disparar el evento de kapi coins para el bounce del header
        window.dispatchEvent(new CustomEvent('kapi-coins-animation-start', { detail: { amount: 1 } }));
      }
    }, 1500);
  };

  const handleSubmitEvidence = async () => {
    if(!evidenceUrl) return;
    setSubmittingEv(true);
    try {
       const functions = getFunctions();
       const submitEvidence = httpsCallable(functions, 'submitChallengeEvidence');
       await submitEvidence({
         evidenceUrl,
         challengeId: activeWeeklyChallenge.challengeId,
         evidenceType: 'link'
       });
       alert('¡Evidencia enviada! Será revisada pronto.');
       setEvidenceUrl('');
    } catch(e) {
       alert('Error al enviar: ' + e.message);
    }
    setSubmittingEv(false);
  };

  const handleToggle = () => setIsOpen(!isOpen);

  // Determinar progreso del reto actual
  const progressData = userProfile?.weeklyChallengeProgress || {};
  const isChallengeCompleted = progressData.challengeId === activeWeeklyChallenge?.challengeId && progressData.completed;
  const currentProgress = progressData.challengeId === activeWeeklyChallenge?.challengeId ? (progressData.progress || 0) : 0;
  // eslint-disable-next-line no-unused-vars
  const isPendingApproval = userProfile?.challengeEvidencesApproved?.includes(activeWeeklyChallenge?.challengeId);
  // Wait, actually challengeEvidencesApproved means it IS approved.
  const isManualApproved = userProfile?.challengeEvidencesApproved?.includes(activeWeeklyChallenge?.challengeId);
  const displayCompleted = isChallengeCompleted || isManualApproved;

  return (
    <>
      {!isOpen && (
        <div className={styles.fab} onClick={handleToggle} title="¡Tu Kapi Pet!">
          <div className={styles.fabIcon}>
            <img 
              src={IMAGES[kapiState]} 
              alt="Kapi Pet" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
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

            <div className={styles.petContainer} id="kapi-pet-container">
              <div className={`${styles.petImageWrapper} ${isFeeding ? styles.eating : ''}`}>
                <img 
                  src={isFeeding ? IMAGES.happy : IMAGES[kapiState]} 
                  alt={`Kapi ${kapiState}`} 
                  className={styles.petImage} 
                />
              </div>
              
              <div className={styles.stats} id="kapi-stats">
                <span>Felicidad: {userProfile.kapiHappiness || 0}/100</span>
                <div className={styles.happinessBar}>
                  <div className={styles.happinessFill} style={{ width: `${Math.min(100, userProfile.kapiHappiness || 0)}%` }} />
                </div>
              </div>
            </div>

            {/* RETO SEMANAL BANNER */}
            {activeWeeklyChallenge && (
              <div className={styles.challengeCard}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🎯</span>
                  <div style={{flex: 1}}>
                    <h4 className={styles.challengeTitle}>Reto Semanal: {activeWeeklyChallenge.title}</h4>
                    <span className={styles.challengeReward}>
                      Recompensa: {activeWeeklyChallenge.rewardType === 'main' ? `${activeWeeklyChallenge.rewardCoins} WalaCoins` : 'Doble KapiCoins'}
                    </span>
                  </div>
                </div>
                
                <p className={styles.challengeDesc}>{activeWeeklyChallenge.description}</p>
                
                {displayCompleted ? (
                   <div className={styles.challengeCompletedBox}>
                     ✅ ¡Reto completado! Recompensa entregada.
                   </div>
                ) : (
                   <>
                     <div className={styles.challengeProgress}>
                       <span>{currentProgress} / {activeWeeklyChallenge.goal}</span>
                       <div className={styles.progressBar}>
                         <div className={styles.progressFill} style={{width: `${Math.min(100, (currentProgress/activeWeeklyChallenge.goal)*100)}%`}}></div>
                       </div>
                     </div>
                     {activeWeeklyChallenge.actionType?.startsWith('manual_') && (
                       <div className={styles.evidenceBox}>
                         <input 
                           type="text" 
                           placeholder="Pega el link de tu evidencia (foto/story)" 
                           value={evidenceUrl} 
                           onChange={e => setEvidenceUrl(e.target.value)} 
                           className={styles.evidenceInput}
                         />
                         <button onClick={handleSubmitEvidence} disabled={submittingEv || !evidenceUrl} className={styles.evidenceBtn}>
                           {submittingEv ? 'Enviando...' : 'Enviar Evidencia'}
                         </button>
                       </div>
                     )}
                   </>
                )}
              </div>
            )}

            <div className={styles.actionContainer}>
              {hasClaimedToday ? (
                <div className={styles.claimedText}>
                  ¡Kapi está lleno por hoy! Vuelve mañana.
                </div>
              ) : (
                <button 
                  id="kapi-feed-btn"
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
