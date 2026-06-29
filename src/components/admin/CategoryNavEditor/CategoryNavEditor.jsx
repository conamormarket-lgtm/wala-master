import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  ImagePlus,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  Wand2,
  Eraser,
  RefreshCw,
  CheckCircle2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  GalleryHorizontalEnd,
  LayoutGrid,
} from 'lucide-react';
import { getBrand, updateBrand } from '../../../services/brands';
import { getCategories } from '../../../services/categories';
import { getProductsByBrand } from '../../../services/products';
import { uploadFile } from '../../../services/firebase/storage';
import Button from '../../common/Button';
import AdminImageCropper from '../AdminImageCropper/AdminImageCropper';
import styles from './CategoryNavEditor.module.css';

/**
 * EDITOR REUTILIZABLE DEL NAV DE CATEGORÍAS POR MARCA.
 *
 * Arma el array `categoryNav` de una marca: una lista de "burbujas"
 * { categoryId, name, imageUrl, order } que la página de la marca pinta como
 * miniaturas. Cada burbuja, al pulsarse en cliente, filtra el catálogo de la
 * marca por la categoría `categoryId`.
 *
 * Reglas del nav (ya implementadas en la tienda):
 *  - Si `categoryNav` está VACÍO → el nav es AUTOMÁTICO (se deriva de las
 *    categorías de los productos de la marca).
 *  - Si `categoryNav` tiene items → se usan esos (OVERRIDE manual).
 *
 * Por cada burbuja se pueden editar los 3 campos:
 *  (a) QUÉ FILTRA  → <select> de tienda_categories que setea `categoryId`.
 *  (b) NOMBRE      → input de texto (default = nombre de la categoría).
 *  (c) MINIATURA   → subir+recortar 1:1 (FileReader → AdminImageCropper →
 *                    uploadFile a brand_nav/{brandId}/...) o heredar la de la
 *                    categoría.
 *
 * Acciones extra:
 *  - Reordenar (flechas), Quitar, Agregar categoría disponible.
 *  - "Generar automático": pre-llena el nav con las categorías de los productos
 *    de la marca (para que el dueño parta de ahí y personalice).
 *  - "Vaciar (volver a automático)": deja categoryNav = [] (modo auto).
 *
 * Guardado: updateBrand(brandId, { categoryNav }) asignando order por posición,
 * + invalida ['brands'], ['admin-brand-doc'], ['categories-nav-brands'].
 *
 * Es AUTOSUFICIENTE (carga sus propios datos vía react-query), pensado para
 * embeberse tanto en una página admin como en el panel del editor visual.
 *
 * @param {Object} props
 * @param {string} props.brandId    id del doc tienda_brands a editar.
 * @param {string} [props.brandName] nombre de la marca (solo para textos).
 * @param {Function} [props.onSaved] callback opcional tras guardar (recibe el categoryNav guardado).
 */
// Estilo por defecto del nav (retrocompatible = comportamiento actual).
const DEFAULT_NAV_STYLE = { align: 'center', animation: 'static' };
const ALIGN_OPTIONS = [
  { value: 'left', label: 'Izquierda', Icon: AlignLeft },
  { value: 'center', label: 'Centro', Icon: AlignCenter },
  { value: 'right', label: 'Derecha', Icon: AlignRight },
  { value: 'justify', label: 'Justificado', Icon: AlignJustify },
];

