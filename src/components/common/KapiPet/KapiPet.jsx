import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../contexts/AuthContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { volarMonedasGanadas } from '../../../utils/animations';
import { scheduleKapiNotifications } from '../../../services/kapiNotifications';
import {
  limaTodayStr, felicidadKapiHoy, msHastaMananaLima, textoEspera,
} from '../../../utils/fechaLima';
import { useGlobalToast } from '../../../contexts/ToastContext';
import { diseno, disenoNum } from '../../../utils/modoDiseno';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Badge } from '../../ui';
import styles from './KapiPet.module.css';
import { T } from '../../../i18n/useTranslatedText';

// Marca del navegador (compatibilidad); la que manda es userProfile.kapiTutorialVisto.
const CLAVE_TUTORIAL = 'kapiTutorialCompleted';

const KapiPet = () => {
  const { user, userProfile, feedKapi, calentarKapi, activeWeeklyChallenge, updateUserProfile } = useAuth();
  const { addToast } = useGlobalToast();
  // En landing pages el header se oculta (LayoutContext). Ahí NO mostramos ni
  // auto-abrimos a Kapi: el login anónimo del checkout dispararía el modal encima
  // del pago y espantaría la venta.
  const layout = useLayoutContext();
  const onLandingPage = layout && layout.isHeaderVisible === false;
  // En el estudio de Crear tapaba el botón de compra en el celular.
  const enEstudioCrear = useLocation().pathname.startsWith('/crear/');
  const [isOpen, setIsOpen] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submittingEv, setSubmittingEv] = useState(false);

  // Los juegos diarios se reabren a medianoche de Lima.
  const faltaComida = textoEspera(msHastaMananaLima());

  // Lo que se le dice al usuario según cómo esté Kapi. Antes el subtítulo era
  // siempre el mismo ("Alimenta a Kapi todos los días..."), así que la carita
  // cambiaba y el texto no la acompañaba.
  // eslint-disable-next-line no-unused-vars
  const TEXTO_ESTADO = {
    happy: 'Kapi está feliz. Vuelve mañana por su comida.',
    hungry: 'Kapi tiene hambre. Dale de comer y te llevas una moneda.',
    sad: 'Kapi te echa de menos. Llevas días sin darle de comer.',
  };

  // Cada archivo se llama como la cara que tiene. Estuvieron intercambiados: el
  // que llora se llamaba 'hungry' y el de la carita alicaida 'sad', asi que un
  // solo dia sin comer sacaba lagrimas y llevar dias olvidado sacaba la cara
  // suave. Se renombraron para que el nombre no vuelva a mentir.
  // eslint-disable-next-line no-unused-vars
  const IMAGES = {
    // WebP a 400 px. Los PNG originales eran de 800 px y pesaban 638/598/545 KB
    // CADA UNO, y el boton flotante los pinta a 56 px en TODAS las paginas: eran
    // ~600 KB de descarga garantizada por visita para un icono de pulgar.
    happy: process.env.PUBLIC_URL + '/assets/kapi/kapi-happy.webp',
    hungry: process.env.PUBLIC_URL + '/assets/kapi/kapi-hungry.webp',
    sad: process.env.PUBLIC_URL + '/assets/kapi/kapi-sad.webp'
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

  // ── Tutorial de Kapi: se muestra UNA vez por CUENTA ────────────────────
  // Antes solo se recordaba en el navegador (localStorage): volvía a salir en
  // otro dispositivo, en la app, en incógnito, al borrar datos o al entrar por
  // wala.pe en vez de www.wala.pe. Ahora se guarda también en el perfil
  // (kapiTutorialVisto) y se marca apenas arranca el recorrido.
  const tutorialVisto = () => {
    if (userProfile?.kapiTutorialVisto) return true;
    try {
      return Boolean(localStorage.getItem(CLAVE_TUTORIAL));
    } catch {
      return false;
    }
  };
  const marcarTutorialVisto = () => {
    try {
      localStorage.setItem(CLAVE_TUTORIAL, 'true');
    } catch {
      /* sin storage: queda en el perfil */
    }
    if (user && !userProfile?.kapiTutorialVisto) updateUserProfile({ kapiTutorialVisto: true });
  };

  // Hook para disparar Onboarding Tutorial a usuarios nuevos
  useEffect(() => {
    if (onLandingPage) return; // no auto-abrir Kapi en landings/checkout
    if (!userProfile) return;
    let enNavegador = false;
    try {
      enNavegador = Boolean(localStorage.getItem(CLAVE_TUTORIAL));
    } catch {
      /* sin storage */
    }
    if (userProfile.kapiTutorialVisto) return;
    // Ya lo vio en ESTE navegador antes de que existiera el campo: se pasa a
    // su cuenta para que no le vuelva a salir en otro lado.
    if (enNavegador) {
      updateUserProfile({ kapiTutorialVisto: true });
      return;
    }
    // Abrir modal automáticamente si no ha completado el tutorial
    setIsOpen(true);
  }, [userProfile, onLandingPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) {
      if (!tutorialVisto()) {
        setTimeout(async () => {
          // driver.js (27 KB + su CSS) solo hace falta la PRIMERA vez que
          // alguien abre a Kapi, para el tour. KapiPet esta montado en todas
          // las paginas, asi que importarlo arriba metia la libreria en el
          // bundle de arranque de todo el mundo, tutorial visto o no.
          const [{ driver }] = await Promise.all([
            import('driver.js'),
            import('driver.js/dist/driver.css'),
          ]);
          const driverObj = driver({
            showProgress: true,
            animate: true,
            nextBtnText: 'Siguiente',
            prevBtnText: 'Atrás',
            doneBtnText: '¡Entendido!',
            steps: [
              { element: '#kapi-pet-container', popover: { title: 'Conoce a Kapi', description: '¡Esta es tu mascota virtual! Crecerá contigo mientras usas la app.', side: "top" } },
              { element: '#kapi-stats', popover: { title: 'Felicidad de Kapi', description: 'Kapi necesita atención. Si olvidas alimentarlo, se pondrá triste y su barra de felicidad bajará.', side: "bottom" } },
              { element: '#kapi-feed-btn', popover: { title: '¡A comer!', description: 'Aliméntalo todos los días aquí. A cambio, él te premiará con monedas que puedes canjear por recompensas reales.', side: "top" } }
            ],
            onDestroyed: () => marcarTutorialVisto(),
          });
          driverObj.drive();
          // Ya lo vio: aunque cierre el recorrido a la mitad no se repite.
          marcarTutorialVisto();
        }, 500); // 500ms para asegurar que el DOM cargó los IDs del modal
      }
    }
  }, [isOpen]);

  // Al abrir el panel con la comida pendiente se despierta el servidor: entre
  // que se abre y se pulsa "Alimentar" pasan uno o dos segundos, que es lo que
  // tarda en arrancar en frío. Va antes de los `return null` (orden de hooks).
  const comidaPendiente = Boolean(user) && userProfile?.lastKapiClaimDate !== limaTodayStr();
  useEffect(() => {
    if (isOpen && comidaPendiente) calentarKapi();
  }, [isOpen, comidaPendiente, calentarKapi]);

  // Escape cierra el panel, como el resto de modales de la app.
  //
  // OJO al sitio: este efecto va ANTES de los dos `return null` de abajo. La
  // primera vez lo colgué después y tumbó la web: con sesión el componente
  // ejecutaba un hook más que sin ella, y React tira el árbol entero cuando el
  // número de hooks cambia entre renders. Como el perfil llega asíncrono, el
  // salto ocurría en cada carga de un usuario logueado.
  useEffect(() => {
    if (!isOpen) return;
    const alPulsar = (e) => { if (e.key === 'Escape' && !isFeeding) setIsOpen(false); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [isOpen, isFeeding]);

  if (onLandingPage || enEstudioCrear) return null; // Kapi no aparece en landings (protege la conversión del checkout)
  // ?sesion=activa pinta a Kapi sin cuenta, para poder repasar el modal sin una
  // sesión delante. Inerte en producción, como todo modoDiseno: no concede nada,
  // el servidor sigue decidiendo si se puede alimentar.
  // Con ?kapi=feliz se simula ademas que ya comio hoy, que es el unico estado
  // en el que aparecen la insignia de "Hecho hoy" y la cuenta atras.
  const perfil = userProfile || (diseno('sesion') === 'activa'
    ? { lastKapiClaimDate: diseno('kapi') === 'feliz' ? limaTodayStr() : undefined }
    : null);
  if (!perfil) return null;

  // Mismo criterio de día que feedKapiSecure (hora de Lima).
  const todayStr = limaTodayStr();
  const lastClaim = perfil.lastKapiClaimDate;
  const hasClaimedToday = lastClaim === todayStr;

  // Ya no retornamos null aquí, para que la mascota siempre esté visible (feliz si ya comió)
  // if (hasClaimedToday) return null;

  // Felicidad REAL de hoy: el valor guardado solo se actualiza al alimentarlo, así
  // que aquí se le aplica el mismo decaimiento que usará el servidor. Si no, la
  // barra se quedaba clavada en 100/100 aunque llevaras semanas sin darle de comer.
  const felicidadReal = felicidadKapiHoy(perfil.kapiHappiness, lastClaim, todayStr);
  // Modo diseño (solo en local): ?felicidad=25&kapi=triste para verlo sin esperar.
  const felicidad = disenoNum('felicidad', 0, 100) ?? felicidadReal;

  let kapiState = 'happy';
  if (!hasClaimedToday) {
    // Triste si además lleva días olvidado; con hambre si solo falta la de hoy.
    kapiState = felicidad < 40 ? 'sad' : 'hungry';
  }
  const ESTADOS_DISENO = { feliz: 'happy', hambriento: 'hungry', triste: 'sad' };
  kapiState = ESTADOS_DISENO[diseno('kapi')] || kapiState;

  // Con el multiplicador de la ruleta ("doble al alimentar") da 2. Mismo
  // criterio que feedKapiSecure, para que la etiqueta no prometa 1 y caigan 2.
  const recompensaHoy = perfil.activeMultiplier === 'kapi_double_3d' &&
    perfil.multiplierExpiresAt && new Date(perfil.multiplierExpiresAt) > new Date() ? 2 : 1;

  const handleFeed = async () => {
    if (hasClaimedToday || isFeeding) return;
    setIsFeeding(true);
    // Se mide ya: al acreditarse, el botón se cambia por "¡Kapi está lleno!" y
    // las monedas no tendrían de dónde salir.
    const rectBoton = document.getElementById('kapi-feed-btn')?.getBoundingClientRect();

    // El servidor se llama YA, a la vez que la animación de comer. Antes se
    // esperaba 1,5 s fijos de animación y solo entonces se llamaba al servidor
    // (y luego se releía el perfil entero): las esperas se sumaban en serie.
    // Ahora la animación dura lo que tarde el servidor, con un mínimo para que
    // se vea.
    const [res] = await Promise.all([
      feedKapi(),
      new Promise((r) => setTimeout(r, 700)),
    ]);
    setIsFeeding(false);
    if (res?.error) {
      // callFn devuelve el error como string ya legible ("Ya alimentaste a
      // Kapi hoy."), no como objeto Error.
      addToast(res.error || 'No pudimos alimentar a Kapi. Inténtalo de nuevo.', 'error');
      return;
    }
    // Monedas volando al contador de la cabecera: las que acreditó el
    // servidor, no un 1 fijo.
    volarMonedasGanadas(
      rectBoton ? { getBoundingClientRect: () => rectBoton } : null,
      Number(res?.data?.reward) || 1,
    );
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

  // Mientras Kapi come no se cierra. La animación de comer, el toast de error y
  // las monedas que vuelan al header salen de DENTRO del modal: si desaparece a
  // mitad, el usuario pulsa, no ve nada y se queda sin saber si se le acreditó.
  // Son 1,5 s de animación más lo que tarde el servidor.
  const cerrarPanel = () => {
    if (isFeeding) return;
    setIsOpen(false);
  };

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
      {/* El boton se pinta SIEMPRE, tambien con el panel abierto (donde queda
          bajo la capa). Antes se desmontaba al abrir, y la burbuja rosada de
          paquetes caia 76px para ocupar su hueco y volvia a subir al cerrar:
          justo el salto que se veia como si desapareciera. */}
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

      {/* Se monta en <body>, como los modales de la Zona Arcade.
          Motivo: .App lleva isolation:isolate, asi que el z-index 9999 de la
          AdminBar solo compite DENTRO de .App. Un modal que viva ahi dentro
          nunca la tapa: quedaba nitida y clicable por encima del dialogo, y se
          podia pulsar "Activar Editor Visual" con la ventana abierta. Fuera de
          .App, la capa cubre todo. */}
      {createPortal(
      <AnimatePresence>
        {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cerrarPanel}
          role="presentation"
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Tu mascota Kapi"
          >
            {/* Se deshabilita mientras come, en vez de dejar un clic muerto:
                así se ve por qué no cierra. */}
            <button
              className={styles.closeBtn}
              onClick={cerrarPanel}
              disabled={isFeeding}
              aria-label="Cerrar"
            >
              ✕
            </button>
            
            <h2 className={styles.title}><T>Tu Mascota Kapi</T></h2>
            <p className={styles.subtitle}>
              <T>{TEXTO_ESTADO[kapiState]}</T>
            </p>

            <div className={styles.petContainer} id="kapi-pet-container">
              <div className={`${styles.petImageWrapper} ${isFeeding ? styles.eating : ''}`}>
                <img 
                  src={isFeeding ? IMAGES.happy : IMAGES[kapiState]} 
                  alt={`Kapi ${kapiState}`} 
                  className={styles.petImage} 
                />
              </div>

              {/* Estado y recompensa, en una fila propia debajo del retrato.
                  Montada sobre el círculo se comía la carita de Kapi. */}
              <div className={styles.petChips}>
                {hasClaimedToday
                  ? <Badge tone="success" variant="soft"><T>Hecho hoy</T></Badge>
                  : <Badge tone="warning" variant="soft" dot><T>Disponible hoy</T></Badge>}
                <span className={styles.recompensa}>
                  <span aria-hidden="true">🪙</span>{recompensaHoy === 2 ? <T>+2 monedas</T> : <T>+1 moneda</T>}
                </span>
              </div>
              
              <div className={styles.stats} id="kapi-stats">
                {/* Etiqueta y valor a los lados, como "Días reclamados 7/7"
                    en la tarjeta de la Ruleta. */}
                <div className={styles.statsFila}>
                  <span><T>Felicidad</T></span>
                  <span className={styles.statsValor}>{felicidad}/100</span>
                </div>
                <div className={styles.happinessBar}>
                  <div className={styles.happinessFill} style={{ width: `${felicidad}%` }} />
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
                      Recompensa: {activeWeeklyChallenge.rewardType === 'main' ? `${activeWeeklyChallenge.rewardCoins} monedas` : 'Doble monedas al alimentar'}
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
                <div>
                  <span className={styles.claimedText}>
                    <T>¡Kapi está lleno por hoy!</T>
                  </span>
                  {/* Cuánto falta de verdad, igual que en las tarjetas del hub:
                      "vuelve mañana" no dice nada a las once de la noche. */}
                  {faltaComida && (
                    <span className={styles.claimedEspera}>
                      <T>Podrás darle de comer en</T> {faltaComida}
                    </span>
                  )}
                </div>
              ) : (
                <button 
                  id="kapi-feed-btn"
                  className={`${styles.feedBtn} ${isFeeding ? styles.feedingBtn : ''}`}
                  onClick={handleFeed}
                  disabled={isFeeding}
                >
                  {isFeeding ? 'Alimentando...' : '🍖 Alimentar a Kapi'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </>
  );
};

export default KapiPet;
