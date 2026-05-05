import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../../services/brands';
import { uploadFile } from '../../services/firebase/storage';
import Button from '../../components/common/Button';
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
    setBgUploading(true);
    try {
      const path = `brands/backgrounds/${Date.now()}_${file.name}`;
      const { url, error: err } = await uploadFile(file, path);
      if (url && !err) {
        setForm((f) => ({ ...f, bgImage: url }));
      }
    } finally {
      setBgUploading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Marcas</h1>
      <p className={styles.subtitle}>
        Walá unifica varias marcas. Agrega aquí las marcas que manejas y asígnalas a cada producto.
        Si un producto no tiene marca asignada, se entiende que es de <strong>Walá</strong>.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formFields}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nombre de la marca *</label>
            <input
              type="text"
              placeholder="Ej. Nike, Adidas, Mi Marca…"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Logo (opcional)</label>
            <div className={styles.logoUploadRow}>
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className={styles.logoPreview}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className={styles.fileInput}
                disabled={uploading}
              />
              {uploading && <span className={styles.uploadingLabel}>Subiendo...</span>}
            </div>
            <input
              type="text"
              placeholder="O pega URL del logo"
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              className={styles.input}
              style={{ marginTop: '0.5rem' }}
            />
          </div>

          <div className={styles.fieldGroup} style={{ maxWidth: '120px' }}>
            <label className={styles.label}>Orden</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              className={styles.inputOrder}
            />
          </div>

          <div className={styles.designSection}>
            <h3 className={styles.designTitle}>Diseño Característico (Fondo en Tienda)</h3>
            <div className={styles.designFields}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Color Base (Hexadecimal)</label>
                <div className={styles.colorPickerWrapper}>
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
                    style={{ width: '100px' }}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Textura o Imagen de Fondo</label>
                <div className={styles.logoUploadRow}>
                  {form.bgImage && (
                    <img
                      src={form.bgImage}
                      alt="Background preview"
                      className={styles.bgPreview}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBgUpload}
                    className={styles.fileInput}
                    disabled={bgUploading}
                  />
                  {bgUploading && <span className={styles.uploadingLabel}>Subiendo...</span>}
                </div>
                {form.bgImage && (
                  <div className={styles.rangeGroup}>
                    <label className={styles.label}>Visibilidad de la Imagen ({form.bgOpacity}%)</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={form.bgOpacity}
                      onChange={(e) => setForm((f) => ({ ...f, bgOpacity: Number(e.target.value) }))}
                      className={styles.rangeInput}
                    />
                    <small className={styles.hint}>100% = Imagen opaca, 0% = Solo color base.</small>
                  </div>
                )}
              </div>
              
              <div className={styles.previewBoxWrapper}>
                <label className={styles.label}>Vista Previa del Fondo</label>
                <div 
                  className={styles.previewBox}
                  style={{
                    backgroundColor: form.bgColor,
                    backgroundImage: form.bgImage 
                      ? `linear-gradient(${hexToRgba(form.bgColor, 1 - form.bgOpacity/100)}, ${hexToRgba(form.bgColor, 1 - form.bgOpacity/100)}), url(${form.bgImage})` 
                      : 'none'
                  }}
                >
                  <span className={styles.previewBoxText}>{form.name || 'Tu Marca'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingId ? 'Guardar cambios' : 'Añadir marca'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {isLoading && <p className={styles.loading}>Cargando marcas...</p>}
      {error && <p className={styles.error}>{error.message}</p>}

      <ul className={styles.list}>
        {brands.map((brand) => (
          <li key={brand.id} className={styles.item}>
            {brand.logoUrl && (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className={styles.itemLogo}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>{brand.name}</span>
              <span className={styles.itemOrder}>Orden: {brand.order ?? 0}</span>
              <div 
                className={styles.itemColorSwatch} 
                style={{ 
                  backgroundColor: brand.bgColor || '#ffffff',
                  backgroundImage: brand.bgImage ? `linear-gradient(${hexToRgba(brand.bgColor, 1 - (brand.bgOpacity ?? 100)/100)}, ${hexToRgba(brand.bgColor, 1 - (brand.bgOpacity ?? 100)/100)}), url(${brand.bgImage})` : 'none',
                }} 
                title="Fondo de la marca"
              />
            </div>
            <div className={styles.itemActions}>
              <button type="button" className={styles.btnEdit} onClick={() => handleEdit(brand)}>
                Editar
              </button>
              <button
                type="button"
                className={styles.btnDelete}
                onClick={() => setDeleteConfirm(brand)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {brands.length === 0 && !isLoading && (
        <p className={styles.empty}>No hay marcas registradas. Añade una arriba.</p>
      )}

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p>¿Eliminar la marca &quot;{deleteConfirm.name}&quot;?</p>
            <p className={styles.modalHint}>
              Los productos que tenían esta marca asignada volverán a mostrarse como "Walá".
            </p>
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

export default AdminMarcas;
