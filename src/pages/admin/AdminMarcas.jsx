import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../../services/brands';
import { uploadFile } from '../../services/firebase/storage';
import Button from '../../components/common/Button';
import styles from './AdminMarcas.module.css';

const AdminMarcas = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', logoUrl: '', order: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);

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
      setForm({ name: '', logoUrl: '', order: (brandsData?.length ?? 0) });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBrand(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setEditingId(null);
      setForm({ name: '', logoUrl: '', order: 0 });
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
    const payload = { name: form.name.trim(), logoUrl: form.logoUrl.trim(), order: Number(form.order) };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (brand) => {
    setEditingId(brand.id);
    setForm({ name: brand.name, logoUrl: brand.logoUrl || '', order: brand.order ?? 0 });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', logoUrl: '', order: brands.length });
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
            <span className={styles.itemName}>{brand.name}</span>
            <span className={styles.itemOrder}>Orden: {brand.order ?? 0}</span>
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
