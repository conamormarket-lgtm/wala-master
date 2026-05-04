import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCliparts, createClipart, updateClipart, deleteClipart } from '../../services/cliparts';
import { uploadFile } from '../../services/firebase/storage';
import { toDirectImageUrl } from '../../utils/imageUrl';
import Button from '../../components/common/Button';
import styles from './AdminCliparts.module.css';

const AdminCliparts = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', url: '', category: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: clipartsData, isLoading, error } = useQuery({
    queryKey: ['admin-cliparts'],
    queryFn: async () => {
      const { data, error: err } = await getCliparts();
      if (err) throw new Error(err);
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => createClipart(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cliparts'] });
      queryClient.invalidateQueries({ queryKey: ['cliparts'] });
      setForm({ name: '', url: '', category: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateClipart(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cliparts'] });
      queryClient.invalidateQueries({ queryKey: ['cliparts'] });
      setEditingId(null);
      setForm({ name: '', url: '', category: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteClipart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cliparts'] });
      queryClient.invalidateQueries({ queryKey: ['cliparts'] });
      setDeleteConfirm(null);
    }
  });

  const cliparts = clipartsData ?? [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const url = form.url?.trim() ? toDirectImageUrl(form.url.trim()) : '';
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: { name: form.name.trim(), url, category: form.category.trim() }
      });
    } else {
      if (!form.url?.trim()) return;
      createMutation.mutate({
        name: form.name.trim(),
        url,
        category: form.category.trim()
      });
    }
  };

  const handleFileSelect = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const path = `cliparts/${Date.now()}_${file.name}`;
      const { url, error: err } = await uploadFile(file, path);
      if (url && !err) setForm((f) => ({ ...f, url }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name ?? '', url: item.url ?? '', category: item.category ?? '' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', url: '', category: '' });
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Galería de cliparts</h1>
      <p className={styles.subtitle}>Imágenes que los clientes pueden usar al personalizar productos.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <input
            type="text"
            placeholder="Nombre del clipart"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={styles.input}
            required
          />
          <input
            type="text"
            placeholder="Categoría (opcional)"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className={styles.inputCategory}
          />
        </div>
        <div className={styles.formRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className={styles.fileInput}
            disabled={uploading}
          />
          {uploading && <span className={styles.uploading}>Subiendo...</span>}
          {form.url && (
            <span className={styles.urlPreview}>
              <img src={toDirectImageUrl(form.url)} alt="" className={styles.thumb} loading="lazy" />
              <button type="button" className={styles.clearUrl} onClick={() => setForm((f) => ({ ...f, url: '' }))}>
                Quitar
              </button>
            </span>
          )}
        </div>
        <div className={styles.formRow}>
          <input
            type="text"
            placeholder="O pega URL / enlace de Google Drive o Firebase"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || (!form.url && !editingId)}>
            {editingId ? 'Guardar cambios' : 'Añadir clipart'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {isLoading && <p className={styles.loading}>Cargando cliparts...</p>}
      {error && <p className={styles.error}>{error.message}</p>}

      <ul className={styles.grid}>
        {cliparts.map((item) => (
          <li key={item.id} className={styles.card}>
            <div className={styles.cardImage}>
              <img src={toDirectImageUrl(item.url)} alt={item.name} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.cardName}>{item.name}</span>
              {item.category && <span className={styles.cardCategory}>{item.category}</span>}
            </div>
            <div className={styles.cardActions}>
              <button type="button" className={styles.btnEdit} onClick={() => handleEdit(item)}>
                Editar
              </button>
              <button type="button" className={styles.btnDelete} onClick={() => setDeleteConfirm(item)}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {cliparts.length === 0 && !isLoading && (
        <p className={styles.empty}>No hay cliparts. Añade uno arriba.</p>
      )}

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p>¿Eliminar el clipart &quot;{deleteConfirm.name}&quot;?</p>
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCliparts;
