import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getBeneficios,
  createBeneficio,
  updateBeneficio,
  deleteBeneficio,
  getGanadoresGaleria,
  createGanadorGaleria,
  updateGanadorGaleria,
  deleteGanadorGaleria,
  slugify,
  formatoPrecioPen,
  formatoPrecioUsd,
} from '../../services/suscripcionSorteos';
import { uploadFile } from '../../services/firebase/storage';
import {
  Edit2,
  Trash2,
  Users,
  UploadCloud,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminSuscripcionSorteos.module.css';

// ── Constantes de dominio ────────────────────────────────────────────────────
// Cada intervalo fija automáticamente los "meses" del ciclo de cobro.
const INTERVALOS = [
  { value: 'mensual', label: 'Mensual', meses: 1 },
  { value: 'trimestral', label: 'Trimestral', meses: 3 },
  { value: 'semestral', label: 'Semestral', meses: 6 },
  { value: 'anual', label: 'Anual', meses: 12 },
];
const mesesDeIntervalo = (intervalo) =>
  INTERVALOS.find((i) => i.value === intervalo)?.meses || 1;

const ESTADO_LABEL = { borrador: 'Borrador', activo: 'Activo', cerrado: 'Cerrado' };

// Colores por defecto de una campaña nueva (coinciden con el backend).
const COLORES_DEFAULT = {
  primario: '#111111',
  fondo: '#ffffff',
  texto: '#111111',
  acento: '#e60023',
};

// Formulario vacío para una campaña nueva.
const emptyForm = () => ({
  titulo: '',
  slug: '',
  descripcion: '',
  estado: 'borrador',
  numGanadores: 1,
  heroImagenUrl: '',
  logoUrl: '',
  colores: { ...COLORES_DEFAULT },
  premios: [],
  planes: [],
});

// Un plan nuevo, con chancesPorCiclo por defecto = meses (proporcional).
const nuevoPlan = () => ({
  id: `plan_${Date.now()}`,
  nombre: '',
  intervalo: 'mensual',
  meses: 1,
  precioCentimos: 0,
  precioUsd: 0,
  chancesPorCiclo: 1,
  beneficios: [],
  destacado: false,
  orden: 0,
});

const AdminSuscripcionSorteos = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPremio, setUploadingPremio] = useState(-1); // índice del premio subiendo
  const [formError, setFormError] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  // ── LISTA DE CAMPAÑAS ──────────────────────────────────────────────────────
  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ['admin-suscripcion-campaigns'],
    queryFn: async () => {
      const { data, error: err } = await getCampaigns();
      if (err) throw new Error(err);
      return data;
    },
  });
  const campaigns = campaignsData ?? [];

  const resetForm = () => {
    setForm(emptyForm());
    setFormError('');
    setEditingId(null);
    setShowEditor(false);
  };

  const createMutation = useMutation({
    mutationFn: (data) => createCampaign(data),
    onSuccess: ({ id, error: err }) => {
      if (err || !id) {
        setFormError(err || 'No se pudo crear la campaña.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-campaigns'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCampaign(id, data),
    onSuccess: ({ error: err }) => {
      if (err) {
        setFormError(err);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-campaigns'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-campaigns'] });
      setDeleteConfirm(null);
    },
  });

  // Sube una imagen a Storage y ejecuta un callback con la URL resultante.
  const subirImagen = async (file, carpeta, onDone, setBusy, busyValue = true) => {
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(busyValue);
    try {
      const path = `sorteos_suscripcion/${carpeta}/${Date.now()}_${file.name}`;
      const { url, error: err } = await uploadFile(file, path);
      if (url && !err) onDone(url);
      else if (err) setFormError(err);
    } finally {
      setBusy(carpeta === 'premios' ? -1 : false);
    }
  };

  // ── ABRIR EDITOR (nuevo / editar) ──────────────────────────────────────────
  const abrirNuevo = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormError('');
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const abrirEditar = (c) => {
    setEditingId(c.id);
    setForm({
      titulo: c.titulo || '',
      slug: c.slug || '',
      descripcion: c.descripcion || '',
      estado: c.estado || 'borrador',
      numGanadores: c.numGanadores ?? 1,
      heroImagenUrl: c.heroImagenUrl || '',
      logoUrl: c.logoUrl || '',
      colores: { ...COLORES_DEFAULT, ...(c.colores || {}) },
      premios: Array.isArray(c.premios)
        ? c.premios.map((p) => ({ nombre: p.nombre || '', imagenUrl: p.imagenUrl || '' }))
        : [],
      planes: Array.isArray(c.planes)
        ? c.planes.map((p, i) => ({
            id: p.id || `plan_${i}`,
            nombre: p.nombre || '',
            intervalo: p.intervalo || 'mensual',
            meses: Number(p.meses) || mesesDeIntervalo(p.intervalo),
            precioCentimos: Number(p.precioCentimos) || 0,
            precioUsd: Number(p.precioUsd) || 0,
            chancesPorCiclo: Number(p.chancesPorCiclo) || Number(p.meses) || 1,
            beneficios: Array.isArray(p.beneficios) ? p.beneficios : [],
            destacado: !!p.destacado,
            orden: Number(p.orden) || i,
          }))
        : [],
    });
    setFormError('');
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── PLANES: helpers de edición ─────────────────────────────────────────────
  const addPlan = () =>
    setForm((f) => ({ ...f, planes: [...f.planes, { ...nuevoPlan(), orden: f.planes.length }] }));

  const updatePlan = (idx, patch) =>
    setForm((f) => ({
      ...f,
      planes: f.planes.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));

  // Al cambiar el intervalo: recalcula meses y, si chancesPorCiclo seguía el
  // valor proporcional anterior (== meses), lo re-sincroniza al nuevo default.
  const cambiarIntervalo = (idx, intervalo) => {
    setForm((f) => ({
      ...f,
      planes: f.planes.map((p, i) => {
        if (i !== idx) return p;
        const nuevosMeses = mesesDeIntervalo(intervalo);
        const seguiaDefault = Number(p.chancesPorCiclo) === Number(p.meses);
        return {
          ...p,
          intervalo,
          meses: nuevosMeses,
          chancesPorCiclo: seguiaDefault ? nuevosMeses : p.chancesPorCiclo,
        };
      }),
    }));
  };

  const removePlan = (idx) =>
    setForm((f) => ({ ...f, planes: f.planes.filter((_, i) => i !== idx) }));

  // ── PREMIOS: helpers de edición ────────────────────────────────────────────
  const addPremio = () =>
    setForm((f) => ({ ...f, premios: [...f.premios, { nombre: '', imagenUrl: '' }] }));
  const updatePremio = (idx, patch) =>
    setForm((f) => ({
      ...f,
      premios: f.premios.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  const removePremio = (idx) =>
    setForm((f) => ({ ...f, premios: f.premios.filter((_, i) => i !== idx) }));

  // ── GUARDAR CAMPAÑA ────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.titulo.trim()) {
      setFormError('El título es obligatorio.');
      return;
    }
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else createMutation.mutate(form);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const guardando = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🎟️ Sorteo por suscripción</h1>
          <p className={styles.subtitle}>
            Crea campañas de suscripción con auto-débito (Culqi/PayPal). Solo los suscriptores
            activos participan; a más meses, más chances.
          </p>
        </div>
        {!showEditor && (
          <Button type="button" onClick={abrirNuevo}>
            <Plus size={16} /> Nueva campaña
          </Button>
        )}
      </div>

      {/* ── EDITOR ─────────────────────────────────────────────────────────── */}
      {showEditor && (
        <div className={styles.contentGrid}>
          <div className={styles.formSection}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                {editingId ? 'Editar campaña' : 'Nueva campaña'}
              </h2>
              <form className={styles.form} onSubmit={handleSubmit}>
                {/* ── DATOS GENERALES ── */}
                <div className={styles.field}>
                  <label className={styles.label}>Título</label>
                  <input
                    type="text"
                    placeholder="Ej. No Hay Sin Suerte"
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Enlace público (slug)</label>
                  <input
                    type="text"
                    placeholder="se-genera-del-titulo"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className={styles.input}
                  />
                  <p className={styles.slugHint}>
                    wala.pe/suscrito-sorteo/
                    <strong>{slugify(form.slug || form.titulo) || 'tu-campana'}</strong>
                    {' '}· se crea solo del título; puedes editarlo.
                  </p>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Descripción</label>
                  <textarea
                    placeholder="Explica cómo funciona la suscripción y el sorteo…"
                    value={form.descripcion}
                    onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                    className={styles.textarea}
                    rows={3}
                  />
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>Estado</label>
                    <select
                      value={form.estado}
                      onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                      className={styles.input}
                    >
                      <option value="borrador">Borrador</option>
                      <option value="activo">Activo</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </div>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>N.º de ganadores</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.numGanadores}
                      onChange={(e) => setForm((f) => ({ ...f, numGanadores: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                </div>

                {/* ── IMÁGENES: HERO + LOGO ── */}
                <div className={styles.fieldRow}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>Imagen principal (hero)</label>
                    <label className={styles.uploadBox}>
                      {uploadingHero ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Subiendo…
                        </>
                      ) : (
                        <>
                          <UploadCloud size={16} /> Subir hero
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) =>
                          subirImagen(
                            e.target.files?.[0],
                            'hero',
                            (url) => setForm((f) => ({ ...f, heroImagenUrl: url })),
                            setUploadingHero,
                          )
                        }
                      />
                    </label>
                    {form.heroImagenUrl && (
                      <img src={form.heroImagenUrl} alt="Hero" className={styles.thumbWide} />
                    )}
                  </div>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>Logo</label>
                    <label className={styles.uploadBox}>
                      {uploadingLogo ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Subiendo…
                        </>
                      ) : (
                        <>
                          <UploadCloud size={16} /> Subir logo
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) =>
                          subirImagen(
                            e.target.files?.[0],
                            'logo',
                            (url) => setForm((f) => ({ ...f, logoUrl: url })),
                            setUploadingLogo,
                          )
                        }
                      />
                    </label>
                    {form.logoUrl && (
                      <img src={form.logoUrl} alt="Logo" className={styles.thumb} />
                    )}
                  </div>
                </div>

                {/* ── COLORES ── */}
                <div className={styles.subGroup}>
                  <h3 className={styles.subGroupTitle}>Colores de la campaña</h3>
                  <div className={styles.coloresGrid}>
                    {[
                      { key: 'primario', label: 'Primario' },
                      { key: 'fondo', label: 'Fondo' },
                      { key: 'texto', label: 'Texto' },
                      { key: 'acento', label: 'Acento' },
                    ].map((c) => (
                      <div key={c.key} className={styles.colorField}>
                        <label className={styles.label}>{c.label}</label>
                        <div className={styles.colorRow}>
                          <input
                            type="color"
                            value={form.colores[c.key] || '#000000'}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                colores: { ...f.colores, [c.key]: e.target.value },
                              }))
                            }
                            className={styles.colorPicker}
                          />
                          <input
                            type="text"
                            value={form.colores[c.key] || ''}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                colores: { ...f.colores, [c.key]: e.target.value },
                              }))
                            }
                            className={styles.input}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── PLANES ── */}
                <div className={styles.subGroup}>
                  <div className={styles.subGroupHeader}>
                    <h3 className={styles.subGroupTitle}>Planes de suscripción</h3>
                    <button type="button" className={styles.addBtn} onClick={addPlan}>
                      <Plus size={14} /> Agregar plan
                    </button>
                  </div>
                  {form.planes.length === 0 && (
                    <p className={styles.helpText}>Aún no hay planes. Agrega al menos uno.</p>
                  )}
                  {form.planes.map((p, idx) => (
                    <div key={p.id || idx} className={styles.planCard}>
                      <div className={styles.planCardHeader}>
                        <span className={styles.planIndex}>Plan {idx + 1}</span>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => removePlan(idx)}
                          title="Quitar plan"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Nombre</label>
                        <input
                          type="text"
                          placeholder="Ej. Plan mensual"
                          value={p.nombre}
                          onChange={(e) => updatePlan(idx, { nombre: e.target.value })}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.fieldRow}>
                        <div className={styles.field} style={{ flex: 1 }}>
                          <label className={styles.label}>Intervalo</label>
                          <select
                            value={p.intervalo}
                            onChange={(e) => cambiarIntervalo(idx, e.target.value)}
                            className={styles.input}
                          >
                            {INTERVALOS.map((i) => (
                              <option key={i.value} value={i.value}>
                                {i.label} ({i.meses} {i.meses === 1 ? 'mes' : 'meses'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field} style={{ flex: 1 }}>
                          <label className={styles.label}>Chances por ciclo</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={p.chancesPorCiclo}
                            onChange={(e) =>
                              updatePlan(idx, { chancesPorCiclo: Number(e.target.value) })
                            }
                            className={styles.input}
                          />
                          <p className={styles.miniHint}>Por defecto = meses ({p.meses}).</p>
                        </div>
                      </div>
                      <div className={styles.fieldRow}>
                        <div className={styles.field} style={{ flex: 1 }}>
                          <label className={styles.label}>Precio (S/)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            /* Entrada en soles; el modelo guarda céntimos (× 100). */
                            value={(Number(p.precioCentimos) || 0) / 100}
                            onChange={(e) =>
                              updatePlan(idx, {
                                precioCentimos: Math.round((Number(e.target.value) || 0) * 100),
                              })
                            }
                            className={styles.input}
                          />
                          <p className={styles.miniHint}>
                            = {formatoPrecioPen(p.precioCentimos)}
                          </p>
                        </div>
                        <div className={styles.field} style={{ flex: 1 }}>
                          <label className={styles.label}>Precio (USD)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.precioUsd}
                            onChange={(e) =>
                              updatePlan(idx, { precioUsd: Number(e.target.value) })
                            }
                            className={styles.input}
                          />
                          <p className={styles.miniHint}>= {formatoPrecioUsd(p.precioUsd)}</p>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Beneficios (uno por línea)</label>
                        <textarea
                          rows={2}
                          placeholder={'Envío gratis\nDescuentos exclusivos'}
                          value={(p.beneficios || []).join('\n')}
                          onChange={(e) =>
                            updatePlan(idx, {
                              beneficios: e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className={styles.textarea}
                        />
                      </div>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={p.destacado}
                          onChange={(e) => updatePlan(idx, { destacado: e.target.checked })}
                          className={styles.checkbox}
                        />
                        <span>Plan destacado</span>
                      </label>
                    </div>
                  ))}
                </div>

                {/* ── PREMIOS ── */}
                <div className={styles.subGroup}>
                  <div className={styles.subGroupHeader}>
                    <h3 className={styles.subGroupTitle}>Premios</h3>
                    <button type="button" className={styles.addBtn} onClick={addPremio}>
                      <Plus size={14} /> Agregar premio
                    </button>
                  </div>
                  {form.premios.length === 0 && (
                    <p className={styles.helpText}>Sin premios aún.</p>
                  )}
                  {form.premios.map((p, idx) => (
                    <div key={idx} className={styles.premioRow}>
                      <input
                        type="text"
                        placeholder="Nombre del premio"
                        value={p.nombre}
                        onChange={(e) => updatePremio(idx, { nombre: e.target.value })}
                        className={styles.input}
                        style={{ flex: 1 }}
                      />
                      <label className={styles.uploadBoxSmall}>
                        {uploadingPremio === idx ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UploadCloud size={14} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) =>
                            subirImagen(
                              e.target.files?.[0],
                              'premios',
                              (url) => updatePremio(idx, { imagenUrl: url }),
                              setUploadingPremio,
                              idx,
                            )
                          }
                        />
                      </label>
                      {p.imagenUrl && (
                        <img src={p.imagenUrl} alt="Premio" className={styles.thumbMini} />
                      )}
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removePremio(idx)}
                        title="Quitar premio"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {formError && <p className={styles.error}>{formError}</p>}

                <div className={styles.formActions}>
                  <Button
                    type="submit"
                    disabled={guardando || uploadingHero || uploadingLogo || uploadingPremio >= 0}
                  >
                    {guardando ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Guardando…
                      </>
                    ) : editingId ? (
                      'Guardar cambios'
                    ) : (
                      'Crear campaña'
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>

            {/* Editores de subcolecciones: solo al editar una campaña existente. */}
            {editingId && (
              <>
                <BeneficiosEditor campaignId={editingId} />
                <GaleriaEditor campaignId={editingId} />
              </>
            )}
          </div>

          {/* ── VISTA PREVIA ── */}
          <div className={styles.listSection}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Vista previa</h2>
              <div
                className={styles.preview}
                style={{ background: form.colores.fondo, color: form.colores.texto }}
              >
                {form.heroImagenUrl ? (
                  <img src={form.heroImagenUrl} alt="Vista previa" className={styles.previewHero} />
                ) : (
                  <div className={styles.previewHeroEmpty}>Sin imagen principal</div>
                )}
                <div className={styles.previewBody}>
                  {form.logoUrl && (
                    <img src={form.logoUrl} alt="Logo" className={styles.previewLogo} />
                  )}
                  <h3 className={styles.previewTitle} style={{ color: form.colores.primario }}>
                    {form.titulo || 'Título de la campaña'}
                  </h3>
                  <p className={styles.previewDesc}>
                    {form.descripcion || 'Aquí aparecerá la descripción.'}
                  </p>
                  <div className={styles.previewPlanes}>
                    {form.planes.map((p, i) => (
                      <div
                        key={p.id || i}
                        className={styles.previewPlan}
                        style={{
                          borderColor: p.destacado ? form.colores.acento : undefined,
                        }}
                      >
                        <strong>{p.nombre || 'Plan'}</strong>
                        <span>{formatoPrecioPen(p.precioCentimos)}</span>
                        <span className={styles.previewPlanMeta}>
                          {p.chancesPorCiclo} chance{p.chancesPorCiclo === 1 ? '' : 's'} / ciclo
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LISTA DE CAMPAÑAS ─────────────────────────────────────────────── */}
      {!showEditor && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Tus campañas</h2>
          {isLoading && <p className={styles.loading}>Cargando…</p>}
          {error && <p className={styles.error}>{error.message}</p>}

          <div className={styles.campaignsGrid}>
            {campaigns.map((c) => (
              <div key={c.id} className={styles.campaignCard}>
                <div className={styles.campaignInfo}>
                  <div className={styles.sorteoTopRow}>
                    <span
                      className={`${styles.statusBadge} ${styles[`status_${c.estado}`] || ''}`}
                    >
                      {ESTADO_LABEL[c.estado] || c.estado}
                    </span>
                    <span className={styles.typeBadge}>
                      {(c.planes?.length || 0)} plan{(c.planes?.length || 0) === 1 ? '' : 'es'}
                    </span>
                  </div>
                  <h3 className={styles.campaignName}>{c.titulo}</h3>
                  <div className={styles.badgeRow}>
                    <span className={styles.sorteoBadge}>
                      Suscriptores: {c.contadorSuscriptores ?? 0}
                    </span>
                    <span className={styles.sorteoBadge}>Ganadores: {c.numGanadores ?? 1}</span>
                  </div>
                  <div className={styles.cardActionsRow}>
                    <Link
                      to={`/admin/sorteos-suscripcion/${c.id}`}
                      className={styles.detalleLink}
                    >
                      <Users size={15} /> Suscriptores / Ganadores
                    </Link>
                    {c.slug && (
                      <a
                        href={`/suscrito-sorteo/${c.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.detalleLink}
                      >
                        🔗 Ver pública
                      </a>
                    )}
                  </div>
                </div>
                <div className={styles.sorteoActions}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => abrirEditar(c)}
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                    onClick={() => setDeleteConfirm(c)}
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {campaigns.length === 0 && !isLoading && (
            <div className={styles.emptyState}>
              <p>No tienes campañas de suscripción todavía.</p>
              <Button type="button" onClick={abrirNuevo}>
                <Plus size={16} /> Crear la primera
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Confirmación de borrado */}
      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar campaña?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar <strong>{deleteConfirm.titulo}</strong>. Esta acción no se
              puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                style={{ backgroundColor: '#ff4757', borderColor: '#ff4757' }}
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-EDITOR: BENEFICIOS (marcas / descuentos) — CRUD create/update/delete
// ═══════════════════════════════════════════════════════════════════════════
const emptyBeneficio = {
  marca: '',
  titulo: '',
  descuento: '',
  imagenUrl: '',
  categoria: '',
  ubicacion: '',
  url: '',
  orden: 0,
};

const BeneficiosEditor = ({ campaignId }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyBeneficio);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-suscripcion-beneficios', campaignId],
    queryFn: async () => {
      const { data: d, error } = await getBeneficios(campaignId);
      if (error) throw new Error(error);
      return d;
    },
    enabled: !!campaignId,
  });
  const beneficios = data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-beneficios', campaignId] });

  const reset = () => {
    setForm(emptyBeneficio);
    setEditingId(null);
    setMsg('');
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? updateBeneficio(campaignId, editingId, form)
        : createBeneficio(campaignId, form),
    onSuccess: ({ error }) => {
      if (error) {
        setMsg(error);
        return;
      }
      invalidate();
      reset();
    },
  });

  const delMutation = useMutation({
    mutationFn: (id) => deleteBeneficio(campaignId, id),
    onSuccess: () => invalidate(),
  });

  const subir = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const path = `sorteos_suscripcion/beneficios/${Date.now()}_${file.name}`;
      const { url, error } = await uploadFile(file, path);
      if (url && !error) setForm((f) => ({ ...f, imagenUrl: url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setMsg('');
    if (!form.marca.trim() && !form.titulo.trim()) {
      setMsg('Indica al menos la marca o el título.');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Beneficios (marcas y descuentos)</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldRow}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Marca</label>
            <input
              type="text"
              value={form.marca}
              onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Descuento</label>
            <input
              type="text"
              placeholder="Ej. 20%"
              value={form.descuento}
              onChange={(e) => setForm((f) => ({ ...f, descuento: e.target.value }))}
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Título</label>
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Categoría</label>
            <input
              type="text"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Ubicación</label>
            <input
              type="text"
              value={form.ubicacion}
              onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))}
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>URL (opcional)</label>
          <input
            type="url"
            placeholder="https://…"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Imagen</label>
          <label className={styles.uploadBox}>
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Subiendo…
              </>
            ) : (
              <>
                <UploadCloud size={16} /> Subir imagen
              </>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => subir(e.target.files?.[0])}
            />
          </label>
          {form.imagenUrl && <img src={form.imagenUrl} alt="Beneficio" className={styles.thumb} />}
        </div>

        {msg && <p className={styles.error}>{msg}</p>}

        <div className={styles.formActions}>
          <Button type="submit" disabled={saveMutation.isPending || uploading}>
            {editingId ? 'Guardar beneficio' : 'Agregar beneficio'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={reset}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {beneficios.length > 0 && (
        <div className={styles.subList}>
          {beneficios.map((b) => (
            <div key={b.id} className={styles.subListRow}>
              {b.imagenUrl && <img src={b.imagenUrl} alt="" className={styles.thumbMini} />}
              <div className={styles.subListInfo}>
                <strong>{b.marca || b.titulo || '—'}</strong>
                <span className={styles.subListMeta}>
                  {[b.descuento, b.categoria, b.ubicacion].filter(Boolean).join(' · ')}
                </span>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setEditingId(b.id);
                  setForm({ ...emptyBeneficio, ...b });
                  setMsg('');
                }}
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                onClick={() => delMutation.mutate(b.id)}
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-EDITOR: GALERÍA DE GANADORES — CRUD create/update/delete
// ═══════════════════════════════════════════════════════════════════════════
const emptyGanador = { nombre: '', premio: '', fotoUrl: '', fecha: '', orden: 0 };

const GaleriaEditor = ({ campaignId }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyGanador);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-suscripcion-galeria', campaignId],
    queryFn: async () => {
      const { data: d, error } = await getGanadoresGaleria(campaignId);
      if (error) throw new Error(error);
      return d;
    },
    enabled: !!campaignId,
  });
  const ganadores = data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-galeria', campaignId] });

  const reset = () => {
    setForm(emptyGanador);
    setEditingId(null);
    setMsg('');
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? updateGanadorGaleria(campaignId, editingId, form)
        : createGanadorGaleria(campaignId, form),
    onSuccess: ({ error }) => {
      if (error) {
        setMsg(error);
        return;
      }
      invalidate();
      reset();
    },
  });

  const delMutation = useMutation({
    mutationFn: (id) => deleteGanadorGaleria(campaignId, id),
    onSuccess: () => invalidate(),
  });

  const subir = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const path = `sorteos_suscripcion/galeria/${Date.now()}_${file.name}`;
      const { url, error } = await uploadFile(file, path);
      if (url && !error) setForm((f) => ({ ...f, fotoUrl: url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setMsg('');
    if (!form.nombre.trim()) {
      setMsg('El nombre del ganador es obligatorio.');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Galería de ganadores anteriores</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldRow}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Fecha</label>
            <input
              type="text"
              placeholder="Ej. Junio 2026"
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Premio</label>
          <input
            type="text"
            value={form.premio}
            onChange={(e) => setForm((f) => ({ ...f, premio: e.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Foto</label>
          <label className={styles.uploadBox}>
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Subiendo…
              </>
            ) : (
              <>
                <UploadCloud size={16} /> Subir foto
              </>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => subir(e.target.files?.[0])}
            />
          </label>
          {form.fotoUrl && <img src={form.fotoUrl} alt="Ganador" className={styles.thumb} />}
        </div>

        {msg && <p className={styles.error}>{msg}</p>}

        <div className={styles.formActions}>
          <Button type="submit" disabled={saveMutation.isPending || uploading}>
            {editingId ? 'Guardar ganador' : 'Agregar ganador'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={reset}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {ganadores.length > 0 && (
        <div className={styles.subList}>
          {ganadores.map((g) => (
            <div key={g.id} className={styles.subListRow}>
              {g.fotoUrl && <img src={g.fotoUrl} alt="" className={styles.thumbMini} />}
              <div className={styles.subListInfo}>
                <strong>{g.nombre || '—'}</strong>
                <span className={styles.subListMeta}>
                  {[g.premio, g.fecha].filter(Boolean).join(' · ')}
                </span>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setEditingId(g.id);
                  setForm({ ...emptyGanador, ...g });
                  setMsg('');
                }}
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                onClick={() => delMutation.mutate(g.id)}
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSuscripcionSorteos;
