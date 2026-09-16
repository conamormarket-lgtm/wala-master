import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useProducts } from '../../hooks/useProducts';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { getUserSuggestedPackages } from '../../services/fechasImportantes';
import { GlassCard, Reveal } from '../../components/ui';
// eslint-disable-next-line no-unused-vars
import { Gift, Calendar, CalendarHeart, Plus, Edit2, Trash2, X, Globe, ShoppingCart, Package, Camera, AlertCircle, Check } from 'lucide-react';
// Helper de subida YA existente en el repo (mismo que usan AvatarStudio / CategoryNavEditor).
import { uploadFile } from '../../services/firebase/storage';
import styles from './CuentaFechasImportantesPage.module.css';
import { T } from '../../i18n/useTranslatedText';

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

const getGlobalDates = (roleKey, gender) => {
  const dates = [];
  if (gender === 'Femenino') dates.push('Día de la Mujer');
  if (gender === 'Masculino') dates.push('Día del Hombre');
  
  if (roleKey === 'pareja') dates.push('San Valentín');
  if (roleKey === 'padres' && gender === 'Femenino') dates.push('Día de la Madre');
  if (roleKey === 'padres' && gender === 'Masculino') dates.push('Día del Padre');
  if (roleKey === 'hijos') dates.push('Día del Niño');
  if (roleKey === 'amigos') dates.push('Día de la Amistad');
  
  return dates;
};

// Días que faltan para la PRÓXIMA vez que se celebre una fecha 'YYYY-MM-DD'.
// Solo importan mes y día: un cumpleaños del 2001 se celebra igual este año, y
// si ya pasó, la próxima es el año que viene. Devuelve null si no hay fecha.
// (Un 29 de febrero cae en el 1 de marzo los años no bisiestos; es el
// comportamiento nativo de Date y alcanza para un recordatorio.)
const diasParaProxima = (iso) => {
  if (!iso) return null;
  const [, mesStr, diaStr] = String(iso).split('-');
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  if (!mes || !dia) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let proxima = new Date(hoy.getFullYear(), mes - 1, dia);
  if (proxima < hoy) proxima = new Date(hoy.getFullYear() + 1, mes - 1, dia);
  return Math.round((proxima - hoy) / 86400000);
};

// "¡Es hoy!" / "Mañana" / "En 12 días". Más allá de un mes no se avisa: la
// fecha completa ya está escrita al lado y un "en 210 días" no ayuda a nadie.
const avisoProximidad = (dias) => {
  if (dias == null || dias > 30) return null;
  if (dias === 0) return '¡Es hoy!';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
};

