import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollections, createCollection, updateCollection, deleteCollection } from '../../services/collections';
import Button from '../../components/common/Button';
import styles from './AdminColecciones.module.css';

const AdminColecciones = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', order: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      setForm({ name: '', order: (collectionsData?.length ?? 0) });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setEditingId(null);
      setForm({ name: '', order: 0 });
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { name: form.name.trim(), order: Number(form.order) } });
    } else {
      createMutation.mutate({ name: form.name.trim(), order: Number(form.order) });
    }
  };

  const handleEdit = (col) => {
    setEditingId(col.id);
    setForm({ name: col.name, order: col.order ?? 0 });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', order: collections.length });
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Colecciones</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre de la colección (Ej. parejas)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={styles.input}
          required
        />
        <input
          type="number"
          min="0"
          placeholder="Orden"
          value={form.order}
          onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
          className={styles.inputOrder}
        />
        <div className={styles.formActions}>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingId ? 'Guardar cambios' : 'Añadir colección'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {isLoading && <p className={styles.loading}>Cargando colecciones...</p>}
      {error && <p className={styles.error}>{error.message}</p>}

      <ul className={styles.list}>
        {collections.map((col) => (
          <li key={col.id} className={styles.item}>
            <span className={styles.itemName}>{col.name}</span>
            <span className={styles.itemOrder}>Orden: {col.order ?? 0}</span>
            <div className={styles.itemActions}>
              <button type="button" className={styles.btnEdit} onClick={() => handleEdit(col)}>
                Editar
              </button>
              <button
                type="button"
                className={styles.btnDelete}
                onClick={() => setDeleteConfirm(col)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {collections.length === 0 && !isLoading && (
        <p className={styles.empty}>No hay colecciones. Añade una arriba.</p>
      )}

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p>¿Eliminar la colección &quot;{deleteConfirm.name}&quot;?</p>
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

export default AdminColecciones;
