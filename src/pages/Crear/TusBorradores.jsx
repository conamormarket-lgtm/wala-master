import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PenLine, Trash2, Clock } from 'lucide-react';
import { getBorradoresCrear } from '../../services/designs';
import { getProduct } from '../../services/products';
import { precioBase, fondoColorGuardado } from '../../utils/prendaBase';
import { useEliminarCreacion } from './useEliminarCreacion';
import { esperarGuardados } from './borradoresCache';
import FilaCarrusel from './FilaCarrusel';
import styles from './TusBorradores.module.css';
// La misma tarjeta que las creaciones (MiCreacionCard): mismo tamaño, foto,
// datos y pie con precio + botón. Lo propio del borrador va en `styles`.
import tarjeta from '../cuenta/MisCreacionesPage.module.css';
import estilosEliminar from './EliminarCreacion.module.css';

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** "hace 5 minutos", "ayer"… a partir de un Timestamp de Firestore. */
const haceCuanto = (ts) => {
  const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : null;
  if (!ms) return '';
  const seg = Math.round((ms - Date.now()) / 1000);
  const pasos = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
  let valor = seg;
  for (const [tope, unidad] of pasos) {
    if (Math.abs(valor) < tope) return relativo.format(Math.round(valor), unidad);
    valor /= tope;
  }
  return '';
};

/**
 * Borradores del cliente en Crear (comparten caché con quien los pida).
 * Se vuelven a leer cada vez que se muestran (al retroceder desde el
 * estudio, por ejemplo) y esperan a que termine un guardado en curso.
 */
export const useBorradoresCrear = (uid) => useQuery({
  queryKey: ['mis-borradores-crear', uid],
  enabled: Boolean(uid),
  refetchOnMount: 'always',
  queryFn: async () => {
    await esperarGuardados();
    const { data } = await getBorradoresCrear(uid);
    return data || [];
  },
});

export const TarjetaBorrador = ({ borrador: b, onEliminar }) => {
  // El estudio vuelve aquí con su flecha (ver CrearStudioPage `volverA`).
  const { pathname } = useLocation();
  const desde = { desde: pathname };
  // Misma consulta (y caché) que usa MiCreacionCard para el precio.
  const { data: respuesta } = useQuery({
    queryKey: ['product', b.productId],
    queryFn: () => getProduct(b.productId),
    enabled: Boolean(b.productId),
  });
  const precio = respuesta?.data ? precioBase(respuesta.data) : 0;
  const editado = haceCuanto(b.updatedAt || b.createdAt);
  const continuarUrl = `/crear/${b.productId}?designId=${b.id}`;

  return (
    <li className={`${tarjeta.card} ${styles.tarjeta}`}>
      <div className={tarjeta.media}>
        <Link to={continuarUrl} state={desde} className={tarjeta.foto} aria-label={`Continuar ${b.productName || 'borrador'}`}>
          {b.miniatura
            ? <img src={b.miniatura} alt="" className={tarjeta.fotoFrente} loading="lazy" />
            : <span className={tarjeta.fotoVacia}><PenLine size={34} aria-hidden="true" /></span>}
        </Link>
        <div className={tarjeta.insignias}>
          <span className={styles.etiqueta}>Borrador</span>
        </div>
        <button
          type="button"
          className={estilosEliminar.botonTarjeta}
          onClick={() => onEliminar(b)}
          aria-label="Eliminar borrador"
          title="Eliminar"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={tarjeta.info}>
        <h3 className={tarjeta.nombre}>{b.productName || 'Mi diseño'}</h3>
        <p className={tarjeta.prenda}>
          {b.color?.hex && <span className={tarjeta.puntoColor} style={{ background: fondoColorGuardado(b.color, respuesta?.data) }} aria-hidden="true" />}
          <span className={tarjeta.prendaTexto}>{b.color?.nombre ? `${b.color.nombre} · sin terminar` : 'Sin terminar'}</span>
        </p>
        {editado && (
          <p className={tarjeta.fecha}>
            <Clock size={12} aria-hidden="true" />
            Editado {editado}
          </p>
        )}
        <div className={tarjeta.pie}>
          <div className={tarjeta.precios}>
            {precio > 0 && <span className={tarjeta.precio}>S/ {precio.toFixed(2)}</span>}
          </div>
          <div className={tarjeta.acciones}>
            <Link to={continuarUrl} state={desde} className={tarjeta.botonPrincipal}>
              Continuar <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
};

/**
 * Diseños que el cliente empezó en Crear y no guardó: se guardan solos
 * mientras diseña y desde aquí los continúa o los elimina.
 */
const TusBorradores = ({ uid }) => {
  const { data: borradores = [] } = useBorradoresCrear(uid);
  const { pedir, dialogo } = useEliminarCreacion();

  if (!borradores.length) return dialogo;

  return (
    <section className={styles.seccion} aria-label="Tus borradores">
      <div className={styles.cabecera}>
        <h2 className={styles.titulo}>Tus borradores</h2>
        <p className={styles.ayuda}>Diseños sin terminar. Continúa donde lo dejaste.</p>
      </div>
      <FilaCarrusel className={styles.fila}>
        {borradores.map((b) => <TarjetaBorrador key={b.id} borrador={b} onEliminar={pedir} />)}
      </FilaCarrusel>
      {dialogo}
    </section>
  );
};

export default TusBorradores;
