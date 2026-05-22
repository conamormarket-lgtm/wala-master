import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Gift, Calendar, Plus, Edit2, Trash2, X, Heart, Users, UserPlus, UserCircle } from 'lucide-react';
import styles from './CuentaFechasImportantesPage.module.css';

const EVENT_TYPES = [
  { id: 'cumpleanos', label: 'Cumpleaños', needsDate: true },
  { id: 'aniversario', label: 'Aniversario', needsDate: true },
  { id: 'otro', label: 'Fecha Especial', needsDate: true }
];

const ROLES_MAP = {
  pareja: { label: 'Pareja', singular: 'Pareja' },
  hijos: { label: 'Hijos', singular: 'Hijo/a' },
  padres: { label: 'Padres', singular: 'Padre/Madre' },
  hermanos: { label: 'Hermanos', singular: 'Hermano/a' },
  sobrinos: { label: 'Sobrinos', singular: 'Sobrino/a' },
  primos: { label: 'Primos', singular: 'Primo/a' },
  amigos: { label: 'Amigos', singular: 'Amigo/a' },
  otros: { label: 'Otros', singular: 'Otra persona' }
};

const CuentaFechasImportantesPage = () => {
  const { userProfile, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempRecipient, setTempRecipient] = useState(null);
  const [saving, setSaving] = useState(false);

  const recipients = userProfile?.giftRecipients || [];
  const hasCompletedSurvey = userProfile?.hasCompletedSurvey;

  if (!hasCompletedSurvey) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Gift size={64} className={styles.emptyStateIcon} />
          <h2>¡Gana recompensas diciéndonos qué te gusta!</h2>
          <p>
            Al completar nuestro perfil de regalos, ganarás Kapicoins que puedes canjear
            por descuentos, y te recordaremos las fechas más importantes de tus seres queridos.
          </p>
          <Link to="/encuesta-suscripcion" className={styles.primaryButton}>
            Completa la encuesta ahora
          </Link>
        </div>
      </div>
    );
  }

  const handleAddNew = () => {
    setTempRecipient({
      id: Math.random().toString(36).substring(2, 9),
      roleKey: 'otros',
      roleDisplay: 'Otra persona',
      name: '',
      gender: '',
      events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }],
    });
    setIsModalOpen(true);
  };

  const handleEdit = (rec) => {
    setTempRecipient(JSON.parse(JSON.stringify(rec)));
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar a esta persona de tus fechas importantes?')) return;
    
    const newList = recipients.filter(r => r.id !== id);
    try {
      await updateUserProfile({ giftRecipients: newList });
    } catch (e) {
      alert('Error al eliminar la persona.');
    }
  };

  const handleTempChange = (field, value) => {
    setTempRecipient(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'roleKey') {
        updated.roleDisplay = ROLES_MAP[value]?.singular || 'Otra persona';
      }
      return updated;
    });
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
      newEvents[index][field] = value;
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

  const saveRecipient = async () => {
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

    setSaving(true);
    try {
      const copy = [...recipients];
      const existingIdx = copy.findIndex(r => r.id === tempRecipient.id);
      if (existingIdx >= 0) {
        copy[existingIdx] = tempRecipient;
      } else {
        copy.push(tempRecipient);
      }
      await updateUserProfile({ giftRecipients: copy });
      setIsModalOpen(false);
    } catch (e) {
      alert('Error al guardar los datos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Fechas Importantes</h1>
        <button onClick={handleAddNew} className={styles.primaryButton}>
          <Plus size={20} /> Añadir Persona
        </button>
      </div>

      <div className={styles.grid}>
        {recipients.length === 0 ? (
          <p style={{ color: '#64748b' }}>Aún no has agregado personas a tu lista.</p>
        ) : (
          recipients.map(rec => (
            <div key={rec.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>{rec.name}</h3>
                  <span className={styles.cardRole}>{rec.roleDisplay}</span>
                </div>
                <div className={styles.cardActions}>
                  <button onClick={() => handleEdit(rec)} className={styles.iconBtn} title="Editar">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(rec.id)} className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Eliminar">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className={styles.eventsList}>
                {rec.events.map(ev => (
                  <div key={ev.id} className={styles.eventItem}>
                    <Calendar size={16} />
                    <span>
                      <strong>{ev.type === 'Fecha Especial' ? ev.customName : ev.type}:</strong>{' '}
                      {ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'Sin fecha'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && tempRecipient && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{tempRecipient.name ? `Editar a ${tempRecipient.name}` : 'Añadir Nueva Persona'}</h2>
              <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>
            
            <div className={styles.formBody}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className={styles.fieldGroup} style={{ flex: 2 }}>
                  <label>Nombre de la persona *</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Ej. Carlos" 
                    value={tempRecipient.name} 
                    onChange={e => handleTempChange('name', e.target.value)} 
                  />
                </div>
                <div className={styles.fieldGroup} style={{ flex: 1 }}>
                  <label>Género *</label>
                  <select 
                    className={styles.input} 
                    value={tempRecipient.gender || ''} 
                    onChange={e => handleTempChange('gender', e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Relación / Parentesco *</label>
                <select 
                  className={styles.input} 
                  value={tempRecipient.roleKey || 'otros'} 
                  onChange={e => handleTempChange('roleKey', e.target.value)}
                >
                  {Object.keys(ROLES_MAP).map(key => (
                    <option key={key} value={key}>{ROLES_MAP[key].label}</option>
                  ))}
                </select>
              </div>
              
              <div className={styles.breakdownSection}>
                <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem' }}>Fechas Importantes</h3>
                
                {tempRecipient.events.map((event, eventIdx) => {
                  const evTypeConfig = EVENT_TYPES.find(e => e.label === event.type) || EVENT_TYPES.find(e => e.id === 'otro');
                  
                  return (
                    <div key={event.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-start', background: eventIdx === 0 ? '#ffffff' : 'transparent', padding: eventIdx === 0 ? '1rem' : '0', borderRadius: '8px', border: eventIdx === 0 ? '1px solid #e2e8f0' : 'none' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        
                        {eventIdx === 0 ? (
                          <div style={{ fontWeight: 'bold', color: '#0f172a', padding: '0.5rem 0' }}>
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
                            placeholder="¿Qué se celebra? (Ej. Bautizo)" 
                            value={event.customName || ''} 
                            onChange={e => updateEvent(eventIdx, 'customName', e.target.value)}
                          />
                        )}

                        {evTypeConfig.needsDate && (
                          <input 
                            type="date" 
                            className={styles.input} 
                            value={event.date} 
                            onChange={e => updateEvent(eventIdx, 'date', e.target.value)} 
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
                
                <button type="button" onClick={addEvent} className={styles.addBtn}>
                  <Plus size={18} /> Agregar otra fecha importante
                </button>
              </div>

            </div>
            
            <div className={styles.modalFooter}>
              <button onClick={() => setIsModalOpen(false)} className={styles.cancelBtn}>Cancelar</button>
              <button onClick={saveRecipient} className={styles.primaryButton} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuentaFechasImportantesPage;
