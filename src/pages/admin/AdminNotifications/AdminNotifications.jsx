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
    orders: { start: '08:00', end: '21:00' },
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

// Nombre y explicación de cada categoría (antes se mostraba la clave cruda).
const CATEGORIAS = {
  cart_abandoned: { nombre: 'Carrito abandonado', detalle: 'Avisa a la 1 h, 24 h y 48 h a quien dejó productos en el carrito. Solo a quien tiene la app.' },
  retention: { nombre: 'Kapi te extraña', detalle: 'Avisa a quien no abre la app hace 7 o 14 días. Solo a quien tiene la app.' },
  orders: { nombre: 'Pedidos', detalle: 'Avisa cuando se confirma el pago, entra a producción, sale a reparto y se entrega. Fuera de horario queda en la campanita y la push no sale.' },
  promos: { nombre: 'Ofertas programadas', detalle: 'Las ofertas programadas solo salen dentro de este horario. Apagado: quedan en espera. "Enviar ahora" fuera de horario pide confirmación.' },
};

// Avisos automáticos editables, en lenguaje de negocio (las claves internas
// cart_1h, retention_7d… no le dicen nada a quien administra la tienda).
// `titulo` es el título FIJO con que llega la notificación (lo pone el motor,
// functions/notificationsEngine.js); acá se muestra en la vista previa.
const GRUPOS_AVISOS = [
  {
    nombre: '🛒 Carrito abandonado',
    detalle: 'Para quien agregó productos al carrito y no terminó de comprar.',
    avisos: [
      { key: 'cart_1h', nombre: '1 hora después', cuando: 'Sale 1 hora después de que dejó el carrito.', titulo: '🛒 Tu Carrito' },
      { key: 'cart_24h', nombre: 'Al día siguiente', cuando: 'Sale 24 horas después, si todavía no compró.', titulo: '🛒 Tu Carrito' },
      { key: 'cart_48h', nombre: 'Último aviso', cuando: 'Sale a las 48 horas: es el último recordatorio del carrito.', titulo: '🛒 Tu Carrito' },
    ],
  },
  {
    nombre: '🐾 Kapi te extraña',
    detalle: 'Para quien dejó de abrir la app (Kapi es la mascota virtual).',
    avisos: [
      { key: 'retention_7d', nombre: 'Después de 7 días', cuando: 'Sale cuando lleva 7 días sin abrir la app.', titulo: 'Mascota Hambrienta' },
      { key: 'retention_14d', nombre: 'Después de 14 días', cuando: 'Sale cuando lleva 14 días sin abrir la app.', titulo: 'Kapi te extraña' },
    ],
  },
];

// Vista previa: arma el mensaje igual que el motor (texto + frase final +
// emoji) y reemplaza {nombre}/{monedas} por datos de ejemplo.
const vistaPrevia = (v) => [v?.text, v?.cta, v?.emoji]
  .map((x) => (x || '').trim())
  .filter(Boolean)
  .join(' ')
  .replace(/\{nombre\}/g, 'María')
  .replace(/\{monedas\}/g, '25');

// Nombres de los avisos automáticos para la tabla A/B.
const NOMBRES_AVISO = {
  cart_1h: 'Carrito 1 h', cart_24h: 'Carrito 24 h', cart_48h: 'Carrito 48 h',
  retention_7d: 'Kapi 7 días', retention_14d: 'Kapi 14 días',
  orders: 'Pedidos', fecha_recordatorio: 'Fechas importantes', manual_promo: 'Ofertas (campañas)',
};

