// =========================================================================
// Walá — AdminEnlaceEditor (EL CONSTRUCTOR tipo Linktree / link-in-bio)
// -------------------------------------------------------------------------
// Ruta: /admin/enlaces/:id. Editor con VISTA PREVIA EN VIVO (móvil) al lado.
// Secciones:
//   (a) Cabecera: avatar (uploadFile), título, descripción, slug (único).
//   (b) Botones: tarjetas { título, url, miniatura } con agregar/eliminar y
//       ARRASTRAR PARA REORDENAR (HTML5 draggable; al soltar recalcula 'order').
//   (c) Redes: fila editable de íconos sociales, también reordenables.
//   (d) Diseño: estilo de botón (sólido/glass/contorno), redondez, sombra,
//       color de botón, color de texto, fondo (color/degradado/imagen), tipografía.
//   (e) Analítica: visitas de la página + clics por botón (getClicsDeLinkPage).
//
// PATRONES REUTILIZADOS (nada de librerías nuevas):
//   - uploadFile (services/firebase/storage) para avatar/miniaturas/fondo.
//   - CRUD vía services/enlaces.js (getLinkPage / updateLinkPage).
//   - react-query para carga y guardado.
//
// REGLAS DURAS respetadas:
//   - Contadores en la NUBE: visitas del doc + clics de la subcolección; NUNCA
//     localStorage. El editor solo LEE esos contadores (1 lectura de subcol).
//   - Pocas escrituras: se guarda con botón "Guardar" (no en cada tecla).
//   - No se tocan pagos/ERP. Comentarios en español.
// =========================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLinkPage,
  getLinkPages,
  updateLinkPage,
  getClicsDeLinkPage,
  getAnaliticaEnlace,
} from '../../services/enlaces';
import { uploadFile } from '../../services/firebase/storage';
import Button from '../../components/common/Button';
import {
  ArrowLeft, Plus, Trash2, GripVertical, UploadCloud, Save,
  Image as ImageIcon, Link2, BarChart3, Eye, ExternalLink, Palette,
  Camera, MessageCircle, Music2, Globe,
} from 'lucide-react';
import styles from './AdminEnlaceEditor.module.css';

