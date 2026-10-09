import React, { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paintbrush, Download, Loader2, Trash2, Truck, RefreshCw, ShieldCheck, Check, Minus, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getDesignById, guardarTallaCreacion } from '../../services/designs';
import { getPrendaBase } from '../../services/prendasBase';
import { leerPrendaBase, precioPersonalizado, tallasDeColor, fondoColorGuardado } from '../../utils/prendaBase';
import { useTranslatedHtml } from '../../i18n/useTranslatedText';
import { itemDeCreacion, creacionLista } from './creacionCarrito';
import { useEliminarCreacion } from './useEliminarCreacion';
import NombreEditable from './NombreEditable';
import AccionesComunidad, { InsigniaPublicada, usePuedePublicar } from '../Comunidad/AccionesComunidad';
import { fechaDeCreacion } from '../cuenta/components/MiCreacionCard';
import styles from './CreacionPage.module.css';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

const fechaLarga = (ms) => new Date(ms).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Galería como la de la ficha de producto: miniaturas en columna a la
 * izquierda (debajo en móvil), zoom que sigue al cursor y deslizar con el
 * dedo para pasar de imagen.
 */
const Galeria = ({ imagenes, sel, setSel, nombre }) => {
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const toqueX = useRef(null);
  const imagen = imagenes[Math.min(sel, imagenes.length - 1)];

  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const soltarDedo = (e) => {
    if (toqueX.current === null) return;
    const inicio = toqueX.current;
    toqueX.current = null;
    const fin = e.changedTouches[0]?.clientX;
    if (imagenes.length < 2 || typeof fin !== 'number' || Math.abs(fin - inicio) < 44) return;
    setSel((i) => (fin < inicio ? Math.min(i + 1, imagenes.length - 1) : Math.max(i - 1, 0)));
  };

  return (
    <div className={styles.galeria}>
      {imagenes.length > 1 && (
        <div className={styles.miniaturas}>
          {imagenes.map((img, i) => (
            <button
              key={img.url}
              type="button"
              className={`${styles.miniatura} ${i === sel ? styles.miniaturaActiva : ''}`}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              aria-label={img.nombre}
              aria-pressed={i === sel}
            >
              <img src={img.url} alt="" loading="lazy" />
              <span>{img.nombre}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={styles.marco}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={mover}
        onTouchStart={(e) => { toqueX.current = e.touches[0]?.clientX ?? null; setZoom(false); }}
        onTouchEnd={soltarDedo}
        onTouchCancel={() => { toqueX.current = null; }}
      >
        {imagen && (
          <img
            src={imagen.url}
            alt={`${nombre} · ${imagen.nombre}`}
            className={styles.marcoImg}
            style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${pos.x}% ${pos.y}%` } : undefined}
          />
        )}
        {imagen && <span className={styles.ladoActual}>{imagen.nombre}</span>}
        {!zoom && imagen && <span className={styles.pistaZoom}>Pasa el cursor para ver de cerca</span>}
      </div>
    </div>
  );
};

/**
 * Página de una creación del cliente: su "producto propio" hecho en Crear,
 * con la misma estructura que la ficha de producto de la tienda. Solo la ve
 * su dueño. Muestra la prenda por todos sus lados, deja elegir talla y
 * cantidad y agregarla al carrito (o comprarla directo) sin volver al
 * estudio (usa lo ya generado al guardarla), o abrirla en el estudio.
 */
const CreacionPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { addToCart } = useCart();
  const toast = useGlobalToast();
  const [talla, setTalla] = useState(null);
  const [imagenSel, setImagenSel] = useState(0);
  const [avisoTalla, setAvisoTalla] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const queryClient = useQueryClient();
  const { pedir: pedirEliminar, dialogo: dialogoEliminar } = useEliminarCreacion({
    alEliminar: () => navigate('/cuenta/creaciones', { replace: true }),
  });

  const { data: creacion, isLoading: cargandoCreacion } = useQuery({
    queryKey: ['creacion', id, user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getDesignById(id);
      if (error || !data) return null;
      return { id, ...data };
    },
  });
  const esMia = creacion && creacion.userId === user?.uid && creacion.tipo === 'crear';
  const puedePublicar = usePuedePublicar(creacion);

  const { data: prenda, isLoading: cargandoPrenda } = useQuery({
    queryKey: ['prenda-base', creacion?.productId],
    enabled: Boolean(esMia && creacion.productId),
    queryFn: async () => {
      const { data, error } = await getPrendaBase(creacion.productId);
      if (error) throw new Error(error);
      return data;
    },
  });

  const cfg = useMemo(() => (prenda ? leerPrendaBase(prenda) : null), [prenda]);
  const colorCfg = cfg?.colores.find((c) => c.id === creacion?.color?.id || c.nombre === creacion?.color?.nombre) || null;
  const tallas = cfg ? (colorCfg ? tallasDeColor(colorCfg, cfg) : cfg.tallas) : [];
  const tallaActual = talla ?? (tallas.includes(creacion?.variant?.size) ? creacion.variant.size : '');

  const imagenes = useMemo(() => {
    if (!creacion) return [];
    // Cada lado primero (se ve grande, como la foto de un producto) y al
    // final la imagen con todos los lados juntos.
    const lista = [];
    (creacion.vistasPrevias || []).forEach((p) => p?.url && lista.push({ url: p.url, nombre: p.nombre }));
    if (creacion.imagenConjunta) lista.push({ url: creacion.imagenConjunta, nombre: 'Todos los lados' });
    if (!lista.length && creacion.previewUrl) lista.push({ url: creacion.previewUrl, nombre: 'Vista previa' });
    return lista;
  }, [creacion]);

  const descripcionPrenda = useTranslatedHtml(prenda?.description || '');

  if (authLoading || (user && (cargandoCreacion || (esMia && cargandoPrenda)))) {
    return (
      <div className={styles.estado}>
        <Loader2 className={styles.girando} size={28} aria-hidden="true" />
        <p>Cargando tu creación…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.estado}>
        <h1 className={styles.estadoTitulo}>Inicia sesión para ver tu creación</h1>
        <button type="button" className={styles.principal} onClick={() => navigate('/login', { state: { from: location.pathname } })}>
          Iniciar sesión
        </button>
      </div>
    );
  }

  if (!esMia) {
    return (
      <div className={styles.estado}>
        <h1 className={styles.estadoTitulo}>No encontramos esta creación</h1>
        <p>Puede que se haya borrado o que sea de otra cuenta.</p>
        <Link to="/cuenta/creaciones" className={styles.principal}>Ir a Mis creaciones</Link>
      </div>
    );
  }

  const disponible = Boolean(prenda) && prenda.deleted !== true && (prenda.visible !== false || isAdmin);
  const agotado = typeof prenda?.inStock === 'number' && prenda.inStock <= 0;
  const lista = creacionLista(creacion);
  const precio = prenda ? precioPersonalizado(prenda) : 0;
  const precioLista = Number(prenda?.price);
  const enOferta = precio > 0 && Number.isFinite(precioLista) && precio < precioLista;
  const editarUrl = `/crear/${creacion.productId}?designId=${id}`;
  const lados = (creacion.vistasPrevias || []).map((p) => p?.nombre).filter(Boolean);
  const zonasImpresas = (creacion.archivosImpresion || []).filter((a) => a?.nombre);
  const fecha = fechaDeCreacion(creacion);
  const nombre = creacion.name || 'Mi creación';
  const sePuedeComprar = disponible && lista && !agotado;

  /** Elegir talla la deja guardada en la creación (al volver, sigue la misma). */
  const elegirTalla = async (t) => {
    setTalla(t);
    setAvisoTalla(false);
    if (t === creacion.variant?.size) return;
    const { error } = await guardarTallaCreacion(id, t);
    if (error) {
      toast.error('No pudimos guardar la talla. Inténtalo de nuevo.');
      return;
    }
    queryClient.setQueryData(['creacion', id, user?.uid], (prev) => (prev ? { ...prev, variant: { ...prev.variant, size: t } } : prev));
  };

  /** ¿Se puede agregar? Si falta la talla, la pide en vez de agregar. */
  const puedeAgregar = () => {
    if (tallas.length && !tallaActual) {
      setAvisoTalla(true);
      toast.info('Elige tu talla.');
      return false;
    }
    if (prenda.visible === false) {
      toast.info('Esta prenda está en borrador: publícala para poder comprarla.');
      return false;
    }
    return true;
  };

  const articulo = () => {
    const [producto, variante, personalizacion] = itemDeCreacion({ prenda, creacion, talla: tallaActual });
    return [producto, variante, personalizacion, cantidad];
  };

  const agregar = () => {
    if (!puedeAgregar()) return;
    addToCart(...articulo(), null, { silent: true });
    toast.success('¡Agregado al carrito!');
  };

  // "Comprar": como en la ficha de producto, deja SOLO esta creación
  // seleccionada en el carrito y va directo al pago.
  const comprarAhora = () => {
    if (!puedeAgregar()) return;
    addToCart(...articulo(), null, { selectOnly: true, silent: true });
    navigate('/checkout');
  };

  return (
    // product-detail-page: la misma clase global que la ficha de producto
    // (App.css esconde los botones flotantes en móvil para dar lugar a la
    // barra de compra fija).
    <div className={`${styles.pagina} product-detail-page`}>
      <div className={styles.columnaGaleria}>
        <Galeria imagenes={imagenes} sel={imagenSel} setSel={setImagenSel} nombre={nombre} />
      </div>

      <section className={styles.info}>
        <nav className={styles.migas} aria-label="Ruta">
          <Link to="/cuenta">Mi cuenta</Link>
          <span aria-hidden="true">/</span>
          <Link to="/cuenta/creaciones">Mis creaciones</Link>
          <span aria-hidden="true" className={styles.migaFinal}>/</span>
          <span className={styles.migaFinal}>{nombre}</span>
        </nav>

        <div className={styles.cabecera}>
          <span className={styles.etiqueta}>Mi creación</span>
          <NombreEditable designId={id} nombre={creacion.name} como="h1" className={styles.titulo} />
          <p className={styles.base}>
            Hecha sobre {creacion.productName || prenda?.name}
            {fecha ? ` · guardada el ${fechaLarga(fecha)}` : ''}
          </p>
        </div>

        {disponible && precio > 0 && (
          <div className={styles.filaPrecio}>
            <span className={styles.precio}>{soles(precio)}</span>
            {enOferta && <span className={styles.precioAntes}>{soles(precioLista)}</span>}
            {enOferta && (
              <span className={styles.descuento}>-{Math.round((1 - precio / precioLista) * 100)}%</span>
            )}
          </div>
        )}
        {disponible && <p className={styles.incluye}>Incluye la impresión de todos tus diseños.</p>}

        <hr className={styles.divisor} />

        {!disponible && (
          <p className={styles.aviso}>Esta prenda ya no está disponible. Puedes ver tu creación, pero no comprarla.</p>
        )}

        {creacion.color?.nombre && (
          <div className={styles.grupo}>
            <span className={styles.rotulo}>Color: <em>{creacion.color.nombre}</em></span>
            <div className={styles.filaColor}>
              <span className={styles.muestra} title={creacion.color.nombre}>
                <span style={{ background: fondoColorGuardado(creacion.color, prenda) || '#ccc' }} />
              </span>
              <span className={styles.ayuda}>El color va con tu diseño. Para cambiarlo, edita el diseño.</span>
            </div>
          </div>
        )}

        {lados.length > 0 && (
          <div className={styles.grupo}>
            <span className={styles.rotulo}>Lados con diseño</span>
            <div className={styles.chips}>
              {lados.map((l) => (
                <span key={l} className={styles.chip}><Check size={13} strokeWidth={3} aria-hidden="true" /> {l}</span>
              ))}
            </div>
          </div>
        )}

        {disponible && tallas.length > 0 && (
          <div className={styles.grupo}>
            <span className={styles.rotulo}>Talla{tallaActual && <>: <em>{tallaActual}</em></>}</span>
            <div className={styles.tallas}>
              {tallas.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={t === tallaActual}
                  className={`${styles.talla} ${t === tallaActual ? styles.tallaActiva : ''}`}
                  onClick={() => elegirTalla(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {avisoTalla && <p className={styles.avisoTalla}>Elige una talla para continuar.</p>}
          </div>
        )}

        {disponible && !lista && (
          <p className={styles.aviso}>
            Esta creación se guardó con una versión anterior. Ábrela en el editor y vuelve a guardarla para poder comprarla desde aquí.
          </p>
        )}

        {sePuedeComprar && (
          <div className={styles.grupo}>
            <span className={styles.rotulo}>Cantidad</span>
            <div className={styles.cantidad}>
              <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Quitar uno" disabled={cantidad <= 1}>
                <Minus size={15} aria-hidden="true" />
              </button>
              <span aria-live="polite">{cantidad}</span>
              <button type="button" onClick={() => setCantidad((c) => Math.min(99, c + 1))} aria-label="Agregar uno">
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className={styles.botones}>
          {disponible && (
            <button type="button" className={styles.principal} onClick={agregar} disabled={!sePuedeComprar}>
              {agotado ? 'Agotado por ahora' : 'Agregar al carrito'}
            </button>
          )}
          <Link to={editarUrl} state={{ desde: location.pathname }} className={styles.contorno}>
            <Paintbrush size={16} aria-hidden="true" /> Editar diseño
          </Link>
        </div>

        {sePuedeComprar && (
          <button type="button" className={styles.comprar} onClick={comprarAhora}>
            Comprar
          </button>
        )}

        <div className={styles.confianza}>
          <span><Truck size={14} aria-hidden="true" /> Envío a todo el país</span>
          <span><RefreshCw size={14} aria-hidden="true" /> Cambios y devoluciones</span>
          <span><ShieldCheck size={14} aria-hidden="true" /> Pago seguro</span>
        </div>

        <details className={styles.desplegable} open>
          <summary>Detalles de tu creación</summary>
          <dl className={styles.detalles}>
            <dt>Prenda</dt>
            <dd>{creacion.productName || prenda?.name || '—'}</dd>
            {creacion.color?.nombre && (
              <>
                <dt>Color</dt>
                <dd>{creacion.color.nombre}</dd>
              </>
            )}
            {zonasImpresas.length > 0 && (
              <>
                <dt>Impresión</dt>
                <dd>
                  <ul>
                    {zonasImpresas.map((z) => (
                      <li key={z.url || z.nombre}>
                        {z.nombre}
                        {z.anchoCm > 0 && z.altoCm > 0 && ` · ${Math.round(z.anchoCm)} × ${Math.round(z.altoCm)} cm`}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
          </dl>
          <p className={styles.nota}>Al editarla y guardarla se actualiza esta misma creación.</p>
          {creacion.imagenConjunta && (
            <a href={creacion.imagenConjunta} target="_blank" rel="noopener noreferrer" className={styles.enlace}>
              <Download size={15} aria-hidden="true" /> Ver imagen completa
            </a>
          )}
        </details>

        {prenda?.description && (
          <details className={styles.desplegable}>
            <summary>Sobre la prenda</summary>
            <div className={styles.textoRico} dangerouslySetInnerHTML={{ __html: descripcionPrenda }} />
          </details>
        )}

        {puedePublicar && (
          <div className={styles.comunidad}>
            <InsigniaPublicada design={creacion} />
            <AccionesComunidad design={creacion} />
          </div>
        )}

        <button type="button" className={styles.eliminar} onClick={() => pedirEliminar(creacion)}>
          <Trash2 size={15} aria-hidden="true" /> Eliminar creación
        </button>
      </section>
      {dialogoEliminar}
    </div>
  );
};

export default CreacionPage;
