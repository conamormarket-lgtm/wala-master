import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useGlobalToast } from '../../../contexts/ToastContext';
import BuscadorProducto from '../../../components/admin/BuscadorProducto/BuscadorProducto';
import styles from './AdminNotifications.module.css';

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
    retention_14d: { a: { text: "Tienes {monedas} monedas que se van a perder. Y Kapi está triste...", emoji: "💔", cta: "Sálvalas" }, b: null }
  }
};

const promoVacia = {
  title: '', body: '', segment: 'all', link: '', image: '',
  productId: '', productName: '', cuando: 'ahora', scheduledAt: '',
};

const SEGMENTOS = {
  all: 'Todos', vip: 'VIP', inactive: 'Inactivos', cart: 'Con carrito', dates: 'Con fechas',
};
const ESTADOS = {
  sent: '✅ Enviada', scheduled: '🕒 Programada', sending: '⏳ Enviando', error: '⚠️ Error',
};

const AdminNotifications = () => {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [manualPromo, setManualPromo] = useState(promoVacia);
  const [isSending, setIsSending] = useState(false);
  const toast = useGlobalToast();

  // Historial REAL de campañas (antes esta pestaña mostraba números inventados).
  const [campanas, setCampanas] = useState([]);
  const [cargandoCampanas, setCargandoCampanas] = useState(false);

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

  useEffect(() => {
    if (activeTab !== 'metrics') return;
    let vivo = true;
    setCargandoCampanas(true);
    getDocs(query(collection(db, 'notification_campaigns'), orderBy('createdAt', 'desc'), limit(50)))
      .then((snap) => { if (vivo) setCampanas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); })
      .catch((err) => console.warn('Error cargando campañas:', err))
      .finally(() => { if (vivo) setCargandoCampanas(false); });
    return () => { vivo = false; };
  }, [activeTab]);

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

  // "Anunciar un producto": rellena la campaña con su nombre, foto y link. Si
  // tiene precio de oferta, el texto lo dice; si no, se anuncia como novedad.
  const elegirProducto = (p) => {
    if (!p?.id) {
      setManualPromo((prev) => ({ ...prev, productId: '', productName: '' }));
      return;
    }
    const enOferta = p.salePrice && Number(p.salePrice) < Number(p.price);
    setManualPromo((prev) => ({
      ...prev,
      productId: p.id,
      productName: p.name,
      title: enOferta ? `🔥 Oferta: ${p.name}` : `✨ Nuevo: ${p.name}`,
      body: enOferta
        ? `Ahora a S/ ${p.salePrice} (antes S/ ${p.price}). Solo por tiempo limitado.`
        : `Llegó ${p.name}. Míralo antes de que se agote.`,
      link: `/producto/${p.id}`,
      image: p.images?.[0] || p.mainImage || prev.image,
    }));
  };

  const handleSendManualPromo = async () => {
    if (!manualPromo.title || !manualPromo.body) {
      return toast.error("El título y el mensaje son requeridos.");
    }
    const programar = manualPromo.cuando === 'programar';
    if (programar && !manualPromo.scheduledAt) {
      return toast.error("Elige la fecha y hora del envío.");
    }
    setIsSending(true);
    try {
      const functions = getFunctions();
      const sendPromo = httpsCallable(functions, 'sendManualPromoNotification');
      const response = await sendPromo({
        title: manualPromo.title,
        body: manualPromo.body,
        segment: manualPromo.segment,
        link: manualPromo.link,
        image: manualPromo.image,
        // datetime-local llega sin zona: new Date() lo toma en la hora del navegador.
        scheduledAt: programar ? new Date(manualPromo.scheduledAt).toISOString() : null,
      });
      if (response.data.success) {
        if (response.data.scheduled) {
          toast.success(`Campaña programada para el ${new Date(response.data.scheduledAt).toLocaleString('es-PE')}.`);
        } else {
          toast.success(`Campaña enviada: ${response.data.count} por push y ${response.data.inApp} en la campanita.`);
        }
        setManualPromo(promoVacia);
      } else {
        throw new Error(response.data.error || 'Error desconocido');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Ocurrió un error al enviar la campaña promocional.');
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
        <button className={activeTab === 'manual' ? styles.active : ''} onClick={() => setActiveTab('manual')}>Ofertas y novedades</button>
        <button className={activeTab === 'metrics' ? styles.active : ''} onClick={() => setActiveTab('metrics')}>Historial</button>
      </div>

      {activeTab === 'settings' && (
        <div className={styles.tabContent}>
          <h3>Categorías y Horarios</h3>
          <p className={styles.helpText}>Horario de Lima. Una categoría apagada no envía avisos automáticos.</p>
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
          <p className={styles.helpText}>
            Edita el texto, emoji y call to action de cada notificación. Puedes escribir{' '}
            <code>{'{nombre}'}</code> y <code>{'{monedas}'}</code> dentro del texto. Si agregas una
            Variante B, la mitad de los usuarios recibe esa versión.
          </p>
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
          <h3>Ofertas y novedades</h3>
          <p className={styles.helpText}>
            Llega como push a quienes tienen la app y queda en la campanita 🔔 de todos los del
            segmento (también en la web). Al tocarla se abre el link que pongas.
          </p>
          <div className={styles.manualForm}>
            <label>Anunciar un producto (opcional):</label>
            <BuscadorProducto
              productId={manualPromo.productId}
              productName={manualPromo.productName}
              onElegir={elegirProducto}
            />

            <label>Título:</label>
            <input type="text" maxLength={80} value={manualPromo.title} onChange={e => setManualPromo({ ...manualPromo, title: e.target.value })} placeholder="Ej. 🔥 2x1 en cajas de regalo solo hoy" />

            <label>Mensaje:</label>
            <textarea maxLength={300} value={manualPromo.body} onChange={e => setManualPromo({ ...manualPromo, body: e.target.value })} placeholder="Ingresa el cuerpo de la notificación..."></textarea>

            <label>Link al tocarla (opcional):</label>
            <input type="text" value={manualPromo.link} onChange={e => setManualPromo({ ...manualPromo, link: e.target.value })} placeholder="/producto/abc123, /tienda o https://..." />

            <label>Imagen (opcional, URL https):</label>
            <input type="text" value={manualPromo.image} onChange={e => setManualPromo({ ...manualPromo, image: e.target.value })} placeholder="https://..." />
            {manualPromo.image && (
              <img src={manualPromo.image} alt="" className={styles.previewImg} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}

            <label>Segmentación:</label>
            <select value={manualPromo.segment} onChange={e => setManualPromo({ ...manualPromo, segment: e.target.value })}>
              <option value="all">Todos los usuarios</option>
              <option value="vip">VIP (con 50 monedas o más)</option>
              <option value="inactive">Inactivos (sin abrir en 30+ días)</option>
              <option value="cart">Con productos en el carrito</option>
              <option value="dates">Con fechas importantes registradas</option>
            </select>

            <label>¿Cuándo?</label>
            <select value={manualPromo.cuando} onChange={e => setManualPromo({ ...manualPromo, cuando: e.target.value })}>
              <option value="ahora">Enviar ahora</option>
              <option value="programar">Programar</option>
            </select>
            {manualPromo.cuando === 'programar' && (
              <>
                <input type="datetime-local" value={manualPromo.scheduledAt} onChange={e => setManualPromo({ ...manualPromo, scheduledAt: e.target.value })} />
                <p className={styles.helpText}>Sale en la primera vuelta del motor después de esa hora (corre cada hora en punto).</p>
              </>
            )}

            <button className={styles.saveBtn} onClick={handleSendManualPromo} disabled={isSending}>
              {isSending ? 'Enviando...' : manualPromo.cuando === 'programar' ? 'Programar campaña' : 'Enviar ahora'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className={styles.tabContent}>
          <h3>Historial de campañas</h3>
          <p className={styles.helpText}>Las últimas 50 campañas enviadas o programadas desde este panel.</p>
          {cargandoCampanas ? (
            <p>Cargando...</p>
          ) : campanas.length === 0 ? (
            <p className={styles.helpText}>Todavía no hay campañas.</p>
          ) : (
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Campaña</th>
                    <th>Segmento</th>
                    <th>Estado</th>
                    <th>Push</th>
                    <th>Campanita</th>
                  </tr>
                </thead>
                <tbody>
                  {campanas.map((c) => (
                    <tr key={c.id}>
                      <td>{new Date(c.sentAt || c.scheduledAt || c.createdAt).toLocaleString('es-PE')}</td>
                      <td><strong>{c.title}</strong><br /><span className={styles.helpText}>{c.body}</span></td>
                      <td>{SEGMENTOS[c.segment] || c.segment}</td>
                      <td>{ESTADOS[c.status] || c.status}</td>
                      <td>{c.pushUsers ?? '—'}</td>
                      <td>{c.inAppUsers ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default AdminNotifications;
