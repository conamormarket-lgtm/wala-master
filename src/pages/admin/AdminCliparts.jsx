import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCliparts, createClipart, updateClipart, deleteClipart } from '../../services/cliparts';
import { uploadFile } from '../../services/firebase/storage';
import { toDirectImageUrl } from '../../utils/imageUrl';
import { Edit2, Trash2, ImagePlus, Loader2, X, Plus } from 'lucide-react';
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', url: '', category: '' });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Galería de Cliparts</h1>
          <p className={styles.subtitle}>Recursos gráficos que los clientes pueden usar al personalizar sus productos</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Clipart' : 'Nuevo Clipart'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              
              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label className={styles.label}>Nombre del Clipart</label>
                  <input
                    type="text"
                    placeholder="Ej. Corazón Neon"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej. Amor, Deportes"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Archivo del Clipart (PNG Transparente o SVG)</label>
                <div className={styles.imageUploadWrapper}>
                  {form.url ? (
                    <div className={styles.imagePreviewContainer}>
                      <img src={toDirectImageUrl(form.url)} alt="Clipart" className={styles.imagePreview} />
                      <button type="button" onClick={() => setForm(f => ({...f, url: ''}))} className={styles.removeBtn}><X size={16} /></button>
                    </div>
                  ) : (
                    <label className={styles.uploadImageLabel}>
                      <ImagePlus size={24} />
                      <span>Subir Imagen</span>
                      <input 
                        type="file" 
                        accept="image/png, image/svg+xml" 
                        onChange={handleFileSelect} 
                        disabled={uploading} 
                        hidden 
                      />
                    </label>
                  )}
                  {uploading && <div className={styles.uploadOverlay}><Loader2 className="animate-spin" /> Subiendo...</div>}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>O usa una URL Externa</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className={styles.input}
                />
              </div>

              <div className={styles.formActions}>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || uploading || (!form.url && !editingId)}>
                  {editingId ? 'Guardar Cambios' : 'Añadir Clipart'}
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

        {/* LISTA DE CLIPARTS */}
        <div className={styles.listSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Biblioteca</h2>
            
            {isLoading && <p className={styles.loading}>Cargando cliparts...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.clipartsGrid}>
              {cliparts.map((item) => (
                <div key={item.id} className={styles.clipartCard}>
                  <div className={styles.clipartVisual}>
                    <img 
                      src={toDirectImageUrl(item.url)} 
                      alt={item.name} 
                      className={styles.clipartImage} 
                      loading="lazy" 
                      onError={(e) => { e.target.style.display = 'none'; }} 
                    />
                  </div>
                  <div className={styles.clipartContent}>
                    <div className={styles.clipartInfo}>
                      <h3 className={styles.clipartName} title={item.name}>{item.name}</h3>
                      {item.category && <span className={styles.clipartBadge}>{item.category}</span>}
                    </div>
                    <div className={styles.clipartActions}>
                      <button type="button" className={styles.actionBtn} onClick={() => handleEdit(item)} title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteConfirm(item)} title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cliparts.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No hay cliparts en la biblioteca.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar clipart?</h3>
            <p className={styles.modalText}>Estás a punto de eliminar <strong>{deleteConfirm.name}</strong>. Esta acción no se puede deshacer.</p>
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

export default AdminCliparts;
