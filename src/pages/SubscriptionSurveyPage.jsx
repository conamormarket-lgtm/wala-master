import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gift, UserCircle, Users, CheckCircle, Heart, UserPlus, Calendar, Plus, Trash2, ArrowLeft, Edit2, AlertCircle } from 'lucide-react';
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

  const createBlankRecipient = (roleKey, displayRole) => {
    return {
      id: Math.random().toString(36).substring(2, 9),
      roleKey,
      roleDisplay: displayRole,
      name: '',
      events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }],
      selectedCategories: [],
      categoryAnswers: {}
    };
  };

  const setupParejaIfNeeded = (recipientsList, currentRoles, index) => {
    // Si el rol actual es Pareja y no existe en finalRecipients, lo creamos
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
      if (selectedRoles.pareja) selectedKeys.unshift('pareja'); // Pareja siempre primero
      
      if (selectedKeys.length === 0) {
        return alert('Por favor, selecciona al menos un rol o dale a Atrás/Omitir si no deseas regalar a nadie.');
      }

      setRolesList(selectedKeys);
      setCurrentRoleIndex(0);
      setIsEditingRecipient(false);
      
      // Auto-generar tarjeta de Pareja si es el primero
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
    // Para que esté completo debe tener nombre y el evento cumpleaños debe tener fecha (si aplica)
    if (!rec.name || rec.name.trim() === '') return false;
    
    // Verificar que todos los eventos que requieran fecha la tengan
    for (const ev of rec.events) {
      const evTypeConfig = EVENT_TYPES.find(e => e.label === ev.type) || EVENT_TYPES.find(e => e.label === 'Otro Evento');
      if (evTypeConfig.needsDate && (!ev.date || ev.date.trim() === '')) {
        return false;
      }
    }
    
    return true;
  };

  const goToNextRoleGroup = () => {
    const currentRoleKey = rolesList[currentRoleIndex];
    const roleRecipients = finalRecipients.filter(r => r.roleKey === currentRoleKey);
    
    // Validación: No pueden haber tarjetas incompletas en este grupo
    const hasIncompletes = roleRecipients.some(r => !isRecipientComplete(r));
    if (hasIncompletes) {
       return alert('Por favor completa los datos de todas las tarjetas antes de continuar.');
    }
    
    // Validación: Debe haber al menos una persona en los grupos (excepto si el usuario los borró todos, pero lo normal es que haya)
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

  // ---- MANEJO DEL HUB ----
  const handleAddNewCard = () => {
    const roleKey = rolesList[currentRoleIndex];
    const roleDisplay = ROLES_MAP[roleKey].singular;
    const newRecipient = createBlankRecipient(roleKey, roleDisplay);
    setFinalRecipients(prev => [...prev, newRecipient]);
  };

  const startEditingCard = (recipient) => {
    setTempRecipient(JSON.parse(JSON.stringify(recipient))); // Clon profundo simple
    setAnimationDir('Right');
    setIsEditingRecipient(true);
  };

  // ---- MANEJO DEL TEMP RECIPIENT (EDITOR) ----
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
    if (!tempRecipient.name || tempRecipient.name.trim() === '') {
       return alert('El nombre es obligatorio.');
    }

    for (const ev of tempRecipient.events) {
      const evTypeConfig = EVENT_TYPES.find(e => e.label === ev.type) || EVENT_TYPES.find(e => e.label === 'Otro Evento');
      if (evTypeConfig.needsDate && (!ev.date || ev.date.trim() === '')) {
        return alert(`La fecha es obligatoria para el evento: ${ev.type}.`);
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
    setIsEditingRecipient(false); // Volver al Hub
  };

  const cancelTempRecipient = () => {
    setAnimationDir('Left');
    setIsEditingRecipient(false); // Volver al Hub sin guardar los cambios de tempRecipient
  };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      // Limpiar tarjetas incompletas que hayan quedado
      const validRecipients = finalRecipients.filter(r => isRecipientComplete(r));
      
      await updateUserProfile({ 
        surveyBasicData: basicAnswers, 
        giftRoles: selectedRoles,
        giftRecipients: validRecipients, 
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

  const currentRoleObj = rolesList[currentRoleIndex] === 'pareja' 
    ? { label: 'Pareja', icon: <Heart size={32} />, singular: 'Pareja' } 
    : ROLES_MAP[rolesList[currentRoleIndex]];

  return (
    <div className={styles.surveyLayout} style={{ '--survey-primary': config.design.primaryColor, backgroundColor: config.design.backgroundColor, color: config.design.textColor }}>
      
      <div className={styles.sideScene}></div>

      <div className={styles.centerColumn}>
        
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarLight}></div>
          <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }}></div>
        </div>

        <div key={animationKey} className={`${styles.card} ${animationClass}`}>
          
          {/* PASOS 0, 1 y 2 */}
          {currentStep === 0 && (
            <>
              <div className={styles.headerIcon}><Gift size={40} color={config.design.primaryColor} /></div>
              <h1 className={styles.title}>{config.introPanel.title}</h1>
              <h2 className={styles.subtitle}>{config.introPanel.subtitle}</h2>
              <p className={styles.description}>{config.introPanel.description}</p>
              <div className={styles.actions} style={{ justifyContent: 'center' }}>
                <button type="button" onClick={handleSkip} className={styles.skipBtn}>{config.introPanel.skipButtonText}</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>{config.introPanel.continueButtonText}</button>
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <div className={styles.headerIcon}><UserCircle size={40} color={config.design.primaryColor} /></div>
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

          {currentStep === 2 && (
            <>
              <div className={styles.headerIcon}><Users size={40} color={config.design.primaryColor} /></div>
              <h1 className={styles.title}>¿A quiénes sueles regalar?</h1>
              <p className={styles.description}>Selecciona todos los perfiles a los que sueles hacer regalos (puedes elegir varios).</p>
              
              <div className={styles.groupsContainer}>
                <button 
                  className={`${styles.groupCard} ${selectedRoles.pareja ? styles.groupCardSelected : ''}`}
                  onClick={() => setSelectedRoles(p => ({...p, pareja: !p.pareja}))}
                >
                  <Heart size={32} /><h3>Pareja</h3>
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
                <button type="button" onClick={goBack} className={styles.skipBtn}>Atrás</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>Continuar</button>
              </div>
            </>
          )}

          {/* PASO 3: Bucle de Roles (Hub & Spoke) */}
          {currentStep === 3 && currentRoleObj && (
            <>
              {!isEditingRecipient ? (
                /* ---- EL HUB (PANTALLA RESUMEN) ---- */
                <>
                  <div className={styles.headerIcon}>{currentRoleObj.icon}</div>
                  <h1 className={styles.title}>{rolesList[currentRoleIndex] === 'pareja' ? 'Tu Pareja' : `Tus ${currentRoleObj.label}`}</h1>
                  <p className={styles.description}>Completa los datos de estas personas para poder guardarlas.</p>
                  
                  <div className={styles.form}>
                    <div className={styles.recipientsList}>
                      {finalRecipients.filter(r => r.roleKey === rolesList[currentRoleIndex]).map((rec, idx) => {
                        const isDone = isRecipientComplete(rec);
                        return (
                          <div key={rec.id} className={`${styles.recipientCard} ${isDone ? styles.cardComplete : styles.cardIncomplete}`} onClick={() => startEditingCard(rec)}>
                            <div className={styles.recipientInfo}>
                              <h3>{rec.name || `${rec.roleDisplay} (Sin Nombre)`}</h3>
                              {isDone ? (
                                <p style={{color: '#10b981'}}><CheckCircle size={14}/> Perfil Completado</p>
                              ) : (
                                <p style={{color: '#f59e0b'}}><AlertCircle size={14}/> Falta completar datos</p>
                              )}
                            </div>
                            <button type="button" className={isDone ? styles.hubEditBtn : styles.hubCompleteBtn} onClick={(e) => { e.stopPropagation(); startEditingCard(rec); }}>
                              {isDone ? 'Editar' : 'Completar Perfil'}
                            </button>
                            {rolesList[currentRoleIndex] !== 'pareja' && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setFinalRecipients(prev => prev.filter(p => p.id !== rec.id)); }} className={styles.removeBtn} style={{marginLeft:'0.5rem'}}>
                                <Trash2 size={20} />
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
                      <button type="button" onClick={() => setCurrentStep(2)} className={styles.skipBtn}>Atrás</button>
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
                /* ---- EL SPOKE (FORMULARIO DE DETALLES) ---- */
                <>
                  <div className={styles.subFlowHeader}>
                    <button className={styles.backLinkBtn} onClick={cancelTempRecipient} style={{background:'none', border:'none', color:'#64748b', display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', marginBottom:'1rem', fontWeight:'600'}}>
                      <ArrowLeft size={16}/> Volver sin guardar
                    </button>
                    <h3>Datos de {tempRecipient.roleDisplay}</h3>
                  </div>
                  
                  <div className={styles.form}>
                    <div className={styles.fieldGroup}>
                      <label>Nombre de la persona *</label>
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

                    {/* Preguntas Dinámicas de Administrador (Intereses convertidos a Botones Toggle) */}
                    {config.brandsPanel?.categories?.map(cat => {
                      const isCatSelected = tempRecipient.selectedCategories?.includes(cat.id);
                      return (
                        <div key={cat.id} className={styles.breakdownSection} style={{ padding: '1rem' }}>
                          <button 
                            type="button"
                            className={`${styles.conjuntoBtn} ${isCatSelected ? styles.conjuntoBtnActive : ''}`}
                            onClick={() => {
                              const currentList = tempRecipient.selectedCategories || [];
                              const newList = !isCatSelected ? [...currentList, cat.id] : currentList.filter(id => id !== cat.id);
                              handleTempChange('selectedCategories', newList);
                            }}
                          >
                            <span style={{flex: 1, textAlign: 'left', fontWeight: 'bold'}}>Conjunto {cat.name}</span>
                            <div className={styles.toggleIndicator}>
                              <div className={styles.toggleCircle}></div>
                            </div>
                          </button>
                          
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
