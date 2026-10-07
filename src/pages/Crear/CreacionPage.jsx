import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShoppingBag, Pencil, Download, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getDesignById, guardarTallaCreacion } from '../../services/designs';
import { getPrendaBase } from '../../services/prendasBase';
import { leerPrendaBase, precioPersonalizado, tallasDeColor } from '../../utils/prendaBase';
import { itemDeCreacion, creacionLista } from './creacionCarrito';
import { useEliminarCreacion } from './useEliminarCreacion';
import NombreEditable from './NombreEditable';
import styles from './CreacionPage.module.css';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/**
 * Página de una creación del cliente: su "producto propio" hecho en Crear.
 * Solo la ve su dueño. Muestra la prenda por todos sus lados, deja elegir
 * talla y agregarla al carrito sin volver al estudio (usa lo ya generado al
 * guardarla), o abrirla en el estudio para seguir editándola.
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
    const lista = [];
    if (creacion.imagenConjunta) lista.push({ url: creacion.imagenConjunta, nombre: 'Todos los lados' });
    (creacion.vistasPrevias || []).forEach((p) => lista.push({ url: p.url, nombre: p.nombre }));
    if (!lista.length && creacion.previewUrl) lista.push({ url: creacion.previewUrl, nombre: 'Vista previa' });
    return lista;
  }, [creacion]);

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
  const editarUrl = `/crear/${creacion.productId}?designId=${id}`;
  const imagen = imagenes[Math.min(imagenSel, imagenes.length - 1)];

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

  const agregar = () => {
    if (tallas.length && !tallaActual) {
      setAvisoTalla(true);
      toast.info('Elige tu talla.');
      return;
    }
    if (prenda.visible === false) {
      toast.info('Esta prenda está en borrador: publícala para poder comprarla.');
      return;
    }
    addToCart(...itemDeCreacion({ prenda, creacion, talla: tallaActual }));
    navigate('/carrito');
  };

  return (
    <div className={styles.pagina}>
      <Link to="/cuenta/creaciones" className={styles.volver}>
        <ArrowLeft size={18} aria-hidden="true" /> Mis creaciones
      </Link>

      <div className={styles.cuerpo}>
        <section className={styles.galeria} aria-label="Imágenes de la creación">
          <div className={styles.principalFoto}>
            {imagen && <img src={imagen.url} alt={`${creacion.name} · ${imagen.nombre}`} />}
          </div>
          {imagenes.length > 1 && (
            <div className={styles.miniaturas}>
              {imagenes.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  className={`${styles.miniatura} ${i === imagenSel ? styles.miniaturaActiva : ''}`}
                  onClick={() => setImagenSel(i)}
                  aria-label={img.nombre}
                  aria-pressed={i === imagenSel}
                >
                  <img src={img.url} alt="" />
                  <span>{img.nombre}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={styles.info}>
          <span className={styles.etiqueta}>Mi creación</span>
          <NombreEditable designId={id} nombre={creacion.name} como="h1" className={styles.titulo} />
          <p className={styles.base}>Hecha sobre: {creacion.productName || prenda?.name}</p>

          {!disponible ? (
            <p className={styles.aviso}>Esta prenda ya no está disponible. Puedes ver tu creación, pero no comprarla.</p>
          ) : (
            <>
              <div className={styles.fila}>
                <span className={styles.rotulo}>Color</span>
                <span className={styles.color}>
                  <span className={styles.punto} style={{ background: creacion.color?.hex || '#ccc' }} aria-hidden="true" />
                  {creacion.color?.nombre}
                </span>
              </div>

              {tallas.length > 0 && (
                <div className={styles.bloque}>
                  <span className={styles.rotulo}>Talla</span>
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

              <p className={styles.precio}>{soles(precio)}</p>

              {!lista && (
                <p className={styles.aviso}>
                  Esta creación se guardó con una versión anterior. Ábrela en el editor y vuelve a guardarla para poder comprarla desde aquí.
                </p>
              )}

              <button type="button" className={styles.principal} onClick={agregar} disabled={!lista || agotado}>
                <ShoppingBag size={18} aria-hidden="true" />
                {agotado ? 'Agotado por ahora' : 'Agregar al carrito'}
              </button>
            </>
          )}

          <div className={styles.secundarias}>
            <Link to={editarUrl} className={styles.secundario}>
              <Pencil size={16} aria-hidden="true" /> Editar diseño
            </Link>
            {creacion.imagenConjunta && (
              <a href={creacion.imagenConjunta} target="_blank" rel="noopener noreferrer" className={styles.secundario}>
                <Download size={16} aria-hidden="true" /> Ver imagen completa
              </a>
            )}
          </div>
          <p className={styles.nota}>Al editarla y guardarla se actualiza esta misma creación.</p>
          <button type="button" className={styles.eliminar} onClick={() => pedirEliminar(creacion)}>
            <Trash2 size={16} aria-hidden="true" /> Eliminar creación
          </button>
        </section>
      </div>
      {dialogoEliminar}
    </div>
  );
};

export default CreacionPage;
