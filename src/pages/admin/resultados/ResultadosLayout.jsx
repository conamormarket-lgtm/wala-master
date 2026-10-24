import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  useDashboardFilters,
  useDashboardAnalytics,
  limaHoyKey,
  fmtTime,
} from '../dashboard/dashShared';
import { useAuth } from '../../../contexts/AuthContext';
import { PESTANAS } from './rutas';
import styles from './ResultadosLayout.module.css';

/*
 * Resultados: el panel que ve el dueño de la tienda. Una sola cabecera para
 * todas las pestañas (periodo, comparar, actualizar) y los datos del resumen
 * diario compartidos por react-query (mismo caché que el panel anterior).
 * Las pestañas reciben { filtros, analitica } por el contexto del Outlet.
 */

const PERIODOS = [
  { id: 7, label: '7 días' },
  { id: 30, label: '30 días' },
  { id: 90, label: '90 días' },
];

function SelectorPeriodo({ filtros }) {
  const { rangeDays, setRangeDays, customStart, customEnd, setCustomRange } = filtros;
  const hoy = limaHoyKey();
  const esHoy = rangeDays === 'custom' && customStart === hoy && customEnd === hoy;
  const esFechas = rangeDays === 'custom' && !esHoy;
  const [abiertas, setAbiertas] = useState(esFechas);
  const mostrarFechas = esFechas || abiertas;

  return (
    <div className={styles.periodo}>
      <div className={styles.segmentos} role="group" aria-label="Periodo">
        <button
          type="button"
          className={esHoy ? styles.segActivo : styles.seg}
          aria-pressed={esHoy}
          onClick={() => { setAbiertas(false); setCustomRange(hoy, hoy); }}
        >
          Hoy
        </button>
        {PERIODOS.map((p) => {
          const activo = rangeDays === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={activo ? styles.segActivo : styles.seg}
              aria-pressed={activo}
              onClick={() => { setAbiertas(false); setRangeDays(p.id); }}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          className={mostrarFechas ? styles.segActivo : styles.seg}
          aria-pressed={mostrarFechas}
          onClick={() => setAbiertas(true)}
        >
          Fechas
        </button>
      </div>
      {mostrarFechas && (
        <div className={styles.fechas}>
          <label>
            Desde
            <input
              id="resultados-desde"
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomRange(e.target.value, customEnd)}
            />
          </label>
          <label>
            Hasta
            <input
              id="resultados-hasta"
              type="date"
              value={customEnd}
              min={customStart}
              max={hoy}
              onChange={(e) => setCustomRange(customStart, e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default function ResultadosLayout() {
  const { adminPermissions } = useAuth();
  const conClientes = adminPermissions?.includes('superadmin') || adminPermissions?.includes('manage_clients');
  const pestanas = PESTANAS.filter((p) => !p.soloClientes || conClientes);
  const filtros = useDashboardFilters(30);
  const analitica = useDashboardAnalytics(filtros);
  const { data, isFetching, refetch, dataUpdatedAt } = analitica;

  const hoy = limaHoyKey();
  const etiquetaPeriodo = filtros.rangeDays === 'custom' && filtros.customStart === hoy && filtros.customEnd === hoy
    ? 'hoy'
    : filtros.rangeLabel;
  const datosAl = data?.actualizadoEnMs || dataUpdatedAt;

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <div>
          <h1 className={styles.titulo}>Resultados</h1>
          <p className={styles.subtitulo}>
            Cómo va tu tienda · {etiquetaPeriodo}
            {datosAl ? ` · datos al ${fmtTime(datosAl)}` : ''}
          </p>
        </div>
        <div className={styles.controles}>
          <SelectorPeriodo filtros={filtros} />
          <label className={styles.comparar}>
            <input
              id="resultados-comparar"
              type="checkbox"
              checked={filtros.compare}
              onChange={(e) => filtros.setCompare(e.target.checked)}
            />
            Comparar con el periodo anterior
          </label>
          <button type="button" className={styles.actualizar} onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {pestanas.length > 1 && (
        <nav className={styles.pestanas} aria-label="Secciones de Resultados">
          {pestanas.map((p) => (
            <NavLink
              key={p.to}
              to={{ pathname: p.to, search: filtros.filtersSearch }}
              end={p.end}
              className={({ isActive }) => (isActive ? styles.pestanaActiva : styles.pestana)}
            >
              {p.label}
            </NavLink>
          ))}
        </nav>
      )}

      <Outlet context={{ filtros, analitica }} />
    </div>
  );
}
