import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMockups, createMockup, updateMockup, deleteMockup } from '../../../services/mockups';
import { uploadFile } from '../../../services/firebase/storage';
import { Edit2, Trash2, ImagePlus, Loader2, Plus, X } from 'lucide-react';
import Button from '../../../components/common/Button';
import styles from './AdminMockups.module.css';

const AdminMockups = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', baseImageUrl: '', variants: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: mockupsData, isLoading, error } = useQuery({
    queryKey: ['admin-mockups'],
    queryFn: async () => {
      const { data, error: err } = await getMockups();
      if (err) throw new Error(err);
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => createMockup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mockups'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateMockup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mockups'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteMockup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mockups'] });
      setDeleteConfirm(null);
    }
  });

  const mockups = mockupsData ?? [];

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', category: '', baseImageUrl: '', variants: [] });
  };

  const handleImageUpload = async (e, type, variantIndex = null) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    setUploading(true);
    try {
      const path = `mockups/${Date.now()}_${file.name}`;
      const { url, error: err } = await uploadFile(file, path);
      if (url && !err) {
        if (type === 'base') {
          setForm(f => ({ ...f, baseImageUrl: url }));
        } else if (type === 'variant' && variantIndex !== null) {
          setForm(f => {
            const newVariants = [...f.variants];
            newVariants[variantIndex].imageUrl = url;
            return { ...f, variants: newVariants };
          });
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const addVariant = () => {
    setForm(f => ({
      ...f,
      variants: [...f.variants, { colorName: '', colorHex: '#000000', imageUrl: '' }]
    }));
  };

  const updateVariant = (index, field, value) => {
    setForm(f => {
      const newVariants = [...f.variants];
      newVariants[index][field] = value;
      return { ...f, variants: newVariants };
    });
  };

  const removeVariant = (index) => {
    setForm(f => {
      const newVariants = [...f.variants];
      newVariants.splice(index, 1);
      return { ...f, variants: newVariants };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.baseImageUrl) return;
    
    const payload = { 
      name: form.name.trim(), 
      category: form.category.trim(),
      baseImageUrl: form.baseImageUrl,
      variants: form.variants
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (mockup) => {
    setEditingId(mockup.id);
    setForm({ 
      name: mockup.name || '', 
      category: mockup.category || '',
      baseImageUrl: mockup.baseImageUrl || '',
      variants: mockup.variants || []
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Mockups (Plantillas Base)</h1>
          <p className={styles.subtitle}>Sube prendas en blanco para utilizarlas como base en la creación de productos</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Mockup' : 'Nuevo Mockup'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              
              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label className={styles.label}>Nombre del Mockup</label>
                  <input
                    type="text"
                    placeholder="Ej. Hoodie Oversize"
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
                    placeholder="Ej. Hoodies"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Imagen Base (Fondo Transparente)</label>
                <div className={styles.imageUploadWrapper}>
                  {form.baseImageUrl ? (
                    <div className={styles.imagePreviewContainer}>
                      <img src={form.baseImageUrl} alt="Mockup Base" className={styles.imagePreview} />
                      <button type="button" onClick={() => setForm(f => ({...f, baseImageUrl: ''}))} className={styles.removeBtn}><X size={16} /></button>
                    </div>
                  ) : (
                    <label className={styles.uploadImageLabel}>
                      <ImagePlus size={24} />
                      <span>Subir Imagen PNG</span>
                      <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleImageUpload(e, 'base')} disabled={uploading} hidden />
                    </label>
                  )}
                  {uploading && <div className={styles.uploadOverlay}><Loader2 className="animate-spin" /> Subiendo...</div>}
                </div>
                <p className={styles.helpText}>Esta imagen se usará por defecto si no hay colores específicos. Se recomienda un PNG sin fondo (transparente).</p>
              </div>

              <div className={styles.variantsSection}>
                <div className={styles.variantsHeader}>
                  <label className={styles.label}>Colores / Variantes</label>
                  <button type="button" onClick={addVariant} className={styles.addVariantBtn}>
                    <Plus size={16} /> Agregar Color
                  </button>
                </div>
                
                {form.variants.map((variant, index) => (
                  <div key={index} className={styles.variantCard}>
                    <div className={styles.variantHeader}>
                      <span>Color #{index + 1}</span>
                      <button type="button" onClick={() => removeVariant(index)} className={styles.removeVariantBtn}><X size={14} /></button>
                    </div>
                    <div className={styles.variantBody}>
                      <div className={styles.field}>
                        <label>Nombre del Color</label>
                        <input type="text" value={variant.colorName} onChange={e => updateVariant(index, 'colorName', e.target.value)} placeholder="Ej. Negro" className={styles.input} />
                      </div>
                      <div className={styles.field} style={{ maxWidth: '80px' }}>
                        <label>Hex</label>
                        <input type="color" value={variant.colorHex} onChange={e => updateVariant(index, 'colorHex', e.target.value)} className={styles.colorInput} />
                      </div>
                      <div className={styles.field}>
                        <label>Imagen Específica (Opcional)</label>
                        {variant.imageUrl ? (
                           <div className={styles.smallPreviewContainer}>
                             <img src={variant.imageUrl} alt="Color Variant" className={styles.smallPreview} />
                             <button type="button" onClick={() => updateVariant(index, 'imageUrl', '')} className={styles.removeSmallBtn}><X size={12} /></button>
                           </div>
                        ) : (
                          <label className={styles.smallUploadBtn}>
                            <ImagePlus size={16} /> Subir
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'variant', index)} disabled={uploading} hidden />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.formActions}>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || uploading || !form.baseImageUrl}>
                  {editingId ? 'Guardar Cambios' : 'Crear Mockup'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
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
            <h2 className={styles.cardTitle}>Tus Mockups</h2>
            
            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.mockupsGrid}>
              {mockups.map((mockup) => (
                <div key={mockup.id} className={styles.mockupCard}>
                  <div className={styles.mockupVisual}>
                    <img src={mockup.baseImageUrl} alt={mockup.name} className={styles.mockupImage} />
                  </div>
                  <div className={styles.mockupInfo}>
                    <h3 className={styles.mockupName}>{mockup.name}</h3>
                    <p className={styles.mockupCategory}>{mockup.category || 'Sin categoría'}</p>
                    
                    {mockup.variants && mockup.variants.length > 0 && (
                      <div className={styles.colorDots}>
                        {mockup.variants.map((v, i) => (
                          <div key={i} className={styles.colorDot} style={{ backgroundColor: v.colorHex }} title={v.colorName} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.mockupActions}>
                    <button type="button" className={styles.actionBtn} onClick={() => handleEdit(mockup)} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteConfirm(mockup)} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {mockups.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes mockups creados todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar mockup?</h3>
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

export default AdminMockups;
