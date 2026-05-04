import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/categories';
import Button from '../../components/common/Button';
import styles from './AdminCategorias.module.css';

const AdminCategorias = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', order: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      setForm({ name: '', order: (categoriesData?.length ?? 0) });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
      setForm({ name: '', order: 0 });
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { name: form.name.trim(), order: Number(form.order) } });
    } else {
      createMutation.mutate({ name: form.name.trim(), order: Number(form.order) });
    }
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, order: cat.order ?? 0 });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', order: categories.length });
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Categorías</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre de la categoría"
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
            {editingId ? 'Guardar cambios' : 'Añadir categoría'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {isLoading && <p className={styles.loading}>Cargando categorías...</p>}
      {error && <p className={styles.error}>{error.message}</p>}

      <ul className={styles.list}>
        {categories.map((cat) => (
          <li key={cat.id} className={styles.item}>
            <span className={styles.itemName}>{cat.name}</span>
            <span className={styles.itemOrder}>Orden: {cat.order ?? 0}</span>
            <div className={styles.itemActions}>
              <button type="button" className={styles.btnEdit} onClick={() => handleEdit(cat)}>
                Editar
              </button>
              <button
                type="button"
                className={styles.btnDelete}
                onClick={() => setDeleteConfirm(cat)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {categories.length === 0 && !isLoading && (
        <p className={styles.empty}>No hay categorías. Añade una arriba.</p>
      )}

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p>¿Eliminar la categoría &quot;{deleteConfirm.name}&quot;?</p>
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

export default AdminCategorias;
