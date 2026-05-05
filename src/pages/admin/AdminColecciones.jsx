import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollections, createCollection, updateCollection, deleteCollection } from '../../services/collections';
import { uploadFile } from '../../services/firebase/storage';
import { Edit2, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import Button from '../../components/common/Button';
import AdminImageCropper from '../../components/admin/AdminImageCropper/AdminImageCropper';
import styles from './AdminColecciones.module.css';

const AdminColecciones = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', order: 0, imageUrl: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const { data: collectionsData, isLoading, error } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: async () => {
      const { data, error: err } = await getCollections();
      if (err) throw new Error(err);
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => createCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setForm({ name: '', order: (collectionsData?.length ?? 0), imageUrl: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setEditingId(null);
      setForm({ name: '', order: 0, imageUrl: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setDeleteConfirm(null);
    }
  });

  const collections = collectionsData ?? [];

  const handleImageUpload = async (e) => {
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
      const path = `collections/${Date.now()}_cropped.jpg`;
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
    
    const payload = { 
      name: form.name.trim(), 
      order: Number(form.order),
      imageUrl: form.imageUrl
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (col) => {
    setEditingId(col.id);
    setForm({ 
      name: col.name, 
      order: col.order ?? 0,
      imageUrl: col.imageUrl || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', order: collections.length, imageUrl: '' });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Colecciones</h1>
          <p className={styles.subtitle}>Agrupa tus productos en campañas y crea banners visuales</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Colección' : 'Nueva Colección'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              
              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label className={styles.label}>Nombre de la Colección</label>
                  <input
                    type="text"
                    placeholder="Ej. Summer 2024"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={styles.input}
                    required
                  />
                </div>
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
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Banner de la Colección (Opcional)</label>
                <div className={styles.imageUploadWrapper}>
                  {form.imageUrl ? (
                    <div className={styles.imagePreviewContainer}>
                      <img src={form.imageUrl} alt="Colección Banner" className={styles.imagePreview} />
                      <button type="button" onClick={() => setForm(f => ({...f, imageUrl: ''}))} className={styles.removeBtn}>✕</button>
                    </div>
                  ) : (
                    <label className={styles.uploadImageLabel}>
                      <ImagePlus size={24} />
                      <span>Subir Banner</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} hidden />
                    </label>
                  )}
                  {uploading && <div className={styles.uploadOverlay}><Loader2 className="animate-spin" /> Subiendo...</div>}
                </div>
                <p className={styles.helpText}>Puedes subir un banner en formato horizontal para representar esta colección.</p>
              </div>

              <div className={styles.formActions}>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || uploading}>
                  {editingId ? 'Guardar Cambios' : 'Crear Colección'}
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
            <h2 className={styles.cardTitle}>Tus Colecciones</h2>
            
            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.collectionsGrid}>
              {collections.map((col) => (
                <div key={col.id} className={styles.collectionCard}>
                  <div className={styles.collectionVisual}>
                    {col.imageUrl ? (
                      <img src={col.imageUrl} alt={col.name} className={styles.collectionBanner} />
                    ) : (
                      <div className={styles.collectionBannerEmpty}>
                        <ImagePlus size={24} opacity={0.3} />
                        <span>Sin Banner</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.collectionContent}>
                    <div className={styles.collectionInfo}>
                      <h3 className={styles.collectionName}>{col.name}</h3>
                      <span className={styles.collectionBadge}>Orden: {col.order ?? 0}</span>
                    </div>
                    <div className={styles.collectionActions}>
                      <button type="button" className={styles.actionBtn} onClick={() => handleEdit(col)} title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteConfirm(col)} title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {collections.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes colecciones creadas todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar colección?</h3>
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

      {cropModalOpen && imageToCrop && (
        <AdminImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setCropModalOpen(false);
            setImageToCrop(null);
          }}
          aspectRatio={16 / 9} // 16:9 format for Banners
        />
      )}
    </div>
  );
};

export default AdminColecciones;
