import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { getUserSuggestedPackages } from '../../services/fechasImportantes';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import { Gift, Calendar, Plus, Edit2, Trash2, X, Globe, ShoppingCart, Package, Camera } from 'lucide-react';
// Helper de subida YA existente en el repo (mismo que usan AvatarStudio / CategoryNavEditor).
import { uploadFile } from '../../services/firebase/storage';
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

  const recipients = userProfile?.giftRecipients || [];
  const hasCompletedSurvey = userProfile?.hasCompletedSurvey;

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

  // Add all products from a package to cart
  const handleAddPackageToCart = (pkg) => {
    (pkg.products || []).forEach(prod => {
      addToCart(
        { id: prod.id, name: prod.name, price: prod.price, images: [prod.image] },
        {},
        null,
        1
      );
    });
    setAddedPackageIds(prev => new Set([...prev, pkg.id]));
  };

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
      photoUrl: null, // foto de la persona (avatar circular); null = sin foto
      events: [{ id: Math.random().toString(36).substring(2, 9), type: 'Cumpleaños', date: '' }],
    });
    setPhotoError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (rec) => {
    setTempRecipient(JSON.parse(JSON.stringify(rec)));
    setPhotoError(null);
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
          recipients.map(rec => {
            const recPackages = getPackagesForRecipient(rec);
            return (
              <div key={rec.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderMain}>
                    {/* FOTO de la persona (avatar circular). Sin foto -> inicial. */}
                    <div className={styles.cardAvatar}>
                      {rec.photoUrl ? (
                        <img
                          src={rec.photoUrl}
                          alt={rec.name || 'Foto'}
                          className={styles.cardAvatarImg}
                        />
                      ) : (
                        <span className={styles.cardAvatarInitial}>
                          {(rec.name || '?').trim().charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardHeaderText}>
                      <h3 className={styles.cardTitle}>{rec.name}</h3>
                      <span className={styles.cardRole}>{rec.roleDisplay}</span>
                      {getGlobalDates(rec.roleKey, rec.gender).length > 0 && (
                        <div className={styles.globalDatesContainer}>
                          {getGlobalDates(rec.roleKey, rec.gender).map((gDate, i) => (
                            <span key={i} className={styles.globalDateBadge}>
                              <Globe size={12} /> {gDate}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
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

                {/* Suggested Packages Section */}
                {recPackages.length > 0 && (
                  <div className={styles.suggestedSection}>
                    <div className={styles.suggestedHeader}>
                      <Package size={16} />
                      <span>Paquete sugerido para ti</span>
                    </div>
                    {recPackages.map(pkg => {
                      const isAdded = addedPackageIds.has(pkg.id);
                      return (
                        <div key={pkg.id} className={styles.suggestedPackage}>
                          <div className={styles.suggestedProducts}>
                            {(pkg.products || []).map((prod, i) => (
                              <div key={i} className={styles.suggestedProductItem}>
                                <img 
                                  src={prod.image || '/images/placeholder.svg'}
                                  alt={prod.name} 
                                />
                                <div className={styles.suggestedProductInfo}>
                                  <span className={styles.suggestedProductName}>{prod.name}</span>
                                  <span className={styles.suggestedProductPrice}>S/ {prod.price}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button 
                            className={`${styles.addToCartBtn} ${isAdded ? styles.addToCartBtnDone : ''}`}
                            onClick={() => !isAdded && handleAddPackageToCart(pkg)}
                            disabled={isAdded}
                          >
                            <ShoppingCart size={16} />
                            {isAdded ? 'Agregado al carrito' : 'Agregar todo al carrito'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
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
              {/* ── FOTO de la persona (avatar circular) ──────────────────────
                  Sube/cambia/quita la foto. La URL se guarda en tempRecipient.photoUrl
                  y se persiste con el resto del recipient al pulsar "Guardar Cambios". */}
              <div className={styles.photoUploadRow}>
                <div className={styles.photoAvatar}>
                  {tempRecipient.photoUrl ? (
                    <img
                      src={tempRecipient.photoUrl}
                      alt={tempRecipient.name || 'Foto de la persona'}
                      className={styles.photoAvatarImg}
                    />
                  ) : (
                    // Placeholder con la inicial del nombre (círculo --primary-color).
                    <span className={styles.photoAvatarInitial}>
                      {(tempRecipient.name || '?').trim().charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                  {uploadingPhoto && (
                    <div className={styles.photoAvatarOverlay}>Subiendo…</div>
                  )}
                </div>

                <div className={styles.photoActions}>
                  {/* Input de archivo oculto, disparado por el botón de abajo. */}
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
                    <Camera size={16} />
                    {uploadingPhoto
                      ? 'Subiendo...'
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
                  {photoError && <p className={styles.photoError}>{photoError}</p>}
                </div>
              </div>

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
                    <div key={event.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-start', background: eventIdx === 0 ? 'var(--color-surface)' : 'transparent', padding: eventIdx === 0 ? '1rem' : '0', borderRadius: '8px', border: eventIdx === 0 ? '1px solid var(--color-border)' : 'none' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        
                        {eventIdx === 0 ? (
                          <div style={{ fontWeight: 'bold', color: 'var(--color-text)', padding: '0.5rem 0' }}>
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
