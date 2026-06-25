import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRewards, createReward, updateReward, deleteReward } from '../../services/rewardsCatalog';
import { Edit2, Trash2, Gift } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminRecompensas.module.css';

const emptyForm = {
  title: '',
  description: '',
  cost: 0,
  value: '',
  order: 0,
  active: true
};

const AdminRecompensas = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: rewardsData, isLoading, error } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: async () => {
      const { data, error: err } = await getRewards();
      if (err) throw new Error(err);
      return data;
    }
  });

  const rewards = rewardsData ?? [];

  const resetForm = (nextOrder) =>
    setForm({ ...emptyForm, order: nextOrder ?? rewards.length });

  const createMutation = useMutation({
    mutationFn: (data) => createReward(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      resetForm((rewardsData?.length ?? 0) + 1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateReward(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      setEditingId(null);
      resetForm(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteReward(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      cost: Number(form.cost) || 0,
      value: form.value.trim(),
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

  const handleEdit = (reward) => {
    setEditingId(reward.id);
    setForm({
      title: reward.title || '',
      description: reward.description || '',
      cost: reward.cost ?? 0,
      value: reward.value || '',
      order: reward.order ?? 0,
      active: reward.active !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm(rewards.length);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Recompensas</h1>
          <p className={styles.subtitle}>
            Catálogo de premios que los clientes canjean con sus puntos (monedas).
          </p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Recompensa' : 'Nueva Recompensa'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label className={styles.label}>Título</label>
                <input
                  type="text"
                  placeholder="Ej. Pack de stickers"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Descripción</label>
                <textarea
                  placeholder="Breve descripción de la recompensa"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Costo (puntos)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                    className={styles.input}
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
                <label className={styles.label}>Valor (referencia)</label>
                <input
                  type="text"
                  placeholder="Ej. S/30 de descuento, accesorio físico..."
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className={styles.input}
                />
                <p className={styles.helpText}>
                  Texto interno de referencia sobre qué representa esta recompensa.
                </p>
              </div>

              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className={styles.checkbox}
                  />
                  <span>Recompensa activa (visible para canje)</span>
                </label>
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Recompensa'}
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
            <h2 className={styles.cardTitle}>Tus Recompensas</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.rewardsGrid}>
              {rewards.map((reward) => (
                <div key={reward.id} className={styles.rewardCard}>
                  <div className={styles.rewardVisual}>
                    <div className={styles.rewardBubble}>
                      <Gift size={22} />
                    </div>
                  </div>
                  <div className={styles.rewardInfo}>
                    <h3 className={styles.rewardName}>{reward.title}</h3>
                    {reward.description && (
                      <p className={styles.rewardDesc}>{reward.description}</p>
                    )}
                    <div className={styles.badgeRow}>
                      <span className={styles.costBadge}>{reward.cost ?? 0} pts</span>
                      <span className={styles.rewardBadge}>Orden: {reward.order ?? 0}</span>
                      <span
                        className={`${styles.statusBadge} ${
                          reward.active !== false ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {reward.active !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    {reward.value && (
                      <span className={styles.rewardValue}>{reward.value}</span>
                    )}
                  </div>
                  <div className={styles.rewardActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(reward)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(reward)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {rewards.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes recompensas creadas todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar recompensa?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar <strong>{deleteConfirm.title}</strong>. Esta acción no se puede deshacer.
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

export default AdminRecompensas;
