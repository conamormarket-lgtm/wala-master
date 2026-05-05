import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../../services/brands';
import { uploadFile } from '../../services/firebase/storage';
import { Edit2, Trash2, UploadCloud, Palette, ImageIcon, ImagePlus } from 'lucide-react';
import Button from '../../components/common/Button';
import AdminImageCropper from '../../components/admin/AdminImageCropper/AdminImageCropper';
import styles from './AdminMarcas.module.css';

const hexToRgba = (hex, alpha) => {
  const cleanHex = hex ? hex.replace('#', '') : 'ffffff';
  const r = parseInt(cleanHex.length === 3 ? cleanHex.charAt(0).repeat(2) : cleanHex.substring(0, 2), 16) || 255;
  const g = parseInt(cleanHex.length === 3 ? cleanHex.charAt(1).repeat(2) : cleanHex.substring(2, 4), 16) || 255;
  const b = parseInt(cleanHex.length === 3 ? cleanHex.charAt(2).repeat(2) : cleanHex.substring(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const AdminMarcas = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', logoUrl: '', order: 0, bgColor: '#ffffff', bgImage: '', bgOpacity: 100 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const { data: brandsData, isLoading, error } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async () => {
      const { data, error: err } = await getBrands();
      if (err) throw new Error(err);
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => createBrand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setForm({ name: '', logoUrl: '', order: (brandsData?.length ?? 0), bgColor: '#ffffff', bgImage: '', bgOpacity: 100 });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBrand(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setEditingId(null);
      setForm({ name: '', logoUrl: '', order: 0, bgColor: '#ffffff', bgImage: '', bgOpacity: 100 });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteBrand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setDeleteConfirm(null);
    }
  });

  const brands = brandsData ?? [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = { 
      name: form.name.trim(), 
      logoUrl: form.logoUrl.trim(), 
      order: Number(form.order),
      bgColor: form.bgColor,
      bgImage: form.bgImage.trim(),
      bgOpacity: Number(form.bgOpacity)
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (brand) => {
    setEditingId(brand.id);
    setForm({ 
      name: brand.name, 
      logoUrl: brand.logoUrl || '', 
      order: brand.order ?? 0,
      bgColor: brand.bgColor || '#ffffff',
      bgImage: brand.bgImage || '',
      bgOpacity: brand.bgOpacity ?? 100
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', logoUrl: '', order: brands.length, bgColor: '#ffffff', bgImage: '', bgOpacity: 100 });
  };

  const handleLogoUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const path = `brands/logos/${Date.now()}_${file.name}`;
      const { url, error: err } = await uploadFile(file, path);
      if (url && !err) {
        setForm((f) => ({ ...f, logoUrl: url }));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleBgUpload = async (e) => {
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
    setBgUploading(true);
    try {
      const path = `brands/backgrounds/${Date.now()}_cropped.jpg`;
      const { url, error: err } = await uploadFile(croppedFile, path);
      if (url && !err) {
        setForm((f) => ({ ...f, bgImage: url }));
      }
    } finally {
      setBgUploading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerTitles}>
          <h1 className={styles.title}>Gestión de Marcas</h1>
          <p className={styles.subtitle}>
            Diseña identidades visuales únicas para cada marca. Los productos heredarán estos fondos en la tienda.
          </p>
        </div>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          {/* Columna Izquierda: Datos Básicos */}
          <div className={styles.basicInfo}>
            <h3 className={styles.sectionTitle}>
              <Palette size={18} />
              Información Básica
            </h3>
            
            <div className={styles.field}>
              <label className={styles.label}>Nombre de la Marca</label>
              <input
                type="text"
                placeholder="Ej. Nike, Adidas..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 2 }}>
                <label className={styles.label}>Logotipo</label>
                <div className={styles.uploadBox}>
                  {form.logoUrl ? (
                    <div className={styles.logoPreviewWrapper}>
                      <img src={form.logoUrl} alt="Logo" className={styles.logoPreview} />
                      <button type="button" onClick={() => setForm(f => ({...f, logoUrl: ''}))} className={styles.removeBtn}>✕</button>
                    </div>
                  ) : (
                    <label className={styles.uploadLabel}>
                      <UploadCloud size={24} />
                      <span>Subir Logo</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} hidden />
                    </label>
                  )}
                  {uploading && <div className={styles.uploadOverlay}>Subiendo...</div>}
                </div>
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
          </div>

          {/* Columna Derecha: Identidad Visual */}
          <div className={styles.visualInfo}>
            <h3 className={styles.sectionTitle}>
              <ImageIcon size={18} />
              Identidad Visual
            </h3>

            <div className={styles.field}>
              <label className={styles.label}>Color Base</label>
              <div className={styles.colorPickerContainer}>
                <input
                  type="color"
                  value={form.bgColor}
                  onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                  className={styles.colorInput}
                />
                <input
                  type="text"
                  value={form.bgColor}
                  onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                  className={styles.input}
                  style={{ textTransform: 'uppercase', flex: 1 }}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Textura o Imagen de Fondo</label>
              <div className={styles.bgUploadWrapper}>
                {form.bgImage ? (
                  <div className={styles.bgPreviewContainer}>
                    <img src={form.bgImage} alt="Background" className={styles.bgPreviewImg} />
                    <button type="button" onClick={() => setForm(f => ({...f, bgImage: ''}))} className={styles.removeBtn}>✕</button>
                  </div>
                ) : (
                  <label className={styles.uploadBgLabel}>
                    <ImagePlus size={20} />
                    <span>Añadir Fondo</span>
                    <input type="file" accept="image/*" onChange={handleBgUpload} disabled={bgUploading} hidden />
                  </label>
                )}
                {bgUploading && <div className={styles.uploadOverlay}>Subiendo...</div>}
              </div>
            </div>

            {form.bgImage && (
              <div className={styles.field}>
                <div className={styles.rangeHeader}>
                  <label className={styles.label}>Transparencia de la Imagen</label>
                  <span className={styles.rangeValue}>{form.bgOpacity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={form.bgOpacity}
                  onChange={(e) => setForm((f) => ({ ...f, bgOpacity: Number(e.target.value) }))}
                  className={styles.rangeSlider}
                />
              </div>
            )}
          </div>
        </div>

        {/* Vista Previa */}
        <div className={styles.previewSection}>
          <h3 className={styles.previewTitle}>Vista Previa de Tarjeta</h3>
          <div className={styles.previewCardWrapper}>
            <div 
              className={styles.previewCard}
              style={{
                backgroundColor: form.bgColor,
                backgroundImage: form.bgImage 
                  ? `linear-gradient(${hexToRgba(form.bgColor, 1 - form.bgOpacity/100)}, ${hexToRgba(form.bgColor, 1 - form.bgOpacity/100)}), url(${form.bgImage})` 
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: `center`,
                backgroundRepeat: 'no-repeat'
              }}
            >
              <div className={styles.previewProductMockup}>
                {form.logoUrl ? (
                  <img src={form.logoUrl} className={styles.previewMockupLogo} alt="Logo" />
                ) : (
                  <div className={styles.previewMockupPlaceholder} />
                )}
                <div className={styles.previewMockupTags}>
                  <span>NEW</span>
                </div>
              </div>
              <div className={styles.previewCardContent}>
                <h4>Product Name</h4>
                <p>S/ 99.00</p>
                <div className={styles.previewMockupBrand}>{form.name || 'Brand Name'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.formFooter}>
          {editingId && (
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingId ? 'Actualizar Identidad' : 'Crear Marca'}
          </Button>
        </div>
      </form>

      {/* Grid de Marcas */}
      <div className={styles.brandsSection}>
        <h2 className={styles.brandsTitle}>Marcas Registradas ({brands.length})</h2>
        
        {isLoading && <div className={styles.loadingPulse}>Cargando identidades...</div>}
        {error && <div className={styles.errorAlert}>{error.message}</div>}

        <div className={styles.brandsGrid}>
          {brands.map((brand) => (
            <div 
              key={brand.id} 
              className={styles.brandCard}
              style={{
                backgroundColor: brand.bgColor || '#ffffff',
                backgroundImage: brand.bgImage ? `linear-gradient(${hexToRgba(brand.bgColor, 1 - (brand.bgOpacity ?? 100)/100)}, ${hexToRgba(brand.bgColor, 1 - (brand.bgOpacity ?? 100)/100)}), url(${brand.bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: `center`,
                backgroundRepeat: 'no-repeat'
              }}
            >
              <div className={styles.brandCardGlass}>
                <div className={styles.brandCardHeader}>
                  <div className={styles.brandCardLogoWrap}>
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.name} className={styles.brandCardLogo} />
                    ) : (
                      <span className={styles.brandInitials}>{brand.name.substring(0,2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.brandCardActions}>
                    <button onClick={() => handleEdit(brand)} className={styles.iconBtn} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setDeleteConfirm(brand)} className={`${styles.iconBtn} ${styles.dangerBtn}`} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className={styles.brandCardBody}>
                  <h3 className={styles.brandCardName}>{brand.name}</h3>
                  <div className={styles.brandCardMeta}>
                    <span className={styles.metaPill}>Orden: {brand.order ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {brands.length === 0 && !isLoading && (
          <div className={styles.emptyState}>
            <Palette size={48} className={styles.emptyIcon} />
            <p>No tienes marcas creadas aún.</p>
            <span>Configura tu primera marca arriba para empezar a personalizar fondos.</span>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <Trash2 size={24} className={styles.modalIcon} />
              <h3>¿Eliminar "{deleteConfirm.name}"?</h3>
            </div>
            <p className={styles.modalBody}>
              Al eliminar esta marca, los productos que la tengan asignada volverán a tener el fondo predeterminado (transparent/blanco). Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                style={{ backgroundColor: 'var(--rojo-principal)' }}
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
              >
                Sí, Eliminar
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
          aspectRatio={3 / 4} // Proporción vertical para tarjetas de producto
        />
      )}
    </div>
  );
};

export default AdminMarcas;
