import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gift, UserCircle, Users, CheckCircle, Heart, UserPlus, Calendar, Plus, Trash2, ArrowLeft } from 'lucide-react';
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

  const startEditingRecipient = (roleKey, displayRole) => {
    setTempRecipient({
      id: Math.random().toString(36).substring(2, 9),
      roleKey, // e.g. 'hijos'
      roleDisplay: displayRole, // e.g. 'Hijo/a'
      name: '',
      events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }],
      selectedCategories: [],
      categoryAnswers: {}
    });
    setAnimationDir('Right');
    setIsEditingRecipient(true);
  };

  const goToNextStep = () => {
    if (currentStep === 1 && !validateFields(config.basicDataPanel.fields, basicAnswers)) return;
    
    if (currentStep === 2) {
      const selectedKeys = Object.keys(ROLES_MAP).filter(key => selectedRoles[key]);
      if (selectedRoles.pareja) selectedKeys.unshift('pareja'); // Pareja siempre primero
      
      if (selectedKeys.length === 0) {
        return alert('Por favor, selecciona al menos un rol o dale a Atrás/Omitir si no deseas regalar a nadie.');
      }

      setRolesList(selectedKeys);
      setCurrentRoleIndex(0);
      
      if (selectedKeys[0] === 'pareja') {
        startEditingRecipient('pareja', 'Pareja');
      } else {
        setIsEditingRecipient(false);
      }
    }

    setAnimationDir('Right');
    setCurrentStep(prev => prev + 1);
  };

  const goBack = () => {
    setAnimationDir('Left');
    setCurrentStep(prev => prev - 1);
  };

  const goToNextRoleGroup = () => {
    const nextIdx = currentRoleIndex + 1;
    if (nextIdx < rolesList.length) {
      setAnimationDir('Right');
      setCurrentRoleIndex(nextIdx);
      if (rolesList[nextIdx] === 'pareja') {
        startEditingRecipient('pareja', 'Pareja');
      } else {
        setIsEditingRecipient(false); // Entra al Hub
      }
    } else {
      handleFinalSave();
    }
  };

  // ---- MANEJO DEL TEMP RECIPIENT ----
  const handleTempChange = (field, value) => {
    setTempRecipient(prev => ({ ...prev, [field]: value }));
  };

  const addEvent = () => {
    setTempRecipient(prev => ({
      ...prev,
      events: [...prev.events, { id: Math.random().toString(36).substring(2, 9), type: 'Otro Evento', date: '' }]
    }));
  };

  const updateEvent = (index, field, value) => {
    setTempRecipient(prev => {
      const newEvents = [...prev.events];
      newEvents[index][field] = value;
      
      if (field === 'type') {
        const evTypeConfig = EVENT_TYPES.find(e => e.label === value);
        if (evTypeConfig && !evTypeConfig.needsDate) {
          newEvents[index].date = '';
        }
      }
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
    // Validaciones
    if (tempRecipient.roleKey !== 'pareja' && !tempRecipient.name) {
       return alert('Por favor escribe el nombre de esta persona para poder identificarla en tu lista.');
    }

    for (const ev of tempRecipient.events) {
      const evTypeConfig = EVENT_TYPES.find(e => e.label === ev.type) || EVENT_TYPES.find(e => e.label === 'Otro Evento');
      if (evTypeConfig.needsDate && !ev.date) {
        return alert(`La fecha es obligatoria para el evento: ${ev.type}.`);
      }
    }

    setFinalRecipients(prev => {
      // Si estamos editando uno existente (todavía no soportado, pero buena práctica) o creando uno nuevo
      const existingIdx = prev.findIndex(r => r.id === tempRecipient.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = tempRecipient;
        return copy;
      }
      return [...prev, tempRecipient];
    });

    const currentRole = rolesList[currentRoleIndex];
    if (currentRole === 'pareja') {
      goToNextRoleGroup();
    } else {
      setAnimationDir('Left');
      setIsEditingRecipient(false); // Volver al Hub
    }
  };

  const cancelTempRecipient = () => {
    const currentRole = rolesList[currentRoleIndex];
    setAnimationDir('Left');
    if (currentRole === 'pareja') {
      // Si cancelan pareja, simplemente se salta este grupo
      goToNextRoleGroup();
    } else {
      setIsEditingRecipient(false); // Volver al Hub
    }
  };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ 
        surveyBasicData: basicAnswers, 
        giftRoles: selectedRoles,
        giftRecipients: finalRecipients, 
        hasCompletedSurvey: true 
      });
      setAnimationDir('Right');
      setCurrentStep(4);
    } catch (err) {
      alert('Hubo un error al guardar tus datos.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || configLoading) return <div className={styles.surveyLayout}>Cargando...</div>;

  // Cálculo de Progreso
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

          {/* PASO 3: Bucle de Roles (Hub & Spoke) */}
          {currentStep === 3 && (
            <>
              {!isEditingRecipient ? (
                /* ---- EL HUB (PANTALLA RESUMEN) ---- */
                <>
                  <div className={styles.headerIcon}>
                    {ROLES_MAP[rolesList[currentRoleIndex]].icon}
                  </div>
                  <h1 className={styles.title}>Tus {ROLES_MAP[rolesList[currentRoleIndex]].label}</h1>
                  <p className={styles.description}>Agrega a los {ROLES_MAP[rolesList[currentRoleIndex]].label.toLowerCase()} a los que sueles darles regalos.</p>
                  
                  <div className={styles.form}>
                    <div className={styles.recipientsList}>
                      {finalRecipients.filter(r => r.roleKey === rolesList[currentRoleIndex]).map((rec, idx) => (
                        <div key={rec.id} className={styles.recipientCard}>
                          <div className={styles.recipientInfo}>
                            <h3>{rec.name} ({rec.roleDisplay})</h3>
                            <p><Calendar size={14}/> {rec.events.length} Fechas Importantes guardadas</p>
                            {rec.selectedCategories.length > 0 && (
                              <div className={styles.recipientPills}>
                                {rec.selectedCategories.map(catId => {
                                  const catName = config.brandsPanel.categories.find(c => c.id === catId)?.name;
                                  return catName ? <span key={catId} className={styles.miniPill}>{catName}</span> : null;
                                })}
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={() => setFinalRecipients(prev => prev.filter(p => p.id !== rec.id))} className={styles.removeBtn}>
                            <Trash2 size={20} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => startEditingRecipient(rolesList[currentRoleIndex], ROLES_MAP[rolesList[currentRoleIndex]].singular)} 
                      className={styles.addRecipientBtn}
                    >
                      <Plus size={20} /> Añadir {ROLES_MAP[rolesList[currentRoleIndex]].singular}
                    </button>
                  </div>

                  <div className={styles.actions}>
                    {currentRoleIndex === 0 ? (
                      <button type="button" onClick={() => setCurrentStep(2)} className={styles.skipBtn}>Atrás</button>
                    ) : (
                      <button type="button" onClick={() => {
                        setAnimationDir('Left');
                        setCurrentRoleIndex(prev => prev - 1);
                        if (rolesList[currentRoleIndex - 1] === 'pareja') {
                          // Aunque Pareja no tiene hub, al darle atrás deberíamos poder editarla?
                          // Por ahora dejaremos que solo puedan darle atrás y pase de grupo
                        }
                      }} className={styles.skipBtn}>Grupo Anterior</button>
                    )}
                    <button type="button" onClick={goToNextRoleGroup} className={styles.saveBtn} disabled={saving}>
                      {currentRoleIndex + 1 >= rolesList.length ? (saving ? 'Guardando...' : 'Terminar Encuesta') : 'Siguiente Grupo'}
                    </button>
                  </div>
                </>
              ) : (
                /* ---- EL SPOKE (FORMULARIO DE DETALLES) ---- */
                <>
                  <div className={styles.subFlowHeader}>
                    <button className={styles.backLinkBtn} onClick={cancelTempRecipient} style={{background:'none', border:'none', color:'#64748b', display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', marginBottom:'1rem', fontWeight:'600'}}>
                      <ArrowLeft size={16}/> Volver
                    </button>
                    <h3>Datos de {tempRecipient.roleDisplay}</h3>
                  </div>
                  
                  <div className={styles.form}>
                    <div className={styles.fieldGroup}>
                      <label>Nombre de la persona {tempRecipient.roleKey !== 'pareja' && '*'}</label>
                      <input type="text" className={styles.input} placeholder="Ej. Carlos" value={tempRecipient.name} onChange={e => handleTempChange('name', e.target.value)} />
                    </div>
                    
                    <div className={styles.breakdownSection}>
                      <h3 className={styles.breakdownTitle} style={{fontSize:'1rem'}}>Fechas Importantes</h3>
                      
                      {tempRecipient.events.map((event, eventIdx) => {
                        const evTypeConfig = EVENT_TYPES.find(e => e.label === event.type) || EVENT_TYPES.find(e => e.id === 'otro');
                        return (
                          <div key={event.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <select 
                                className={styles.input} 
                                value={event.type}
                                onChange={e => updateEvent(eventIdx, 'type', e.target.value)}
                                disabled={eventIdx === 0}
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
                      const isCatSelected = tempRecipient.selectedCategories?.includes(cat.id);
                      return (
                        <div key={cat.id} className={styles.breakdownSection}>
                          <h3 className={styles.breakdownTitle} style={{fontSize:'1rem'}}>Intereses: {cat.name}</h3>
                          <label style={{display:'flex', gap:'0.5rem', alignItems:'center', cursor:'pointer', marginBottom:'0.5rem'}}>
                            <input 
                              type="checkbox" 
                              checked={isCatSelected || false} 
                              onChange={e => {
                                const currentList = tempRecipient.selectedCategories || [];
                                const newList = e.target.checked ? [...currentList, cat.id] : currentList.filter(id => id !== cat.id);
                                handleTempChange('selectedCategories', newList);
                              }} 
                            />
                            ¿Le interesa {cat.name}?
                          </label>
                          
                          {isCatSelected && cat.fields?.map(field => {
                            const answerValue = tempRecipient.categoryAnswers?.[cat.id]?.[field.id] || '';
                            return (
                              <div key={field.id} className={styles.fieldGroup} style={{ marginTop: '1rem' }}>
                                <label>{field.label} {field.required && '*'}</label>
                                {field.type === 'text' && (
                                  <input 
                                    type="text" 
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
                                  />
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

          {/* PASO 4: Completado */}
          {currentStep === 4 && (
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
