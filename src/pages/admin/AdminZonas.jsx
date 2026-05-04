import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStorefrontConfig,
  saveStorefrontConfig,
  SECTION_TYPES,
  createSectionId,
  getDefaultSettings
} from '../../services/storefront';
import { getCollections } from '../../services/collections';
import Button from '../../components/common/Button';
import styles from './AdminZonas.module.css';

const typeLabel = (typeId) => SECTION_TYPES.find((t) => t.id === typeId)?.label ?? typeId;

const AdminZonas = () => {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['storefront-config'],
    queryFn: async () => {
      const { sections, error: err } = await getStorefrontConfig();
      if (err) throw new Error(err);
      return { sections };
    }
  });

  const { data: collections } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: async () => {
      const { data, error: err } = await getCollections();
      if (err) throw new Error(err);
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: (sections) => saveStorefrontConfig(sections),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-config'] });
      setEditingSection(null);
      setAddOpen(false);
    }
  });

  const sections = config?.sections ?? [];
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleMove = (index, dir) => {
    if (dir < 0 && index <= 0) return;
    if (dir > 0 && index >= sorted.length - 1) return;
    const next = [...sorted];
    const [removed] = next.splice(index, 1);
    next.splice(index + dir, 0, removed);
    const reordered = next.map((s, i) => ({ ...s, order: i }));
    saveMutation.mutate(reordered);
  };

  const handleDelete = (id) => {
    if (!window.confirm('¿Quitar esta zona?')) return;
    const next = sorted.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }));
    saveMutation.mutate(next);
  };

  const handleAdd = (typeId) => {
    const newSection = {
      id: createSectionId(),
      type: typeId,
      order: sorted.length,
      settings: getDefaultSettings(typeId)
    };
    saveMutation.mutate([...sorted, newSection]);
  };

  const handleSaveEdit = (updated) => {
    const next = sorted.map((s) => (s.id === updated.id ? { ...s, ...updated } : s));
    saveMutation.mutate(next);
  };

  if (isLoading) return <p className={styles.loading}>Cargando zonas...</p>;
  if (error) return <p className={styles.error}>{error.message}</p>;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Zonas de la tienda</h1>
      <p className={styles.subtitle}>
        Ordena y configura las secciones de la página de tienda (como en Shopify). Añade zonas de texto, imagen, video, productos destacados, etc.
      </p>

      <div className={styles.toolbar}>
        <div className={styles.addDropdown}>
          <Button onClick={() => setAddOpen(!addOpen)}>Añadir zona</Button>
          {addOpen && (
            <div className={styles.addMenu}>
              {SECTION_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.addMenuItem}
                  onClick={() => handleAdd(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className={styles.list}>
        {sorted.map((section, index) => (
          <li key={section.id} className={styles.item}>
            <span className={styles.itemLabel}>{typeLabel(section.type)}</span>
            <div className={styles.itemActions}>
              <button
                type="button"
                className={styles.btnIcon}
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                title="Subir"
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.btnIcon}
                onClick={() => handleMove(index, 1)}
                disabled={index === sorted.length - 1}
                title="Bajar"
              >
                ↓
              </button>
              <button type="button" className={styles.btnEdit} onClick={() => setEditingSection({ ...section })}>
                Editar
              </button>
              <button type="button" className={styles.btnDelete} onClick={() => handleDelete(section.id)}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {sorted.length === 0 && (
        <p className={styles.empty}>
          No hay zonas. Haz clic en &quot;Añadir zona&quot; para añadir la primera. Si guardas sin zonas, la tienda usará el diseño por defecto.
        </p>
      )}

      {editingSection && (
        <EditSectionModal
          section={editingSection}
          collections={collections || []}
          onSave={handleSaveEdit}
          onClose={() => setEditingSection(null)}
        />
      )}
    </div>
  );
};

function EditSectionModal({ section, collections, onSave, onClose }) {
  const [form, setForm] = useState(section.settings || {});

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...section, settings: { ...form } });
  };

  const type = section.type;
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Editar: {typeLabel(type)}</h3>
        <form onSubmit={handleSubmit}>
          {type === 'header' && (
            <>
              <div className={styles.field}>
                <label>Título</label>
                <input
                  value={form.title ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Subtítulo</label>
                <input
                  value={form.subtitle ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  className={styles.input}
                />
              </div>
            </>
          )}
          {type === 'text' && (
            <>
              <div className={styles.field}>
                <label>Título del bloque</label>
                <input
                  value={form.heading ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Contenido</label>
                <textarea
                  value={form.content ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className={styles.input}
                  rows={4}
                />
              </div>
            </>
          )}
          {type === 'image' && (
            <>
              <div className={styles.field}>
                <label>URL de imagen (o Google Drive)</label>
                <input
                  value={form.url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className={styles.input}
                  placeholder="https://..."
                />
              </div>
              <div className={styles.field}>
                <label>Texto alternativo</label>
                <input
                  value={form.alt ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Enlace (opcional)</label>
                <input
                  value={form.link ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                  className={styles.input}
                  placeholder="https://..."
                />
              </div>
            </>
          )}
          {type === 'video' && (
            <>
              <div className={styles.field}>
                <label>URL del video (embed o directo)</label>
                <input
                  value={form.url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className={styles.input}
                  placeholder="https://..."
                />
              </div>
              <div className={styles.field}>
                <label>URL imagen de poster (opcional)</label>
                <input
                  value={form.poster ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, poster: e.target.value }))}
                  className={styles.input}
                />
              </div>
            </>
          )}
          {type === 'featured_products' && (
            <div className={styles.field}>
              <label>Título de la sección</label>
              <input
                value={form.title ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={styles.input}
              />
            </div>
          )}
          {type === 'collection_carousel' && (
            <>
              <div className={styles.field}>
                <label>Título de la sección</label>
                <input
                  value={form.title ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Colección a mostrar</label>
                <select
                  value={form.collection ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, collection: e.target.value }))}
                  className={styles.input}
                >
                  <option value="">Selecciona una colección...</option>
                  {(collections || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className={styles.hint}>Los productos con esta colección se mostrarán en un carrusel.</p>
              </div>
            </>
          )}
          {type === 'product_grid' && (
            <>
              <div className={styles.field}>
                <label>Título (opcional)</label>
                <input
                  value={form.title ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={form.show_search !== false}
                    onChange={(e) => setForm((f) => ({ ...f, show_search: e.target.checked }))}
                  />
                  Mostrar búsqueda y ordenación
                </label>
              </div>
            </>
          )}
          {type === 'categories_nav' && <p className={styles.hint}>Esta zona no tiene opciones de configuración.</p>}
          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminZonas;
