import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNiches, createNiche, updateNiche, deleteNiche } from '../../services/niches';
import { uploadFile } from '../../services/firebase/storage';
import { Edit2, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import Button from '../../components/common/Button';
import AdminImageCropper from '../../components/admin/AdminImageCropper/AdminImageCropper';
import styles from './AdminNichos.module.css';

const emptyForm = {
  name: '',
  slug: '',
  type: 'general',
  commissionPct: 0,
  order: 0,
  active: true,
  imageUrl: ''
};

// Convierte un nombre en un slug url-safe (minúsculas, sin acentos, guiones).
const slugify = (str) =>
  (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const AdminNichos = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const { data: nichesData, isLoading, error } = useQuery({
    queryKey: ['admin-niches'],
    queryFn: async () => {
      const { data, error: err } = await getNiches();
      if (err) throw new Error(err);
      return data;
    }
  });

  const niches = nichesData ?? [];

  const resetForm = (nextOrder) =>
    setForm({ ...emptyForm, order: nextOrder ?? niches.length });

  const createMutation = useMutation({
    mutationFn: (data) => createNiche(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-niches'] });
      queryClient.invalidateQueries({ queryKey: ['niches'] });
      resetForm((nichesData?.length ?? 0) + 1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateNiche(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-niches'] });
      queryClient.invalidateQueries({ queryKey: ['niches'] });
      setEditingId(null);
      resetForm(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteNiche(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-niches'] });
      queryClient.invalidateQueries({ queryKey: ['niches'] });
      setDeleteConfirm(null);
    }
  });

  const handleImageUpload = (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setImageToCrop(reader.result);
      setCropModalOpen(true);
    };
  };

  const handleCropComplete = async (croppedFile) => {
    setCropModalOpen(false);
    setImageToCrop(null);
    setUploading(true);
    try {
      const path = `niches/${Date.now()}_cropped.jpg`;
      const { url, error: err } = await uploadFile(croppedFile, path);
      if (url && !err) {
        setForm((f) => ({ ...f, imageUrl: url }));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const slug = (form.slug && form.slug.trim()) || slugify(form.name);

    const payload = {
      name: form.name.trim(),
      slug,
      type: form.type,
      commissionPct: Number(form.commissionPct) || 0,
      order: Number(form.order) || 0,
      active: !!form.active,
      imageUrl: form.imageUrl
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (niche) => {
    setEditingId(niche.id);
    setForm({
      name: niche.name || '',
      slug: niche.slug || '',
      type: niche.type || 'general',
      commissionPct: niche.commissionPct ?? 0,
      order: niche.order ?? 0,
      active: niche.active !== false,
      imageUrl: niche.imageUrl || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm(niches.length);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Nichos</h1>
          <p className={styles.subtitle}>
            Agrupa el catálogo y los vendedores por nicho (personalizados, general...)
          </p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Nicho' : 'Nuevo Nicho'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label className={styles.label}>Nombre del Nicho</label>
                <input
                  type="text"
                  placeholder="Ej. Ropa Personalizada"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Slug</label>
                <input
                  type="text"
                  placeholder="Se genera del nombre si lo dejas vacío"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className={styles.input}
                />
                <p className={styles.helpText}>
                  Identificador para la URL. Si lo dejas vacío se autogenera: <strong>{slugify(form.name) || '—'}</strong>
                </p>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className={styles.input}
                  >
                    <option value="general">General</option>
                    <option value="personalizados">Personalizados</option>
                  </select>
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Comisión (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.commissionPct}
                    onChange={(e) => setForm((f) => ({ ...f, commissionPct: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Orden</label>
                  <input
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                      className={styles.checkbox}
                    />
                    <span>Nicho activo</span>
                  </label>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Imagen del Nicho (opcional)</label>
                <div className={styles.imageUploadWrapper}>
                  {form.imageUrl ? (
                    <div className={styles.imagePreviewContainer}>
                      <img src={form.imageUrl} alt="Nicho" className={styles.imagePreview} />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                        className={styles.removeBtn}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className={styles.uploadImageLabel}>
                      <ImagePlus size={24} />
                      <span>Subir Imagen</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        hidden
                      />
                    </label>
                  )}
                  {uploading && (
                    <div className={styles.uploadOverlay}>
                      <Loader2 className="animate-spin" /> Subiendo...
                    </div>
                  )}
                </div>
                <p className={styles.helpText}>
                  Se usa para destacar el nicho en la navegación y páginas de nicho.
                </p>
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || uploading}
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Nicho'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* LISTA */}
        <div className={styles.listSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Tus Nichos</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.nichesGrid}>
              {niches.map((niche) => (
                <div key={niche.id} className={styles.nicheCard}>
                  <div className={styles.nicheVisual}>
                    {niche.imageUrl ? (
                      <img src={niche.imageUrl} alt={niche.name} className={styles.nicheBubble} />
                    ) : (
                      <div className={styles.nicheBubbleEmpty}>
                        <ImagePlus size={20} opacity={0.5} />
                      </div>
                    )}
                  </div>
                  <div className={styles.nicheInfo}>
                    <h3 className={styles.nicheName}>{niche.name}</h3>
                    <span className={styles.nicheSlug}>/{niche.slug}</span>
                    <div className={styles.badgeRow}>
                      <span className={styles.nicheBadge}>
                        {niche.type === 'personalizados' ? 'Personalizados' : 'General'}
                      </span>
                      <span className={styles.nicheBadge}>{niche.commissionPct ?? 0}% com.</span>
                      <span className={styles.nicheBadge}>Orden: {niche.order ?? 0}</span>
                      <span
                        className={`${styles.statusBadge} ${
                          niche.active !== false ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {niche.active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.nicheActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(niche)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(niche)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {niches.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes nichos creados todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar nicho?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar <strong>{deleteConfirm.name}</strong>. Esta acción no se puede deshacer.
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

      {cropModalOpen && imageToCrop && (
        <AdminImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setCropModalOpen(false);
            setImageToCrop(null);
          }}
          aspectRatio={1}
        />
      )}
    </div>
  );
};

export default AdminNichos;
