import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStorefrontConfig,
  saveStorefrontConfig,
  SECTION_TYPES,
  createSectionId,
  getDefaultSettings
} from './Tienda/services/storefront';
import { getCollections } from '../services/collections';
import Button from '../components/common/Button';
import styles from './AdminDashboard.module.css';
import zoneStyles from './admin/AdminZonas.module.css';

const typeLabel = (typeId) => SECTION_TYPES.find((t) => t.id === typeId)?.label ?? typeId;

const PREVIEW_URL = '/tienda';

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const addDropdownRef = useRef(null);

  const [previewSrc, setPreviewSrc] = useState(() => `${PREVIEW_URL}?t=${Date.now()}`);

  const refreshPreviews = () => {
    setPreviewSrc(`${PREVIEW_URL}?t=${Date.now()}`);
  };

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
    mutationFn: async (sections) => {
      const result = await saveStorefrontConfig(sections);
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onMutate: async (newSections) => {
      await queryClient.cancelQueries({ queryKey: ['storefront-config'] });
      const previous = queryClient.getQueryData(['storefront-config']);
      queryClient.setQueryData(['storefront-config'], { sections: newSections });
      return { previous };
    },
    onError: (_err, _newSections, context) => {
      if (context?.previous) queryClient.setQueryData(['storefront-config'], context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-config'] });
      setPreviewSrc(`${PREVIEW_URL}?t=${Date.now()}`);
    },
    onSettled: () => {
      setEditingSection(null);
      setAddOpen(false);
    }
  });

  useEffect(() => {
    const close = (e) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target)) setAddOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const sections = config?.sections ?? [];
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleMove = (index, dir) => {
    if (dir < 0 && index <= 0) return;
    if (dir > 0 && index >= sorted.length - 1) return;
    const next = [...sorted];
    const [removed] = next.splice(index, 1);
    next.splice(index + dir, 0, removed);
    saveMutation.mutate(next.map((s, i) => ({ ...s, order: i })));
  };

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIndex(null);
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData('text/plain');
    if (raw === '') return;
    const fromIndex = Number(raw);
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...sorted];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    saveMutation.mutate(next.map((s, i) => ({ ...s, order: i })));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDelete = (id) => {
    if (!window.confirm('¿Quitar esta zona?')) return;
    saveMutation.mutate(sorted.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  const handleAdd = (typeId) => {
    saveMutation.mutate([
      ...sorted,
      { id: createSectionId(), type: typeId, order: sorted.length, settings: getDefaultSettings(typeId) }
    ]);
  };

  const handleSaveEdit = (updated) => {
    saveMutation.mutate(sorted.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  };

  const quickLinks = [
    { to: '/admin/productos', label: 'Productos', description: 'Crear, editar y eliminar productos' },
    { to: '/admin/categorias', label: 'Categorías', description: 'Gestionar categorías' },
    { to: '/admin/colecciones', label: 'Colecciones', description: 'Gestionar colecciones' },
    { to: '/admin/marcas', label: 'Marcas', description: 'Gestionar marcas de productos' },
    { to: '/admin/destacados', label: 'Destacados', description: 'Ordenar productos destacados' },
    { to: '/admin/cliparts', label: 'Cliparts', description: 'Galería de cliparts' },
    { to: '/admin/mascota', label: 'Mascota Virtual', description: 'Configurar mascota de retención' },
    { to: '/admin/backups', label: 'Historial y Backups', description: 'Restaurar diseño de la tienda' }
  ];

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Panel de Administración</h1>
      <p className={styles.subtitle}>
        Bienvenido al panel. Selecciona una opción para gestionar tu catálogo o configuración. 
        Para editar el diseño de la tienda visualmente, ve a "Vista Tienda" y usa el Editor Visual de la barra superior.
      </p>

      <div className={styles.grid}>
        {quickLinks.map(({ to, label, description }) => (
          <Link key={to} to={to} className={styles.card}>
            <h2 className={styles.cardTitle}>{label}</h2>
            <p className={styles.cardDesc}>{description}</p>
          </Link>
        ))}
      </div>
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
    <div className={zoneStyles.modalBackdrop} onClick={onClose}>
      <div className={zoneStyles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={zoneStyles.modalTitle}>Editar: {typeLabel(type)}</h3>
        <form onSubmit={handleSubmit}>
          {type === 'header' && (
            <>
              <div className={zoneStyles.field}>
                <label>Título</label>
                <input value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={zoneStyles.input} />
              </div>
              <div className={zoneStyles.field}>
                <label>Subtítulo</label>
                <input value={form.subtitle ?? ''} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} className={zoneStyles.input} />
              </div>
            </>
          )}
          {type === 'text' && (
            <>
              <div className={zoneStyles.field}>
                <label>Título del bloque</label>
                <input value={form.heading ?? ''} onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))} className={zoneStyles.input} />
              </div>
              <div className={zoneStyles.field}>
                <label>Contenido</label>
                <textarea value={form.content ?? ''} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} className={zoneStyles.input} rows={4} />
              </div>
            </>
          )}
          {type === 'image' && (
            <>
              <div className={zoneStyles.field}>
                <label>URL de imagen (o Google Drive)</label>
                <input value={form.url ?? ''} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={zoneStyles.input} placeholder="https://..." />
              </div>
              <div className={zoneStyles.field}>
                <label>Texto alternativo</label>
                <input value={form.alt ?? ''} onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))} className={zoneStyles.input} />
              </div>
              <div className={zoneStyles.field}>
                <label>Enlace (opcional)</label>
                <input value={form.link ?? ''} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} className={zoneStyles.input} placeholder="https://..." />
              </div>
            </>
          )}
          {type === 'video' && (
            <>
              <div className={zoneStyles.field}>
                <label>URL del video (embed o directo)</label>
                <input value={form.url ?? ''} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={zoneStyles.input} placeholder="https://..." />
              </div>
              <div className={zoneStyles.field}>
                <label>URL imagen de poster (opcional)</label>
                <input value={form.poster ?? ''} onChange={(e) => setForm((f) => ({ ...f, poster: e.target.value }))} className={zoneStyles.input} />
              </div>
            </>
          )}
          {type === 'featured_products' && (
            <div className={zoneStyles.field}>
              <label>Título de la sección</label>
              <input value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={zoneStyles.input} />
            </div>
          )}
          {type === 'collection_carousel' && (
            <>
              <div className={zoneStyles.field}>
                <label>Título de la sección</label>
                <input value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={zoneStyles.input} />
              </div>
              <div className={zoneStyles.field}>
                <label>Colección a mostrar</label>
                <select
                  value={form.collection ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, collection: e.target.value }))}
                  className={zoneStyles.input}
                >
                  <option value="">Selecciona una colección...</option>
                  {(collections || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className={zoneStyles.hint}>Los productos con esta colección se mostrarán en un carrusel.</p>
              </div>
            </>
          )}
          {type === 'product_grid' && (
            <>
              <div className={zoneStyles.field}>
                <label>Título (opcional)</label>
                <input value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={zoneStyles.input} />
              </div>
              <div className={zoneStyles.field}>
                <label className={zoneStyles.checkLabel}>
                  <input type="checkbox" checked={form.show_search !== false} onChange={(e) => setForm((f) => ({ ...f, show_search: e.target.checked }))} />
                  Mostrar búsqueda y ordenación
                </label>
              </div>
            </>
          )}
          {type === 'categories_nav' && <p className={zoneStyles.hint}>Esta zona no tiene opciones de configuración.</p>}
          {type === 'announcement_bar' && (
            <>
              <div className={zoneStyles.field}>
                <label>Color de fondo</label>
                <input type="color" value={form.bgColor ?? '#000000'} onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))} className={zoneStyles.input} style={{ height: '40px', padding: '0 5px' }} />
              </div>
              <div className={zoneStyles.field}>
                <label>Color de texto</label>
                <input type="color" value={form.textColor ?? '#ffffff'} onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))} className={zoneStyles.input} style={{ height: '40px', padding: '0 5px' }} />
              </div>
              <p className={zoneStyles.hint}>Los mensajes de la barra de anuncios rotarán automáticamente.</p>
              {/* Aquí podrías agregar lógica para añadir/quitar múltiples mensajes */}
              <div className={zoneStyles.field}>
                <label>Mensaje Principal</label>
                <input value={form.messages?.[0]?.text ?? ''} onChange={(e) => setForm((f) => ({ ...f, messages: [{ text: e.target.value, link: f.messages?.[0]?.link || '' }] }))} className={zoneStyles.input} placeholder="Ej. Envío gratis a todo el Perú" />
              </div>
              <div className={zoneStyles.field}>
                <label>Velocidad de cambio (ms)</label>
                <input type="number" value={form.speed ?? 3000} onChange={(e) => setForm((f) => ({ ...f, speed: Number(e.target.value) }))} className={zoneStyles.input} placeholder="3000" />
              </div>
            </>
          )}
          {type === 'hero_carousel' && (
            <>
              <p className={zoneStyles.hint}>Configura el carrusel de imágenes principal.</p>
               <div className={zoneStyles.field}>
                <label>URL de la Primera Imagen (Hero)</label>
                <input value={form.slides?.[0]?.imageUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, slides: [{ imageUrl: e.target.value, link: f.slides?.[0]?.link || '' }] }))} className={zoneStyles.input} placeholder="https://..." />
              </div>
              <div className={zoneStyles.field}>
                <label>Enlace de la imagen (opcional)</label>
                <input value={form.slides?.[0]?.link ?? ''} onChange={(e) => setForm((f) => ({ ...f, slides: [{ link: e.target.value, imageUrl: f.slides?.[0]?.imageUrl || '' }] }))} className={zoneStyles.input} placeholder="https://..." />
              </div>
              {/* Aquí puedes expandir para permitir agregar N slides */}
            </>
          )}
          {type === 'trust_badges' && (
             <p className={zoneStyles.hint}>Se mostrará una fila de íconos de confianza (Envío, Pago Seguro, etc.)</p>
          )}
          {type === 'flash_sales' && (
             <>
              <div className={zoneStyles.field}>
                <label>Título de la sección</label>
                <input value={form.title ?? 'Ofertas Relámpago'} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={zoneStyles.input} />
              </div>
              <div className={zoneStyles.field}>
                <label>Colección a mostrar</label>
                <select value={form.collection ?? ''} onChange={(e) => setForm((f) => ({ ...f, collection: e.target.value }))} className={zoneStyles.input}>
                  <option value="">Selecciona una colección...</option>
                  {(collections || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className={zoneStyles.field}>
                <label>Fecha/Hora de finalización</label>
                <input type="datetime-local" value={form.endTime ? new Date(form.endTime).toISOString().slice(0, 16) : ''} onChange={(e) => setForm((f) => ({ ...f, endTime: new Date(e.target.value).toISOString() }))} className={zoneStyles.input} />
              </div>
             </>
          )}
          {type === 'testimonials' && (
            <>
              <div className={zoneStyles.field}>
                <label>Título de la sección</label>
                <input value={form.title ?? 'Lo que dicen nuestros clientes'} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={zoneStyles.input} />
              </div>
               <p className={zoneStyles.hint}>El bloque mostrará testimonios reales para dar más confianza a tus clientes.</p>
            </>
          )}
          {type === 'marquee' && (
             <p className={zoneStyles.hint}>Se mostrará un carrusel rotativo de imágenes (como logos de marcas con las que trabajas).</p>
          )}
          <div className={zoneStyles.modalActions}>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminDashboard;
