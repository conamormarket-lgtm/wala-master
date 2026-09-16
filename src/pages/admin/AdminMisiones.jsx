import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMissions, createMission, updateMission, deleteMission } from '../../services/missions';
import { Edit2, Trash2, ListChecks, PackageOpen } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminMisiones.module.css';

const emptyForm = {
  title: '',
  description: '',
  rewardPoints: 0,
  order: 0,
  active: true,
};

// Extraída del map original (antes vivía duplicada -misma tarjeta- para
// poder separar Activas de Inactivas sin repetir el JSX dos veces). Mismo
// patrón que AdminRecompensas.jsx.
const MissionCard = ({ mission, onEdit, onDelete }) => (
  <div className={styles.missionCard}>
    <div className={styles.missionVisual}>
      <div className={styles.missionBubble}>
        <ListChecks size={22} />
      </div>
    </div>
    <div className={styles.missionInfo}>
      <h3 className={styles.missionName}>{mission.title}</h3>
      {mission.description && (
        <p className={styles.missionDesc}>{mission.description}</p>
      )}
      <div className={styles.badgeRow}>
        <span className={styles.rewardBadge}>🪙 {mission.rewardPoints ?? 0}</span>
        <span className={styles.orderBadge}>Orden: {mission.order ?? 0}</span>
        <span
          className={`${styles.statusBadge} ${
            mission.active !== false ? styles.statusActive : styles.statusInactive
          }`}
        >
          {mission.active !== false ? 'Activa' : 'Inactiva'}
        </span>
      </div>
    </div>
    <div className={styles.missionActions}>
      <button
        type="button"
        className={styles.actionBtn}
        onClick={() => onEdit(mission)}
        title="Editar"
      >
        <Edit2 size={16} />
      </button>
      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
        onClick={() => onDelete(mission)}
        title="Eliminar"
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
);

const AdminMisiones = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: missionsData, isLoading, error } = useQuery({
    queryKey: ['admin-missions'],
    queryFn: async () => {
      const { data, error: err } = await getMissions();
      if (err) throw new Error(err);
      return data;
    }
  });

  const missions = missionsData ?? [];

  // Separadas en dos grupos -en vez de una sola grilla mezclada- para que se
  // pueda distinguir de un vistazo qué está realmente visible hoy (Activas)
  // de lo que quedó pausado (Inactivas).
  const { activas, inactivas } = useMemo(() => {
    const act = [];
    const inact = [];
    for (const m of missions) (m.active !== false ? act : inact).push(m);
    return { activas: act, inactivas: inact };
  }, [missions]);

  const resetForm = (nextOrder) =>
    setForm({ ...emptyForm, order: nextOrder ?? missions.length });

  const createMutation = useMutation({
    mutationFn: (data) => createMission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-missions'] });
      resetForm((missionsData?.length ?? 0) + 1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateMission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-missions'] });
      setEditingId(null);
      resetForm(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteMission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-missions'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      rewardPoints: Number(form.rewardPoints) || 0,
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

  const handleEdit = (mission) => {
    setEditingId(mission.id);
    setForm({
      title: mission.title || '',
      description: mission.description || '',
      rewardPoints: mission.rewardPoints ?? 0,
      order: mission.order ?? 0,
      active: mission.active !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm(missions.length);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Misiones Diarias</h1>
          <p className={styles.subtitle}>
            Tareas cortas que el cliente completa cada día a cambio de monedas.
          </p>
        </div>
        {missions.length > 0 && (
          <div className={styles.headerStats}>
            <span className={styles.headerStat}>
              <strong>{activas.length}</strong> activa{activas.length === 1 ? '' : 's'}
            </span>
            {inactivas.length > 0 && (
              <span className={styles.headerStatMuted}>
                <strong>{inactivas.length}</strong> inactiva{inactivas.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Misión' : 'Nueva Misión'}
            </h2>

            <div className={styles.noteBox}>
              El cliente marca la misión como completada él mismo, con un botón;
              no hay verificación automática de que la haya hecho. Por eso funcionan
              mejor misiones simples de comprobar (ej. "visita tal sección") que
              misiones de confianza (ej. "compártelo en redes").
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label className={styles.label}>Título</label>
                <input
                  type="text"
                  placeholder="Ej. Visita el Catálogo de Recompensas"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Descripción</label>
                <textarea
                  placeholder="Breve descripción de la misión"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Recompensa (monedas)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.rewardPoints}
                    onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
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
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className={styles.checkbox}
                  />
                  <span>Misión activa (visible hoy)</span>
                </label>
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Misión'}
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
            <h2 className={styles.cardTitle}>Tus Misiones</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            {!isLoading && !error && activas.length > 0 && (
              <div className={styles.missionsGrid}>
                {activas.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} onEdit={handleEdit} onDelete={setDeleteConfirm} />
                ))}
              </div>
            )}

            {/* Inactivas: aparte y con su propio rótulo -en vez de mezcladas
                en la misma grilla- para que pausar una misión no la deje
                "perdida" entre las que sí se ven hoy. */}
            {!isLoading && !error && inactivas.length > 0 && (
              <>
                <h3 className={styles.groupLabel}>Inactivas</h3>
                <div className={styles.missionsGrid}>
                  {inactivas.map((mission) => (
                    <MissionCard key={mission.id} mission={mission} onEdit={handleEdit} onDelete={setDeleteConfirm} />
                  ))}
                </div>
              </>
            )}

            {missions.length === 0 && !isLoading && !error && (
              <div className={styles.emptyState}>
                <PackageOpen size={36} aria-hidden="true" className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No tienes misiones creadas todavía.</p>
                <p className={styles.emptyText}>
                  Usa el formulario de la izquierda para crear la primera: la lista
                  que ven tus clientes en "Mi cuenta → Misiones" se llena con lo que actives acá.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar misión?</h3>
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

export default AdminMisiones;
