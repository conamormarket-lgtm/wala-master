import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PenLine, Trash2 } from 'lucide-react';
import { getBorradoresCrear } from '../../services/designs';
import { useEliminarCreacion } from './useEliminarCreacion';
import styles from './TusBorradores.module.css';
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

/** Borradores del cliente en Crear (comparten caché con quien los pida). */
export const useBorradoresCrear = (uid) => useQuery({
  queryKey: ['mis-borradores-crear', uid],
  enabled: Boolean(uid),
  queryFn: async () => {
    const { data } = await getBorradoresCrear(uid);
    return data || [];
  },
});

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
      <div className={styles.fila}>
        {borradores.map((b) => (
          <div key={b.id} className={styles.item}>
            <Link to={`/crear/${b.productId}?designId=${b.id}`} className={styles.tarjeta}>
              <div className={styles.foto}>
                {b.miniatura
                  ? <img src={b.miniatura} alt="" loading="lazy" />
                  : <PenLine size={28} aria-hidden="true" />}
                <span className={styles.etiqueta}>Borrador</span>
              </div>
              <strong>{b.productName}{b.color?.nombre ? ` · ${b.color.nombre}` : ''}</strong>
              <span className={styles.fecha}>Editado {haceCuanto(b.updatedAt || b.createdAt)}</span>
              <span className={styles.continuar}>Continuar <ArrowRight size={15} aria-hidden="true" /></span>
            </Link>
            <button
              type="button"
              className={estilosEliminar.botonTarjeta}
              onClick={() => pedir(b)}
              aria-label="Eliminar borrador"
              title="Eliminar"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      {dialogo}
    </section>
  );
};

export default TusBorradores;
