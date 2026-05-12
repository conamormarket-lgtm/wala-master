import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Plus, Trash2, Gift, ArrowRight, UserCircle, CheckCircle, Tag, Users } from 'lucide-react';
import { getSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../services/encuestaConfig';
import styles from './SubscriptionSurveyPage.module.css';

const EVENT_TYPES = [
  { id: 'cumpleanos', label: 'Cumpleaños' },
  { id: 'aniversario', label: 'Aniversario de Pareja' },
  { id: 'dia_madre', label: 'Día de la Madre' },
  { id: 'dia_padre', label: 'Día del Padre' },
  { id: 'navidad', label: 'Navidad' },
  { id: 'otro', label: 'Otro Evento' }
];

const RELATIONSHIP_TYPES = [
  'Pareja (Esposo/a, Novio/a)',
  'Hijo / Hija',
  'Padre / Madre',
  'Hermano / Hermana',
  'Amigo / Amiga',
  'Otro (Personalizado)'
];

const SubscriptionSurveyPage = () => {
  const { userProfile, updateUserProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [config, setConfig] = useState(DEFAULT_SURVEY_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  
  // Flujo Principal
  const [currentStep, setCurrentStep] = useState(0); 
  const [saving, setSaving] = useState(false);
  const [animationDir, setAnimationDir] = useState('Right'); // 'Right' o 'Left'
  
  const [basicAnswers, setBasicAnswers] = useState({});
  const [giftRecipients, setGiftRecipients] = useState([]);
  
  // Sub-Flujo
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [recipientStep, setRecipientStep] = useState(0); 
  const [tempRecipient, setTempRecipient] = useState({ name: '', relationship: '', customRelationship: '', eventType: '', date: '', interests: [], answers: {} });

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await getSurveyConfig();
      if (data) setConfig({ ...DEFAULT_SURVEY_CONFIG, ...data });
      setConfigLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSkip = () => navigate('/', { replace: true });

  const validateFields = (fieldsArray, answersObject) => {
    for (let field of fieldsArray) {
      if (field.required && !answersObject[field.id]) {
        alert(`Por favor completa el campo: ${field.label}`);
        return false;
      }
    }
    return true;
  };

  const goToNextStep = () => {
    if (currentStep === 1 && !validateFields(config.basicDataPanel.fields, basicAnswers)) return;
    setAnimationDir('Right');
    setCurrentStep(prev => prev + 1);
  };

  const goBack = () => {
    setAnimationDir('Left');
    setCurrentStep(prev => prev - 1);
  };

  // --- SUB-FLUJO LÓGICA ---
  const startAddingRecipient = () => {
    setTempRecipient({ id: Date.now().toString(), name: '', relationship: '', customRelationship: '', eventType: '', date: '', interests: [], answers: {} });
    setRecipientStep(0);
    setAnimationDir('Right');
    setIsAddingRecipient(true);
  };

  const nextRecipientStep = () => {
    if (recipientStep === 0) {
      if (!tempRecipient.name || !tempRecipient.relationship || !tempRecipient.eventType || !tempRecipient.date) {
        return alert('Por favor, completa el nombre, la relación, el tipo de evento y la fecha.');
      }
      if (tempRecipient.relationship === 'Otro (Personalizado)' && !tempRecipient.customRelationship) {
        return alert('Por favor, especifica el tipo de relación.');
      }
    }
    
    if (recipientStep >= 2) {
      const currentCatId = tempRecipient.interests[recipientStep - 2];
      const categoryConfig = config.brandsPanel.categories.find(c => c.id === currentCatId);
      if (categoryConfig && !validateFields(categoryConfig.fields, tempRecipient.answers[currentCatId] || {})) return;
    }

    const totalSteps = 2 + tempRecipient.interests.length;
    if (recipientStep + 1 >= totalSteps) {
      const finalRelationship = tempRecipient.relationship === 'Otro (Personalizado)' ? tempRecipient.customRelationship : tempRecipient.relationship;
      setGiftRecipients([...giftRecipients, { ...tempRecipient, relationship: finalRelationship }]);
      setAnimationDir('Left'); // Simulamos que volvemos a la pantalla principal
      setIsAddingRecipient(false);
    } else {
      setAnimationDir('Right');
      setRecipientStep(prev => prev + 1);
    }
  };

  const prevRecipientStep = () => {
    setAnimationDir('Left');
    if (recipientStep === 0) setIsAddingRecipient(false);
    else setRecipientStep(prev => prev - 1);
  };

  const removeRecipient = (id) => setGiftRecipients(giftRecipients.filter(r => r.id !== id));

  const toggleRecipientInterest = (catId) => {
    const isSelected = tempRecipient.interests.includes(catId);
    setTempRecipient({
      ...tempRecipient,
      interests: isSelected ? tempRecipient.interests.filter(id => id !== catId) : [...tempRecipient.interests, catId]
    });
  };

  const handleRecipientAnswerChange = (catId, fieldId, value) => {
    setTempRecipient(prev => ({
      ...prev,
      answers: { ...prev.answers, [catId]: { ...(prev.answers[catId] || {}), [fieldId]: value } }
    }));
  };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ surveyBasicData: basicAnswers, giftRecipients: giftRecipients, hasCompletedSurvey: true });
      setAnimationDir('Right');
      setCurrentStep(3);
    } catch (err) {
      alert('Hubo un error al guardar tus datos.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || configLoading) return <div className={styles.surveyLayout}>Cargando...</div>;

  // Cálculo de Progreso
  let progressPercent = 0;
  if (!isAddingRecipient) {
    progressPercent = (currentStep / 3) * 100;
  } else {
    // Si estamos añadiendo a alguien, la barra se "pausa" en el progreso del paso 2 (aprox 66%) 
    // y muestra un sub-progreso visual.
    const totalSubSteps = 2 + tempRecipient.interests.length;
    const subProgress = ((recipientStep) / totalSubSteps) * (100 / 3); // Fracción del 33% restante
    progressPercent = 66 + subProgress;
  }

  // Animación clave para forzar el remount del div de la tarjeta
  const animationKey = isAddingRecipient ? `sub-${recipientStep}` : `main-${currentStep}`;
  const animationClass = animationDir === 'Right' ? styles.animateSlideInRight : styles.animateSlideInLeft;

  return (
    <div className={styles.surveyLayout} style={{ '--survey-primary': config.design.primaryColor, backgroundColor: config.design.backgroundColor, color: config.design.textColor }}>
      
      {/* Escena Izquierda */}
      <div className={styles.sideScene}>
        {/* Aquí va el componente de mascota / ilustración futura */}
      </div>

      {/* Columna Central */}
      <div className={styles.centerColumn}>
        
        {/* Barra de Progreso */}
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarLight}></div>
          <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }}></div>
        </div>

        {/* Tarjeta con Remount Animation */}
        <div key={animationKey} className={`${styles.card} ${animationClass}`}>
          
          {/* PASO 0: Hook */}
          {!isAddingRecipient && currentStep === 0 && (
            <>
              <div className={styles.headerIcon}>
                <Gift size={40} color={config.design.primaryColor} />
              </div>
              <h1 className={styles.title}>{config.introPanel.title}</h1>
              <h2 className={styles.subtitle}>{config.introPanel.subtitle}</h2>
              <p className={styles.description}>{config.introPanel.description}</p>
              
              <div className={styles.actions} style={{ justifyContent: 'center' }}>
                <button type="button" onClick={handleSkip} className={styles.skipBtn}>{config.introPanel.skipButtonText}</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>{config.introPanel.continueButtonText}</button>
              </div>
            </>
          )}

          {/* PASO 1: Datos Básicos */}
          {!isAddingRecipient && currentStep === 1 && (
            <>
              <div className={styles.headerIcon}>
                <UserCircle size={40} color={config.design.primaryColor} />
              </div>
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
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn}>Atrás</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>Continuar</button>
              </div>
            </>
          )}

          {/* PASO 2: Lista de Agasajados */}
          {!isAddingRecipient && currentStep === 2 && (
            <>
              <div className={styles.headerIcon}>
                <Users size={40} color={config.design.primaryColor} />
              </div>
              <h1 className={styles.title}>Tus Personas Especiales</h1>
              <p className={styles.description}>Añade a las personas a las que sueles hacer regalos. Armaremos cajas perfectas basadas en sus gustos.</p>
              
              <div className={styles.form}>
                <div className={styles.recipientsList}>
                  {giftRecipients.map((rec) => (
                    <div key={rec.id} className={styles.recipientCard}>
                      <div className={styles.recipientInfo}>
                        <h3>{rec.name} ({rec.relationship})</h3>
                        <p><Calendar size={14}/> {EVENT_TYPES.find(t => t.id === rec.eventType)?.label} - {rec.date}</p>
                        {rec.interests.length > 0 && (
                          <div className={styles.recipientPills}>
                            {rec.interests.map(catId => {
                              const catName = config.brandsPanel.categories.find(c => c.id === catId)?.name;
                              return catName ? <span key={catId} className={styles.miniPill}>{catName}</span> : null;
                            })}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => removeRecipient(rec.id)} className={styles.removeBtn}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={startAddingRecipient} className={styles.addRecipientBtn}>
                  <Plus size={20} /> Añadir a alguien especial
                </button>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn} disabled={saving}>Atrás</button>
                <button type="button" onClick={handleFinalSave} className={styles.saveBtn} disabled={saving}>
                  {saving ? 'Guardando...' : 'Terminar'} <CheckCircle size={18} />
                </button>
              </div>
            </>
          )}

          {/* SUB-FLUJO: Añadir Agasajado */}
          {isAddingRecipient && (
            <>
              <div className={styles.subFlowHeader}>
                <h3>Creando Perfil</h3>
              </div>
              
              <div className={styles.form}>
                {recipientStep === 0 && (
                  <div>
                    <h2 className={styles.subtitle}>¿Para quién es y qué celebramos?</h2>
                    <div className={styles.fieldGroup}>
                      <label>Nombre de la Persona</label>
                      <input type="text" placeholder="Ej. María" className={styles.input} value={tempRecipient.name} onChange={e => setTempRecipient({...tempRecipient, name: e.target.value})} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Relación / Parentesco</label>
                      <select className={styles.input} value={tempRecipient.relationship} onChange={e => setTempRecipient({...tempRecipient, relationship: e.target.value})}>
                        <option value="">Seleccionar...</option>
                        {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    
                    {tempRecipient.relationship === 'Otro (Personalizado)' && (
                      <div className={styles.fieldGroup}>
                        <label>Especifica la relación</label>
                        <input type="text" placeholder="Ej. Compañero de trabajo" className={styles.input} value={tempRecipient.customRelationship} onChange={e => setTempRecipient({...tempRecipient, customRelationship: e.target.value})} />
                      </div>
                    )}
                    
                    <div className={styles.fieldGroup}>
                      <label>Tipo de Evento</label>
                      <select className={styles.input} value={tempRecipient.eventType} onChange={e => setTempRecipient({...tempRecipient, eventType: e.target.value})}>
                        <option value="">Seleccionar...</option>
                        {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Fecha del Evento</label>
                      <input type="date" className={styles.input} value={tempRecipient.date} onChange={e => setTempRecipient({...tempRecipient, date: e.target.value})} />
                    </div>
                  </div>
                )}

                {recipientStep === 1 && (
                  <div style={{ textAlign: 'center' }}>
                    <h2 className={styles.subtitle}>¿Qué le gusta a {tempRecipient.name}?</h2>
                    <p className={styles.description} style={{ marginBottom: '1.5rem' }}>Selecciona sus intereses.</p>
                    
                    <div className={styles.pillsContainer}>
                      {config.brandsPanel?.categories?.map(cat => {
                        const isSelected = tempRecipient.interests.includes(cat.id);
                        return (
                          <button key={cat.id} type="button" className={`${styles.pillBtn} ${isSelected ? styles.pillSelected : ''}`} onClick={() => toggleRecipientInterest(cat.id)}>
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recipientStep >= 2 && (
                  (() => {
                    const currentCatId = tempRecipient.interests[recipientStep - 2];
                    const categoryConfig = config.brandsPanel.categories.find(c => c.id === currentCatId);
                    const answersForCat = tempRecipient.answers[currentCatId] || {};

                    if (!categoryConfig || categoryConfig.fields.length === 0) {
                      return (
                        <div>
                          <h2 className={styles.subtitle}>{categoryConfig?.name}</h2>
                          <p className={styles.description}>No hay detalles extras para esta categoría.</p>
                        </div>
                      );
                    }

                    return (
                      <div>
                        <h2 className={styles.subtitle}>Preferencias de {categoryConfig.name}</h2>
                        {categoryConfig.fields.map(f => (
                          <div key={f.id} className={styles.fieldGroup}>
                            <label>{f.label} {f.required && '*'}</label>
                            {f.type === 'text' && <input type="text" className={styles.input} value={answersForCat[f.id] || ''} onChange={e => handleRecipientAnswerChange(currentCatId, f.id, e.target.value)} required={f.required} />}
                            {f.type === 'select' && (
                              <select className={styles.input} value={answersForCat[f.id] || ''} onChange={e => handleRecipientAnswerChange(currentCatId, f.id, e.target.value)} required={f.required}>
                                <option value="">Seleccionar...</option>
                                {f.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={prevRecipientStep} className={styles.skipBtn}>
                  {recipientStep === 0 ? 'Cancelar' : 'Atrás'}
                </button>
                <button type="button" onClick={nextRecipientStep} className={styles.saveBtn}>
                  {recipientStep + 1 >= 2 + tempRecipient.interests.length ? 'Guardar' : 'Continuar'}
                </button>
              </div>
            </>
          )}

          {/* PASO 3: Completado */}
          {!isAddingRecipient && currentStep === 3 && (
            <>
              <div className={styles.headerIcon}>
                <CheckCircle size={60} color={config.design.primaryColor} />
              </div>
              <h1 className={styles.title}>{config.completionPanel.title}</h1>
              <p className={styles.description}>{config.completionPanel.message}</p>
              <div style={{ flex: 1 }}></div>
              <div className={styles.actions} style={{ justifyContent: 'center' }}>
                <button type="button" onClick={handleSkip} className={styles.saveBtn}>
                  {config.completionPanel.buttonText}
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Escena Derecha */}
      <div className={styles.sideScene}>
        {/* Aquí va el componente de mascota / ilustración futura */}
      </div>

    </div>
  );
};

export default SubscriptionSurveyPage;
