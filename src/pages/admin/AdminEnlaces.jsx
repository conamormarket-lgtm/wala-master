// =========================================================================
// Walá — AdminEnlaces (lista de páginas "Enlaces útiles" tipo Linktree)
// -------------------------------------------------------------------------
// Molde: AdminFlashOffers.jsx (react-query + mutaciones + modal de borrado).
// Esta pantalla SOLO lista las páginas de enlaces (título, slug, estado,
// visitas). El CONSTRUCTOR en sí (cabecera, botones, redes, diseño, analítica)
// vive en AdminEnlaceEditor.jsx bajo /admin/enlaces/:id.
//
// REGLAS DURAS respetadas:
//  - Contadores en la NUBE: "visitas" se lee del propio doc (1 lectura por
//    página, ya viene en getLinkPages); NO usamos localStorage.
//  - Pocas lecturas: 1 query de colección (getLinkPages) para toda la lista.
//  - No se tocan pagos/ERP.
// =========================================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLinkPages,
  createLinkPage,
  deleteLinkPage,
} from '../../services/enlaces';
import { Edit2, Trash2, ExternalLink, Plus, Eye, Link2 } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminEnlaces.module.css';

// Slug canónico: minúsculas, sin acentos, solo a-z0-9 y guiones.
const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .replace(/[^a-z0-9]+/g, '-')     // espacios/símbolos -> guion
    .replace(/(^-|-$)/g, '');        // sin guiones al inicio/fin

const AdminEnlaces = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [creando, setCreando] = useState(false);
  // Formulario mínimo para crear una página nueva (el resto se edita adentro).
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoSlug, setNuevoSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);

  const { data: pagesData, isLoading, error } = useQuery({
    queryKey: ['admin-link-pages'],
    queryFn: async () => {
      const { data, error: err } = await getLinkPages();
      if (err) throw new Error(err);
      return data;
    },
  });

  const pages = pagesData ?? [];

  const createMutation = useMutation({
    mutationFn: (data) => createLinkPage(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-link-pages'] });
      setCreando(false);
      setNuevoTitulo('');
      setNuevoSlug('');
      setSlugTocado(false);
      // Entra directo al constructor de la página recién creada.
      if (res?.id) navigate(`/admin/enlaces/${res.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteLinkPage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-link-pages'] });
      setDeleteConfirm(null);
    },
  });

  // Slug efectivo: el escrito a mano (si lo tocaron) o el derivado del título.
  const slugEfectivo = slugTocado ? slugify(nuevoSlug) : slugify(nuevoTitulo);

  const handleCrear = (e) => {
    e.preventDefault();
    const titulo = nuevoTitulo.trim();
    const slug = slugEfectivo;
    if (!titulo || !slug) return;
    // Choca si el slug ya existe (evitamos duplicados desde el front).
    if (pages.some((p) => p.slug === slug)) {
      window.alert('Ya existe una página con ese enlace (slug). Elige otro.');
      return;
    }
    createMutation.mutate({ titulo, slug });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Link2 size={26} /> Enlaces útiles
          </h1>
          <p className={styles.subtitle}>
            Crea páginas de enlaces (estilo Linktree) 100% personalizables. Cada
            una vive en <code>/l/tu-enlace</code> y mide visitas y clics.
          </p>
        </div>
        <Button type="button" onClick={() => setCreando((v) => !v)}>
          <Plus size={16} /> Nueva página
        </Button>
      </div>

      {/* FORMULARIO RÁPIDO DE CREACIÓN (solo título + slug; el resto en el editor) */}
      {creando && (
        <form className={styles.createCard} onSubmit={handleCrear}>
          <h2 className={styles.cardTitle}>Nueva página de enlaces</h2>
          <div className={styles.fieldRow}>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label}>Título</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ej. Mis redes, Catálogo, etc."
                value={nuevoTitulo}
                onChange={(e) => setNuevoTitulo(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label}>Enlace (slug)</label>
              <div className={styles.slugInputWrap}>
                <span className={styles.slugPrefix}>/l/</span>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="se genera del título"
                  value={slugTocado ? nuevoSlug : slugEfectivo}
                  onChange={(e) => {
                    setSlugTocado(true);
                    setNuevoSlug(e.target.value);
                  }}
                />
              </div>
              <p className={styles.helpText}>URL: /l/{slugEfectivo || 'mi-enlace'}</p>
            </div>
          </div>
          <div className={styles.formActions}>
            <Button
              type="submit"
              disabled={createMutation.isPending || !slugEfectivo}
            >
              {createMutation.isPending ? 'Creando…' : 'Crear y editar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {isLoading && <p className={styles.loading}>Cargando…</p>}
      {error && <p className={styles.error}>{error.message}</p>}

      <div className={styles.grid}>
        {pages.map((page) => {
          const slug = page.slug || '';
          return (
            <div key={page.id} className={styles.pageCard}>
              <div className={styles.pageTopRow}>
                <span
                  className={`${styles.statusBadge} ${
                    page.estado === 'borrador' ? styles.statusDraft : styles.statusActive
                  }`}
                >
                  {page.estado === 'borrador' ? 'Borrador' : 'Activo'}
                </span>
                <span className={styles.visitasBadge}>
                  <Eye size={13} /> {page.visitas ?? 0} visitas
                </span>
              </div>

              <h3 className={styles.pageName}>{page.titulo || '(Sin título)'}</h3>
              <span className={styles.pageSlug}>/l/{slug}</span>

              <div className={styles.pageActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => navigate(`/admin/enlaces/${page.id}`)}
                  title="Editar / constructor"
                >
                  <Edit2 size={16} /> Editar
                </button>
                <a
                  href={`/l/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.actionBtn}
                  title="Ver página pública"
                >
                  <ExternalLink size={16} /> Ver
                </a>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                  onClick={() => setDeleteConfirm(page)}
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pages.length === 0 && !isLoading && (
        <div className={styles.emptyState}>
          <Link2 size={48} className={styles.emptyIcon} />
          <p>Todavía no tienes páginas de enlaces.</p>
          <span>Crea la primera con el botón “Nueva página”.</span>
        </div>
      )}

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar esta página?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar <strong>{deleteConfirm.titulo || 'esta página'}</strong>{' '}
              (<code>/l/{deleteConfirm.slug}</code>). Sus visitas y clics se
              perderán. Esta acción no se puede deshacer.
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

export default AdminEnlaces;
