import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ImageOff, Paintbrush, ShoppingBag, Check, Clock } from 'lucide-react';
import { getProduct } from '../../../services/products';
import { toThumbnailImageUrl } from '../../../utils/imageUrl';
import { precioBase } from '../../../utils/prendaBase';
import { useProductThumbnailVariant } from '../../../hooks/useProductThumbnailVariant';
import ComboProductImage from '../../Tienda/components/ComboProductImage/ComboProductImage';
import { DomOverlay } from '../../Tienda/components/ComboProductImage/ComboProductImageWithDesign';
import OptimizedImage from '../../../components/common/OptimizedImage/OptimizedImage';
import styles from '../MisCreacionesPage.module.css';
import estilosEliminar from '../../Crear/EliminarCreacion.module.css';
import NombreEditable from '../../Crear/NombreEditable';

/**
 * Milisegundos del último guardado de una creación, o null.
 *
 * `updatedAt` puede llegar como Timestamp de Firestore, como { seconds } (de
 * caché), como texto, número o Date. Las creaciones guardadas antes de
 * corregir services/firebase/firestore.js tienen ahí un mapa sin fecha; para
 * esas se usa la hora que llevan en el nombre las vistas previas que se
 * suben al guardar (designs/{uid}/crear/previas/{ms}_…).
 */
export const fechaDeCreacion = (design) => {
  for (const ts of [design?.updatedAt, design?.createdAt]) {
    if (!ts) continue;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    const segundos = ts.seconds ?? ts._seconds;
    if (typeof segundos === 'number') return segundos * 1000;
    if (ts instanceof Date || typeof ts === 'string' || typeof ts === 'number') {
      const ms = new Date(ts).getTime();
      if (!Number.isNaN(ms)) return ms;
    }
  }
  const urls = [design?.imagenConjunta, design?.previewUrl, ...(design?.vistasPrevias || []).map((p) => p?.url)];
  let ultima = null;
  urls.forEach((u) => {
    const m = typeof u === 'string' && u.match(/previas(?:%2F|\/)(\d{13})_/);
    if (m) ultima = Math.max(ultima || 0, Number(m[1]));
  });
  return ultima;
};

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** "Guardada hoy", "Guardada ayer", "Guardada hace 3 días"… */
const guardadaHace = (ms) => {
  const dias = Math.round((Date.now() - ms) / 86400000);
  if (dias < 30) return `Guardada ${relativo.format(-dias, 'day')}`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `Guardada ${relativo.format(-meses, 'month')}`;
  return `Guardada ${relativo.format(-Math.round(meses / 12), 'year')}`;
};

const fechaCompleta = (ms) =>
  new Date(ms).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

const soles = (n) => `S/ ${n.toFixed(2)}`;

export const MiCreacionCardSkeleton = () => (
  <li className={`${styles.card} ${styles.skeletonCard}`} aria-hidden="true">
    <div className={styles.skeletonFoto} />
    <div className={styles.info}>
      <div className={`${styles.skeletonLinea} ${styles.skeletonTitulo}`} />
      <div className={`${styles.skeletonLinea} ${styles.skeletonCorta}`} />
      <div className={styles.pie}>
        <div className={`${styles.skeletonLinea} ${styles.skeletonPrecio}`} />
        <div className={`${styles.skeletonLinea} ${styles.skeletonBoton}`} />
      </div>
    </div>
  </li>
);

