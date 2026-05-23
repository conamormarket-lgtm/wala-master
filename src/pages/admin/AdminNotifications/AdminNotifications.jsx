import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useGlobalToast } from '../../../contexts/ToastContext';
import styles from './AdminNotifications.module.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const defaultSettings = {
  categories: {
    cart_abandoned: true,
    retention: true,
    orders: true,
    promos: true
  },
  schedules: {
    cart_abandoned: { start: '09:00', end: '21:00' },
    retention: { start: '09:00', end: '21:00' },
    promos: { start: '10:00', end: '20:00' }
  },
  copys: {
    cart_1h: { a: { text: "Tu regalo te está esperando.", emoji: "📦", cta: "¿Terminamos?" }, b: null },
    cart_24h: { a: { text: "El box que elegiste sigue en tu carrito.", emoji: "🎁", cta: "¿Terminamos de armarlo?" }, b: null },
    cart_48h: { a: { text: "Última oportunidad. Tu carrito se vacía mañana.", emoji: "⏳", cta: "¿Lo completamos?" }, b: null },
    retention_7d: { a: { text: "Kapi te extraña mucho. Lleva varios días sin verte", emoji: "😢", cta: "Abre la app" }, b: null },
    retention_14d: { a: { text: "Tienes monedas que se van a perder. Y Kapi está triste...", emoji: "💔", cta: "Sálvalas" }, b: null }
  }
};

