import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Upload, Shirt, Eye, EyeOff, Sparkles, ArrowLeft, Save, X } from 'lucide-react';
import { useGlobalToast } from '../../../contexts/ToastContext';
import { uploadFile } from '../../../services/firebase/storage';
import { getPrendasBaseAdmin, guardarPrendaBase, eliminarPrendaBase } from '../../../services/prendasBase';
import {
  TALLAS_SUGERIDAS, leerPrendaBase, normalizarZona, hoodieDeEjemplo, slug, precioBase,
  cargarImagen, tintarImagen,
} from '../../../utils/prendaBase';
import ZonaEditor from './ZonaEditor';
import styles from './AdminPrendasCrear.module.css';

const formVacio = () => ({
  id: null,
  name: '',
  description: '',
  price: '',
  visible: false,
  ordenCrear: 1,
  prendaBase: {
    tallas: ['S', 'M', 'L', 'XL'],
    colores: [{ id: 'blanco', nombre: 'Blanco', hex: '#FFFFFF', fotos: {} }],
    vistas: [
      { id: 'frente', nombre: 'Frente', imagen: '', costo: 0, zona: normalizarZona({ x: 0.35, y: 0.27, w: 0.3, anchoCm: 30, altoCm: 30 }) },
    ],
  },
});

const desdeDocumento = (doc) => ({
  id: doc.id,
  name: doc.name || '',
  description: doc.description || '',
  price: doc.price ?? '',
  visible: doc.visible !== false,
  ordenCrear: doc.ordenCrear ?? 1,
  prendaBase: leerPrendaBase(doc),
});

/** Miniatura teñida para revisar cómo queda cada color sin salir del admin. */
const MiniaturaColor = ({ imagen, hex, nombre }) => {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vigente = true;
    if (!imagen) return undefined;
    cargarImagen(imagen).then((img) => {
      if (!vigente) return;
      const tenida = tintarImagen(img, hex);
      const c = document.createElement('canvas');
      const escala = 160 / tenida.width;
      c.width = 160;
      c.height = Math.round(tenida.height * escala);
      c.getContext('2d').drawImage(tenida, 0, 0, c.width, c.height);
      try { setSrc(c.toDataURL('image/png')); } catch { setSrc(imagen); }
    }).catch(() => {});
    return () => { vigente = false; };
  }, [imagen, hex]);
  return (
    <figure className={styles.miniatura}>
      <div className={styles.miniaturaFoto}>{src && <img src={src} alt={`Vista previa en ${nombre}`} />}</div>
      <figcaption>{nombre}</figcaption>
    </figure>
  );
};