const CategoryNavEditor = ({ brandId, brandName, onSaved }) => {
  const queryClient = useQueryClient();

  // Estado local editable del nav (se hidrata desde Firestore al cargar la marca).
  // Cada item: { categoryId, name, imageUrl }. El `order` se asigna al guardar.
  const [items, setItems] = useState([]);
  // Estilo editable del nav { align, animation } (se hidrata desde el brand).
  const [navStyle, setNavStyle] = useState(DEFAULT_NAV_STYLE);
  // Categoría elegida en el selector de "Agregar burbuja".
  const [pickToAdd, setPickToAdd] = useState('');
  // Feedback efímero { type: 'ok'|'error', text }.
  const [feedback, setFeedback] = useState(null);

  // Estado del cropper de miniatura por burbuja.
  const [cropOpen, setCropOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [uploadingIndex, setUploadingIndex] = useState(null); // índice de la burbuja cuya imagen se sube

  const safeName = brandName || 'esta marca';

  // ── Doc de la marca (para leer el categoryNav guardado) ──────────────────
  const {
    data: brandDoc,
    isLoading: loadingBrand,
    error: errorBrand,
  } = useQuery({
    queryKey: ['admin-brand-doc', brandId],
    queryFn: async () => {
      const { data, error } = await getBrand(brandId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: Boolean(brandId), // sin marca no se consulta
  });

  // ── Categorías disponibles (tienda_categories, con imageUrl) ─────────────
  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await getCategories();
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: Boolean(brandId),
  });

  // Mapa id → categoría, para resolver nombre/imagen heredados rápidamente.
  const catById = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Hidrata el estado editable cuando llega el nav guardado de la marca.
  useEffect(() => {
    if (brandDoc && Array.isArray(brandDoc.categoryNav)) {
      const ordered = [...brandDoc.categoryNav]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((it) => ({
          categoryId: it.categoryId || '',
          name: it.name || '',
          imageUrl: it.imageUrl || '',
        }));
      setItems(ordered);
    } else if (brandDoc) {
      setItems([]);
    }
    // Hidrata el estilo del nav. Retrocompat: sin categoryNavStyle → default.
    if (brandDoc) {
      const s = brandDoc.categoryNavStyle || {};
      setNavStyle({
        align: ['left', 'center', 'right', 'justify'].includes(s.align)
          ? s.align
          : DEFAULT_NAV_STYLE.align,
        animation: ['static', 'slider'].includes(s.animation)
          ? s.animation
          : DEFAULT_NAV_STYLE.animation,
      });
    }
  }, [brandDoc]);

  // Feedback efímero con auto-limpieza.
  const flash = (type, text) => {
    setFeedback({ type, text });
    if (type === 'ok') setTimeout(() => setFeedback(null), 4000);
  };

  // ── Mutación de guardado ─────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ nav, style }) => {
      // Asigna order según la posición actual de cada burbuja.
      const categoryNav = nav.map((it, idx) => ({
        categoryId: it.categoryId || '',
        name: it.name || '',
        imageUrl: it.imageUrl || '',
        order: idx,
      }));
      // Estilo del nav (alineación + modo). Se persiste junto al categoryNav.
      const categoryNavStyle = {
        align: ['left', 'center', 'right', 'justify'].includes(style?.align)
          ? style.align
          : DEFAULT_NAV_STYLE.align,
        animation: ['static', 'slider'].includes(style?.animation)
          ? style.animation
          : DEFAULT_NAV_STYLE.animation,
      };
      const { error } = await updateBrand(brandId, { categoryNav, categoryNavStyle });
      if (error) throw new Error(error);
      return categoryNav;
    },
    onSuccess: (categoryNav) => {
      // Invalida las cachés que dependen del nav de marcas.
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['admin-brand-doc', brandId] });
      queryClient.invalidateQueries({ queryKey: ['admin-brand-doc'] });
      queryClient.invalidateQueries({ queryKey: ['categories-nav-brands'] });
      flash('ok', 'Nav de categorías guardado correctamente.');
      if (typeof onSaved === 'function') onSaved(categoryNav);
    },
    onError: (e) => {
      flash('error', e?.message || 'No se pudo guardar el nav.');
    },
  });

  // Categorías que todavía NO están en el nav (para el selector de "agregar").
  const availableCategories = useMemo(() => {
    const used = new Set(items.map((it) => it.categoryId).filter(Boolean));
    return (categories || []).filter((c) => !used.has(c.id));
  }, [categories, items]);

  // ── Acciones sobre las burbujas ──────────────────────────────────────────

  // (a) Cambia QUÉ FILTRA la burbuja (categoryId). Si la burbuja aún no tenía
  //     nombre/imagen propios, hereda los de la nueva categoría como default.
  const changeCategory = (index, categoryId) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const cat = catById.get(categoryId);
        const inheritedName = it.name || cat?.name || '';
        const inheritedImg = it.imageUrl || cat?.imageUrl || '';
        return { ...it, categoryId, name: inheritedName, imageUrl: inheritedImg };
      })
    );
  };

  // (b) Cambia el NOMBRE (label) visible de la burbuja.
  const renameItem = (index, name) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, name } : it)));
  };

  // (c) MINIATURA · heredar la imagen de la categoría vinculada.
  const inheritThumb = (index) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const cat = catById.get(it.categoryId);
        return { ...it, imageUrl: cat?.imageUrl || '' };
      })
    );
  };

  // Agrega una burbuja desde una categoría disponible (hereda nombre + imagen).
  const addCategory = (categoryId) => {
    const cat = catById.get(categoryId);
    if (!cat) return;
    setItems((prev) => [
      ...prev,
      { categoryId: cat.id, name: cat.name || '', imageUrl: cat.imageUrl || '' },
    ]);
    setPickToAdd('');
  };

  // Quita una burbuja del nav.
  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Mueve una burbuja arriba/abajo (cambia el orden).
  const move = (index, dir) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // ── "Generar automático": pre-llena con las categorías de los productos ──
  // Trae los productos de la marca, junta sus categorías distintas, las mapea a
  // tienda_categories y crea una burbuja por cada una (heredando nombre+imagen).
  // Es solo un PRELLENADO editable; no guarda hasta pulsar "Guardar nav".
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await getProductsByBrand(brandId);
      if (error) throw new Error(error);
      return data || [];
    },
    onSuccess: (products) => {
      // Categorías distintas presentes en los productos de la marca, en orden de
      // aparición. `categories` ya viene normalizado como array de IDs string.
      const seen = new Set();
      const orderedIds = [];
      (products || []).forEach((p) => {
        (Array.isArray(p.categories) ? p.categories : []).forEach((cid) => {
          if (cid && !seen.has(cid)) {
            seen.add(cid);
            orderedIds.push(cid);
          }
        });
      });

      // Solo categorías que existen en tienda_categories (descarta ids huérfanos).
      const generated = orderedIds
        .filter((cid) => catById.has(cid))
        .map((cid) => {
          const cat = catById.get(cid);
          return { categoryId: cid, name: cat?.name || '', imageUrl: cat?.imageUrl || '' };
        });

      setItems(generated);
      if (generated.length === 0) {
        flash(
          'error',
          'No se encontraron categorías en los productos de la marca para generar el nav.'
        );
      } else {
        flash(
          'ok',
          `Se generaron ${generated.length} burbuja(s) desde los productos. Personalízalas y pulsa "Guardar nav".`
        );
      }
    },
    onError: (e) => {
      flash('error', e?.message || 'No se pudo generar el nav automático.');
    },
  });

  // "Vaciar (volver a automático)": deja el nav vacío → modo automático.
  const clearToAuto = () => {
    setItems([]);
    // Conserva el estilo elegido aunque el nav vuelva a modo automático.
    saveMutation.mutate({ nav: [], style: navStyle });
  };

  // ── Subida de miniatura propia para una burbuja (patrón AdminCategorias) ──
  const handleImagePick = (index, e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setUploadingIndex(index);
      setImageToCrop(reader.result);
      setCropOpen(true);
    };
    e.target.value = ''; // permite volver a elegir el mismo archivo
  };

  const handleCropComplete = async (croppedFile) => {
    setCropOpen(false);
    setImageToCrop(null);
    const index = uploadingIndex;
    if (index == null) return;
    try {
      const path = `brand_nav/${brandId}/${Date.now()}_cropped.jpg`;
      const { url, error } = await uploadFile(croppedFile, path);
      if (url && !error) {
        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, imageUrl: url } : it)));
      } else if (error) {
        flash('error', `No se pudo subir la imagen: ${error}`);
      }
    } finally {
      setUploadingIndex(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Sin marca: nada que editar.
  if (!brandId) {
    return <div className={styles.empty}>Selecciona una marca.</div>;
  }

  if (loadingBrand) {
    return (
      <div className={styles.loading}>
        <Loader2 size={18} className={styles.spin} /> Cargando nav de la marca…
      </div>
    );
  }

  if (errorBrand) {
    return <div className={styles.errorBox}>{errorBrand.message}</div>;
  }

  const saving = saveMutation.isPending;
  const generating = generateMutation.isPending;

  return (
    <div className={styles.editor}>
      {feedback && (
        <div className={feedback.type === 'ok' ? styles.feedbackOk : styles.feedbackError}>
          {feedback.type === 'ok' && <CheckCircle2 size={16} />} {feedback.text}
        </div>
      )}

      {/* ── Barra de acciones generales ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarInfo}>
          <span className={styles.toolbarTitle}>Nav de categorías · {safeName}</span>
          <span className={styles.toolbarHint}>
            {items.length === 0
              ? 'Vacío = nav AUTOMÁTICO (se deriva de los productos de la marca).'
              : `${items.length} burbuja(s) manual(es). Esto reemplaza al nav automático.`}
          </span>
        </div>
        <div className={styles.toolbarBtns}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => generateMutation.mutate()}
            disabled={generating || saving}
            title="Pre-llenar con las categorías de los productos de la marca"
          >
            {generating ? (
              <Loader2 size={15} className={styles.spin} />
            ) : (
              <Wand2 size={15} />
            )}
            Generar automático
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={clearToAuto}
            disabled={saving || generating || items.length === 0}
            title="Vaciar el nav manual y volver al modo automático"
          >
            <Eraser size={15} /> Vaciar (volver a automático)
          </button>
          <Button onClick={() => saveMutation.mutate({ nav: items, style: navStyle })} disabled={saving || generating}>
            <span className={styles.btnInline}>
              {saving ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
              {saving ? 'Guardando…' : 'Guardar nav'}
            </span>
          </Button>
        </div>
      </div>

      {/* ── Estilo del nav (alineación + modo estático/slider) ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Estilo del nav</h3>
          <span className={styles.styleHint}>
            Se aplica en la tienda (sincronizado en todos lados).
          </span>
        </div>

        {/* ALINEACIÓN de las burbujas dentro del contenedor */}
        <div className={styles.styleGroup}>
          <span className={styles.styleGroupLabel}>Alineación</span>
          <div className={styles.segmented}>
            {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={`${styles.segBtn} ${navStyle.align === value ? styles.segActive : ''}`}
                onClick={() => setNavStyle((s) => ({ ...s, align: value }))}
                title={label}
                aria-pressed={navStyle.align === value}
              >
                <Icon size={16} />
                <span className={styles.segText}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MODO: estático (fila/wrap) vs slider (auto-scroll animado) */}
        <div className={styles.styleGroup}>
          <span className={styles.styleGroupLabel}>Modo</span>
          <div className={styles.segmented}>
            <button
              type="button"
              className={`${styles.segBtn} ${navStyle.animation === 'static' ? styles.segActive : ''}`}
              onClick={() => setNavStyle((s) => ({ ...s, animation: 'static' }))}
              title="Estático (fila fija, como hoy)"
              aria-pressed={navStyle.animation === 'static'}
            >
              <LayoutGrid size={16} />
              <span className={styles.segText}>Estático</span>
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${navStyle.animation === 'slider' ? styles.segActive : ''}`}
              onClick={() => setNavStyle((s) => ({ ...s, animation: 'slider' }))}
              title="Slider con animación (auto-scroll suave)"
              aria-pressed={navStyle.animation === 'slider'}
            >
              <GalleryHorizontalEnd size={16} />
              <span className={styles.segText}>Slider (animación)</span>
            </button>
          </div>
          {navStyle.animation === 'slider' && (
            <span className={styles.styleHint}>
              Las burbujas se desplazan solas en bucle; el clic para filtrar sigue funcionando.
            </span>
          )}
        </div>
      </section>

      {/* ── Burbujas actuales del nav ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Burbujas del nav ({items.length})</h3>
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>
            Esta marca no tiene burbujas manuales: el nav se genera automáticamente desde las
            categorías de sus productos. Agrega una categoría abajo o pulsa "Generar automático"
            para personalizar.
          </div>
        ) : (
          <ul className={styles.navList}>
            {items.map((it, index) => {
              const cat = catById.get(it.categoryId);
              const canInherit = Boolean(cat?.imageUrl) && it.imageUrl !== cat.imageUrl;
              return (
                <li key={`${it.categoryId || 'free'}-${index}`} className={styles.navRow}>
                  {/* Orden */}
                  <div className={styles.orderBtns}>
                    <button
                      type="button"
                      className={styles.orderBtn}
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      title="Subir"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.orderBtn}
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                      title="Bajar"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  {/* (c) MINIATURA: subir/cambiar (recorte 1:1) */}
                  <label className={styles.navThumbWrap} title="Subir o cambiar miniatura">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt={it.name} className={styles.navThumb} />
                    ) : (
                      <div className={styles.navThumbEmpty}>
                        <ImagePlus size={20} opacity={0.5} />
                      </div>
                    )}
                    {uploadingIndex === index && (
                      <div className={styles.navThumbOverlay}>
                        <Loader2 size={16} className={styles.spin} />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => handleImagePick(index, e)}
                    />
                  </label>

                  {/* Campos editables: categoría (qué filtra), nombre, heredar imagen */}
                  <div className={styles.navFields}>
                    {/* (a) QUÉ FILTRA */}
                    <label className={styles.fieldLabel}>
                      Filtra la categoría
                      <select
                        className={styles.select}
                        value={it.categoryId}
                        onChange={(e) => changeCategory(index, e.target.value)}
                      >
                        <option value="">— Sin categoría (burbuja libre) —</option>
                        {(categories || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || 'Sin nombre'}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* (b) NOMBRE */}
                    <label className={styles.fieldLabel}>
                      Nombre que se muestra
                      <input
                        type="text"
                        value={it.name}
                        onChange={(e) => renameItem(index, e.target.value)}
                        placeholder="Nombre de la burbuja"
                        className={styles.navNameInput}
                      />
                    </label>

                    {/* (c) heredar imagen de la categoría */}
                    {canInherit && (
                      <button
                        type="button"
                        className={styles.inheritBtn}
                        onClick={() => inheritThumb(index)}
                        title="Usar la miniatura de la categoría"
                      >
                        <RefreshCw size={13} /> Heredar imagen de la categoría
                      </button>
                    )}
                  </div>

                  {/* Quitar */}
                  <button
                    type="button"
                    className={styles.navRemoveBtn}
                    onClick={() => removeItem(index)}
                    title="Quitar del nav"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Agregar burbuja desde una categoría disponible ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Agregar burbuja</h3>
        </div>

        {loadingCats ? (
          <div className={styles.loading}>
            <Loader2 size={18} className={styles.spin} /> Cargando categorías…
          </div>
        ) : (categories?.length ?? 0) === 0 ? (
          <div className={styles.empty}>
            No hay categorías creadas todavía. Créalas en la sección Categorías.
          </div>
        ) : availableCategories.length === 0 ? (
          <div className={styles.empty}>
            Todas las categorías ya están en el nav de esta marca.
          </div>
        ) : (
          <div className={styles.addRow}>
            <select
              className={styles.select}
              value={pickToAdd}
              onChange={(e) => setPickToAdd(e.target.value)}
            >
              <option value="">Elige una categoría…</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Sin nombre'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.catAddBtn}
              onClick={() => addCategory(pickToAdd)}
              disabled={!pickToAdd}
            >
              <Plus size={15} /> Agregar
            </button>
          </div>
        )}
      </section>

      {/* Cropper 1:1 para las miniaturas (igual que AdminCategorias) */}
      {cropOpen && imageToCrop && (
        <AdminImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setCropOpen(false);
            setImageToCrop(null);
            setUploadingIndex(null);
          }}
          aspectRatio={1}
        />
      )}
    </div>
  );
};

export default CategoryNavEditor;
