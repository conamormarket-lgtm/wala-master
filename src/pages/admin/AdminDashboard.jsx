import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import KpiCard from '../../components/dashboard/KpiCard';
import GlassCard from '../../components/dashboard/GlassCard';
import {
  DashBackground,
  RangePicker,
  RefreshButton,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtDuration,
  fmtTime,
  shortPath,
  useDateRange,
  useGlobalAnalytics,
} from './dashboard/dashShared';
import styles from './AdminDashboard.module.css';

/* ----------------------------------------------------------------------------
 * AdminDashboard — HUB "Resumen" del panel de analítica.
 *
 * Antes era una única página enorme. Ahora es un hub ligero:
 *   - fila de KPIs (de getGlobalAnalytics),
 *   - grid de tarjetas-botón que enlazan a cada sub-página dedicada
 *     (Mapa de calor, Productos, Origen/Tráfico, Páginas, Categorías/Tags),
 *   - panel "En vivo".
 *
 * Cada sub-página carga SOLO su parte. La query global se comparte por react-query
 * (mismo queryKey por rango), así que entrar a una sub-página con el mismo rango
 * reutiliza la caché y no dispara lecturas extra.
 * -------------------------------------------------------------------------- */

const NAV_CARDS = [
  {
    to: 'heatmap',
    icon: '🗺️',
    title: 'Mapa de calor',
    desc: 'Dónde hacen clic tus visitantes, página por página.',
  },
  {
    to: 'productos',
    icon: '📦',
    title: 'Productos',
    desc: 'Más vistos, agregados al carrito y los más vendidos del ERP.',
  },
  {
    to: 'origen',
    icon: '🌐',
    title: 'Origen y tráfico',
    desc: 'Dispositivos, navegador, fuentes UTM y regiones.',
  },
  {
    to: 'paginas',
    icon: '🧭',
    title: 'Páginas',
    desc: 'Tráfico por página, top rutas y búsquedas.',
  },
  {
    to: 'categorias',
    icon: '🏷️',
    title: 'Categorías y tags',
    desc: 'Líneas más vistas, etiquetas y embudo de conversión.',
  },
];

export default function AdminDashboard() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  /* ----- sparkline ligero de page_views por día (para los KPIs) ----- */
  const trafficByDay = useMemo(() => {
    const events = data?.eventsForCharts || [];
    const byDay = new Map();
    events.forEach((e) => {
      if (e.type !== 'page_view') return;
      const ts = e.clientTsMs || e.createdAt || 0;
      const d = new Date(typeof ts === 'object' && ts?.toMillis ? ts.toMillis() : ts);
      if (Number.isNaN(d.getTime())) return;
      const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dayStart = new Date(d).setHours(0, 0, 0, 0);
      if (!byDay.has(key)) byDay.set(key, { total: 0, app: 0, web: 0, ts: dayStart });
      const row = byDay.get(key);
      row.total += 1;
      if (e.clientType === 'APP') row.app += 1;
      else row.web += 1;
    });
    return [...byDay.values()].sort((a, b) => a.ts - b.ts);
  }, [data?.eventsForCharts]);

  const kpis = useMemo(
    () => [
      {
        label: 'Sesiones',
        value: data?.totalSessions?.total || 0,
        accent: 'var(--primary-color, #6D28D9)',
        spark: trafficByDay.map((d) => d.total),
      },
      {
        label: 'Identidades activas',
        value: data?.activeIdentities?.total || 0,
        accent: '#8B5CF6',
        spark: trafficByDay.map((d) => d.web),
      },
      {
        label: 'Page views',
        value: trafficByDay.reduce((a, d) => a + d.total, 0),
        accent: '#10B981',
        spark: trafficByDay.map((d) => d.total),
      },
      {
        label: 'Tiempo navegado',
        value: data?.totalDwellMs?.total || 0,
        format: fmtDuration,
        accent: '#F59E0B',
        spark: trafficByDay.map((d) => d.app + d.web),
      },
    ],
    [data, trafficByDay]
  );

  const liveSessions = data?.realtimeSessionsDetails || [];
  const liveCount = data?.realtimeActiveSessions?.total || 0;
  const lastUpdated = dataUpdatedAt ? fmtTime(dataUpdatedAt) : null;

  return (
    <div className={styles.page}>
      <DashBackground />

      <motion.div
        className={styles.content}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header + selector de rango + actualizar */}
        <motion.header className={styles.header} variants={itemVariants}>
          <div>
            <h1 className={styles.title}>Panel de Analítica</h1>
            <p className={styles.subtitle}>
              Resumen de los últimos {rangeDays} días
              {lastUpdated ? ` · actualizado ${lastUpdated}` : ''}
            </p>
          </div>
          <div className={styles.headerControls}>
            <RangePicker rangeDays={rangeDays} setRangeDays={setRangeDays} />
            <RefreshButton onClick={() => refetch()} isFetching={isFetching} />
          </div>
        </motion.header>

        {error && <div className={styles.errorBox}>Error al cargar datos: {error.message}</div>}
        {isLoading && !data && <div className={styles.loading}>Cargando analítica…</div>}

        {/* (1) Fila de KPIs */}
        <motion.section className={styles.kpiRow} variants={containerVariants}>
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              format={k.format}
              accent={k.accent}
              sparkData={k.spark}
            />
          ))}
        </motion.section>

        {/* (2) Grid de tarjetas-botón hacia cada sub-página */}
        <motion.section className={styles.navGrid} variants={containerVariants}>
          {NAV_CARDS.map((c) => (
            <motion.div key={c.to} variants={itemVariants}>
              <Link to={c.to} className={styles.navCard}>
                <span className={styles.highlight} aria-hidden="true" />
                <span className={styles.navIcon} aria-hidden="true">{c.icon}</span>
                <h3 className={styles.navCardTitle}>{c.title}</h3>
                <p className={styles.navCardDesc}>{c.desc}</p>
                <span className={styles.navArrow} aria-hidden="true">→</span>
              </Link>
            </motion.div>
          ))}
        </motion.section>

        {/* (3) Panel "En vivo" */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="En vivo"
            subtitle={`${fmtInt(liveCount)} sesión(es) activas`}
            actions={
              <span className={styles.livePulse} aria-hidden="true">
                <motion.span
                  className={styles.liveDot}
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                EN VIVO
              </span>
            }
          >
            <ul className={styles.liveList}>
              {liveSessions.length ? (
                liveSessions.slice(0, 10).map((s) => (
                  <li key={s.id} className={styles.liveItem}>
                    <span className={`${styles.liveBadge} ${s.hasAccount ? styles.badgeUser : styles.badgeGuest}`}>
                      {s.hasAccount ? (s.displayName || s.email || 'Cliente') : 'Visitante'}
                    </span>
                    <span className={styles.livePath}>{shortPath(s.lastPath)}</span>
                    <span className={styles.liveTime}>{fmtTime(s.lastSeenAtMs)}</span>
                  </li>
                ))
              ) : (
                <li className={styles.empty}>Nadie navegando ahora mismo.</li>
              )}
            </ul>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
