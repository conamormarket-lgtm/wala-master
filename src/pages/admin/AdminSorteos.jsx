import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getSorteos,
  createSorteo,
  updateSorteo,
  deleteSorteo,
} from '../../services/sorteos';
import { uploadFile } from '../../services/firebase/storage';
import { Edit2, Trash2, Users, UploadCloud, Loader2 } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminSorteos.module.css';

// Formulario vacío. Los campos de imagen guardan la URL ya subida a Storage.
const emptyForm = {
  titulo: '',
  descripcion: '',
  tipo: 'gratis',
  precioTicket: 0,
  requisitoApp: 'ninguno',
  numGanadores: 1,
  premioNombre: '',
  premioImagenUrl: '',
  premioValor: 0,
  heroImagenUrl: '',
  fechaInicio: '',
  fechaFin: '',
  estado: 'borrador',
  chanceExtraCompartir: false,
  chanceExtraReferido: false,
};

// Opciones del requisito de app (3 opciones del contrato).
const REQUISITO_OPCIONES = [
  { value: 'ninguno', label: 'Sin requisito' },
  { value: 'recomendado', label: 'Recomienda usar el app' },
  { value: 'obligatorio', label: 'Obligatorio desde el app' },
];

// Etiquetas y estilos de badge por estado.
const ESTADO_LABEL = { borrador: 'Borrador', activo: 'Activo', cerrado: 'Cerrado' };

