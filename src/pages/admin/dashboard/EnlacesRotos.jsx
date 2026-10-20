import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import GlassCard from '../../../components/dashboard/GlassCard';
import { getEnlacesRotos, redirigirALanding } from '../../../services/adminEnlacesRotos';
import { fmtInt } from './dashShared';
import styles from '../AdminDashboard.module.css';
import propios from './EnlacesRotos.module.css';

/*
 * Enlaces rotos: las direcciones que no existen y que la gente pidió en el
 * rango (page_not_found), cuántas veces y de dónde venían. Una dirección de un
 * solo tramo (/promo) se busca como landing, así que trae dos atajos: crear la
 * landing con ese slug, o que lleve a una que ya existe (slugsAnteriores, como
 * al renombrarla).
 */
export const CLAVE_ENLACES_ROTOS = 'admin-enlaces-rotos';
const VISIBLES = 10;

const fmtFecha = (ms) =>
  ms
    ? new Date(ms).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

function Atajos({ enlace, landings, onRedirigido }) {
  const [destino, setDestino] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  if (enlace.resueltaA) {
    return <span className={propios.resuelta}>Ya lleva a /{enlace.resueltaA}</span>;
  }
  if (!enlace.slug) {
    return <span className={propios.nota}>No es una landing: corrige el enlace donde se publicó.</span>;
  }

  const redirigir = async () => {
    const landing = landings.find((l) => l.id === destino);
    if (!landing) return;
    if (!window.confirm(`Quien entre a ${enlace.direccion} irá a /${landing.slug}. ¿Seguro?`)) return;
    setGuardando(true);
    setError('');
    const { error: fallo } = await redirigirALanding(landing.id, enlace.slug);
    setGuardando(false);
    if (fallo) setError(`No se pudo guardar: ${fallo}`);
    else onRedirigido();
  };

  return (
    <div className={propios.atajos}>
      <Link
        to={`/admin/landing-pages?nueva=${encodeURIComponent(enlace.slug)}`}
        className={propios.boton}
      >
        Crear landing
      </Link>
      <span className={propios.o}>o</span>
      <select
        className={propios.select}
        value={destino}
        onChange={(e) => setDestino(e.target.value)}
        aria-label={`Landing a la que llevará ${enlace.direccion}`}
      >
        <option value="">Llevar a…</option>
        {landings.map((l) => (
          <option key={l.id} value={l.id}>
            {l.title} (/{l.slug})
          </option>
        ))}
      </select>
      <button
        type="button"
        className={propios.botonSecundario}
        disabled={!destino || guardando}
        onClick={redirigir}
      >
        {guardando ? 'Guardando…' : 'Redirigir'}
      </button>
      {error && <span className={propios.error}>{error}</span>}
    </div>
  );
}

export default function EnlacesRotos({ dateRange }) {
  const queryClient = useQueryClient();
  const [verTodos, setVerTodos] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: [CLAVE_ENLACES_ROTOS, dateRange.startDateMs, dateRange.endDateMs],
    queryFn: async () => {
      const res = await getEnlacesRotos(dateRange);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const enlaces = data?.enlaces || [];
  const visibles = verTodos ? enlaces : enlaces.slice(0, VISIBLES);
  const recargar = () => queryClient.invalidateQueries({ queryKey: [CLAVE_ENLACES_ROTOS] });

  return (
    <GlassCard
      title="Enlaces rotos"
      subtitle="Direcciones que no existen y que la gente pidió: de un anuncio, un QR o una landing borrada"
      actions={
        data?.visitas ? (
          <span className={propios.total}>
            {fmtInt(data.visitas)} {data.visitas === 1 ? 'visita' : 'visitas'}
          </span>
        ) : null
      }
    >
      {isLoading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : error ? (
        <p className={styles.empty}>No se pudieron leer los enlaces rotos: {error.message}</p>
      ) : enlaces.length === 0 ? (
        <p className={styles.empty}>Nadie llegó a una dirección que no existe en este rango.</p>
      ) : (
        <>
          {data.truncado && (
            <p className={propios.nota}>Solo se leyeron las 1000 visitas más recientes: los conteos se quedan cortos.</p>
          )}
          <ul className={propios.lista}>
            {visibles.map((e) => (
              <li key={e.direccion} className={propios.fila}>
                <div className={propios.cabeza}>
                  <code className={propios.direccion} title={e.direccion}>{e.direccion}</code>
                  <strong className={propios.visitas}>
                    {fmtInt(e.visitas)} {e.visitas === 1 ? 'visita' : 'visitas'}
                  </strong>
                </div>
                <p className={propios.detalle}>
                  {fmtInt(e.personas)} {e.personas === 1 ? 'persona' : 'personas'} · última {fmtFecha(e.ultimaMs)}
                </p>
                <ul className={propios.origenes} aria-label="De dónde venían">
                  {e.origenes.slice(0, 3).map((o) => (
                    <li key={o.origen} className={propios.origen}>
                      {o.origen} · {fmtInt(o.visitas)}
                    </li>
                  ))}
                  {e.origenes.length > 3 && (
                    <li className={propios.origen}>+{e.origenes.length - 3} más</li>
                  )}
                </ul>
                <Atajos enlace={e} landings={data.landings} onRedirigido={recargar} />
              </li>
            ))}
          </ul>
          {enlaces.length > VISIBLES && (
            <button type="button" className={propios.verTodos} onClick={() => setVerTodos((v) => !v)}>
              {verTodos ? 'Ver menos' : `Ver las ${enlaces.length}`}
            </button>
          )}
        </>
      )}
    </GlassCard>
  );
}