const AdminPrendasCrear = () => {
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(null);
  const [colorPrevio, setColorPrevio] = useState('#FFFFFF');
  const [tallaNueva, setTallaNueva] = useState('');

  const { data: prendas = [], isLoading } = useQuery({
    queryKey: ['admin-prendas-base'],
    queryFn: async () => {
      const { data, error } = await getPrendasBaseAdmin();
      if (error) throw new Error(error);
      return data;
    },
  });

  const cfg = form?.prendaBase;
  const setCfg = (fn) => setForm((f) => ({ ...f, prendaBase: fn(f.prendaBase) }));
  const setVista = (i, cambios) => setCfg((c) => ({ ...c, vistas: c.vistas.map((v, j) => (j === i ? { ...v, ...cambios } : v)) }));
  const setColor = (i, cambios) => setCfg((c) => ({ ...c, colores: c.colores.map((v, j) => (j === i ? { ...v, ...cambios } : v)) }));

  const precioDesde = useMemo(() => (form ? precioBase({ price: form.price }) : 0), [form]);

  const subir = async (archivo, clave) => {
    if (!archivo) return null;
    setSubiendo(clave);
    try {
      const nombre = slug(archivo.name.replace(/\.[^.]+$/, ''));
      const { url, error } = await uploadFile(archivo, `productos_v2/prendas-crear/${Date.now()}_${nombre}.png`);
      if (error || !url) throw new Error(error || 'Sin URL');
      return url;
    } catch (err) {
      toast.error(`No se pudo subir la foto: ${err.message}`);
      return null;
    } finally {
      setSubiendo(null);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    const { id, error } = await guardarPrendaBase(form.id, form);
    setGuardando(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(form.visible ? 'Prenda guardada y publicada en Crear.' : 'Prenda guardada como borrador.');
    setForm((f) => ({ ...f, id }));
    queryClient.invalidateQueries({ queryKey: ['admin-prendas-base'] });
    queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    queryClient.invalidateQueries({ queryKey: ['prenda-base', id] });
  };

  const eliminar = async () => {
    if (!form.id || !window.confirm(`¿Quitar "${form.name}" de Crear? Los pedidos ya hechos no se ven afectados.`)) return;
    const { error } = await eliminarPrendaBase(form.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Prenda eliminada.');
    setForm(null);
    queryClient.invalidateQueries({ queryKey: ['admin-prendas-base'] });
    queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
  };

  // ── Lista ────────────────────────────────────────────────────────────────
  if (!form) {
    return (
      <div className={styles.pagina}>
        <header className={styles.cabecera}>
          <div>
            <h1 className={styles.titulo}>Prendas para Crear</h1>
            <p className={styles.descripcion}>
              Las prendas en blanco que tus clientes diseñan en la sección Crear: sus fotos sin fondo, la zona de impresión en
              centímetros, los colores, las tallas y cuánto cuesta cada lado.
            </p>
          </div>
          <div className={styles.cabeceraAcciones}>
            <button type="button" className={styles.botonSecundario} onClick={() => setForm({ ...desdeDocumento({ id: null, ...hoodieDeEjemplo(window.location.origin) }), visible: false })}>
              <Sparkles size={16} aria-hidden="true" /> Cargar hoodie de ejemplo
            </button>
            <button type="button" className={styles.botonPrincipal} onClick={() => setForm(formVacio())}>
              <Plus size={16} aria-hidden="true" /> Nueva prenda
            </button>
          </div>
        </header>

        {isLoading ? (
          <p className={styles.ayuda}>Cargando…</p>
        ) : prendas.length === 0 ? (
          <div className={styles.vacio}>
            <Shirt size={40} aria-hidden="true" />
            <h2>Aún no hay prendas</h2>
            <p>Empieza con el hoodie de ejemplo (ya trae sus fotos y zonas) y solo ponle precio.</p>
          </div>
        ) : (
          <div className={styles.lista}>
            {prendas.map((p) => {
              const c = leerPrendaBase(p);
              return (
                <button key={p.id} type="button" className={styles.item} onClick={() => setForm(desdeDocumento(p))}>
                  <div className={styles.itemFoto}>{c.vistas[0]?.imagen && <img src={c.vistas[0].imagen} alt="" />}</div>
                  <div className={styles.itemInfo}>
                    <strong>{p.name}</strong>
                    <span>S/ {precioBase(p).toFixed(2)} · {c.vistas.length} vistas · {c.colores.length} colores</span>
                    <span className={p.visible !== false ? styles.badgePublicada : styles.badgeBorrador}>
                      {p.visible !== false ? <><Eye size={12} aria-hidden="true" /> Publicada</> : <><EyeOff size={12} aria-hidden="true" /> Borrador</>}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <button type="button" className={styles.botonTexto} onClick={() => setForm(null)}>
          <ArrowLeft size={16} aria-hidden="true" /> Todas las prendas
        </button>
        <div className={styles.cabeceraAcciones}>
          {form.id && (
            <button type="button" className={styles.botonPeligro} onClick={eliminar}>
              <Trash2 size={16} aria-hidden="true" /> Eliminar
            </button>
          )}
          <button type="button" className={styles.botonPrincipal} onClick={guardar} disabled={guardando || !!subiendo}>
            <Save size={16} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>

      <section className={styles.tarjeta}>
        <h2 className={styles.tarjetaTitulo}>Datos</h2>
        <div className={styles.grilla2}>
          <label className={styles.campo}>
            <span>Nombre</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hoodie clásico" />
          </label>
          <label className={styles.campo}>
            <span>Precio base (S/)</span>
            <input type="number" min="0" step="0.5" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="79" />
            <small>Lo que cuesta la prenda. Cada lado con diseño suma su propio costo (abajo).</small>
          </label>
        </div>
        <label className={styles.campo}>
          <span>Descripción</span>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <div className={styles.grilla2}>
          <label className={styles.interruptor}>
            <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
            <span>
              <strong>Publicada en Crear</strong>
              <small>Si está apagada, queda como borrador y nadie la ve.</small>
            </span>
          </label>
          <label className={styles.campo}>
            <span>Orden en la lista</span>
            <input type="number" min="1" value={form.ordenCrear} onChange={(e) => setForm({ ...form, ordenCrear: e.target.value })} />
          </label>
        </div>
      </section>

      <section className={styles.tarjeta}>
        <h2 className={styles.tarjetaTitulo}>Vistas y zonas de impresión</h2>
        <p className={styles.ayuda}>
          Sube cada foto en PNG con fondo transparente y la prenda en blanco: los colores se generan solos. Arrastra el
          rectángulo para ubicar la zona y agrándalo desde la esquina. Las medidas en cm son las del área que se imprime.
        </p>
        <div className={styles.previoColor}>
          <span>Ver en:</span>
          {cfg.colores.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.punto} ${colorPrevio === c.hex ? styles.puntoActivo : ''}`}
              style={{ background: c.hex }}
              title={c.nombre}
              aria-label={c.nombre}
              onClick={() => setColorPrevio(c.hex)}
            />
          ))}
        </div>

        <div className={styles.vistas}>
          {cfg.vistas.map((v, i) => (
            <div key={i} className={styles.vista}>
              <div className={styles.vistaCabecera}>
                <input className={styles.vistaNombre} value={v.nombre} onChange={(e) => setVista(i, { nombre: e.target.value, ...(form.id ? {} : { id: slug(e.target.value) }) })} aria-label="Nombre de la vista" />
                {cfg.vistas.length > 1 && (
                  <button type="button" className={styles.iconoPeligro} onClick={() => setCfg((c) => ({ ...c, vistas: c.vistas.filter((_, j) => j !== i) }))} aria-label={`Quitar vista ${v.nombre}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <ZonaEditor imagen={v.imagen} zona={v.zona} colorHex={colorPrevio} onChange={(zona) => setVista(i, { zona })} />
              <label className={styles.botonSubir}>
                <Upload size={16} aria-hidden="true" />
                {subiendo === `vista-${i}` ? 'Subiendo…' : v.imagen ? 'Cambiar foto' : 'Subir foto'}
                <input
                  type="file"
                  accept="image/png,image/webp"
                  hidden
                  onChange={async (e) => {
                    const url = await subir(e.target.files?.[0], `vista-${i}`);
                    e.target.value = '';
                    if (url) setVista(i, { imagen: url });
                  }}
                />
              </label>
              <div className={styles.grilla3}>
                <label className={styles.campo}>
                  <span>Ancho (cm)</span>
                  <input type="number" min="1" step="0.5" value={v.zona.anchoCm} onChange={(e) => setVista(i, { zona: normalizarZona({ ...v.zona, anchoCm: e.target.value }) })} />
                </label>
                <label className={styles.campo}>
                  <span>Alto (cm)</span>
                  <input type="number" min="1" step="0.5" value={v.zona.altoCm} onChange={(e) => setVista(i, { zona: normalizarZona({ ...v.zona, altoCm: e.target.value }) })} />
                </label>
                <label className={styles.campo}>
                  <span>Cuesta extra (S/)</span>
                  <input type="number" min="0" step="0.5" value={v.costo} onChange={(e) => setVista(i, { costo: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
              </div>
              <small className={styles.ayuda}>
                {v.costo > 0 ? `Si el cliente diseña en ${v.nombre.toLowerCase()}, se suman S/ ${Number(v.costo).toFixed(2)}.` : `Diseñar en ${v.nombre.toLowerCase()} no tiene costo extra.`}
              </small>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.botonSecundario}
          onClick={() => setCfg((c) => ({
            ...c,
            vistas: [...c.vistas, { id: `vista-${c.vistas.length + 1}`, nombre: c.vistas.length === 1 ? 'Espalda' : `Vista ${c.vistas.length + 1}`, imagen: '', costo: 0, zona: normalizarZona({}) }],
          }))}
        >
          <Plus size={16} aria-hidden="true" /> Agregar vista
        </button>
      </section>

      <section className={styles.tarjeta}>
        <h2 className={styles.tarjetaTitulo}>Colores</h2>
        <p className={styles.ayuda}>
          Cada color se genera tiñendo la foto blanca. Si alguno no se ve bien (suele pasar con los muy oscuros), súbele
          su propia foto en esa vista y reemplaza al teñido.
        </p>
        <div className={styles.colores}>
          {cfg.colores.map((c, i) => (
            <div key={i} className={styles.color}>
              <div className={styles.colorFila}>
                <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })} aria-label={`Tono de ${c.nombre}`} />
                <input className={styles.colorNombre} value={c.nombre} onChange={(e) => setColor(i, { nombre: e.target.value, ...(form.id ? {} : { id: slug(e.target.value) }) })} aria-label="Nombre del color" />
                <code>{c.hex}</code>
                {cfg.colores.length > 1 && (
                  <button type="button" className={styles.iconoPeligro} onClick={() => setCfg((x) => ({ ...x, colores: x.colores.filter((_, j) => j !== i) }))} aria-label={`Quitar ${c.nombre}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className={styles.miniaturas}>
                {cfg.vistas.map((v) => (
                  <div key={v.id} className={styles.miniaturaVista}>
                    <MiniaturaColor imagen={c.fotos[v.id] || v.imagen} hex={c.fotos[v.id] ? '#FFFFFF' : c.hex} nombre={v.nombre} />
                    {c.fotos[v.id] ? (
                      <button type="button" className={styles.botonMini} onClick={() => setColor(i, { fotos: Object.fromEntries(Object.entries(c.fotos).filter(([k]) => k !== v.id)) })}>
                        Usar teñido
                      </button>
                    ) : (
                      <label className={styles.botonMini}>
                        {subiendo === `color-${i}-${v.id}` ? 'Subiendo…' : 'Foto propia'}
                        <input
                          type="file"
                          accept="image/png,image/webp"
                          hidden
                          onChange={async (e) => {
                            const url = await subir(e.target.files?.[0], `color-${i}-${v.id}`);
                            e.target.value = '';
                            if (url) setColor(i, { fotos: { ...c.fotos, [v.id]: url } });
                          }}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.botonSecundario}
          onClick={() => setCfg((c) => ({ ...c, colores: [...c.colores, { id: `color-${c.colores.length + 1}`, nombre: `Color ${c.colores.length + 1}`, hex: '#7C3AED', fotos: {} }] }))}
        >
          <Plus size={16} aria-hidden="true" /> Agregar color
        </button>
      </section>

      <section className={styles.tarjeta}>
        <h2 className={styles.tarjetaTitulo}>Tallas</h2>
        <div className={styles.tallas}>
          {[...new Set([...TALLAS_SUGERIDAS, ...cfg.tallas])].map((t) => {
            const activa = cfg.tallas.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={activa}
                className={`${styles.talla} ${activa ? styles.tallaActiva : ''}`}
                onClick={() => setCfg((c) => ({
                  ...c,
                  tallas: activa ? c.tallas.filter((x) => x !== t) : [...new Set([...TALLAS_SUGERIDAS, ...c.tallas])].filter((x) => x === t || c.tallas.includes(x)),
                }))}
              >
                {t}
              </button>
            );
          })}
          <form
            className={styles.tallaNueva}
            onSubmit={(e) => {
              e.preventDefault();
              const t = tallaNueva.trim().toUpperCase();
              if (t) setCfg((c) => ({ ...c, tallas: [...new Set([...c.tallas, t])] }));
              setTallaNueva('');
            }}
          >
            <input value={tallaNueva} onChange={(e) => setTallaNueva(e.target.value)} placeholder="Otra (ej. 3XL)" aria-label="Agregar talla" />
            <button type="submit" className={styles.botonMini}>Agregar</button>
          </form>
        </div>
        <small className={styles.ayuda}>La zona de impresión es la misma para todas las tallas.</small>
      </section>

      <p className={styles.ayuda}>
        Precio que verá el cliente: desde S/ {precioDesde.toFixed(2)}
        {cfg.vistas.some((v) => v.costo > 0) && ` · con diseño en todas las vistas: S/ ${(precioDesde + cfg.vistas.reduce((a, v) => a + (Number(v.costo) || 0), 0)).toFixed(2)}`}
      </p>
    </div>
  );
};

export default AdminPrendasCrear;
