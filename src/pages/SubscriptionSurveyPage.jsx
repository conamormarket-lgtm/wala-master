import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Plus, Trash2, Gift, ArrowRight } from 'lucide-react';
import styles from './SubscriptionSurveyPage.module.css';

const EVENT_TYPES = [
  { id: 'cumpleanos', label: 'Cumpleaños' },
  { id: 'aniversario', label: 'Aniversario de Pareja' },
  { id: 'dia_madre', label: 'Día de la Madre' },
  { id: 'dia_padre', label: 'Día del Padre' },
  { id: 'navidad', label: 'Navidad' },
  { id: 'otro', label: 'Otro Evento' }
];

const SubscriptionSurveyPage = () => {
  const { userProfile, updateUserProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  
  const [events, setEvents] = useState([
    { id: Date.now().toString(), type: '', recipientName: '', date: '', boxesCount: 1 }
  ]);

  useEffect(() => {
    // Si ya completó la encuesta y no quiere re-editar, podría redirigir.
    // Pero lo dejamos abierto si desea actualizar sus fechas luego.
  }, []);

  const addEvent = () => {
    if (events.length >= 10) return alert('Máximo 10 eventos.');
    setEvents([...events, { id: Date.now().toString(), type: '', recipientName: '', date: '', boxesCount: 1 }]);
  };

  const removeEvent = (id) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const updateEvent = (id, field, value) => {
    setEvents(events.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Validar
    const validEvents = events.filter(ev => ev.type && ev.date);
    if (validEvents.length === 0 && events.length > 0) {
      alert('Por favor, completa al menos una fecha o elige "Saltar por ahora".');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        subscriptionDates: validEvents,
        hasCompletedSurvey: true
      });
      navigate('/', { replace: true });
    } catch (err) {
      alert('Hubo un error al guardar tus fechas.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ hasCompletedSurvey: true });
      navigate('/', { replace: true });
    } catch (err) {
      navigate('/', { replace: true });
    }
  };

  if (loading) return <div className={styles.loading}>Cargando...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.headerIcon}>
          <Gift size={48} color="#8b5cf6" />
        </div>
        <h1 className={styles.title}>Tus Fechas Importantes</h1>
        <p className={styles.description}>
          Programa tus regalos anuales (Día de la Madre, cumpleaños, aniversarios) y nosotros nos encargamos de que recibas las Boxes en el momento perfecto con nuestra suscripción mensual.
        </p>

        <form onSubmit={handleSave} className={styles.form}>
          {events.map((ev, index) => (
            <div key={ev.id} className={styles.eventBox}>
              <div className={styles.eventHeader}>
                <h3>Evento #{index + 1}</h3>
                {events.length > 1 && (
                  <button type="button" onClick={() => removeEvent(ev.id)} className={styles.removeBtn}>
                    <Trash2 size={16} /> Eliminar
                  </button>
                )}
              </div>
              
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Tipo de Evento</label>
                  <select 
                    value={ev.type} 
                    onChange={e => updateEvent(ev.id, 'type', e.target.value)}
                    required
                  >
                    <option value="">Selecciona un evento...</option>
                    {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Fecha</label>
                  <input 
                    type="date" 
                    value={ev.date} 
                    onChange={e => updateEvent(ev.id, 'date', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Nombre del Agasajado (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Mamá, Mi amor, Juan..."
                    value={ev.recipientName} 
                    onChange={e => updateEvent(ev.id, 'recipientName', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>Cantidad de Boxes (1-4)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="4" 
                    value={ev.boxesCount} 
                    onChange={e => updateEvent(ev.id, 'boxesCount', parseInt(e.target.value))}
                    required
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="button" onClick={addEvent} className={styles.addBtn}>
            <Plus size={18} /> Añadir otra fecha
          </button>

          <div className={styles.actions}>
            <button type="button" onClick={handleSkip} className={styles.skipBtn} disabled={saving}>
              Saltar por ahora
            </button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar mis fechas'} <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubscriptionSurveyPage;