const CuentaFechasImportantesPage = () => {
  // eslint-disable-next-line no-unused-vars
  const { user, userProfile, updateUserProfile } = useAuth();
  const { addToCart } = useCart();
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempRecipient, setTempRecipient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [suggestedPackages, setSuggestedPackages] = useState([]);
  const [addedPackageIds, setAddedPackageIds] = useState(new Set());

  // ── Subida de FOTO de la persona (avatar del recipient) ──────────────────
  // Reúsa el helper uploadFile (Firebase Storage) igual que AvatarStudio.
  const photoInputRef = useRef(null);          // input file oculto del modal
  const [uploadingPhoto, setUploadingPhoto] = useState(false); // spinner mientras sube
  const [photoError, setPhotoError] = useState(null);          // mensaje de error de subida
  // Validación del modal. Antes eran alert() del navegador: bloquean la
  // pantalla, no dicen QUÉ campo falla cuando hay varias fechas y se ven
  // como un error del sistema, no como "te faltó algo".
  const [formError, setFormError] = useState(null);

  const recipients = userProfile?.giftRecipients || [];
  const hasCompletedSurvey = userProfile?.hasCompletedSurvey;

  // Catálogo PÚBLICO (useProducts sin opciones ya excluye lo oculto/borrado:
  // visible !== false). Los paquetes sugeridos guardan una FOTO del producto
  // al momento de armarlos (id/nombre/precio/imagen), así que por su cuenta
  // seguirían mostrando productos dados de baja -y "Agregar todo al carrito"
  // metía ese fantasma al carrito, con el precio viejo-. Acá se cruzan contra
  // el catálogo real: lo que ya no está se cae, y lo que sigue se pinta con
  // sus datos de hoy, no con los de cuando se armó el paquete.
  const { data: catalogo, isLoading: cargandoCatalogo } = useProducts();
  const catalogoPorId = useMemo(() => {
    const indice = new Map();
    (catalogo || []).forEach((p) => {
      if (p?.id != null) indice.set(String(p.id), p);
    });
    return indice;
  }, [catalogo]);

  const resolverPaquete = (pkg) => {
    const guardados = pkg.products || [];
    const items = guardados
      .map((prod) => {
        const vivo = catalogoPorId.get(String(prod.id));
        if (!vivo) return null;
        return {
          producto: vivo,
          nombre: vivo.name || prod.name,
          precio: vivo.salePrice || vivo.price,
          imagen: vivo.images?.[0] || PLACEHOLDER_IMG,
        };
      })
      .filter(Boolean);
    return { items, retirados: guardados.length - items.length };
  };

  // Load suggested packages for current user
  useEffect(() => {
    if (user?.uid) {
      getUserSuggestedPackages(user.uid).then(pkgs => {
        setSuggestedPackages(pkgs);
      });
    }
  }, [user?.uid]);

  // Get packages for a specific recipient
  const getPackagesForRecipient = (rec) => {
    return suggestedPackages.filter(pkg => 
      pkg.recipientId === rec.id
    );
  };

  // Manda al carrito el producto REAL del catálogo (no el recortado
  // {id,name,price,images} que se armaba con la foto guardada): así viajan
  // precio de oferta, variantes e imágenes tal como están hoy.
  const handleAddPackageToCart = (pkg, items) => {
    items.forEach(({ producto }) => addToCart(producto, {}, null, 1));
    setAddedPackageIds(prev => new Set([...prev, pkg.id]));
  };

  if (!hasCompletedSurvey) {
    return (
      <div className={styles.page}>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.empty} bodyClassName={styles.emptyBody}>
          <div className={styles.emptyIcon}>
            <Gift size={26} aria-hidden="true" />
          </div>
          <p className={styles.emptyTitle}>
            <T>Gana recompensas diciéndonos qué te gusta</T>
          </p>
          <p className={styles.emptyText}>
            Al completar tu perfil de regalos ganas monedas para canjear por descuentos, y
            te recordamos las fechas más importantes de tus seres queridos.
          </p>
          <Link to="/encuesta-suscripcion" className={styles.btnSolido}>
            Completar la encuesta
          </Link>
        </GlassCard>
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
      photoUrl: null, // foto de la persona (avatar circular); null = sin foto
      events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }],
    });
    setPhotoError(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (rec) => {
    setTempRecipient(JSON.parse(JSON.stringify(rec)));
    setPhotoError(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Cerrar el modal. No se cierra mientras se guarda o sube una foto: perder
  // el formulario a mitad de una operación en curso es peor que esperar.
  const closeModal = React.useCallback(() => {
    if (saving || uploadingPhoto) return;
    setIsModalOpen(false);
    setFormError(null);
  }, [saving, uploadingPhoto]);

  // Escape cierra, como en cualquier modal del sistema.
  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen, closeModal]);

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

  // Abre el selector de archivo nativo para la foto de la persona.
  const handlePickPhoto = () => {
    if (uploadingPhoto) return;
    photoInputRef.current?.click();
  };

  // Sube la imagen elegida a Firebase Storage y guarda la URL en tempRecipient.photoUrl.
  // Mismo patrón que AvatarStudio: FileReader no es necesario aquí porque uploadFile
  // recibe el File directamente; la preview usa la URL ya subida.
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    // Permite volver a elegir el mismo archivo en una nueva selección.
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('El archivo debe ser una imagen.');
      return;
    }

    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      // Ruta sugerida: gift_recipients/{uid}/{Date.now()}.jpg
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `gift_recipients/${user?.uid || 'anon'}/${Date.now()}.${ext}`;
      const { url, error } = await uploadFile(file, path);
      if (error || !url) {
        setPhotoError(error || 'No se pudo subir la foto. Inténtalo de nuevo.');
        return;
      }
      setTempRecipient(prev => ({ ...prev, photoUrl: url }));
    } catch (err) {
      setPhotoError('No se pudo subir la foto. Inténtalo de nuevo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Quita la foto del recipient en edición (vuelve al placeholder con inicial).
  const handleRemovePhoto = () => {
    setPhotoError(null);
    setTempRecipient(prev => ({ ...prev, photoUrl: null }));
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
    setFormError(null);
    if (!tempRecipient.name || tempRecipient.name.trim() === '') {
      return setFormError('Falta el nombre de la persona.');
    }
    if (!tempRecipient.gender || tempRecipient.gender.trim() === '') {
      return setFormError('Falta elegir el género.');
    }

    for (const ev of tempRecipient.events) {
      const evTypeConfig = EVENT_TYPES.find(e => e.label === ev.type) || EVENT_TYPES.find(e => e.id === 'otro');
      if (ev.type === 'Fecha Especial' && (!ev.customName || ev.customName.trim() === '')) {
        return setFormError('Escribe qué se celebra en la fecha especial.');
      }
      if (evTypeConfig.needsDate && (!ev.date || ev.date.trim() === '')) {
        const cual = ev.type === 'Fecha Especial' ? ev.customName : ev.type;
        return setFormError(`Falta la fecha de "${cual}".`);
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
      setFormError('No pudimos guardar los cambios. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Cabecera ─────────────────────────────────────────────────── */}
      <Reveal>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.headerIcon}>
              <CalendarHeart size={20} aria-hidden="true" />
            </div>
            <h2>Fechas importantes</h2>
            <button type="button" onClick={handleAddNew} className={`${styles.btnSolido} ${styles.headerAction}`}>
              <Plus size={17} aria-hidden="true" /> Añadir persona
            </button>
          </div>
          <p className={styles.headerSub}>
            Guarda a quién quieres regalarle y cuándo. Te avisamos cuando se acerque la
            fecha y te armamos un paquete con productos que le pegan.
          </p>
        </GlassCard>
      </Reveal>

      {recipients.length === 0 ? (
        <Reveal>
          <GlassCard variant="solid" padding="lg" animate={false} className={styles.empty} bodyClassName={styles.emptyBody}>
            <div className={styles.emptyIcon}>
              <Calendar size={26} aria-hidden="true" />
            </div>
            <p className={styles.emptyTitle}>Todavía no agregaste a nadie.</p>
            <p className={styles.emptyText}>
              Empieza por la persona a la que más le regalas: con su cumpleaños alcanza.
            </p>
            <button type="button" onClick={handleAddNew} className={styles.btnSolido}>
              <Plus size={17} aria-hidden="true" /> Añadir persona
            </button>
          </GlassCard>
        </Reveal>
      ) : (
        // OJO: acá NO va <Stagger>/<StaggerItem>. El contenedor revela a sus
        // hijos una sola vez (whileInView + once), así que una tarjeta agregada
        // después se quedaría invisible. <Reveal> por tarjeta monta su propio
        // observador. Mismo motivo que en el historial de Mis Referidos.
        <div className={styles.grid}>
          {recipients.map((rec, idx) => {
            const fechasGlobales = getGlobalDates(rec.roleKey, rec.gender);
            const recPackages = getPackagesForRecipient(rec);

            return (
              <Reveal key={rec.id} delay={Math.min(idx, 6) * 0.06} className={styles.gridItem}>
                <GlassCard
                  as="article"
                  variant="solid"
                  padding="lg"
                  animate={false}
                  className={styles.personCard}
                  bodyClassName={styles.personBody}
                >
                  {/* Identidad */}
                  <div className={styles.personTop}>
                    <div className={styles.cardAvatar}>
                      {rec.photoUrl ? (
                        <img src={rec.photoUrl} alt="" className={styles.cardAvatarImg} />
                      ) : (
                        <span className={styles.cardAvatarInitial}>
                          {(rec.name || '?').trim().charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className={styles.personIdent}>
                      <h3 className={styles.cardTitle}>{rec.name || 'Sin nombre'}</h3>
                      <span className={styles.cardRole}>{rec.roleDisplay}</span>
                    </div>
                    <div className={styles.cardActions}>
                      <button type="button" onClick={() => handleEdit(rec)} className={styles.iconBtn} title="Editar">
                        <Edit2 size={17} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => handleDelete(rec.id)} className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Eliminar">
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Fechas propias: la que está cerca se marca con su aviso. */}
                  <ul className={styles.eventsList}>
                    {rec.events.map((ev) => {
                      const dias = diasParaProxima(ev.date);
                      const aviso = avisoProximidad(dias);
                      return (
                        <li key={ev.id} className={styles.eventItem}>
                          <Calendar size={15} aria-hidden="true" className={styles.eventIcon} />
                          <span className={styles.eventName}>
                            {ev.type === 'Fecha Especial' ? ev.customName : ev.type}
                          </span>
                          <span className={styles.eventDate}>
                            {ev.date
                              ? new Date(ev.date + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })
                              : 'Sin fecha'}
                          </span>
                          {aviso && (
                            <span className={`${styles.eventSoon} ${dias === 0 ? styles.eventToday : ''}`}>
                              {aviso}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Fechas del calendario que le corresponden por rol/género. */}
                  {fechasGlobales.length > 0 && (
                    <div className={styles.globalDatesContainer}>
                      {fechasGlobales.map((gDate) => (
                        <span key={gDate} className={styles.globalDateBadge}>
                          <Globe size={12} aria-hidden="true" /> {gDate}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Paquete sugerido. Mientras el catálogo carga no se pinta
                      nada: mostrar la foto guardada y recortarla un segundo
                      después se ve como un error. */}
                  {!cargandoCatalogo && recPackages.length > 0 && (
                    <div className={styles.suggestedSection}>
                      {recPackages.map((pkg) => {
                        const { items, retirados } = resolverPaquete(pkg);
                        if (items.length === 0) return null;
                        const isAdded = addedPackageIds.has(pkg.id);
                        const total = items.reduce((acc, it) => acc + (Number(it.precio) || 0), 0);

                        return (
                          <div key={pkg.id} className={styles.suggestedPackage}>
                            <div className={styles.suggestedHeader}>
                              <Package size={15} aria-hidden="true" />
                              <span className={styles.suggestedTitle}>Paquete sugerido</span>
                              <span className={styles.suggestedTotal}>S/ {total.toFixed(2)}</span>
                            </div>

                            <ul className={styles.suggestedProducts}>
                              {items.map((it) => (
                                <li key={it.producto.id} className={styles.suggestedProductItem}>
                                  <img
                                    src={it.imagen}
                                    alt=""
                                    className={styles.suggestedProductImg}
                                    loading="lazy"
                                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                                  />
                                  <Link to={`/producto/${it.producto.id}`} className={styles.suggestedProductName}>
                                    {it.nombre}
                                  </Link>
                                  <span className={styles.suggestedProductPrice}>S/ {it.precio}</span>
                                </li>
                              ))}
                            </ul>

                            {retirados > 0 && (
                              <p className={styles.suggestedNota}>
                                <AlertCircle size={13} aria-hidden="true" />
                                {retirados === 1
                                  ? 'Un producto de esta sugerencia ya no está disponible y se quitó.'
                                  : `${retirados} productos de esta sugerencia ya no están disponibles y se quitaron.`}
                              </p>
                            )}

                            <button
                              type="button"
                              className={`${styles.btnSolido} ${styles.addToCartBtn} ${isAdded ? styles.addToCartBtnDone : ''}`}
                              onClick={() => !isAdded && handleAddPackageToCart(pkg, items)}
                              disabled={isAdded}
                            >
                              {isAdded ? <Check size={16} aria-hidden="true" /> : <ShoppingCart size={16} aria-hidden="true" />}
                              {isAdded ? 'Agregado al carrito' : 'Agregar todo al carrito'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      )}

      {isModalOpen && tempRecipient && (
        // El clic en el fondo cierra; el de adentro no burbujea hasta acá.
        <div
          className={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          role="presentation"
        >
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="fechasModalTitle">
            {/* Cabecera fija: antes se iba con el scroll y, en una pantalla
                baja, el formulario arrancaba cortado por la mitad. */}
            <div className={styles.modalHeader}>
              <div className={styles.headerIcon}>
                <CalendarHeart size={18} aria-hidden="true" />
              </div>
              <h2 id="fechasModalTitle">
                {tempRecipient.name ? `Editar a ${tempRecipient.name}` : 'Añadir persona'}
              </h2>
              <button type="button" onClick={closeModal} className={styles.closeBtn} aria-label="Cerrar">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.formBody}>
              {/* ── FOTO de la persona (avatar circular) ──────────────────────
                  Sube/cambia/quita la foto. La URL se guarda en tempRecipient.photoUrl
                  y se persiste con el resto del recipient al pulsar "Guardar". */}
              <div className={styles.photoUploadRow}>
                <div className={styles.photoAvatar}>
                  {tempRecipient.photoUrl ? (
                    <img
                      src={tempRecipient.photoUrl}
                      alt=""
                      className={styles.photoAvatarImg}
                    />
                  ) : (
                    <span className={styles.photoAvatarInitial}>
                      {(tempRecipient.name || '?').trim().charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                  {uploadingPhoto && (
                    <div className={styles.photoAvatarOverlay}>Subiendo…</div>
                  )}
                </div>

                <div className={styles.photoActions}>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handlePickPhoto}
                    disabled={uploadingPhoto}
                    className={styles.photoBtn}
                  >
                    <Camera size={15} aria-hidden="true" />
                    {uploadingPhoto
                      ? 'Subiendo…'
                      : (tempRecipient.photoUrl ? 'Cambiar foto' : 'Subir foto')}
                  </button>
                  {tempRecipient.photoUrl && !uploadingPhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className={styles.photoRemoveBtn}
                    >
                      Quitar foto
                    </button>
                  )}
                  <p className={styles.photoHint}>Opcional. Ayuda a reconocerla de un vistazo.</p>
                  {photoError && <p className={styles.photoError}>{photoError}</p>}
                </div>
              </div>

              {/* Datos básicos. La grilla reemplaza a los style={{flex}} inline. */}
              <div className={styles.fieldRow}>
                <div className={`${styles.fieldGroup} ${styles.fieldGrow}`}>
                  <label htmlFor="fiNombre"><T>Nombre de la persona</T> *</label>
                  <input
                    id="fiNombre"
                    type="text"
                    className={styles.input}
                    placeholder="Ej. Carlos"
                    value={tempRecipient.name}
                    onChange={e => handleTempChange('name', e.target.value)}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="fiGenero"><T>Género</T> *</label>
                  <select
                    id="fiGenero"
                    className={styles.input}
                    value={tempRecipient.gender || ''}
                    onChange={e => handleTempChange('gender', e.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="fiRol"><T>Relación</T> *</label>
                <select
                  id="fiRol"
                  className={styles.input}
                  value={tempRecipient.roleKey || 'otros'}
                  onChange={e => handleTempChange('roleKey', e.target.value)}
                >
                  {Object.keys(ROLES_MAP).map(key => (
                    <option key={key} value={key}>{ROLES_MAP[key].label}</option>
                  ))}
                </select>
                <p className={styles.fieldHint}>
                  Con la relación y el género sumamos las fechas del calendario que le
                  tocan (Día de la Madre, del Padre, de la Amistad…).
                </p>
              </div>

              {/* ── Fechas ──────────────────────────────────────────────────
                  El cumpleaños es siempre el primer evento y no se puede quitar
                  ni cambiar de tipo; el resto sí. Antes esa diferencia se
                  pintaba con style={{}} condicionales en medio del JSX. */}
              <div className={styles.datesSection}>
                <h3 className={styles.datesTitle}>Fechas de esta persona</h3>

                {tempRecipient.events.map((event, eventIdx) => {
                  const evTypeConfig = EVENT_TYPES.find(e => e.label === event.type) || EVENT_TYPES.find(e => e.id === 'otro');
                  const esCumple = eventIdx === 0;

                  return (
                    <div
                      key={event.id}
                      className={`${styles.dateRow} ${esCumple ? styles.dateRowMain : ''}`}
                    >
                      <div className={styles.dateFields}>
                        {esCumple ? (
                          <span className={styles.dateFixedLabel}>Cumpleaños *</span>
                        ) : (
                          <select
                            className={styles.input}
                            value={event.type}
                            onChange={e => updateEvent(eventIdx, 'type', e.target.value)}
                            aria-label="Tipo de fecha"
                          >
                            {EVENT_TYPES.filter(et => et.id !== 'cumpleanos').map(et => (
                              <option key={et.id} value={et.label}>{et.label}</option>
                            ))}
                          </select>
                        )}

                        {event.type === 'Fecha Especial' && !esCumple && (
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="¿Qué se celebra? Ej. Bautizo"
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
                            aria-label="Fecha"
                          />
                        )}
                      </div>

                      {!esCumple && (
                        <button
                          type="button"
                          onClick={() => removeEvent(eventIdx)}
                          className={styles.removeBtn}
                          title="Quitar esta fecha"
                          aria-label="Quitar esta fecha"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addEvent} className={styles.addBtn}>
                  <Plus size={17} aria-hidden="true" /> Agregar otra fecha
                </button>
              </div>
            </div>

            {/* Pie fijo, con el aviso de validación justo encima de los botones
                (antes era un alert() del navegador). */}
            <div className={styles.modalFooter}>
              {formError && (
                <p className={styles.formError} role="alert">
                  <AlertCircle size={15} aria-hidden="true" />
                  {formError}
                </p>
              )}
              <div className={styles.footerActions}>
                <button type="button" onClick={closeModal} className={styles.cancelBtn} disabled={saving}>
                  Cancelar
                </button>
                <button type="button" onClick={saveRecipient} className={styles.btnSolido} disabled={saving || uploadingPhoto}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuentaFechasImportantesPage;
