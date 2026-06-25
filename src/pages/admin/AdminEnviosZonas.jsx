import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShippingZones,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone
} from '../../services/shippingZones';
import { Edit2, Trash2, Truck } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminEnviosZonas.module.css';

const emptyForm = {
  name: '',
  departamento: '',
  cost: 0,
  etaDays: 0,
  order: 0,
  active: true
};

const AdminEnviosZonas = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: zonesData, isLoading, error } = useQuery({
    queryKey: ['admin-shipping-zones'],
    queryFn: async () => {
      const { data, error: err } = await getShippingZones();
      if (err) throw new Error(err);
      return data;
    }
  });

  const zones = zonesData ?? [];

  const resetForm = (nextOrder) =>
    setForm({ ...emptyForm, order: nextOrder ?? zones.length });

  const createMutation = useMutation({
    mutationFn: (data) => createShippingZone(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-zones'] });
      resetForm((zonesData?.length ?? 0) + 1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateShippingZone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-zones'] });
      setEditingId(null);
      resetForm(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteShippingZone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-zones'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      departamento: form.departamento.trim(),
      cost: Number(form.cost) || 0,
      etaDays: Number(form.etaDays) || 0,
      order: Number(form.order) || 0,
      active: !!form.active
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (zone) => {
    setEditingId(zone.id);
    setForm({
      name: zone.name || '',
      departamento: zone.departamento || '',
      cost: zone.cost ?? 0,
      etaDays: zone.etaDays ?? 0,
      order: zone.order ?? 0,
      active: zone.active !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm(zones.length);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Zonas de Envío</h1>
          <p className={styles.subtitle}>
            Define el costo y el tiempo de entrega por departamento.
          </p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Zona' : 'Nueva Zona'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label className={styles.label}>Nombre de la Zona</label>
                <input
                  type="text"
                  placeholder="Ej. Lima Metropolitana"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Departamento</label>
                <input
                  type="text"
                  placeholder="Ej. Lima"
                  value={form.departamento}
                  onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Costo (S/)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Días de entrega</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.etaDays}
                    onChange={(e) => setForm((f) => ({ ...f, etaDays: e.target.value }))}
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
                    <span>Zona activa</span>
                  </label>
                </div>
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Zona'}
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
            <h2 className={styles.cardTitle}>Tus Zonas</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.zonesGrid}>
              {zones.map((zone) => (
                <div key={zone.id} className={styles.zoneCard}>
                  <div className={styles.zoneVisual}>
                    <div className={styles.zoneIcon}>
                      <Truck size={22} />
                    </div>
                  </div>
                  <div className={styles.zoneInfo}>
                    <h3 className={styles.zoneName}>{zone.name}</h3>
                    {zone.departamento && (
                      <span className={styles.zoneDepartamento}>{zone.departamento}</span>
                    )}
                    <div className={styles.badgeRow}>
                      <span className={styles.zoneBadge}>S/ {Number(zone.cost ?? 0).toFixed(2)}</span>
                      <span className={styles.zoneBadge}>{zone.etaDays ?? 0} días</span>
                      <span className={styles.zoneBadge}>Orden: {zone.order ?? 0}</span>
                      <span
                        className={`${styles.statusBadge} ${
                          zone.active !== false ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {zone.active !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.zoneActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(zone)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(zone)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {zones.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes zonas de envío creadas todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar zona?</h3>
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
    </div>
  );
};

export default AdminEnviosZonas;
