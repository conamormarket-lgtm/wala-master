import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Cargando } from '../../componentes/kit/Cargando';
import { EstadoVacio } from '../../componentes/kit/Feedback';
import styles from './VerDisenoPage.module.css';

/**
 * "wala.pe/ver/<id>": el diseño que pidió un cliente, para el asesor que abre
 * el enlace del WhatsApp (sin sesión). Muestra cada prenda con su color, talla
 * y sus lados. El servidor solo responde creaciones que ya están en un pedido
 * o publicadas (functions/pedidoDisenos.js disenoCompartido).
 */
const VerDisenoViejo = () => {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ['ver-diseno', id],
    queryFn: async () => (await httpsCallable(getFunctions(), 'verDisenoCompartido')({ id })).data,
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (q.isLoading) return <div className={styles.pagina}><Cargando texto="Cargando el diseño" bloque /></div>;

  const piezas = q.data?.piezas || [];
  if (q.isError || piezas.length === 0) {
    return (
      <div className={styles.pagina}>
        <EstadoVacio
          titulo="Este diseño no está disponible"
          texto="Solo se pueden ver por enlace los diseños que ya están en un pedido o publicados."
        />
      </div>
    );
  }

  const titulo = q.data.titulo || (piezas.length === 1 ? piezas[0].nombre : '') || 'Diseño del pedido';
  return (
    <div className={styles.pagina}>
      <p className={styles.rotulo}>
        {piezas.length > 1 ? `Combo · ${piezas.length} prendas` : 'Diseño del pedido'}
      </p>
      <h1 className={styles.titulo}>{titulo}</h1>
      <ol className={styles.piezas}>
        {piezas.map((p, i) => (
          <li key={i} className={styles.pieza}>
            <div className={styles.datos}>
              {piezas.length > 1 && <span className={styles.numero}>{i + 1}</span>}
              <div>
                <h2 className={styles.prenda}>{p.prenda || p.nombre || `Prenda ${i + 1}`}</h2>
                <p className={styles.detalle}>
                  {p.color && (
                    <span className={styles.color}>
                      {p.colorHex && <span className={styles.punto} style={{ background: p.colorHex }} aria-hidden="true" />}
                      {p.color}
                    </span>
                  )}
                  {p.talla && <span>Talla {p.talla}</span>}
                  {p.prenda && p.nombre && <span className={styles.nombre}>«{p.nombre}»</span>}
                </p>
              </div>
            </div>
            <div className={styles.fotos}>
              {(p.lados || []).map((lado, k) => (lado.url ? (
                <a key={k} href={lado.url} target="_blank" rel="noopener noreferrer" className={styles.foto}>
                  <img src={lado.url} alt={`${p.prenda || p.nombre || 'Prenda'}: ${lado.nombre || 'diseño'}`} loading="lazy" />
                  {lado.nombre && <span className={styles.lado}>{lado.nombre}</span>}
                </a>
              ) : (
                // Lado sin diseño: se dice, para que no parezca que falta la foto.
                <div key={k} className={`${styles.foto} ${styles.sinDiseno}`}>
                  <span className={styles.lado}>{lado.nombre}</span>
                  <span className={styles.liso}>
                    <strong>Sin diseño</strong>
                    Este lado va liso{p.color ? `, en ${p.color}` : ''}.
                  </span>
                </div>
              )))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default VerDisenoViejo;