const tasa = (abiertos, enviados) => (enviados > 0 ? `${Math.round((abiertos / enviados) * 100)}%` : '—');

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
  // Enviados/abiertos por aviso y variante (los cuenta el servidor).
  const [stats, setStats] = useState([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'notification_settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          // Mezcla por sección: una configuración guardada antes de que existiera
          // una categoría (p. ej. el horario de "orders") la toma de los valores
          // por defecto en vez de perderla.
          const d = snap.data();
          setSettings({
            ...defaultSettings,
            ...d,
            categories: { ...defaultSettings.categories, ...(d.categories || {}) },
            schedules: { ...defaultSettings.schedules, ...(d.schedules || {}) },
            copys: { ...defaultSettings.copys, ...(d.copys || {}) },
          });
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
    Promise.all([
      getDocs(query(collection(db, 'notification_campaigns'), orderBy('createdAt', 'desc'), limit(50))),
      getDocs(collection(db, 'notification_stats')),
    ])
      .then(([snapC, snapS]) => {
        if (!vivo) return;
        setCampanas(snapC.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStats(snapS.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch((err) => console.warn('Error cargando historial:', err))
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

  const insertarDato = (key, variant, dato) => {
    const actual = settings.copys[key]?.[variant]?.text || '';
    handleCopyChange(key, variant, 'text', `${actual}${actual && !actual.endsWith(' ') ? ' ' : ''}{${dato}}`);
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

  const handleSendManualPromo = async (forzar = false) => {
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
        forzar,
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
      // PROMOS apagado o fuera de horario: se confirma y se reenvía forzando.
      const motivo = err?.details?.motivo;
      if (!forzar && (motivo === 'promos_apagado' || motivo === 'promos_fuera_horario')) {
        setIsSending(false);
        const texto = motivo === 'promos_apagado'
          ? 'La categoría "Ofertas programadas" (PROMOS) está apagada. ¿Enviar igual ahora?'
          : `Estás fuera del horario de ofertas (${settings.schedules?.promos?.start || '10:00'} a ${settings.schedules?.promos?.end || '20:00'}). ¿Enviar igual ahora?`;
        if (window.confirm(texto)) handleSendManualPromo(true);
        return;
      }
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
          <h3>¿Qué avisos están prendidos y en qué horario?</h3>
          <p className={styles.helpText}>Desmarca un aviso para que deje de enviarse. Las horas son de Lima.</p>
          <div className={styles.switches}>
            {Object.keys(settings.categories).map(cat => (
              <div key={cat} className={styles.categoryRow}>
                <label className={styles.switchLabel}>
                  <input type="checkbox" checked={settings.categories[cat]} onChange={() => handleCategoryToggle(cat)} />
                  <span>
                    {CATEGORIAS[cat]?.nombre || cat}
                    {CATEGORIAS[cat]?.detalle && <small className={styles.categoryHelp}>{CATEGORIAS[cat].detalle}</small>}
                  </span>
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

          <h3>Textos de los avisos automáticos</h3>
          <p className={styles.helpText}>
            Escribe lo que dirá cada aviso. A la derecha ves cómo le llegará al cliente en su celular.
            Los botones <strong>+ Nombre</strong> y <strong>+ Monedas</strong> agregan el nombre del cliente o
            cuántas monedas tiene (en la vista previa salen como "María" y "25").
          </p>

          {GRUPOS_AVISOS.map((grupo) => (
            <div key={grupo.nombre} className={styles.grupoAvisos}>
              <h4 className={styles.grupoTitulo}>{grupo.nombre}</h4>
              <p className={styles.helpText}>{grupo.detalle}</p>

              <div className={styles.copysList}>
                {grupo.avisos.filter((a) => settings.copys[a.key]).map((aviso) => {
                  const copy = settings.copys[aviso.key];
                  return (
                    <div key={aviso.key} className={styles.copyBlock}>
                      <div className={styles.copyHeader}>
                        <div>
                          <h4>{aviso.nombre}</h4>
                          <p className={styles.copyCuando}>{aviso.cuando}</p>
                        </div>
                        {!copy.b ? (
                          <button className={styles.textBtn} onClick={() => enableVariantB(aviso.key)}>+ Probar un segundo texto</button>
                        ) : (
                          <button className={styles.textBtnDanger} onClick={() => disableVariantB(aviso.key)}>Quitar el segundo texto</button>
                        )}
                      </div>

                      {['a', 'b'].map((variant) => {
                        if (variant === 'b' && !copy.b) return null;
                        const v = copy[variant];
                        return (
                          <div key={variant} className={styles.variantContainer}>
                            {copy.b && (
                              <span className={styles.variantLabel}>
                                {variant === 'a' ? 'Texto 1 (lo recibe la mitad de los clientes)' : 'Texto 2 (lo recibe la otra mitad)'}
                              </span>
                            )}
                            <div className={styles.copyEditor}>
                              <div className={styles.copyFieldsCol}>
                                <div className={styles.fieldGroup}>
                                  <label>Mensaje</label>
                                  <input type="text" value={v.text} onChange={(e) => handleCopyChange(aviso.key, variant, 'text', e.target.value)} className={styles.copyInput} placeholder="Ej. Tu regalo te está esperando." />
                                  <div className={styles.datosBtns}>
                                    <button type="button" className={styles.datoBtn} onClick={() => insertarDato(aviso.key, variant, 'nombre')}>+ Nombre</button>
                                    <button type="button" className={styles.datoBtn} onClick={() => insertarDato(aviso.key, variant, 'monedas')}>+ Monedas</button>
                                  </div>
                                </div>
                                <div className={styles.copyFieldsRow}>
                                  <div className={styles.fieldGroup}>
                                    <label>Frase final <small>(invita a actuar)</small></label>
                                    <input type="text" value={v.cta} onChange={(e) => handleCopyChange(aviso.key, variant, 'cta', e.target.value)} className={styles.copyInput} placeholder="Ej. ¿Terminamos tu compra?" />
                                  </div>
                                  <div className={styles.fieldGroupSmall}>
                                    <label>Emoji <small>(al final)</small></label>
                                    <input type="text" value={v.emoji} onChange={(e) => handleCopyChange(aviso.key, variant, 'emoji', e.target.value)} className={styles.copyInput} placeholder="🎁" />
                                  </div>
                                </div>
                              </div>

                              <div className={styles.preview} aria-label="Vista previa de la notificación">
                                <span className={styles.previewApp}>WALÁ · ahora</span>
                                <strong className={styles.previewTitulo}>{aviso.titulo}</strong>
                                <span className={styles.previewTexto}>{vistaPrevia(v) || 'Escribe el mensaje…'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className={styles.abInfo}>
            <strong>¿Para qué sirve "Probar un segundo texto"?</strong>
            <p>
              Para saber qué mensaje convence más. La mitad de los clientes recibe el texto 1 y la otra
              mitad el texto 2. En la pestaña <em>Historial</em> ves cuántos abrió cada uno. Cuando uno gane
              con claridad, déjalo como texto 1 y quita el segundo.
            </p>
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

            <button className={styles.saveBtn} onClick={() => handleSendManualPromo(false)} disabled={isSending}>
              {isSending ? 'Enviando...' : manualPromo.cuando === 'programar' ? 'Programar campaña' : 'Enviar ahora'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className={styles.tabContent}>
          <h3>Avisos automáticos: ¿qué texto funciona mejor?</h3>
          <p className={styles.helpText}>
            Enviados y abiertos por cada aviso. "Abierto" = el cliente lo tocó (en la campanita o la push).
            Con al menos 50 envíos por variante ya puedes comparar.
          </p>
          {stats.length === 0 ? (
            <p className={styles.helpText}>Todavía no hay envíos registrados.</p>
          ) : (
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Aviso</th>
                    <th>Variante A</th>
                    <th>Variante B</th>
                    <th>Mejor</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((st) => {
                    const a = st.a || {};
                    const b = st.b || {};
                    const ta = a.sent ? (a.opened || 0) / a.sent : 0;
                    const tb = b.sent ? (b.opened || 0) / b.sent : 0;
                    const comparable = (a.sent || 0) >= 50 && (b.sent || 0) >= 50;
                    return (
                      <tr key={st.id}>
                        <td>{NOMBRES_AVISO[st.id] || st.id}</td>
                        <td>{a.sent || 0} enviados · {a.opened || 0} abiertos ({tasa(a.opened || 0, a.sent || 0)})</td>
                        <td>{b.sent ? `${b.sent} enviados · ${b.opened || 0} abiertos (${tasa(b.opened || 0, b.sent)})` : '—'}</td>
                        <td>{!b.sent ? '—' : comparable ? (ta === tb ? 'Empate' : ta > tb ? '🏆 A' : '🏆 B') : 'Faltan envíos'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ marginTop: '1.5rem' }}>Historial de campañas</h3>
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
                    <th>Abiertas</th>
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
                      <td>{c.status === 'sent' ? `${c.opened || 0} (${tasa(c.opened || 0, c.inAppUsers || 0)})` : '—'}</td>
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