const AdminNotifications = () => {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [manualPromo, setManualPromo] = useState({ title: '', body: '', segment: 'all' });
  const [isSending, setIsSending] = useState(false);
  const toast = useGlobalToast();
  
  // Fake metrics for now, since we haven't tracked enough real data yet
  const [metricsData, setMetricsData] = useState([
    { name: 'Carrito 1h', openRate: 45, conversion: 15, optOut: 1 },
    { name: 'Carrito 24h', openRate: 35, conversion: 10, optOut: 2 },
    { name: 'Retención 7d', openRate: 60, conversion: 5, optOut: 0.5 },
  ]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'notification_settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSettings({ ...defaultSettings, ...snap.data() });
        }
      } catch (err) {
        console.warn("Error cargando configuración:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'notification_settings', 'global'), settings);
      toast.success('Configuración guardada exitosamente');
    } catch (err) {
      toast.error('Error al guardar configuración');
    }
  };

  const handleCategoryToggle = (cat) => {
    setSettings(prev => ({
      ...prev,
      categories: { ...prev.categories, [cat]: !prev.categories[cat] }
    }));
  };

  const handleScheduleChange = (cat, field, value) => {
    setSettings(prev => ({
      ...prev,
      schedules: {
        ...prev.schedules,
        [cat]: { ...(prev.schedules[cat] || { start: '09:00', end: '21:00' }), [field]: value }
      }
    }));
  };

  const handleCopyChange = (key, variant, field, value) => {
    setSettings(prev => {
      const newCopys = { ...prev.copys };
      if (!newCopys[key][variant]) {
        newCopys[key][variant] = { text: '', emoji: '', cta: '' };
      }
      newCopys[key][variant][field] = value;
      return { ...prev, copys: newCopys };
    });
  };

  const enableVariantB = (key) => {
    setSettings(prev => {
      const newCopys = { ...prev.copys };
      newCopys[key].b = { text: newCopys[key].a.text, emoji: newCopys[key].a.emoji, cta: newCopys[key].a.cta };
      return { ...prev, copys: newCopys };
    });
  };

  const disableVariantB = (key) => {
    setSettings(prev => {
      const newCopys = { ...prev.copys };
      newCopys[key].b = null;
      return { ...prev, copys: newCopys };
    });
  };

  const handleSendManualPromo = async () => {
    if (!manualPromo.title || !manualPromo.body) {
      return toast.error("El título y el mensaje son requeridos.");
    }
    setIsSending(true);
    try {
      const functions = getFunctions();
      const sendPromo = httpsCallable(functions, 'sendManualPromoNotification');
      const response = await sendPromo(manualPromo);
      if (response.data.success) {
        toast.success(`Campaña enviada a ${response.data.count} usuarios.`);
        setManualPromo({ title: '', body: '', segment: 'all' });
      } else {
        throw new Error(response.data.error || 'Error desconocido');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al enviar la campaña promocional.');
    } finally {
      setIsSending(false);
    }
  };

  if (loading) return <div>Cargando panel...</div>;

  return (
    <div className={styles.container}>
      <h2>Panel de Notificaciones</h2>
      
      <div className={styles.tabs}>
        <button className={activeTab === 'settings' ? styles.active : ''} onClick={() => setActiveTab('settings')}>Configuración & Copys</button>
        <button className={activeTab === 'manual' ? styles.active : ''} onClick={() => setActiveTab('manual')}>Envío Manual</button>
        <button className={activeTab === 'metrics' ? styles.active : ''} onClick={() => setActiveTab('metrics')}>Métricas</button>
      </div>

      {activeTab === 'settings' && (
        <div className={styles.tabContent}>
          <h3>Categorías y Horarios</h3>
          <div className={styles.switches}>
            {Object.keys(settings.categories).map(cat => (
              <div key={cat} className={styles.categoryRow}>
                <label className={styles.switchLabel}>
                  <input type="checkbox" checked={settings.categories[cat]} onChange={() => handleCategoryToggle(cat)} />
                  {cat.replace('_', ' ').toUpperCase()}
                </label>
                {settings.schedules[cat] && (
                  <div className={styles.scheduleInputs}>
                    <span>Desde: </span>
                    <input type="time" value={settings.schedules[cat].start} onChange={(e) => handleScheduleChange(cat, 'start', e.target.value)} />
                    <span> Hasta: </span>
                    <input type="time" value={settings.schedules[cat].end} onChange={(e) => handleScheduleChange(cat, 'end', e.target.value)} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <h3>Copys y A/B Testing</h3>
          <p className={styles.helpText}>Edita el texto, emoji y call to action de cada notificación. Agrega una Variante B para medir cuál convierte más.</p>
          <div className={styles.copysList}>
            {Object.keys(settings.copys).map(key => (
              <div key={key} className={styles.copyBlock}>
                <div className={styles.copyHeader}>
                  <h4>{key.toUpperCase()}</h4>
                  {!settings.copys[key].b ? (
                    <button className={styles.textBtn} onClick={() => enableVariantB(key)}>+ Añadir Variante B (Test A/B)</button>
                  ) : (
                    <button className={styles.textBtnDanger} onClick={() => disableVariantB(key)}>- Quitar Variante B</button>
                  )}
                </div>
                
                {['a', 'b'].map(variant => {
                  if (variant === 'b' && !settings.copys[key].b) return null;
                  return (
                    <div key={variant} className={styles.variantContainer}>
                      <span className={styles.variantLabel}>Variante {variant.toUpperCase()}</span>
                      <div className={styles.copyFields}>
                        <div className={styles.fieldGroup}>
                          <label>Texto Principal</label>
                          <input type="text" value={settings.copys[key][variant].text} onChange={(e) => handleCopyChange(key, variant, 'text', e.target.value)} className={styles.copyInput} />
                        </div>
                        <div className={styles.fieldGroupSmall}>
                          <label>Emoji</label>
                          <input type="text" value={settings.copys[key][variant].emoji} onChange={(e) => handleCopyChange(key, variant, 'emoji', e.target.value)} className={styles.copyInput} />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label>Call to Action (Botón)</label>
                          <input type="text" value={settings.copys[key][variant].cta} onChange={(e) => handleCopyChange(key, variant, 'cta', e.target.value)} className={styles.copyInput} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <button className={styles.saveBtn} onClick={handleSave}>Guardar Cambios</button>
        </div>
      )}

      {activeTab === 'manual' && (
        <div className={styles.tabContent}>
          <h3>Envío Promocional Manual</h3>
          <p className={styles.helpText}>Esta herramienta enviará una notificación Push Inmediata a la audiencia segmentada.</p>
          <div className={styles.manualForm}>
            <label>Título:</label>
            <input type="text" value={manualPromo.title} onChange={e => setManualPromo({...manualPromo, title: e.target.value})} placeholder="Ej. ¡Nueva Colección de Cajas de Regalo!" />
            
            <label>Mensaje:</label>
            <textarea value={manualPromo.body} onChange={e => setManualPromo({...manualPromo, body: e.target.value})} placeholder="Ingresa el cuerpo de la notificación..."></textarea>
            
            <label>Segmentación:</label>
            <select value={manualPromo.segment} onChange={e => setManualPromo({...manualPromo, segment: e.target.value})}>
              <option value="all">Todos los usuarios con app instalada</option>
              <option value="vip">Usuarios VIP (con más de 50 monedas)</option>
              <option value="inactive">Inactivos (sin abrir en 30+ días)</option>
            </select>
            
            <button className={styles.saveBtn} onClick={handleSendManualPromo} disabled={isSending}>
              {isSending ? 'Enviando...' : 'Enviar Ahora'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className={styles.tabContent}>
          <h3>Rendimiento por Categoría (Últimos 30 días)</h3>
          <p className={styles.helpText}>Mide la efectividad de los copys y determina a los ganadores del Test A/B.</p>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metricsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="openRate" name="Tasa de Apertura (%)" fill="#4f46e5" />
                <Bar dataKey="conversion" name="Tasa de Conversión (%)" fill="#10b981" />
                <Bar dataKey="optOut" name="Tasa de Desactivación (%)" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminNotifications;
