import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gift, UserCircle, Users, CheckCircle, Heart, UserPlus } from 'lucide-react';
import { getSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../services/encuestaConfig';
import styles from './SubscriptionSurveyPage.module.css';

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
  
  // --- NUEVOS ESTADOS DEL WIZARD ---
  const [selectedGroups, setSelectedGroups] = useState({
    familia: false,
    pareja: false,
    amigos: false
  });

  const [breakdownData, setBreakdownData] = useState({
    familia: {
      esposa: false,
      hijos: 0,
      padres: 0,
      hermanos: 0,
      tios: 0,
      primos: 0,
      sobrinos: 0
    },
    parejaNombre: '',
    amigosCantidad: 0
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
    
    // Familia
    if (selectedGroups.familia) {
      if (breakdownData.familia.esposa) {
        list.push({ id: 'f_esposa', role: 'Esposa / Esposo', name: '', birthday: '', likesFootball: false, footballTeam: '', likesGeek: false, geekAnime: '' });
      }
      Object.entries(breakdownData.familia).forEach(([key, value]) => {
        if (key !== 'esposa' && value > 0) {
          for (let i = 0; i < value; i++) {
            const label = key.charAt(0).toUpperCase() + key.slice(1, -1); // hijos -> Hijo
            list.push({ id: `f_${key}_${i}`, role: `${label} ${i + 1}`, name: '', birthday: '', likesFootball: false, footballTeam: '', likesGeek: false, geekAnime: '' });
          }
        }
      });
    }

    // Pareja
    if (selectedGroups.pareja) {
      list.push({ id: 'pareja', role: 'Pareja', name: breakdownData.parejaNombre || '', birthday: '', likesFootball: false, footballTeam: '', likesGeek: false, geekAnime: '' });
    }

    // Amigos
    if (selectedGroups.amigos && breakdownData.amigosCantidad > 0) {
      for (let i = 0; i < breakdownData.amigosCantidad; i++) {
        list.push({ id: `amigo_${i}`, role: `Amigo ${i + 1}`, name: '', birthday: '', likesFootball: false, footballTeam: '', likesGeek: false, geekAnime: '' });
      }
    }

    return list;
  };

  const goToNextStep = () => {
    if (currentStep === 1 && !validateFields(config.basicDataPanel.fields, basicAnswers)) return;
    
    if (currentStep === 2) {
      if (!selectedGroups.familia && !selectedGroups.pareja && !selectedGroups.amigos) {
        return alert('Por favor, selecciona al menos un grupo o dale a Omitir si no deseas regalar a nadie.');
      }
    }

    if (currentStep === 3) {
      // Al salir del breakdown, generamos la lista
      const list = generateRecipientsList();
      if (list.length === 0) {
        return alert('No has especificado a ninguna persona. Añade al menos uno o regresa.');
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

  const handleRecipientDataChange = (field, value) => {
    const updated = [...generatedRecipients];
    updated[currentRecipientIndex] = { ...updated[currentRecipientIndex], [field]: value };
    setGeneratedRecipients(updated);
  };

  const handleNextRecipient = () => {
    const current = generatedRecipients[currentRecipientIndex];
    if (!current.birthday) {
      return alert('La fecha de cumpleaños es obligatoria.');
    }
    
    if (currentRecipientIndex + 1 < generatedRecipients.length) {
      setAnimationDir('Right');
      setCurrentRecipientIndex(prev => prev + 1);
    } else {
      // Terminar bucle
      handleFinalSave();
    }
  };

  const handlePrevRecipient = () => {
    if (currentRecipientIndex > 0) {
      setAnimationDir('Left');
      setCurrentRecipientIndex(prev => prev - 1);
    } else {
      goBack(); // Vuelve al breakdown
    }
  };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ 
        surveyBasicData: basicAnswers, 
        giftGroups: selectedGroups,
        giftBreakdown: breakdownData,
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

          {/* PASO 2: Selección de Grupos */}
          {currentStep === 2 && (
            <>
              <div className={styles.headerIcon}>
                <Users size={40} color={config.design.primaryColor} />
              </div>
              <h1 className={styles.title}>¿A quiénes sueles regalar?</h1>
              <p className={styles.description}>Selecciona los grupos de personas a los que más les haces regalos. (Puedes elegir más de uno)</p>
              
              <div className={styles.groupsContainer}>
                <button 
                  className={`${styles.groupCard} ${selectedGroups.familia ? styles.groupCardSelected : ''}`}
                  onClick={() => setSelectedGroups(p => ({...p, familia: !p.familia}))}
                >
                  <Users size={32} />
                  <h3>Familia</h3>
                </button>
                <button 
                  className={`${styles.groupCard} ${selectedGroups.pareja ? styles.groupCardSelected : ''}`}
                  onClick={() => setSelectedGroups(p => ({...p, pareja: !p.pareja}))}
                >
                  <Heart size={32} />
                  <h3>Pareja</h3>
                </button>
                <button 
                  className={`${styles.groupCard} ${selectedGroups.amigos ? styles.groupCardSelected : ''}`}
                  onClick={() => setSelectedGroups(p => ({...p, amigos: !p.amigos}))}
                >
                  <UserPlus size={32} />
                  <h3>Amigos</h3>
                </button>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn}>Atrás</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>Continuar</button>
              </div>
            </>
          )}

          {/* PASO 3: Desglose */}
          {currentStep === 3 && (
            <>
              <div className={styles.headerIcon}>
                <Users size={40} color={config.design.primaryColor} />
              </div>
              <h1 className={styles.title}>Detalla tus selecciones</h1>
              <p className={styles.description}>Ayúdanos a identificar quiénes son exactamente.</p>
              
              <div className={styles.form}>
                
                {selectedGroups.familia && (
                  <div className={styles.breakdownSection}>
                    <h3 className={styles.breakdownTitle}>Tu Familia</h3>
                    <div className={styles.breakdownGrid}>
                      <div className={styles.breakdownItem}>
                        <label>
                          <input type="checkbox" checked={breakdownData.familia.esposa} onChange={e => setBreakdownData(p => ({...p, familia: {...p.familia, esposa: e.target.checked}}))} />
                          Esposa / Esposo
                        </label>
                      </div>
                      <div className={styles.breakdownItemCounter}>
                        <label>Hijos</label>
                        <input type="number" min="0" max="10" className={styles.counterInput} value={breakdownData.familia.hijos} onChange={e => setBreakdownData(p => ({...p, familia: {...p.familia, hijos: parseInt(e.target.value) || 0}}))} />
                      </div>
                      <div className={styles.breakdownItemCounter}>
                        <label>Padres</label>
                        <input type="number" min="0" max="4" className={styles.counterInput} value={breakdownData.familia.padres} onChange={e => setBreakdownData(p => ({...p, familia: {...p.familia, padres: parseInt(e.target.value) || 0}}))} />
                      </div>
                      <div className={styles.breakdownItemCounter}>
                        <label>Hermanos</label>
                        <input type="number" min="0" max="10" className={styles.counterInput} value={breakdownData.familia.hermanos} onChange={e => setBreakdownData(p => ({...p, familia: {...p.familia, hermanos: parseInt(e.target.value) || 0}}))} />
                      </div>
                      <div className={styles.breakdownItemCounter}>
                        <label>Tíos</label>
                        <input type="number" min="0" max="20" className={styles.counterInput} value={breakdownData.familia.tios} onChange={e => setBreakdownData(p => ({...p, familia: {...p.familia, tios: parseInt(e.target.value) || 0}}))} />
                      </div>
                      <div className={styles.breakdownItemCounter}>
                        <label>Primos</label>
                        <input type="number" min="0" max="30" className={styles.counterInput} value={breakdownData.familia.primos} onChange={e => setBreakdownData(p => ({...p, familia: {...p.familia, primos: parseInt(e.target.value) || 0}}))} />
                      </div>
                      <div className={styles.breakdownItemCounter}>
                        <label>Sobrinos</label>
                        <input type="number" min="0" max="20" className={styles.counterInput} value={breakdownData.familia.sobrinos} onChange={e => setBreakdownData(p => ({...p, familia: {...p.familia, sobrinos: parseInt(e.target.value) || 0}}))} />
                      </div>
                    </div>
                  </div>
                )}

                {selectedGroups.pareja && (
                  <div className={styles.breakdownSection}>
                    <h3 className={styles.breakdownTitle}>Tu Pareja</h3>
                    <div className={styles.fieldGroup}>
                      <label>¿Cómo se llama tu pareja? (Opcional)</label>
                      <input type="text" className={styles.input} placeholder="Nombre de tu pareja" value={breakdownData.parejaNombre} onChange={e => setBreakdownData(p => ({...p, parejaNombre: e.target.value}))} />
                    </div>
                  </div>
                )}

                {selectedGroups.amigos && (
                  <div className={styles.breakdownSection}>
                    <h3 className={styles.breakdownTitle}>Tus Amigos</h3>
                    <div className={styles.fieldGroup}>
                      <label>¿A cuántos amigos sueles darles regalos importantes?</label>
                      <input type="number" min="1" max="20" className={styles.input} value={breakdownData.amigosCantidad || ''} onChange={e => setBreakdownData(p => ({...p, amigosCantidad: parseInt(e.target.value) || 0}))} />
                    </div>
                  </div>
                )}

              </div>

              <div className={styles.actions}>
                <button type="button" onClick={goBack} className={styles.skipBtn}>Atrás</button>
                <button type="button" onClick={goToNextStep} className={styles.saveBtn}>Siguiente</button>
              </div>
            </>
          )}

          {/* PASO 4: Bucle de Detalles */}
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
                
                <div className={styles.fieldGroup}>
                  <label>Fecha de Cumpleaños *</label>
                  <input type="date" className={styles.input} value={generatedRecipients[currentRecipientIndex].birthday} onChange={e => handleRecipientDataChange('birthday', e.target.value)} />
                </div>

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
                          <div key={field.id} className={styles.fieldGroup}>
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
