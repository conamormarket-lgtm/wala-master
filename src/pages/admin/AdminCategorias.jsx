import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/categories';
import { uploadFile } from '../../services/firebase/storage';
import { Edit2, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import Button from '../../components/common/Button';
import AdminImageCropper from '../../components/admin/AdminImageCropper/AdminImageCropper';
import styles from './AdminCategorias.module.css';

const AdminCategorias = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', order: 0, imageUrl: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const { data: categoriesData, isLoading, error } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error: err } = await getCategories();
      if (err) throw new Error(err);
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setForm({ name: '', order: (categoriesData?.length ?? 0), imageUrl: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
      setForm({ name: '', order: 0, imageUrl: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteConfirm(null);
    }
  });

  const categories = categoriesData ?? [];

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
      const path = `categories/${Date.now()}_cropped.jpg`;
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

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ 
      name: cat.name, 
      order: cat.order ?? 0,
      imageUrl: cat.imageUrl || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', order: categories.length, imageUrl: '' });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Categorías</h1>
          <p className={styles.subtitle}>Organiza tu catálogo y define la imagen para la navegación</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              
              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label className={styles.label}>Nombre de la Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej. Hoodies"
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
                <label className={styles.label}>Imagen de la Categoría (Formato Circular)</label>
                <div className={styles.imageUploadWrapper}>
                  {form.imageUrl ? (
                    <div className={styles.imagePreviewContainer}>
                      <img src={form.imageUrl} alt="Categoría" className={styles.imagePreview} />
                      <button type="button" onClick={() => setForm(f => ({...f, imageUrl: ''}))} className={styles.removeBtn}>✕</button>
                    </div>
                  ) : (
                    <label className={styles.uploadImageLabel}>
                      <ImagePlus size={24} />
                      <span>Subir Imagen</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} hidden />
                    </label>
                  )}
                  {uploading && <div className={styles.uploadOverlay}><Loader2 className="animate-spin" /> Subiendo...</div>}
                </div>
                <p className={styles.helpText}>Esta imagen se mostrará en las burbujas de navegación superior.</p>
              </div>

              <div className={styles.formActions}>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || uploading}>
                  {editingId ? 'Guardar Cambios' : 'Crear Categoría'}
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
            <h2 className={styles.cardTitle}>Tus Categorías</h2>
            
            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.categoriesGrid}>
              {categories.map((cat) => (
                <div key={cat.id} className={styles.categoryCard}>
                  <div className={styles.categoryVisual}>
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name} className={styles.categoryBubble} />
                    ) : (
                      <div className={styles.categoryBubbleEmpty}>
                        <ImagePlus size={20} opacity={0.5} />
                      </div>
                    )}
                  </div>
                  <div className={styles.categoryInfo}>
                    <h3 className={styles.categoryName}>{cat.name}</h3>
                    <span className={styles.categoryBadge}>Orden: {cat.order ?? 0}</span>
                  </div>
                  <div className={styles.categoryActions}>
                    <button type="button" className={styles.actionBtn} onClick={() => handleEdit(cat)} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteConfirm(cat)} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {categories.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes categorías creadas todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar categoría?</h3>
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
          aspectRatio={1} // 1:1 format for Category bubbles
        />
      )}
    </div>
  );
};

export default AdminCategorias;
