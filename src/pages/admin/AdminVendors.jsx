import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVendors, createVendor, updateVendor, deleteVendor } from '../../services/vendors';
import { Edit2, Trash2, Store } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminVendors.module.css';

const TYPE_OPTIONS = [
  { value: 'house', label: 'House' },
  { value: 'pod', label: 'POD' },
  { value: 'reseller', label: 'Reseller' },
  { value: 'self-fulfill', label: 'Self-fulfill' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'suspended', label: 'Suspendido' },
];

const EMPTY_FORM = {
  name: '',
  displayName: '',
  slug: '',
  type: 'house',
  status: 'active',
  commissionPct: 0,
  logoUrl: '',
};

const typeLabel = (v) => TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
const statusLabel = (v) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;

const slugify = (str) =>
  (str || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const AdminVendors = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: vendorsData, isLoading, error } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: async () => {
      const { data, error: err } = await getVendors();
      if (err) throw new Error(err);
      return data;
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const createMutation = useMutation({
    mutationFn: (data) => createVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateVendor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteVendor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setDeleteConfirm(null);
    },
  });

  const vendors = vendorsData ?? [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const name = form.name.trim();
    const payload = {
      name,
      displayName: form.displayName.trim() || name,
      slug: (form.slug.trim() || slugify(name)),
      type: form.type,
      status: form.status,
      commissionPct: Number(form.commissionPct) || 0,
      logoUrl: form.logoUrl.trim(),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (vendor) => {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name || '',
      displayName: vendor.displayName || '',
      slug: vendor.slug || '',
      type: vendor.type || 'house',
      status: vendor.status || 'active',
      commissionPct: vendor.commissionPct ?? 0,
      logoUrl: vendor.logoUrl || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendedores</h1>
          <p className={styles.subtitle}>Gestiona las tiendas, su tipo de operación, comisión y estado</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Vendedor' : 'Nuevo Vendedor'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label className={styles.label}>Nombre interno</label>
                <input
                  type="text"
                  placeholder="Ej. Wala House"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Nombre público</label>
                <input
                  type="text"
                  placeholder="Cómo se mostrará al cliente"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Slug</label>
                <input
                  type="text"
                  placeholder="se-genera-del-nombre"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className={styles.input}
                />
                <p className={styles.helpText}>Si lo dejas vacío se genera a partir del nombre.</p>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className={styles.input}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className={styles.input}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
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

              <div className={styles.field}>
                <label className={styles.label}>Logo (URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  className={styles.input}
                />
                {form.logoUrl ? (
                  <div className={styles.logoPreviewWrap}>
                    <img src={form.logoUrl} alt="Logo" className={styles.logoPreview} />
                  </div>
                ) : null}
              </div>

              <div className={styles.formActions}>
                <Button type="submit" disabled={isSaving}>
                  {editingId ? 'Guardar Cambios' : 'Crear Vendedor'}
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
            <h2 className={styles.cardTitle}>Tus Vendedores</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            {vendors.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Comisión</th>
                      <th className={styles.actionsCol}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((vendor) => (
                      <tr key={vendor.id}>
                        <td>
                          <div className={styles.nameCell}>
                            {vendor.logoUrl ? (
                              <img src={vendor.logoUrl} alt="" className={styles.rowLogo} />
                            ) : (
                              <div className={styles.rowLogoEmpty}>
                                <Store size={16} opacity={0.5} />
                              </div>
                            )}
                            <div className={styles.nameText}>
                              <span className={styles.vendorName}>{vendor.displayName || vendor.name}</span>
                              {vendor.slug ? <span className={styles.vendorSlug}>/{vendor.slug}</span> : null}
                            </div>
                          </div>
                        </td>
                        <td><span className={styles.typeBadge}>{typeLabel(vendor.type)}</span></td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[`status_${vendor.status}`] || ''}`}>
                            {statusLabel(vendor.status)}
                          </span>
                        </td>
                        <td>{Number(vendor.commissionPct ?? 0)}%</td>
                        <td className={styles.actionsCol}>
                          <div className={styles.rowActions}>
                            <button type="button" className={styles.actionBtn} onClick={() => handleEdit(vendor)} title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteConfirm(vendor)} title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {vendors.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes vendedores creados todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar vendedor?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar <strong>{deleteConfirm.displayName || deleteConfirm.name}</strong>. Esta acción no se puede deshacer.
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

export default AdminVendors;