const AdminSorteos = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploadingPremio, setUploadingPremio] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [formError, setFormError] = useState('');

  const { data: sorteosData, isLoading, error } = useQuery({
    queryKey: ['admin-sorteos'],
    queryFn: async () => {
      const { data, error: err } = await getSorteos();
      if (err) throw new Error(err);
      return data;
    },
  });

  const sorteos = sorteosData ?? [];

  const resetForm = () => {
    setForm(emptyForm);
    setFormError('');
  };

  const createMutation = useMutation({
    mutationFn: (data) => createSorteo(data),
    onSuccess: ({ error: err }) => {
      if (err) {
        setFormError(err);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['admin-sorteos'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateSorteo(id, data),
    onSuccess: ({ error: err }) => {
      if (err) {
        setFormError(err);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['admin-sorteos'] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSorteo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sorteos'] });
      setDeleteConfirm(null);
    },
  });

  // Sube una imagen (premio o hero) a Storage y guarda su URL en el form.
  const handleUpload = async (file, campo, setUploading, carpeta) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const path = `sorteos/${carpeta}/${Date.now()}_${file.name}`;
      const { url, error: err } = await uploadFile(file, path);
      if (url && !err) {
        setForm((f) => ({ ...f, [campo]: url }));
      } else if (err) {
        setFormError(err);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.titulo.trim()) {
      setFormError('El título es obligatorio.');
      return;
    }
    // Si es pagado, exigimos un precio de ticket mayor a 0 (el cobro sale de aquí).
    if (form.tipo === 'pagado' && (Number(form.precioTicket) || 0) <= 0) {
      setFormError('Un sorteo pagado necesita un precio de ticket mayor a 0.');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({
      titulo: s.titulo || '',
      descripcion: s.descripcion || '',
      tipo: s.tipo === 'pagado' ? 'pagado' : 'gratis',
      precioTicket: s.precioTicket ?? 0,
      requisitoApp: s.requisitoApp || 'ninguno',
      numGanadores: s.numGanadores ?? 1,
      premioNombre: s.premio?.nombre || '',
      premioImagenUrl: s.premio?.imagenUrl || '',
      premioValor: s.premio?.valor ?? 0,
      heroImagenUrl: s.heroImagenUrl || '',
      fechaInicio: s.fechaInicio || '',
      fechaFin: s.fechaFin || '',
      estado: s.estado || 'borrador',
      chanceExtraCompartir: !!s.chanceExtraCompartir,
      chanceExtraReferido: !!s.chanceExtraReferido,
    });
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🎁 Raffles — Sorteos y Rifas</h1>
          <p className={styles.subtitle}>
            Crea sorteos gratuitos o rifas pagadas, sube el premio y decide los ganadores.
          </p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Sorteo' : 'Nuevo Sorteo'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label}>Título</label>
                <input
                  type="text"
                  placeholder="Ej. Gran sorteo de aniversario"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Descripción</label>
                <textarea
                  placeholder="Describe el sorteo, condiciones, cómo se elige al ganador…"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                    className={styles.input}
                  >
                    <option value="gratis">Gratis</option>
                    <option value="pagado">Pagado (rifa)</option>
                  </select>
                </div>
                {/* El precio del ticket solo se muestra/edita si es pagado. */}
                {form.tipo === 'pagado' && (
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>Precio ticket (S/)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.precioTicket}
                      onChange={(e) => setForm((f) => ({ ...f, precioTicket: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                )}
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Requisito de app</label>
                  <select
                    value={form.requisitoApp}
                    onChange={(e) => setForm((f) => ({ ...f, requisitoApp: e.target.value }))}
                    className={styles.input}
                  >
                    {REQUISITO_OPCIONES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
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

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Inicia</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Termina</label>
                  <input
                    type="date"
                    value={form.fechaFin}
                    onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              {/* PREMIO */}
              <div className={styles.subGroup}>
                <h3 className={styles.subGroupTitle}>Premio</h3>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre del premio</label>
                  <input
                    type="text"
                    placeholder="Ej. Smartphone último modelo"
                    value={form.premioNombre}
                    onChange={(e) => setForm((f) => ({ ...f, premioNombre: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Valor del premio (S/)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.premioValor}
                    onChange={(e) => setForm((f) => ({ ...f, premioValor: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Imagen del premio</label>
                  <label className={styles.uploadBox}>
                    {uploadingPremio ? (
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
                      onChange={(e) =>
                        handleUpload(
                          e.target.files?.[0],
                          'premioImagenUrl',
                          setUploadingPremio,
                          'premios',
                        )
                      }
                    />
                  </label>
                  {form.premioImagenUrl && (
                    <img src={form.premioImagenUrl} alt="Premio" className={styles.thumb} />
                  )}
                </div>
              </div>

              {/* HERO */}
              <div className={styles.field}>
                <label className={styles.label}>Imagen principal (hero)</label>
                <label className={styles.uploadBox}>
                  {uploadingHero ? (
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
                    onChange={(e) =>
                      handleUpload(e.target.files?.[0], 'heroImagenUrl', setUploadingHero, 'hero')
                    }
                  />
                </label>
                {form.heroImagenUrl && (
                  <img src={form.heroImagenUrl} alt="Hero" className={styles.thumbWide} />
                )}
              </div>

              {/* CHANCES EXTRA */}
              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.chanceExtraCompartir}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, chanceExtraCompartir: e.target.checked }))
                    }
                    className={styles.checkbox}
                  />
                  <span>Chance extra por compartir</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.chanceExtraReferido}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, chanceExtraReferido: e.target.checked }))
                    }
                    className={styles.checkbox}
                  />
                  <span>Chance extra por referido</span>
                </label>
              </div>

              <div className={styles.field}>
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

              {formError && <p className={styles.error}>{formError}</p>}

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    uploadingPremio ||
                    uploadingHero
                  }
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Sorteo'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* VISTA PREVIA */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Vista previa</h2>
            <div className={styles.preview}>
              {form.heroImagenUrl ? (
                <img src={form.heroImagenUrl} alt="Vista previa" className={styles.previewHero} />
              ) : (
                <div className={styles.previewHeroEmpty}>Sin imagen principal</div>
              )}
              <div className={styles.previewBody}>
                <div className={styles.previewTopRow}>
                  <span
                    className={`${styles.statusBadge} ${
                      styles[`status_${form.estado}`] || ''
                    }`}
                  >
                    {ESTADO_LABEL[form.estado] || form.estado}
                  </span>
                  <span className={styles.typeBadge}>
                    {form.tipo === 'pagado' ? `Rifa · S/ ${Number(form.precioTicket) || 0}` : 'Gratis'}
                  </span>
                </div>
                <h3 className={styles.previewTitle}>{form.titulo || 'Título del sorteo'}</h3>
                <p className={styles.previewDesc}>
                  {form.descripcion || 'Aquí aparecerá la descripción del sorteo.'}
                </p>
                {form.premioNombre && (
                  <p className={styles.previewPrize}>
                    🎁 {form.premioNombre}
                    {form.premioValor ? ` (S/ ${Number(form.premioValor)})` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LISTA */}
        <div className={styles.listSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Tus Sorteos</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.sorteosGrid}>
              {sorteos.map((s) => (
                <div key={s.id} className={styles.sorteoCard}>
                  <div className={styles.sorteoInfo}>
                    <div className={styles.sorteoTopRow}>
                      <span
                        className={`${styles.statusBadge} ${
                          styles[`status_${s.estado}`] || ''
                        }`}
                      >
                        {ESTADO_LABEL[s.estado] || s.estado}
                      </span>
                      <span className={styles.typeBadge}>
                        {s.tipo === 'pagado' ? `Rifa · S/ ${s.precioTicket ?? 0}` : 'Gratis'}
                      </span>
                    </div>
                    <h3 className={styles.sorteoName}>{s.titulo}</h3>
                    {s.premio?.nombre && (
                      <span className={styles.sorteoPrize}>🎁 {s.premio.nombre}</span>
                    )}
                    <div className={styles.badgeRow}>
                      {s.fechaInicio && (
                        <span className={styles.sorteoBadge}>Desde: {s.fechaInicio}</span>
                      )}
                      {s.fechaFin && (
                        <span className={styles.sorteoBadge}>Hasta: {s.fechaFin}</span>
                      )}
                      <span className={styles.sorteoBadge}>
                        Participantes: {s.contadorParticipantes ?? 0}
                      </span>
                      <span className={styles.sorteoBadge}>Ganadores: {s.numGanadores ?? 1}</span>
                    </div>
                    <div className={styles.cardActionsRow}>
                      <Link to={`/admin/sorteos/${s.id}`} className={styles.detalleLink}>
                        <Users size={15} /> Ver participantes / Decidir ganadores
                      </Link>
                    </div>
                  </div>
                  <div className={styles.sorteoActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(s)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(s)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {sorteos.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes sorteos creados todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar sorteo?</h3>
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

export default AdminSorteos;