// ── Utilidades ───────────────────────────────────────────────────────────────
const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Tipos de red disponibles con su ícono por defecto (lucide) para la fila social.
// NOTA: la versión instalada de lucide-react (1.8.0) NO exporta íconos de marca
// (Instagram/Facebook fueron retirados por marca registrada), así que usamos
// íconos genéricos. El dueño puede subir su PROPIO ícono/imagen por red (iconUrl).
const TIPOS_RED = [
  { tipo: 'instagram', label: 'Instagram', Icon: Camera },
  { tipo: 'facebook', label: 'Facebook', Icon: Globe },
  { tipo: 'tiktok', label: 'TikTok', Icon: Music2 },
  { tipo: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { tipo: 'custom', label: 'Otro', Icon: Link2 },
];

const iconoDeTipo = (tipo) =>
  (TIPOS_RED.find((t) => t.tipo === tipo) || TIPOS_RED[TIPOS_RED.length - 1]).Icon;

// id único para botones/redes nuevos (mismo prefijo que usa el servicio).
const nuevoId = (prefijo) => `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// Sombra CSS según la opción de diseño.
const sombraCss = (shadow) => {
  if (shadow === 'soft') return '0 4px 14px rgba(0,0,0,0.12)';
  if (shadow === 'strong') return '0 10px 28px rgba(0,0,0,0.28)';
  return 'none';
};

// Convierte un hex (#rrggbb) a rgba con alpha. Mismo cálculo que la página
// pública (LinkInBioPage) para que la vista previa "glass" coincida EXACTO con
// el resultado real (deriva el translúcido del color del botón elegido).
const hexToRgba = (hex, alpha) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
};

// Devuelve los estilos inline de un botón de la vista previa según 'diseno'.
const estiloBotonPreview = (diseno) => {
  const base = {
    borderRadius: `${diseno.cornerRoundness ?? 12}px`,
    boxShadow: sombraCss(diseno.buttonShadow),
    color: diseno.buttonTextColor || '#ffffff',
  };
  if (diseno.buttonStyle === 'glass') {
    return {
      ...base,
      // Mismo translúcido que la página pública: hexToRgba(buttonColor, 0.22).
      background: hexToRgba(diseno.buttonColor || '#111827', 0.22),
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.35)',
    };
  }
  if (diseno.buttonStyle === 'outline') {
    return {
      ...base,
      background: 'transparent',
      border: `2px solid ${diseno.buttonColor || '#111827'}`,
      color: diseno.buttonColor || '#111827',
    };
  }
  // solid (por defecto)
  return { ...base, background: diseno.buttonColor || '#111827', border: 'none' };
};

// Estilo del fondo de la vista previo según diseno.background.
const estiloFondoPreview = (bg) => {
  if (!bg) return { background: '#f3f4f6' };
  if (bg.type === 'image' && bg.value) {
    return {
      backgroundImage: `url(${bg.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  if (bg.type === 'gradient' && bg.value) {
    return { background: bg.value };
  }
  return { background: bg.value || '#f3f4f6' };
};

// Lista compacta de un desglose (país / dispositivo / día) con visitas y clics.
// items: [{ key, visitas, clics }] ya ordenados por el servicio.
const BreakdownList = ({ titulo, items, etiqueta }) => (
  <div className={styles.breakdownCol}>
    <h4 className={styles.breakdownTitle}>{titulo}</h4>
    {(!items || items.length === 0) ? (
      <p className={styles.emptyMini}>Sin datos aún.</p>
    ) : (
      items.slice(0, 6).map((it) => (
        <div key={it.key} className={styles.breakdownRow}>
          <span className={styles.breakdownKey} title={etiqueta(it.key)}>{etiqueta(it.key)}</span>
          <span className={styles.breakdownVals}>
            <span title="Visitas"><Eye size={11} /> {it.visitas}</span>
            <span title="Clics">· {it.clics} clics</span>
          </span>
        </div>
      ))
    )}
  </div>
);

const AdminEnlaceEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estado del formulario (espejo editable del doc). Se hidrata al cargar.
  const [form, setForm] = useState(null);
  const [slugTocado, setSlugTocado] = useState(false);
  const [uploading, setUploading] = useState('');   // qué imagen se está subiendo
  const [guardadoOk, setGuardadoOk] = useState(false);

  // Índice del item que se está arrastrando (para reordenar) por lista.
  const dragBtn = useRef(null);
  const dragRed = useRef(null);

  // ── Carga de la página ──
  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['admin-link-page', id],
    queryFn: async () => {
      const { data, error: err } = await getLinkPage(id);
      if (err) throw new Error(err);
      return data;
    },
    enabled: !!id,
  });

  // ── Analítica: clics por botón (1 lectura de subcolección) ──
  const { data: clicsData } = useQuery({
    queryKey: ['admin-link-clics', id],
    queryFn: async () => {
      const { data, error: err } = await getClicsDeLinkPage(id);
      if (err) throw new Error(err);
      return data;
    },
    enabled: !!id,
  });
  const clics = clicsData ?? {};

  // ── Analítica "de dónde": país / dispositivo / día (lectura acotada) ──
  // Solo se refresca al montar/invalidar (no en cada tecla): pocas lecturas.
  const { data: analiticaData } = useQuery({
    queryKey: ['admin-link-analitica', id],
    queryFn: async () => {
      const { data, error: err } = await getAnaliticaEnlace(id);
      if (err) throw new Error(err);
      return data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
  const analitica = analiticaData ?? { porPais: [], porDispositivo: [], porDia: [] };

  // Hidrata el formulario una vez llegan los datos.
  useEffect(() => {
    if (pageData && !form) {
      setForm({
        titulo: pageData.titulo || '',
        descripcion: pageData.descripcion || '',
        avatarUrl: pageData.avatarUrl || '',
        slug: pageData.slug || '',
        estado: pageData.estado || 'activo',
        diseno: {
          buttonStyle: pageData.diseno?.buttonStyle || 'solid',
          cornerRoundness: pageData.diseno?.cornerRoundness ?? 12,
          buttonShadow: pageData.diseno?.buttonShadow || 'soft',
          buttonColor: pageData.diseno?.buttonColor || '#111827',
          buttonTextColor: pageData.diseno?.buttonTextColor || '#ffffff',
          background: pageData.diseno?.background || { type: 'color', value: '#f3f4f6' },
          fontFamily: pageData.diseno?.fontFamily || '',
        },
        botones: Array.isArray(pageData.botones)
          ? [...pageData.botones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [],
        redes: Array.isArray(pageData.redes)
          ? [...pageData.redes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [],
      });
    }
  }, [pageData, form]);

  // ── Guardado ──
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Slug único al EDITAR: ninguna OTRA página puede usar el mismo slug (si no,
      // getLinkPageBySlug (limit 1) devolvería una arbitraria y dejaría la otra
      // inalcanzable en /l/:slug). AdminEnlaces ya valida al CREAR; esto cubre la edición.
      const objetivo = (data.slug || '').trim().toLowerCase();
      if (objetivo) {
        const { data: todas } = await getLinkPages();
        const choca = Array.isArray(todas) && todas.some(
          (p) => p.id !== id && (p.slug || '').trim().toLowerCase() === objetivo
        );
        if (choca) throw new Error('Ese slug ya lo usa otra página. Elige uno distinto.');
      }
      const { error: err } = await updateLinkPage(id, data);
      // updateLinkPage resuelve siempre; propagamos el error como throw para que
      // react-query marque isError (y NO muestre "Guardado" en falso positivo).
      if (err) throw new Error(err);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-link-page', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-link-pages'] });
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 2500);
    },
  });

  const handleGuardar = () => {
    if (!form) return;
    // Reasigna 'order' según el orden visual actual antes de guardar.
    const botones = form.botones.map((b, i) => ({ ...b, order: i }));
    const redes = form.redes.map((r, i) => ({ ...r, order: i }));
    saveMutation.mutate({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion,
      avatarUrl: form.avatarUrl,
      slug: slugEfectivo,
      estado: form.estado,
      diseno: form.diseno,
      botones,
      redes,
    });
  };

  // ── Helpers de mutación del form ──
  const setDiseno = (parcial) =>
    setForm((f) => ({ ...f, diseno: { ...f.diseno, ...parcial } }));

  const setBackground = (parcial) =>
    setForm((f) => ({
      ...f,
      diseno: { ...f.diseno, background: { ...f.diseno.background, ...parcial } },
    }));

  // Botones
  const agregarBoton = () =>
    setForm((f) => ({
      ...f,
      botones: [
        ...f.botones,
        { id: nuevoId('btn'), titulo: '', url: '', thumbnailUrl: '', order: f.botones.length },
      ],
    }));

  const actualizarBoton = (idx, parcial) =>
    setForm((f) => ({
      ...f,
      botones: f.botones.map((b, i) => (i === idx ? { ...b, ...parcial } : b)),
    }));

  const eliminarBoton = (idx) =>
    setForm((f) => ({ ...f, botones: f.botones.filter((_, i) => i !== idx) }));

  // Redes
  const agregarRed = () =>
    setForm((f) => ({
      ...f,
      redes: [
        ...f.redes,
        { id: nuevoId('red'), tipo: 'instagram', nombre: '', url: '', iconUrl: '', order: f.redes.length },
      ],
    }));

  const actualizarRed = (idx, parcial) =>
    setForm((f) => ({
      ...f,
      redes: f.redes.map((r, i) => (i === idx ? { ...r, ...parcial } : r)),
    }));

  const eliminarRed = (idx) =>
    setForm((f) => ({ ...f, redes: f.redes.filter((_, i) => i !== idx) }));

  // ── Reordenar (HTML5 draggable): al soltar, mueve el item en el arreglo ──
  const reordenar = (lista, from, to) => {
    const copia = [...lista];
    const [movido] = copia.splice(from, 1);
    copia.splice(to, 0, movido);
    return copia;
  };

  const onDropBoton = (to) => {
    const from = dragBtn.current;
    dragBtn.current = null;
    if (from == null || from === to) return;
    setForm((f) => ({ ...f, botones: reordenar(f.botones, from, to) }));
  };

  const onDropRed = (to) => {
    const from = dragRed.current;
    dragRed.current = null;
    if (from == null || from === to) return;
    setForm((f) => ({ ...f, redes: reordenar(f.redes, from, to) }));
  };

  // ── Subida de imágenes (avatar / miniatura de botón / fondo) ──
  const subirImagen = async (file, carpeta) => {
    if (!file || !file.type?.startsWith('image/')) return null;
    const path = `link_pages/${carpeta}/${id}/${Date.now()}_${file.name}`;
    const { url, error: err } = await uploadFile(file, path);
    return err ? null : url;
  };

  const handleAvatar = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploading('avatar');
    try {
      const url = await subirImagen(file, 'avatars');
      if (url) setForm((f) => ({ ...f, avatarUrl: url }));
    } finally {
      setUploading('');
    }
  };

  const handleThumb = async (e, idx) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploading(`thumb-${idx}`);
    try {
      const url = await subirImagen(file, 'thumbnails');
      if (url) actualizarBoton(idx, { thumbnailUrl: url });
    } finally {
      setUploading('');
    }
  };

  const handleRedIcon = async (e, idx) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploading(`redicon-${idx}`);
    try {
      const url = await subirImagen(file, 'redes');
      if (url) actualizarRed(idx, { iconUrl: url });
    } finally {
      setUploading('');
    }
  };

  const handleFondo = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploading('fondo');
    try {
      const url = await subirImagen(file, 'backgrounds');
      if (url) setBackground({ type: 'image', value: url });
    } finally {
      setUploading('');
    }
  };

  // Slug efectivo: el escrito a mano o el derivado del título.
  const slugEfectivo = useMemo(
    () => (slugTocado ? slugify(form?.slug) : slugify(form?.titulo)) || form?.slug || '',
    [slugTocado, form?.slug, form?.titulo]
  );

  // Total de clics (suma de la subcolección) para la analítica.
  const totalClics = useMemo(
    () => Object.values(clics).reduce((acc, n) => acc + (n || 0), 0),
    [clics]
  );

  if (isLoading || !form) {
    return (
      <div className={styles.wrapper}>
        <Link to="/admin/enlaces" className={styles.backLink}>
          <ArrowLeft size={16} /> Volver
        </Link>
        <p className={styles.loading}>{error ? error.message : 'Cargando…'}</p>
      </div>
    );
  }

  const fuentePreview = form.diseno.fontFamily || 'inherit';

  return (
    <div className={styles.wrapper}>
      {/* ── Barra superior ── */}
      <div className={styles.topbar}>
        <Link to="/admin/enlaces" className={styles.backLink}>
          <ArrowLeft size={16} /> Enlaces útiles
        </Link>
        <div className={styles.topActions}>
          <a
            href={`/l/${form.slug || slugEfectivo}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ghostLink}
          >
            <ExternalLink size={15} /> Ver pública
          </a>
          {guardadoOk && <span className={styles.savedMsg}>✓ Guardado</span>}
          <Button type="button" onClick={handleGuardar} disabled={saveMutation.isPending}>
            <Save size={16} /> {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
      {saveMutation.isError && (
        <p className={styles.error}>{saveMutation.error?.message || 'Error al guardar'}</p>
      )}

      <div className={styles.layout}>
        {/* ══════════════ COLUMNA IZQUIERDA: EDITOR ══════════════ */}
        <div className={styles.editorCol}>

          {/* (a) CABECERA */}
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}><Link2 size={18} /> Cabecera</h2>

            <div className={styles.avatarRow}>
              <div className={styles.avatarBox}>
                {form.avatarUrl ? (
                  <>
                    <img src={form.avatarUrl} alt="Avatar" className={styles.avatarImg} />
                    <button
                      type="button"
                      className={styles.avatarRemove}
                      onClick={() => setForm((f) => ({ ...f, avatarUrl: '' }))}
                    >✕</button>
                  </>
                ) : (
                  <label className={styles.avatarUpload}>
                    <UploadCloud size={22} />
                    <span>Avatar</span>
                    <input type="file" accept="image/*" hidden onChange={handleAvatar} />
                  </label>
                )}
                {uploading === 'avatar' && <div className={styles.uploadOverlay}>Subiendo…</div>}
              </div>

              <div className={styles.avatarFields}>
                <div className={styles.field}>
                  <label className={styles.label}>Título</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ej. Mi tiendita"
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Enlace (slug)</label>
                  <div className={styles.slugWrap}>
                    <span className={styles.slugPrefix}>/l/</span>
                    <input
                      type="text"
                      className={styles.input}
                      value={slugTocado ? form.slug : slugEfectivo}
                      onChange={(e) => {
                        setSlugTocado(true);
                        setForm((f) => ({ ...f, slug: e.target.value }));
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Descripción</label>
              <textarea
                className={styles.textarea}
                rows={2}
                placeholder="Una frase corta sobre ti o tu marca"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Estado</label>
              <div className={styles.segmented}>
                {['activo', 'borrador'].map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`${styles.segBtn} ${form.estado === op ? styles.segBtnActive : ''}`}
                    onClick={() => setForm((f) => ({ ...f, estado: op }))}
                  >
                    {op === 'activo' ? 'Activo' : 'Borrador'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* (b) BOTONES */}
          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}><Link2 size={18} /> Botones</h2>
              <button type="button" className={styles.addBtn} onClick={agregarBoton}>
                <Plus size={15} /> Agregar botón
              </button>
            </div>
            <p className={styles.hint}>Arrastra <GripVertical size={12} /> para reordenar.</p>

            <div className={styles.itemsList}>
              {form.botones.map((b, idx) => (
                <div
                  key={b.id}
                  className={styles.itemCard}
                  draggable
                  onDragStart={() => { dragBtn.current = idx; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropBoton(idx)}
                >
                  <span className={styles.dragHandle} title="Arrastrar para reordenar">
                    <GripVertical size={18} />
                  </span>

                  {/* Miniatura del botón */}
                  <div className={styles.thumbBox}>
                    {b.thumbnailUrl ? (
                      <>
                        <img src={b.thumbnailUrl} alt="" className={styles.thumbImg} />
                        <button
                          type="button"
                          className={styles.thumbRemove}
                          onClick={() => actualizarBoton(idx, { thumbnailUrl: '' })}
                        >✕</button>
                      </>
                    ) : (
                      <label className={styles.thumbUpload}>
                        <ImageIcon size={16} />
                        <input type="file" accept="image/*" hidden onChange={(e) => handleThumb(e, idx)} />
                      </label>
                    )}
                    {uploading === `thumb-${idx}` && <div className={styles.uploadOverlaySmall}>…</div>}
                  </div>

                  <div className={styles.itemFields}>
                    <input
                      type="text"
                      className={styles.inputSm}
                      placeholder="Título del botón"
                      value={b.titulo}
                      onChange={(e) => actualizarBoton(idx, { titulo: e.target.value })}
                    />
                    <input
                      type="url"
                      className={styles.inputSm}
                      placeholder="https://…"
                      value={b.url}
                      onChange={(e) => actualizarBoton(idx, { url: e.target.value })}
                    />
                  </div>

                  {/* Clics de este botón (analítica en la nube) */}
                  <span className={styles.clicPill} title="Clics registrados">
                    {clics[b.id] ?? 0} ▸
                  </span>

                  <button
                    type="button"
                    className={styles.itemDelete}
                    onClick={() => eliminarBoton(idx)}
                    title="Eliminar botón"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {form.botones.length === 0 && (
                <p className={styles.emptyMini}>Aún no hay botones. Agrega el primero.</p>
              )}
            </div>
          </section>

          {/* (c) REDES SOCIALES */}
          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}><Globe size={18} /> Redes sociales</h2>
              <button type="button" className={styles.addBtn} onClick={agregarRed}>
                <Plus size={15} /> Agregar red
              </button>
            </div>
            <p className={styles.hint}>Íconos pequeños en fila. Arrastra para reordenar.</p>

            <div className={styles.itemsList}>
              {form.redes.map((r, idx) => {
                const IconoTipo = iconoDeTipo(r.tipo);
                return (
                  <div
                    key={r.id}
                    className={styles.itemCard}
                    draggable
                    onDragStart={() => { dragRed.current = idx; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropRed(idx)}
                  >
                    <span className={styles.dragHandle}>
                      <GripVertical size={18} />
                    </span>

                    {/* Ícono: imagen subida o el ícono por tipo */}
                    <div className={styles.redIconBox}>
                      {r.iconUrl ? (
                        <>
                          <img src={r.iconUrl} alt="" className={styles.redIconImg} />
                          <button
                            type="button"
                            className={styles.thumbRemove}
                            onClick={() => actualizarRed(idx, { iconUrl: '' })}
                          >✕</button>
                        </>
                      ) : (
                        <label className={styles.redIconUpload} title="Subir ícono propio">
                          <IconoTipo size={18} />
                          <input type="file" accept="image/*" hidden onChange={(e) => handleRedIcon(e, idx)} />
                        </label>
                      )}
                      {uploading === `redicon-${idx}` && <div className={styles.uploadOverlaySmall}>…</div>}
                    </div>

                    <div className={styles.itemFields}>
                      <div className={styles.redTopRow}>
                        <select
                          className={styles.selectSm}
                          value={r.tipo}
                          onChange={(e) => actualizarRed(idx, { tipo: e.target.value })}
                        >
                          {TIPOS_RED.map((t) => (
                            <option key={t.tipo} value={t.tipo}>{t.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className={styles.inputSm}
                          placeholder="Nombre (ej. @usuario)"
                          value={r.nombre}
                          onChange={(e) => actualizarRed(idx, { nombre: e.target.value })}
                        />
                      </div>
                      <input
                        type="url"
                        className={styles.inputSm}
                        placeholder="https://…"
                        value={r.url}
                        onChange={(e) => actualizarRed(idx, { url: e.target.value })}
                      />
                    </div>

                    <button
                      type="button"
                      className={styles.itemDelete}
                      onClick={() => eliminarRed(idx)}
                      title="Eliminar red"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}

              {form.redes.length === 0 && (
                <p className={styles.emptyMini}>Sin redes todavía.</p>
              )}
            </div>
          </section>

          {/* (d) DISEÑO */}
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}><Palette size={18} /> Diseño</h2>

            {/* Estilo de botón */}
            <div className={styles.field}>
              <label className={styles.label}>Estilo de botón</label>
              <div className={styles.segmented}>
                {[
                  { v: 'solid', t: 'Sólido' },
                  { v: 'glass', t: 'Glass' },
                  { v: 'outline', t: 'Contorno' },
                ].map((op) => (
                  <button
                    key={op.v}
                    type="button"
                    className={`${styles.segBtn} ${form.diseno.buttonStyle === op.v ? styles.segBtnActive : ''}`}
                    onClick={() => setDiseno({ buttonStyle: op.v })}
                  >
                    {op.t}
                  </button>
                ))}
              </div>
            </div>

            {/* Redondez */}
            <div className={styles.field}>
              <div className={styles.rangeHeader}>
                <label className={styles.label}>Redondez de esquinas</label>
                <span className={styles.rangeValue}>{form.diseno.cornerRoundness}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={form.diseno.cornerRoundness}
                onChange={(e) => setDiseno({ cornerRoundness: Number(e.target.value) })}
                className={styles.range}
              />
            </div>

            {/* Sombra */}
            <div className={styles.field}>
              <label className={styles.label}>Sombra</label>
              <div className={styles.segmented}>
                {[
                  { v: 'none', t: 'Ninguna' },
                  { v: 'soft', t: 'Suave' },
                  { v: 'strong', t: 'Fuerte' },
                ].map((op) => (
                  <button
                    key={op.v}
                    type="button"
                    className={`${styles.segBtn} ${form.diseno.buttonShadow === op.v ? styles.segBtnActive : ''}`}
                    onClick={() => setDiseno({ buttonShadow: op.v })}
                  >
                    {op.t}
                  </button>
                ))}
              </div>
            </div>

            {/* Colores de botón y texto */}
            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>Color del botón</label>
                <div className={styles.colorRow}>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={form.diseno.buttonColor}
                    onChange={(e) => setDiseno({ buttonColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className={styles.inputSm}
                    value={form.diseno.buttonColor}
                    onChange={(e) => setDiseno({ buttonColor: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>Color del texto</label>
                <div className={styles.colorRow}>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={form.diseno.buttonTextColor}
                    onChange={(e) => setDiseno({ buttonTextColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className={styles.inputSm}
                    value={form.diseno.buttonTextColor}
                    onChange={(e) => setDiseno({ buttonTextColor: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Fondo */}
            <div className={styles.field}>
              <label className={styles.label}>Fondo de la página</label>
              <div className={styles.segmented}>
                {[
                  { v: 'color', t: 'Color' },
                  { v: 'gradient', t: 'Degradado' },
                  { v: 'image', t: 'Imagen' },
                ].map((op) => (
                  <button
                    key={op.v}
                    type="button"
                    className={`${styles.segBtn} ${form.diseno.background.type === op.v ? styles.segBtnActive : ''}`}
                    onClick={() => setBackground({ type: op.v })}
                  >
                    {op.t}
                  </button>
                ))}
              </div>

              {form.diseno.background.type === 'color' && (
                <div className={styles.colorRow} style={{ marginTop: '0.6rem' }}>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={form.diseno.background.value?.startsWith('#') ? form.diseno.background.value : '#f3f4f6'}
                    onChange={(e) => setBackground({ value: e.target.value })}
                  />
                  <input
                    type="text"
                    className={styles.inputSm}
                    value={form.diseno.background.value}
                    onChange={(e) => setBackground({ value: e.target.value })}
                  />
                </div>
              )}

              {form.diseno.background.type === 'gradient' && (
                <input
                  type="text"
                  className={styles.input}
                  style={{ marginTop: '0.6rem' }}
                  placeholder="linear-gradient(135deg, #f6d365, #fda085)"
                  value={form.diseno.background.value}
                  onChange={(e) => setBackground({ value: e.target.value })}
                />
              )}

              {form.diseno.background.type === 'image' && (
                <div className={styles.bgUploadWrap}>
                  {form.diseno.background.value ? (
                    <div className={styles.bgPreview}>
                      <img src={form.diseno.background.value} alt="Fondo" className={styles.bgPreviewImg} />
                      <button
                        type="button"
                        className={styles.thumbRemove}
                        onClick={() => setBackground({ value: '' })}
                      >✕</button>
                    </div>
                  ) : (
                    <label className={styles.bgUploadLabel}>
                      <UploadCloud size={20} />
                      <span>Subir imagen de fondo</span>
                      <input type="file" accept="image/*" hidden onChange={handleFondo} />
                    </label>
                  )}
                  {uploading === 'fondo' && <div className={styles.uploadOverlay}>Subiendo…</div>}
                </div>
              )}
            </div>

            {/* Tipografía opcional */}
            <div className={styles.field}>
              <label className={styles.label}>Tipografía (opcional)</label>
              <select
                className={styles.input}
                value={form.diseno.fontFamily}
                onChange={(e) => setDiseno({ fontFamily: e.target.value })}
              >
                <option value="">Por defecto</option>
                <option value="'Poppins', sans-serif">Poppins</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
                <option value="'Georgia', serif">Georgia (serif)</option>
                <option value="'Courier New', monospace">Monoespaciada</option>
              </select>
            </div>
          </section>

          {/* (e) ANALÍTICA */}
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}><BarChart3 size={18} /> Analítica</h2>

            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <span className={styles.statNum}>{pageData?.visitas ?? 0}</span>
                <span className={styles.statLabel}><Eye size={13} /> Visitas</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statNum}>{totalClics}</span>
                <span className={styles.statLabel}>Clics totales</span>
              </div>
            </div>

            {/* Mini-desglose de clics por botón (barato: ya lo leímos) */}
            <div className={styles.clicsTable}>
              {form.botones.length === 0 && (
                <p className={styles.emptyMini}>Agrega botones para ver sus clics.</p>
              )}
              {form.botones.map((b) => {
                const n = clics[b.id] ?? 0;
                const pct = totalClics > 0 ? Math.round((n / totalClics) * 100) : 0;
                return (
                  <div key={b.id} className={styles.clicRow}>
                    <span className={styles.clicName}>{b.titulo || '(sin título)'}</span>
                    <div className={styles.clicBarWrap}>
                      <div className={styles.clicBar} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.clicCount}>{n}</span>
                  </div>
                );
              })}
            </div>

            {/* Desglose "de dónde": país / dispositivo / día (visitas + clics).
                Datos de analytics_events (link_page_view/link_click) unidos a la
                sesión por sessionId; lectura acotada, solo en el admin. */}
            <div className={styles.breakdown}>
              <BreakdownList
                titulo="Por país"
                items={analitica.porPais}
                etiqueta={(k) => k}
              />
              <BreakdownList
                titulo="Por dispositivo"
                items={analitica.porDispositivo}
                etiqueta={(k) => k}
              />
              <BreakdownList
                titulo="Por día"
                items={(analitica.porDia || []).slice(0, 7).map((d) => ({
                  key: d.dia, visitas: d.visitas, clics: d.clics,
                }))}
                etiqueta={(k) => k}
              />
            </div>

            {/* Enlace al dashboard global (métricas del portal completas). */}
            <Link to="/admin/dashboard" className={styles.detailLink}>
              Ver métricas globales del portal →
            </Link>
          </section>
        </div>

        {/* ══════════════ COLUMNA DERECHA: VISTA PREVIA MÓVIL EN VIVO ══════════════ */}
        <div className={styles.previewCol}>
          <div className={styles.phoneFrame}>
            <div
              className={styles.phoneScreen}
              style={{ ...estiloFondoPreview(form.diseno.background), fontFamily: fuentePreview }}
            >
              {/* Cabecera de la preview */}
              <div className={styles.pvHeader}>
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="" className={styles.pvAvatar} />
                ) : (
                  <div className={styles.pvAvatarPlaceholder}>
                    {(form.titulo || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 className={styles.pvTitle}>{form.titulo || 'Tu título'}</h3>
                {form.descripcion && <p className={styles.pvDesc}>{form.descripcion}</p>}
              </div>

              {/* Fila de redes */}
              {form.redes.length > 0 && (
                <div className={styles.pvRedes}>
                  {form.redes.map((r) => {
                    const IconoTipo = iconoDeTipo(r.tipo);
                    return (
                      <span key={r.id} className={styles.pvRedIcon} title={r.nombre}>
                        {r.iconUrl ? (
                          <img src={r.iconUrl} alt="" className={styles.pvRedImg} />
                        ) : (
                          <IconoTipo size={18} />
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Botones */}
              <div className={styles.pvBotones}>
                {form.botones.map((b) => (
                  <div key={b.id} className={styles.pvBoton} style={estiloBotonPreview(form.diseno)}>
                    {b.thumbnailUrl && (
                      <img src={b.thumbnailUrl} alt="" className={styles.pvBotonThumb} />
                    )}
                    <span className={styles.pvBotonTxt}>{b.titulo || 'Botón'}</span>
                  </div>
                ))}
                {form.botones.length === 0 && (
                  <div className={styles.pvBoton} style={estiloBotonPreview(form.diseno)}>
                    <span className={styles.pvBotonTxt}>Botón de ejemplo</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className={styles.previewNote}>Vista previa en vivo (móvil)</p>
        </div>
      </div>
    </div>
  );
};

export default AdminEnlaceEditor;