const MiCreacionCard = ({ design, isPurchased, onEliminar, onRenombrado }) => {
  // El estudio vuelve aquí con su flecha (ver CrearStudioPage `volverA`).
  const { pathname } = useLocation();
  const { data: productResponse, isLoading } = useQuery({
    queryKey: ['product', design.productId],
    queryFn: () => getProduct(design.productId),
    enabled: !!design.productId
  });

  const product = productResponse?.data || null;
  const isCombo = product?.isComboProduct || product?.comboItems?.length > 0;
  // Las creaciones de Crear ya traen su imagen y sus datos: no esperan al
  // producto. Un diseño sin producto (o con uno que ya no existe) se muestra
  // igual, con su aviso, en vez de quedarse "cargando" para siempre.
  const esDeCrear = design.tipo === 'crear';
  const cargandoProducto = Boolean(design.productId) && isLoading;
  const sinProducto = !cargandoProducto && (!product || product.deleted === true);

  // Utilizar la lógica de miniaturas de la tienda
  const { thumbnailImageUrl } = useProductThumbnailVariant(product);

  if (cargandoProducto && !esDeCrear) return <MiCreacionCardSkeleton />;

  // Combinamos la customización guardada en el diseño con el producto original para que ComboProductImage la pre-renderize si es combo
  const effectiveProductForCombo = isCombo ? {
    ...product,
    comboItemCustomization: design.isUserComboDesign && design.comboItemCustomization
      ? design.comboItemCustomization
      : product?.comboItemCustomization
  } : product;

  const cardImageUrl = thumbnailImageUrl || product?.mainImage || product?.images?.[0] || '';

  // Capas guardadas de un diseño del editor anterior (producto normal).
  let baseLayers = [];
  if (!isCombo && !esDeCrear) {
    if (design.layersByView && Object.keys(design.layersByView).length > 0) {
      baseLayers = Object.values(design.layersByView).find(l => Array.isArray(l) && l.length > 0) || [];
    } else if (design.layers && Array.isArray(design.layers)) {
      baseLayers = design.layers;
    }
  }

  // Creaciones de Crear: una vista previa por lado con diseño. Se muestra el
  // primero y, al pasar el cursor, el segundo (como las prendas en Crear).
  const previas = esDeCrear ? (design.vistasPrevias || []).filter((p) => p?.url) : [];
  const frente = previas[0]?.url || (esDeCrear ? design.imagenConjunta || design.previewUrl || '' : '');
  const espalda = previas[1]?.url || '';
  const lados = previas.map((p) => p.nombre).filter(Boolean);

  const precio = product ? precioBase(product) : 0;
  const precioLista = Number(product?.price);
  const enOferta = precio > 0 && Number.isFinite(precioLista) && precio < precioLista;

  const nombreProducto = product?.name || design.productName || '';
  const color = design.color?.nombre ? design.color : null;
  const fecha = fechaDeCreacion(design);

  // Diseños del apartado Crear: su propia página (ver, elegir talla, comprar)
  // y el estudio para editarlos. Los del editor anterior solo se editan.
  const verUrl = esDeCrear
    ? `/creacion/${design.id}`
    : `/editor/${design.productId || 'unknown'}?designId=${design.id}`;
  const editarUrl = esDeCrear
    ? `/crear/${design.productId}?designId=${design.id}`
    : verUrl;
  const noDisponible = sinProducto;

  const foto = esDeCrear ? (
    frente ? (
      <>
        <img src={frente} alt={design.name || nombreProducto} className={styles.fotoFrente} loading="lazy" />
        {espalda && <img src={espalda} alt="" aria-hidden="true" className={styles.fotoEspalda} loading="lazy" />}
      </>
    ) : (
      <span className={styles.fotoVacia}><ImageOff size={34} aria-hidden="true" /></span>
    )
  ) : sinProducto ? (
    <span className={styles.fotoVacia}><ImageOff size={34} aria-hidden="true" /></span>
  ) : isCombo ? (
    <div className={styles.fotoLegado}>
      <ComboProductImage
        comboProduct={effectiveProductForCombo}
        variantSelections={{}}
        isThumbnail={true}
        className={styles.comboThumb}
      />
    </div>
  ) : (
    <div className={styles.fotoLegado}>
      {baseLayers.length > 0 ? (
        <DomOverlay baseImageUrl={cardImageUrl} layers={baseLayers} />
      ) : (
        <OptimizedImage
          src={toThumbnailImageUrl(cardImageUrl)}
          alt={nombreProducto}
          objectFit="contain"
          className={styles.plainThumbImg}
          showSkeleton={false}
        />
      )}
    </div>
  );

  return (
    <li className={`${styles.card} ${noDisponible ? styles.cardNoDisponible : ''}`}>
      <div className={styles.media}>
        {noDisponible && !esDeCrear ? (
          <div className={styles.foto}>{foto}</div>
        ) : (
          <Link to={verUrl} className={styles.foto} aria-label={`Ver ${design.name || 'creación'}`}>
            {foto}
          </Link>
        )}

        <div className={styles.insignias}>
          {isPurchased && (
            <span className={styles.insigniaComprado} title="Ya compraste este diseño">
              <Check size={12} strokeWidth={3} aria-hidden="true" /> Comprado
            </span>
          )}
          {noDisponible && <span className={styles.insigniaNoDisponible}>Ya no disponible</span>}
        </div>

        {lados.length > 0 && (
          <span className={styles.lados} title="Lados con diseño">
            {lados.join(' + ')}
          </span>
        )}

        {onEliminar && (
          <button
            type="button"
            className={estilosEliminar.botonTarjeta}
            onClick={() => onEliminar(design)}
            aria-label={`Eliminar ${design.name || 'creación'}`}
            title="Eliminar"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={styles.info}>
        <NombreEditable
          designId={design.id}
          nombre={design.name || 'Sin nombre'}
          como="h3"
          className={styles.nombre}
          onCambiado={(nuevo) => onRenombrado?.(design.id, nuevo)}
        />

        <p className={styles.prenda}>
          {color?.hex && (
            <span className={styles.puntoColor} style={{ background: color.hex }} aria-hidden="true" />
          )}
          <span className={styles.prendaTexto}>
            {noDisponible && !esDeCrear
              ? 'Este producto ya no está disponible'
              : [nombreProducto, color?.nombre].filter(Boolean).join(' · ')}
          </span>
        </p>

        {fecha && (
          <p className={styles.fecha} title={fechaCompleta(fecha)}>
            <Clock size={12} aria-hidden="true" />
            {guardadaHace(fecha)}
          </p>
        )}

        <div className={styles.pie}>
          <div className={styles.precios}>
            {precio > 0 && <span className={styles.precio}>{soles(precio)}</span>}
            {enOferta && <span className={styles.precioAntes}>{soles(precioLista)}</span>}
          </div>

          {!noDisponible && (
            <div className={styles.acciones}>
              {esDeCrear && (
                <Link
                  to={editarUrl}
                  state={{ desde: pathname }}
                  className={styles.botonEditar}
                  aria-label="Editar diseño"
                  title="Editar diseño"
                >
                  <Paintbrush size={16} aria-hidden="true" />
                </Link>
              )}
              <Link to={esDeCrear ? verUrl : editarUrl} state={esDeCrear ? undefined : { desde: pathname }} className={styles.botonPrincipal}>
                {esDeCrear
                  ? <><ShoppingBag size={15} aria-hidden="true" /> Comprar</>
                  : <><Paintbrush size={15} aria-hidden="true" /> Editar</>}
              </Link>
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

export default MiCreacionCard;
