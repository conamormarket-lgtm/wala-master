import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gift, UserCircle, Users, CheckCircle, Heart, UserPlus, Calendar, Plus, Trash2 } from 'lucide-react';
import { getSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../services/encuestaConfig';
import styles from './SubscriptionSurveyPage.module.css';

const EVENT_TYPES = [
  { id: 'cumpleanos', label: 'Cumpleaños', needsDate: true },
  { id: 'aniversario', label: 'Aniversario', needsDate: true },
  { id: 'navidad', label: 'Navidad', needsDate: false },
  { id: 'dia_madre', label: 'Día de la Madre', needsDate: false },
  { id: 'dia_padre', label: 'Día del Padre', needsDate: false },
  { id: 'dia_nino', label: 'Día del Niño', needsDate: false },
  { id: 'san_valentin', label: 'San Valentín', needsDate: false },
  { id: 'otro', label: 'Otro Evento', needsDate: true }
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
  const { userProfile, updateUserProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [config, setConfig] = useState(DEFAULT_SURVEY_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  
  // Flujo Principal
  const [currentStep, setCurrentStep] = useState(0); 
  const [saving, setSaving] = useState(false);
  const [animationDir, setAnimationDir] = useState('Right');
  
  const [basicAnswers, setBasicAnswers] = useState({});
  
  // --- NUEVOS ESTADOS DEL WIZARD (Roles Directos) ---
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

  const [quantities, setQuantities] = useState({
    parejaNombre: '',
    hijos: 1,
    padres: 1,
    hermanos: 1,
    sobrinos: 1,
    primos: 1,
    amigos: 1,
    otros: 1
  });

  const [generatedRecipients, setGeneratedRecipients] = useState([]);
  const [currentRecipientIndex, setCurrentRecipientIndex] = useState(0);

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

  const generateRecipientsList = () => {
    const list = [];
    
    // Generar Pareja primero si existe
    if (selectedRoles.pareja) {
      list.push({ 
        id: 'pareja', 
        role: 'Pareja', 
        name: quantities.parejaNombre || '', 
        events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }], 
        selectedCategories: [], 
        categoryAnswers: {} 
      });
    }

    // Generar el resto iterando sobre el mapa de roles
    Object.keys(ROLES_MAP).forEach(roleKey => {
      if (selectedRoles[roleKey]) {
        const qty = quantities[roleKey] || 1;
        for (let i = 0; i < qty; i++) {
          list.push({ 
            id: `${roleKey}_${i}`, 
            role: qty > 1 ? `${ROLES_MAP[roleKey].singular} ${i + 1}` : ROLES_MAP[roleKey].singular, 
            name: '', 
            events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }], 
            selectedCategories: [], 
            categoryAnswers: {} 
          });
        }
      }
    });

    return list;
  };

  const goToNextStep = () => {
    if (currentStep === 1 && !validateFields(config.basicDataPanel.fields, basicAnswers)) return;
    
    if (currentStep === 2) {
      const hasAnyRole = Object.values(selectedRoles).some(val => val === true);
      if (!hasAnyRole) {
        return alert('Por favor, selecciona al menos un rol o dale a Atrás/Omitir si no deseas regalar a nadie.');
      }
    }

    if (currentStep === 3) {
      // Al salir del desglose de cantidades, generamos la lista
      const list = generateRecipientsList();
      if (list.length === 0) {
        return alert('No has especificado a ninguna persona válida. Regresa y verifica las cantidades.');
      }
      setGeneratedRecipients(list);
      setCurrentRecipientIndex(0);
    }

    setAnimationDir('Right');
    setCurrentStep(prev => prev + 1);
  };

  const goBack = () => {
    setAnimationDir('Left');
    setCurrentStep(prev => prev - 1);
  };

  // ---- MANEJO DE ESTADO DE RECIPIENTES ----
  const handleRecipientDataChange = (field, value) => {
    const updated = [...generatedRecipients];
    updated[currentRecipientIndex] = { ...updated[currentRecipientIndex], [field]: value };
    setGeneratedRecipients(updated);
  };

  // ---- MANEJO DE FECHAS (EVENTOS) ----
  const addEvent = () => {
    const updated = [...generatedRecipients];
    updated[currentRecipientIndex].events.push({ 
      id: Math.random().toString(36).substring(2, 9), 
      type: 'Otro Evento', 
      date: '' 
    });
    setGeneratedRecipients(updated);
  };

  const updateEvent = (eventIndex, field, value) => {
    const updated = [...generatedRecipients];
    const event = updated[currentRecipientIndex].events[eventIndex];
    event[field] = value;
    
    // Auto-limpiar fecha si cambia a un evento que no la necesita
    if (field === 'type') {
      const evTypeConfig = EVENT_TYPES.find(e => e.label === value);
      if (evTypeConfig && !evTypeConfig.needsDate) {
        event.date = '';
      }
    }
    
    setGeneratedRecipients(updated);
  };

  const removeEvent = (eventIndex) => {
    const updated = [...generatedRecipients];
    updated[currentRecipientIndex].events.splice(eventIndex, 1);
    setGeneratedRecipients(updated);
  };

  const handleNextRecipient = () => {
    const current = generatedRecipients[currentRecipientIndex];
    
    // Validación: Todos los eventos creados deben ser válidos
    for (const ev of current.events) {
      const evTypeConfig = EVENT_TYPES.find(e => e.label === ev.type) || EVENT_TYPES.find(e => e.label === 'Otro Evento');
      if (evTypeConfig.needsDate && !ev.date) {
        return alert(`La fecha es obligatoria para el evento: ${ev.type}.`);
      }
    }
    
    if (currentRecipientIndex + 1 < generatedRecipients.length) {
      setAnimationDir('Right');
      setCurrentRecipientIndex(prev => prev + 1);
    } else {
      handleFinalSave();
    }
  };

  const handlePrevRecipient = () => {
    if (currentRecipientIndex > 0) {
      setAnimationDir('Left');
      setCurrentRecipientIndex(prev => prev - 1);
    } else {
      goBack();
    }
  };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ 
        surveyBasicData: basicAnswers, 
        giftRoles: selectedRoles,
        giftQuantities: quantities,
        giftRecipients: generatedRecipients, 
        hasCompletedSurvey: true 
      });
      setAnimationDir('Right');
      setCurrentStep(5);
    } catch (err) {
      alert('Hubo un error al guardar tus datos.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || configLoading) return <div className={styles.surveyLayout}>Cargando...</div>;

  // Cálculo de Progreso
  let progressPercent = 0;
  if (currentStep <= 3) {
    progressPercent = (currentStep / 5) * 100;
  } else if (currentStep === 4) {
    const subProgress = (currentRecipientIndex / generatedRecipients.length) * (100 / 5);
    progressPercent = (4 / 5) * 100 + subProgress;
  } else {
    progressPercent = 100;
  }

  const animationKey = currentStep === 4 ? `recipient-${currentRecipientIndex}` : `main-${currentStep}`;
  const animationClass = animationDir === 'Right' ? styles.animateSlideInRight : styles.animateSlideInLeft;

  return (
    <div className={styles.surveyLayout} style={{ '--survey-primary': config.design.primaryColor, backgroundColor: config.design.backgroundColor, color: config.design.textColor }}>
      
      <div className={styles.sideScene}></div>

      <div className={styles.centerColumn}>
        
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarLight}></div>
          <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }}></div>
        </div>

        <div key={animationKey} className={`${styles.card} ${animationClass}`}>
          
          {/* PASO 0: Hook */}
          {currentStep === 0 && (
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
          {currentStep === 1 && (
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

          {/* PASO 2: Selección de Roles */}
          {currentStep === 2 && (
            <>
              <div className={styles.headerIcon}>
                <Users size={40} color={config.design.primaryColor} />
              </div>
              <h1 className={styles.title}>¿A quiénes sueles regalar?</h1>
              <p className={styles.description}>Selecciona todos los perfiles a los que sueles hacer regalos (puedes elegir varios).</p>
              
              <div className={styles.groupsContainer}>
                
                <button 
                  className={`${styles.groupCard} ${selectedRoles.pareja ? styles.groupCardSelected : ''}`}
                  onClick={() => setSelectedRoles(p => ({...p, pareja: !p.pareja}))}
                >
                  <Heart size={32} />
                  <h3>Pareja</h3>
                </button>

                {Object.keys(ROLES_MAP).map(roleKey => (
                  <button 
                    key={roleKey}
                    className={`${styles.groupCard} ${selectedRoles[roleKey] ? styles.groupCardSelected : ''}`}
                    onClick={() => setSelectedRoles(p => ({...p, [roleKey]: !p[roleKey]}))}
                  >
                    {ROLES_MAP[roleKey].icon}
                    <h3>{ROLES_MAP[roleKey].label}</h3>
                  </button>
                ))}

              </div>

              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn}>Atrás</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>Continuar</button>
              </div>
            </>
          )}

          {/* PASO 3: Cantidades */}
          {currentStep === 3 && (
            <>
              <div className={styles.headerIcon}>
                <Users size={40} color={config.design.primaryColor} />
              </div>
              <h1 className={styles.title}>Detalla las cantidades</h1>
              <p className={styles.description}>Dinos cuántas personas hay en cada grupo seleccionado.</p>
              
              <div className={styles.form}>
                <div className={styles.breakdownGrid}>
                  
                  {selectedRoles.pareja && (
                    <div className={styles.breakdownSection} style={{ gridColumn: '1 / -1' }}>
                      <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                        <label>Nombre de tu Pareja (Opcional)</label>
                        <input type="text" className={styles.input} placeholder="Ej. Ana" value={quantities.parejaNombre} onChange={e => setQuantities(p => ({...p, parejaNombre: e.target.value}))} />
                      </div>
                    </div>
                  )}

                  {Object.keys(ROLES_MAP).map(roleKey => {
                    if (!selectedRoles[roleKey]) return null;
                    return (
                      <div key={roleKey} className={styles.breakdownSection}>
                        <div className={styles.breakdownItemCounter}>
                          <label>¿Cuántos {ROLES_MAP[roleKey].label}?</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="30" 
                            className={styles.counterInput} 
                            value={quantities[roleKey]} 
                            onChange={e => setQuantities(p => ({...p, [roleKey]: parseInt(e.target.value) || 1}))} 
                          />
                        </div>
                      </div>
                    );
                  })}
                  
                </div>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn}>Atrás</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>Siguiente</button>
              </div>
            </>
          )}

          {/* PASO 4: Bucle de Detalles (Perfil por Perfil) */}
          {currentStep === 4 && generatedRecipients.length > 0 && (
            <>
              <div className={styles.subFlowHeader}>
                <h3>Perfil {currentRecipientIndex + 1} de {generatedRecipients.length}</h3>
              </div>
              
              <div className={styles.form}>
                <h2 className={styles.subtitle}>Datos sobre: {generatedRecipients[currentRecipientIndex].role}</h2>
                
                <div className={styles.fieldGroup}>
                  <label>Nombre de la persona (Opcional)</label>
                  <input type="text" className={styles.input} placeholder="Ej. Carlos" value={generatedRecipients[currentRecipientIndex].name} onChange={e => handleRecipientDataChange('name', e.target.value)} />
                </div>
                
                <div className={styles.breakdownSection}>
                  <h3 className={styles.breakdownTitle} style={{fontSize:'1rem'}}>Fechas Importantes</h3>
                  
                  {generatedRecipients[currentRecipientIndex].events.map((event, eventIdx) => {
                    const evTypeConfig = EVENT_TYPES.find(e => e.label === event.type) || EVENT_TYPES.find(e => e.id === 'otro');
                    return (
                      <div key={event.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <select 
                            className={styles.input} 
                            value={event.type}
                            onChange={e => updateEvent(eventIdx, 'type', e.target.value)}
                            disabled={eventIdx === 0} // El primero (Cumpleaños) no se puede cambiar de tipo
                          >
                            {EVENT_TYPES.map(et => <option key={et.id} value={et.label}>{et.label}</option>)}
                          </select>
                          
                          {evTypeConfig.needsDate && (
                            <input 
                              type="date" 
                              className={styles.input} 
                              value={event.date} 
                              onChange={e => updateEvent(eventIdx, 'date', e.target.value)} 
                              required={true}
                            />
                          )}
                        </div>
                        
                        {eventIdx > 0 && (
                          <button type="button" onClick={() => removeEvent(eventIdx)} className={styles.removeBtn} style={{ marginTop: '0.2rem' }}>
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  
                  <button type="button" onClick={addEvent} className={styles.addBtn} style={{ background: 'transparent', color: config.design.primaryColor, border: `1px dashed ${config.design.primaryColor}`, padding: '0.5rem', borderRadius: '8px', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <Plus size={18} /> Agregar otra fecha importante
                  </button>
                </div>

                {/* Preguntas Dinámicas de Administrador (Intereses) */}
                {config.brandsPanel?.categories?.map(cat => {
                  const isCatSelected = generatedRecipients[currentRecipientIndex].selectedCategories?.includes(cat.id);
                  return (
                    <div key={cat.id} className={styles.breakdownSection}>
                      <h3 className={styles.breakdownTitle} style={{fontSize:'1rem'}}>Intereses: {cat.name}</h3>
                      <label style={{display:'flex', gap:'0.5rem', alignItems:'center', cursor:'pointer', marginBottom:'0.5rem'}}>
                        <input 
                          type="checkbox" 
                          checked={isCatSelected || false} 
                          onChange={e => {
                            const currentList = generatedRecipients[currentRecipientIndex].selectedCategories || [];
                            const newList = e.target.checked ? [...currentList, cat.id] : currentList.filter(id => id !== cat.id);
                            handleRecipientDataChange('selectedCategories', newList);
                          }} 
                        />
                        ¿Le interesa {cat.name}?
                      </label>
                      
                      {isCatSelected && cat.fields?.map(field => {
                        const answerValue = generatedRecipients[currentRecipientIndex].categoryAnswers?.[cat.id]?.[field.id] || '';
                        return (
                          <div key={field.id} className={styles.fieldGroup} style={{ marginTop: '1rem' }}>
                            <label>{field.label} {field.required && '*'}</label>
                            {field.type === 'text' && (
                              <input 
                                type="text" 
                                className={styles.input} 
                                value={answerValue} 
                                onChange={e => {
                                  const currentAnswers = generatedRecipients[currentRecipientIndex].categoryAnswers || {};
                                  handleRecipientDataChange('categoryAnswers', {
                                    ...currentAnswers,
                                    [cat.id]: { ...(currentAnswers[cat.id] || {}), [field.id]: e.target.value }
                                  });
                                }} 
                                required={field.required}
                              />
                            )}
                            {field.type === 'select' && (
                              <select 
                                className={styles.input} 
                                value={answerValue} 
                                onChange={e => {
                                  const currentAnswers = generatedRecipients[currentRecipientIndex].categoryAnswers || {};
                                  handleRecipientDataChange('categoryAnswers', {
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
                <button type="button" onClick={handlePrevRecipient} className={styles.skipBtn} disabled={saving}>Atrás</button>
                <button type="button" onClick={handleNextRecipient} className={styles.saveBtn} disabled={saving}>
                  {currentRecipientIndex + 1 >= generatedRecipients.length ? (saving ? 'Guardando...' : 'Terminar') : 'Siguiente Persona'}
                </button>
              </div>
            </>
          )}

          {/* PASO 5: Completado */}
          {currentStep === 5 && (
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

      <div className={styles.sideScene}></div>

    </div>
  );
};

export default SubscriptionSurveyPage;
