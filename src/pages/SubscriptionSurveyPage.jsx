import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import { Gift, UserCircle, Users, CheckCircle, Heart, UserPlus, Plus, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import { getSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../services/encuestaConfig';
import { registrarConversionPopup } from '../services/popups';
import { showFlyingCoins, volarMonedasGanadas } from '../utils/animations';
import { useGiftCatalog } from '../hooks/useGiftCatalog';
import { PRESUPUESTOS } from '../utils/giftRecommender.mjs';
import { PLACEHOLDER_IMG } from '../constants/placeholder';
import styles from './SubscriptionSurveyPage.module.css';
import FechaEventoInput from '../components/common/FechaEventoInput/FechaEventoInput';
import { T } from '../i18n/useTranslatedText';
import Moneda from '../components/common/Moneda';

const EVENT_TYPES = [
  { id: 'cumpleanos', label: 'Cumpleaños', needsDate: true },
  { id: 'aniversario', label: 'Aniversario', needsDate: true },
  { id: 'otro', label: 'Fecha Especial', needsDate: true }
];

const ROLES_MAP = {
  hijos: { label: 'Hijos', icon: <UserPlus size={32} />, singular: 'Hijo/a' },
  padres: { label: 'Padres', icon: <Users size={32} />, singular: 'Padre/Madre' },
  hermanos: { label: 'Hermanos', icon: <Users size={32} />, singular: 'Hermano/a' },
  sobrinos: { label: 'Sobrinos', icon: <Users size={32} />, singular: 'Sobrino/a' },
  primos: { label: 'Primos', icon: <Users size={32} />, singular: 'Primo/a' },
  amigos: { label: 'Amigos', icon: <UserPlus size={32} />, singular: 'Amigo/a' },
  otros: { label: 'Otros', icon: <UserCircle size={32} />, singular: 'Otra persona' }
};

const SubscriptionSurveyPage = () => {
  const { user, userProfile, updateUserProfile, loading: authLoading, grantSurveyReward, claimDatesReward } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState(DEFAULT_SURVEY_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);

  // Flujo Principal
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [animationDir, setAnimationDir] = useState('Right');

  const [basicAnswers, setBasicAnswers] = useState({});

  // Cumpleaños PROPIO del usuario (no de terceros). Opcional.
  // Se precarga si el perfil ya lo tiene para que pueda confirmarlo/editarlo.
  const [ownBirthDate, setOwnBirthDate] = useState('');

  // Selección de Roles
  const [selectedRoles, setSelectedRoles] = useState({
    pareja: false,
    hijos: false,
    padres: false,
    hermanos: false,
    sobrinos: false,
    primos: false,
    amigos: false,
    otros: false
  });

  // Bucle de Roles (Hub and Spoke)
  const [rolesList, setRolesList] = useState([]);
  const [currentRoleIndex, setCurrentRoleIndex] = useState(0);

  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [tempRecipient, setTempRecipient] = useState(null);

  const [finalRecipients, setFinalRecipients] = useState([]);

  // Buscador de regalos: ideas en la pantalla final y sugerencias (etiquetas,
  // personajes, colecciones del catálogo) al escribir gustos de cada persona.
  const { recomendar, sugerenciasCampo } = useGiftCatalog();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await getSurveyConfig();
      if (data) setConfig({ ...DEFAULT_SURVEY_CONFIG, ...data });
      setConfigLoading(false);
    };
    fetchConfig();
  }, []);

  // Precarga el cumpleaños propio si ya existe en el perfil.
  useEffect(() => {
    if (userProfile?.birthDate) setOwnBirthDate(userProfile.birthDate);
  }, [userProfile?.birthDate]);

  // ── Precarga de destinatarios existentes al re-tomar la encuesta ─────────────
  // PROBLEMA: al re-tomar la encuesta, finalRecipients arrancaba vacío y el guardado
  // SOBREESCRIBÍA el array giftRecipients del perfil (se perdían los previos).
  // FIX: precargamos finalRecipients desde userProfile.giftRecipients (mismo shape
  // interno: id/roleKey/roleDisplay/name/gender/events/…), normalizando defaults
  // para poder EDITAR sobre lo existente. Se siembra una sola vez (cuando aún no
  // hay nada cargado) para no pisar lo que el usuario edite en esta sesión.
  const recipientsSeededRef = React.useRef(false);
  useEffect(() => {
    if (recipientsSeededRef.current) return;
    const existentes = userProfile?.giftRecipients;
    if (!Array.isArray(existentes) || existentes.length === 0) return;
    recipientsSeededRef.current = true;
    const mapped = existentes.map((r) => ({
      // Garantiza un id estable para el matching/edición (genera uno si falta).
      id: r?.id || Math.random().toString(36).substring(2, 9),
      roleKey: r?.roleKey || 'otros',
      roleDisplay: r?.roleDisplay || ROLES_MAP[r?.roleKey]?.singular || 'Otra persona',
      name: r?.name || '',
      gender: r?.gender || '',
      events: Array.isArray(r?.events) && r.events.length > 0
        ? r.events.map((ev) => ({
            id: ev?.id || Math.random().toString(36).substring(2, 9),
            type: ev?.type || 'Cumpleaños',
            date: ev?.date || '',
            ...(ev?.customName != null && { customName: ev.customName }),
          }))
        : [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }],
      selectedCategories: Array.isArray(r?.selectedCategories) ? r.selectedCategories : [],
      categoryAnswers: r?.categoryAnswers || {},
      familySet: r?.familySet ?? false,
      familyAnswers: r?.familyAnswers || { q1: '', q2: '', q3: '' },
      budget: r?.budget || '',
    }));
    setFinalRecipients(mapped);
  }, [userProfile?.giftRecipients]);

  const handleSkip = async () => {
    try {
      await updateUserProfile({ lastSurveyPromptedAt: Date.now() });
    } catch (e) {
      console.error('Error saving skip timestamp:', e);
    }
    navigate('/', { replace: true });
  };

  const validateFields = (fieldsArray, answersObject) => {
    for (let field of fieldsArray) {
      if (field.required && !answersObject[field.id]) {
        alert(`Por favor completa el campo: ${field.label}`);
        return false;
      }
    }
    return true;
  };

  const createBlankRecipient = (roleKey, displayRole) => {
    return {
      id: Math.random().toString(36).substring(2, 9),
      roleKey,
      roleDisplay: displayRole,
      name: '',
      gender: '',
      events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }],
      selectedCategories: [],
      categoryAnswers: {},
      familySet: false,
      familyAnswers: { q1: '', q2: '', q3: '' },
      budget: '',
    };
  };

  const setupParejaIfNeeded = (recipientsList, currentRoles, index) => {
    if (currentRoles[index] === 'pareja') {
      const hasPareja = recipientsList.some(r => r.roleKey === 'pareja');
      if (!hasPareja) {
        setFinalRecipients(prev => [...prev, createBlankRecipient('pareja', 'Pareja')]);
      }
    }
  };

  const goToNextStep = () => {
    if (currentStep === 1 && !validateFields(config.basicDataPanel.fields, basicAnswers)) return;

    if (currentStep === 2) {
      const selectedKeys = Object.keys(ROLES_MAP).filter(key => selectedRoles[key]);
      if (selectedRoles.pareja) selectedKeys.unshift('pareja');

      if (selectedKeys.length === 0) {
        return alert('Por favor, selecciona al menos un rol o dale a Atrás/Omitir si no deseas regalar a nadie.');
      }

      setRolesList(selectedKeys);
      setCurrentRoleIndex(0);
      setIsEditingRecipient(false);
      setupParejaIfNeeded(finalRecipients, selectedKeys, 0);
    }

    setAnimationDir('Right');
    setCurrentStep(prev => prev + 1);
  };

  const goBack = () => {
    setAnimationDir('Left');
    setCurrentStep(prev => prev - 1);
  };

  const isRecipientComplete = (rec) => {
    if (!rec.name || rec.name.trim() === '') return false;
    if (!rec.gender || rec.gender.trim() === '') return false;

    for (const ev of rec.events) {
      // Fallback al tipo 'otro' (id) si el label no coincide; evita undefined.
      const evTypeConfig = EVENT_TYPES.find(e => e.label === ev.type) || EVENT_TYPES.find(e => e.id === 'otro');
      if (evTypeConfig.needsDate && (!ev.date || ev.date.trim() === '')) {
        return false;
      }
    }

    return true;
  };

  const goToNextRoleGroup = () => {
    const currentRoleKey = rolesList[currentRoleIndex];
    const roleRecipients = finalRecipients.filter(r => r.roleKey === currentRoleKey);

    const hasIncompletes = roleRecipients.some(r => !isRecipientComplete(r));
    if (hasIncompletes) {
       return alert('Por favor completa todos los datos obligatorios (Nombre y Género) de todas las tarjetas antes de continuar.');
    }

    if (roleRecipients.length === 0 && currentRoleKey !== 'pareja') {
      const confirmSkip = window.confirm('No has agregado a nadie en este grupo. ¿Deseas continuar de todos modos?');
      if (!confirmSkip) return;
    }

    const nextIdx = currentRoleIndex + 1;
    if (nextIdx < rolesList.length) {
      setAnimationDir('Right');
      setCurrentRoleIndex(nextIdx);
      setIsEditingRecipient(false);
      setupParejaIfNeeded(finalRecipients, rolesList, nextIdx);
    } else {
      handleFinalSave();
    }
  };

  const handleAddNewCard = () => {
    const roleKey = rolesList[currentRoleIndex];
    const roleDisplay = ROLES_MAP[roleKey].singular;
    const newRecipient = createBlankRecipient(roleKey, roleDisplay);
    setFinalRecipients(prev => [...prev, newRecipient]);
  };

  const startEditingCard = (recipient) => {
    setTempRecipient(JSON.parse(JSON.stringify(recipient)));
    setAnimationDir('Right');
    setIsEditingRecipient(true);
  };

  const handleTempChange = (field, value) => {
    setTempRecipient(prev => ({ ...prev, [field]: value }));
  };

  const addEvent = () => {
    setTempRecipient(prev => ({
      ...prev,
      events: [...prev.events, { id: Math.random().toString(36).substring(2, 9), type: 'Fecha Especial', date: '', customName: '' }]
    }));
  };

  const updateEvent = (index, field, value) => {
    setTempRecipient(prev => {
      const newEvents = [...prev.events];
      // Copia el objeto evento antes de modificarlo (inmutabilidad: no mutar prev).
      const updatedEvent = { ...newEvents[index], [field]: value };

      if (field === 'type') {
        const evTypeConfig = EVENT_TYPES.find(e => e.label === value) || EVENT_TYPES.find(e => e.id === 'otro');
        if (evTypeConfig && !evTypeConfig.needsDate) {
          updatedEvent.date = '';
        }
      }
      newEvents[index] = updatedEvent;
      return { ...prev, events: newEvents };
    });
  };

  const removeEvent = (index) => {
    setTempRecipient(prev => {
      const newEvents = [...prev.events];
      newEvents.splice(index, 1);
      return { ...prev, events: newEvents };
    });
  };

  const saveTempRecipient = () => {
    if (!tempRecipient.name || tempRecipient.name.trim() === '') {
       return alert('El nombre es obligatorio.');
    }
    if (!tempRecipient.gender || tempRecipient.gender.trim() === '') {
       return alert('El género es obligatorio.');
    }

    for (const ev of tempRecipient.events) {
      const evTypeConfig = EVENT_TYPES.find(e => e.label === ev.type) || EVENT_TYPES.find(e => e.id === 'otro');
      if (evTypeConfig.needsDate && (!ev.date || ev.date.trim() === '')) {
        return alert(`La fecha es obligatoria para el evento: ${ev.type}.`);
      }
      if (ev.type === 'Fecha Especial' && (!ev.customName || ev.customName.trim() === '')) {
        return alert('Por favor, indica qué se celebra en la Fecha Especial.');
      }
    }

    setFinalRecipients(prev => {
      const copy = [...prev];
      const existingIdx = copy.findIndex(r => r.id === tempRecipient.id);
      if (existingIdx >= 0) {
        copy[existingIdx] = tempRecipient;
      }
      return copy;
    });

    setAnimationDir('Left');
    setIsEditingRecipient(false);
  };

  const cancelTempRecipient = () => {
    setAnimationDir('Left');
    setIsEditingRecipient(false);
  };

  const handleFinalSave = async () => {
    // Guard: sin perfil cargado no podemos guardar de forma segura (evita TypeError
    // al leer userProfile.giftRecipients). El botón vuelve a habilitarse.
    if (!userProfile) {
      alert('Tu perfil aún se está cargando. Inténtalo de nuevo en unos segundos.');
      return;
    }
    setSaving(true);
    try {
      const validRecipients = finalRecipients.filter(r => isRecipientComplete(r));

      // ── FUSIÓN con los destinatarios previos (no reemplazar el array entero) ──
      // Aunque ahora precargamos finalRecipients, fusionamos por id contra el perfil
      // como red de seguridad: conservamos los previos que NO estén ya en validRecipients
      // (p.ej. uno que quedó incompleto en esta sesión no debería borrarse del perfil).
      const previos = Array.isArray(userProfile?.giftRecipients) ? userProfile.giftRecipients : [];
      const idsValidos = new Set(validRecipients.map(r => r?.id).filter(Boolean));
      const previosNoTocados = previos.filter(r => r?.id && !idsValidos.has(r.id));
      const recipientsAGuardar = [...validRecipients, ...previosNoTocados];

      // Cumpleaños propio: solo se incluye si hay valor, para NO sobrescribir
      // con vacío un birthDate ya existente en el perfil.
      const profileUpdates = {
        surveyBasicData: basicAnswers,
        giftRoles: selectedRoles,
        // Array FUSIONADO: válidos de esta sesión + previos del perfil no tocados.
        giftRecipients: recipientsAGuardar,
        hasCompletedSurvey: true
      };
      if (ownBirthDate) {
        profileUpdates.birthDate = ownBirthDate;
      }

      const { error: saveError } = await updateUserProfile(profileUpdates);
      if (saveError) throw new Error(saveError);
      // Si llegó desde un popup de campaña, cuenta como conversión de ese popup.
      registrarConversionPopup('encuesta', { uid: user?.uid || null, email: user?.email || null });

      // H-06: las monedas las calcula y acredita el SERVIDOR. Bono fijo por
      // completar la encuesta (una vez) + 5 por cada fecha nueva (con tope).
      // La animación solo sale con lo que el servidor de verdad pagó.
      const [encuesta, fechas] = await Promise.all([grantSurveyReward(), claimDatesReward()]);
      const coinsEarned = (encuesta.error ? 0 : encuesta.data?.reward || 0)
        + (fechas.error ? 0 : fechas.data?.reward || 0);
      if (coinsEarned > 0) volarMonedasGanadas(null, coinsEarned);

      setAnimationDir('Right');
      setCurrentStep(4);
    } catch (err) {
      alert('Hubo un error al guardar tus datos.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || configLoading) {
    return <div className={styles.surveyLayout}><p className={styles.cargando}><T>Cargando...</T></p></div>;
  }

  let progressPercent = 0;
  if (currentStep <= 2) {
    progressPercent = (currentStep / 4) * 100;
  } else if (currentStep === 3) {
    const subProgress = (currentRoleIndex / rolesList.length) * (100 / 4);
    progressPercent = (3 / 4) * 100 + subProgress;
  } else {
    progressPercent = 100;
  }

  const animationKey = currentStep === 3 ? `${rolesList[currentRoleIndex]}-${isEditingRecipient ? 'edit' : 'hub'}` : `main-${currentStep}`;
  const animationClass = animationDir === 'Right' ? styles.animateSlideInRight : styles.animateSlideInLeft;

  // Paso visible para el cliente (1 a 4). El 0 es la portada.
  const pasoVisible = Math.min(Math.max(currentStep, 1), 4);

  const currentRoleObj = rolesList[currentRoleIndex] === 'pareja'
    ? { label: 'Pareja', icon: <Heart size={32} />, singular: 'Pareja' }
    : ROLES_MAP[rolesList[currentRoleIndex]];

  return (
    <div className={styles.surveyLayout} style={{ '--survey-primary': config.design?.primaryColor || '#8b5cf6' }}>
      <div className={styles.centerColumn}>

        {currentStep > 0 && (
          <div className={styles.progreso}>
            <span className={styles.progresoTexto}>
              {currentStep >= 4 ? '¡Listo!' : `Paso ${pasoVisible} de 3`}
            </span>
            <div className={styles.progressBarContainer} role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        )}

        <div key={animationKey} className={`${styles.card} ${animationClass}`}>

          {currentStep === 0 && (
            <>
              <div className={styles.headerIcon}><Gift size={30} /></div>
              <h1 className={styles.title}>{config.introPanel.title}</h1>
              <h2 className={styles.subtitle}>{config.introPanel.subtitle}</h2>

              <div className={styles.premioBanner}>
                <Moneda size={26} className={styles.premioIcono} style={{ marginInlineEnd: 0 }} />
                <span>
                  <strong>Gana 15 monedas</strong> al terminar y <strong>5 más</strong> por cada fecha
                  importante que registres (hasta 50). Úsalas como descuento en tus compras.
                </span>
              </div>

              <p className={styles.description}>
                Completa esta encuesta para recibir recomendaciones y regalos exclusivos. Es muy rápido.
              </p>
              <div className={`${styles.actions} ${styles.actionsCentro}`}>
                <button type="button" onClick={handleSkip} className={styles.skipBtn}>{config.introPanel.skipButtonText}</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>{config.introPanel.continueButtonText}</button>
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <div className={styles.headerIcon}><UserCircle size={30} /></div>
              <h1 className={styles.title}>{config.basicDataPanel.title}</h1>
              <h2 className={styles.subtitle}>{config.basicDataPanel.subtitle}</h2>
              <div className={styles.form}>
                {config.basicDataPanel.fields.map(f => (
                  <div key={f.id} className={styles.fieldGroup}>
                    <label>{f.label} {f.required && '*'}</label>
                    {f.type === 'text' && <input type="text" className={styles.input} value={basicAnswers[f.id] || ''} onChange={e => setBasicAnswers(p => ({...p, [f.id]: e.target.value}))} required={f.required} />}
                    {f.type === 'select' && (
                      <select className={styles.input} value={basicAnswers[f.id] || ''} onChange={e => setBasicAnswers(p => ({...p, [f.id]: e.target.value}))} required={f.required}>
                        <option value="">Seleccionar...</option>
                        {f.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                {/* Cumpleaños PROPIO del usuario (opcional). No bloquea el avance. */}
                <div className={styles.fieldGroup}>
                  <label><T>Tu cumpleaños 🎂</T></label>
                  <input
                    type="date"
                    className={styles.input}
                    value={ownBirthDate}
                    onChange={e => setOwnBirthDate(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn}><T>Atrás</T></button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}><T>Continuar</T></button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className={styles.headerIcon}><Users size={30} /></div>
              <h1 className={styles.title}><T>¿A quiénes sueles regalar?</T></h1>
              <p className={styles.description}><T>Selecciona todos los perfiles a los que sueles hacer regalos (puedes elegir varios).</T></p>

              <div className={styles.groupsContainer}>
                <button
                  className={`${styles.groupCard} ${selectedRoles.pareja ? styles.groupCardSelected : ''}`}
                  onClick={() => setSelectedRoles(p => ({...p, pareja: !p.pareja}))}
                >
                  <Heart size={26} /><h3>Pareja</h3>
                </button>
                {Object.keys(ROLES_MAP).map(roleKey => (
                  <button
                    key={roleKey}
                    className={`${styles.groupCard} ${selectedRoles[roleKey] ? styles.groupCardSelected : ''}`}
                    onClick={() => setSelectedRoles(p => ({...p, [roleKey]: !p[roleKey]}))}
                  >
                    {ROLES_MAP[roleKey].icon}<h3>{ROLES_MAP[roleKey].label}</h3>
                  </button>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn}><T>Atrás</T></button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}><T>Continuar</T></button>
              </div>
            </>
          )}

          {currentStep === 3 && currentRoleObj && (
            <>
              {!isEditingRecipient ? (
                <>
                  <div className={styles.headerIcon}>{currentRoleObj.icon}</div>
                  <h1 className={styles.title}>{rolesList[currentRoleIndex] === 'pareja' ? 'Tu Pareja' : `Tus ${currentRoleObj.label}`}</h1>
                  <p className={styles.description}><T>Completa los datos de estas personas para poder guardarlas.</T></p>

                  <div className={styles.form}>
                    <div className={styles.recipientsList}>
                      {finalRecipients.filter(r => r.roleKey === rolesList[currentRoleIndex]).map((rec, idx) => {
                        const isDone = isRecipientComplete(rec);
                        return (
                          <div key={rec.id} className={`${styles.recipientCard} ${isDone ? styles.cardComplete : styles.cardIncomplete}`} onClick={() => startEditingCard(rec)}>
                            <div className={styles.recipientInfo}>
                              <h3>{rec.name || `${rec.roleDisplay} (Sin Nombre)`}</h3>
                              {isDone ? (
                                <p className={styles.estadoOk}><CheckCircle size={14} /> Perfil completo</p>
                              ) : (
                                <p className={styles.estadoPendiente}><AlertCircle size={14} /> Faltan datos</p>
                              )}
                            </div>
                            <button type="button" className={isDone ? styles.hubEditBtn : styles.hubCompleteBtn} onClick={(e) => { e.stopPropagation(); startEditingCard(rec); }}>
                              {isDone ? 'Editar' : 'Completar Perfil'}
                            </button>
                            {rolesList[currentRoleIndex] !== 'pareja' && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setFinalRecipients(prev => prev.filter(p => p.id !== rec.id)); }} className={styles.removeBtn} aria-label="Quitar persona">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {rolesList[currentRoleIndex] !== 'pareja' && (
                      <button type="button" onClick={handleAddNewCard} className={styles.addRecipientBtn}>
                        <Plus size={20} /> Añadir {currentRoleObj.singular}
                      </button>
                    )}
                  </div>

                  <div className={styles.actions}>
                    {currentRoleIndex === 0 ? (
                      <button type="button" onClick={() => setCurrentStep(2)} className={styles.skipBtn}><T>Atrás</T></button>
                    ) : (
                      <button type="button" onClick={() => {
                        setAnimationDir('Left');
                        setCurrentRoleIndex(prev => prev - 1);
                        setIsEditingRecipient(false);
                      }} className={styles.skipBtn}>Grupo Anterior</button>
                    )}
                    <button type="button" onClick={goToNextRoleGroup} className={styles.saveBtn} disabled={saving}>
                      {currentRoleIndex + 1 >= rolesList.length ? (saving ? 'Guardando...' : 'Terminar Encuesta') : 'Siguiente Grupo'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.subFlowHeader}>
                    <button type="button" className={styles.backLinkBtn} onClick={cancelTempRecipient}>
                      <ArrowLeft size={16} /> Volver sin guardar
                    </button>
                    <h3>Datos de {tempRecipient.roleDisplay}</h3>
                  </div>

                  <div className={styles.form}>
                    <div className={styles.formRow}>
                      <div className={`${styles.fieldGroup} ${styles.fieldGrande}`}>
                        <label><T>Nombre de la persona *</T></label>
                        <input type="text" className={styles.input} placeholder="Ej. Carlos" value={tempRecipient.name} onChange={e => handleTempChange('name', e.target.value)} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label><T>Género *</T></label>
                        <select className={styles.input} value={tempRecipient.gender || ''} onChange={e => handleTempChange('gender', e.target.value)} required>
                          <option value="">Seleccionar...</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.breakdownSection}>
                      <h3 className={styles.breakdownTitle}>Fechas importantes</h3>
                      <p className={styles.breakdownAyuda}>Ganas 5 monedas por cada fecha nueva.</p>

                      {tempRecipient.events.map((event, eventIdx) => {
                        const evTypeConfig = EVENT_TYPES.find(e => e.label === event.type) || EVENT_TYPES.find(e => e.id === 'otro');

                        return (
                          <div key={event.id} className={styles.eventRow}>
                            <div className={styles.eventRowMain}>

                              {eventIdx === 0 ? (
                                <div className={styles.eventLabel}>
                                  Cumpleaños *
                                </div>
                              ) : (
                                <select
                                  className={styles.input}
                                  value={event.type}
                                  onChange={e => updateEvent(eventIdx, 'type', e.target.value)}
                                >
                                  {EVENT_TYPES.filter(et => et.id !== 'cumpleanos').map(et => (
                                    <option key={et.id} value={et.label}>{et.label}</option>
                                  ))}
                                </select>
                              )}

                              {event.type === 'Fecha Especial' && eventIdx > 0 && (
                                <input
                                  type="text"
                                  className={styles.input}
                                  placeholder="¿Qué se celebra? (Ej. Bautizo, Graduación)"
                                  value={event.customName || ''}
                                  onChange={e => updateEvent(eventIdx, 'customName', e.target.value)}
                                  required={true}
                                />
                              )}

                              {evTypeConfig.needsDate && (
                                // Día y mes; el año es opcional (ver utils/fechaEvento.mjs).
                                <FechaEventoInput
                                  key={event.id || eventIdx}
                                  id={`encuesta-evento-${event.id || eventIdx}`}
                                  value={event.date}
                                  onChange={(iso) => updateEvent(eventIdx, 'date', iso)}
                                  inputClassName={styles.input}
                                  etiquetaAnio={eventIdx === 0 ? 'Año en que nació (opcional)' : 'Año (opcional)'}
                                />
                              )}
                            </div>

                            {eventIdx > 0 && (
                              <button type="button" onClick={() => removeEvent(eventIdx)} className={styles.removeBtn} aria-label="Quitar fecha">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <button type="button" onClick={addEvent} className={styles.addBtn}>
                        <Plus size={18} /> Agregar otra fecha importante
                      </button>
                    </div>

                    <div className={styles.breakdownSection}>
                      <h3 className={styles.breakdownTitle}>¿Cuánto sueles gastar en su regalo?</h3>
                      <p className={styles.breakdownAyuda}>Opcional. Así te recomendamos regalos que entren en tu presupuesto.</p>
                      <div className={styles.pillsContainer}>
                        {PRESUPUESTOS.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className={`${styles.pillBtn} ${tempRecipient.budget === r.id ? styles.pillSelected : ''}`}
                            aria-pressed={tempRecipient.budget === r.id}
                            onClick={() => handleTempChange('budget', tempRecipient.budget === r.id ? '' : r.id)}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* CONJUNTO FAMILIA (Hardcoded con lógica de género) */}
                    <div className={styles.breakdownSection}>
                      <button
                        type="button"
                        className={`${styles.conjuntoBtn} ${tempRecipient.familySet ? styles.conjuntoBtnActive : ''}`}
                        onClick={() => handleTempChange('familySet', !tempRecipient.familySet)}
                        aria-pressed={!!tempRecipient.familySet}
                      >
                        <span className={styles.conjuntoNombre}>Conjunto Familia</span>
                        <div className={styles.toggleIndicator}>
                          <div className={styles.toggleCircle}></div>
                        </div>
                      </button>

                      {tempRecipient.familySet && (
                        <div className={styles.pillsContainer}>
                          <button
                            type="button"
                            className={`${styles.pillBtn} ${tempRecipient.familyAnswers?.q1 ? styles.pillSelected : ''}`}
                            onClick={() => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q1: !tempRecipient.familyAnswers?.q1 })}
                          >
                            Es para {tempRecipient.gender === 'Masculino' ? 'él' : tempRecipient.gender === 'Femenino' ? 'ella' : 'él o ella'}
                          </button>

                          <button
                            type="button"
                            className={`${styles.pillBtn} ${tempRecipient.familyAnswers?.q2 ? styles.pillSelected : ''}`}
                            onClick={() => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q2: !tempRecipient.familyAnswers?.q2 })}
                          >
                            Es para ambos
                          </button>

                          <button
                            type="button"
                            className={`${styles.pillBtn} ${tempRecipient.familyAnswers?.q3 ? styles.pillSelected : ''}`}
                            onClick={() => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q3: !tempRecipient.familyAnswers?.q3 })}
                          >
                            Es para más personas
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CONJUNTOS DINÁMICOS DE FIREBASE */}
                    {config.brandsPanel?.categories?.map(cat => {
                      const isCatSelected = tempRecipient.selectedCategories?.includes(cat.id);
                      return (
                        <div key={cat.id} className={styles.breakdownSection}>
                          <button
                            type="button"
                            aria-pressed={!!isCatSelected}
                            className={`${styles.conjuntoBtn} ${isCatSelected ? styles.conjuntoBtnActive : ''}`}
                            onClick={() => {
                              const currentList = tempRecipient.selectedCategories || [];
                              const newList = !isCatSelected ? [...currentList, cat.id] : currentList.filter(id => id !== cat.id);
                              handleTempChange('selectedCategories', newList);
                            }}
                          >
                            <span className={styles.conjuntoNombre}>Conjunto {cat.name}</span>
                            <div className={styles.toggleIndicator}>
                              <div className={styles.toggleCircle}></div>
                            </div>
                          </button>

                          {isCatSelected && cat.fields?.map(field => {
                            const answerValue = tempRecipient.categoryAnswers?.[cat.id]?.[field.id] || '';
                            return (
                              <div key={field.id} className={`${styles.fieldGroup} ${styles.conjuntoCampo}`}>
                                <label>{field.label} {field.required && '*'}</label>
                                {field.type === 'text' && (
                                  <input
                                    type="text"
                                    className={styles.input}
                                    list={`sug-${cat.id}-${field.id}`}
                                    autoComplete="off"
                                    value={answerValue}
                                    onChange={e => {
                                      const currentAnswers = tempRecipient.categoryAnswers || {};
                                      handleTempChange('categoryAnswers', {
                                        ...currentAnswers,
                                        [cat.id]: { ...(currentAnswers[cat.id] || {}), [field.id]: e.target.value }
                                      });
                                    }}
                                    required={field.required}
                                  />
                                )}
                                {field.type === 'text' && (
                                  // Sugerencias de ESTA pregunta (equipos, jugadores, animes…).
                                  <datalist id={`sug-${cat.id}-${field.id}`}>
                                    {sugerenciasCampo(cat, field).map((s) => <option key={s} value={s} />)}
                                  </datalist>
                                )}
                                {field.type === 'select' && (
                                  <select
                                    className={styles.input}
                                    value={answerValue}
                                    onChange={e => {
                                      const currentAnswers = tempRecipient.categoryAnswers || {};
                                      handleTempChange('categoryAnswers', {
                                        ...currentAnswers,
                                        [cat.id]: { ...(currentAnswers[cat.id] || {}), [field.id]: e.target.value }
                                      });
                                    }}
                                    required={field.required}
                                  >
                                    <option value="">Seleccionar...</option>
                                    {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                  </div>

                  <div className={styles.actions}>
                    <button type="button" onClick={cancelTempRecipient} className={styles.skipBtn}>Cancelar</button>
                    <button type="button" onClick={saveTempRecipient} className={styles.saveBtn}>Guardar {tempRecipient.roleDisplay}</button>
                  </div>
                </>
              )}
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className={`${styles.headerIcon} ${styles.headerIconOk}`}>
                <CheckCircle size={34} />
              </div>
              <h1 className={styles.title}>{config.completionPanel.title}</h1>
              <p className={styles.description}>{config.completionPanel.message}</p>

              {(() => {
                // Ideas de regalo para las personas que acaba de cargar.
                const conIdeas = finalRecipients
                  .filter((r) => isRecipientComplete(r))
                  // Solo las ideas por sus gustos: "ya tenemos ideas" promete algo a su medida.
                  .map((r) => ({ r, ideas: recomendar(r, { limite: 3 }).filter((x) => x.tipo === 'gusto') }))
                  .filter((x) => x.ideas.length > 0)
                  .slice(0, 3);
                if (conIdeas.length === 0) return null;
                return (
                  <div className={styles.ideasFinal}>
                    <h3 className={styles.ideasFinalTitulo}>🎁 Ya tenemos ideas de regalo</h3>
                    {conIdeas.map(({ r, ideas }) => (
                      <div key={r.id} className={styles.ideasPersona}>
                        <p className={styles.ideasPersonaNombre}>Para {r.name}</p>
                        <ul className={styles.ideasGrid}>
                          {ideas.map(({ producto: p, motivo }) => (
                            <li key={p.id}>
                              <Link to={`/producto/${p.id}`} className={styles.ideaCard}>
                                <img
                                  src={p.images?.[0] || p.mainImage || PLACEHOLDER_IMG}
                                  alt=""
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                                />
                                <span className={styles.ideaCardNombre}>{p.name}</span>
                                <span className={styles.ideaCardMotivo}>{motivo}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className={styles.tipBox}>
                <p>
                  <strong>💡 Tip:</strong> <T>A partir de ahora puedes gestionar a tus personas importantes y agregar nuevas fechas yendo a tu Perfil y dándole a la pestaña</T> <strong>"Fechas Importantes"</strong>.
                </p>
              </div>

              <div className={`${styles.actions} ${styles.actionsCentro}`}>
                <button type="button" onClick={handleSkip} className={styles.saveBtn}>
                  {config.completionPanel.buttonText}
                </button>
              </div>
            </>
          )}

        </div>
      </div>

    </div>
  );
};

export default SubscriptionSurveyPage;
