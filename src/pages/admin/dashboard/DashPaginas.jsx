import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import GlassCard from '../../../components/dashboard/GlassCard';
import RankingConMiniaturas from '../../../components/dashboard/RankingConMiniaturas';
import {
  CHART_COLORS,
  DashBackground,
  DashHeader,
  DashStates,
  GlassTooltip,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtTime,
  shortPath,
  prettyRouteName,
  useDateRange,
  useGlobalAnalytics,
} from './dashShared';
import styles from '../AdminDashboard.module.css';

/**
 * DashPaginas — sub-página de PÁGINAS:
 *   - Tráfico por día (AreaChart de page_views, toggle total/app/web)
 *   - Top rutas por page views (BarChart horizontal)
 *   - Páginas más visitadas (RankingConMiniaturas)
 *   - Búsquedas más frecuentes
 */
export default function DashPaginas() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);
  const [trafficMode, setTrafficMode] = useState('total');

  /* ----- series temporales de page_views por dia ----- */
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
      if (!byDay.has(key)) byDay.set(key, { name: key, total: 0, app: 0, web: 0, ts: dayStart });
      const row = byDay.get(key);
      row.total += 1;
      if (e.clientType === 'APP') row.app += 1;
      else row.web += 1;
    });
    return [...byDay.values()].sort((a, b) => a.ts - b.ts);
  }, [data?.eventsForCharts]);

  const hasAppData = useMemo(
    () => trafficByDay.some((d) => d.app > 0) || (data?.totalEvents?.app || 0) > 0,
    [trafficByDay, data?.totalEvents]
  );

  /* ----- top rutas para BarChart horizontal ----- */
  const routeBars = useMemo(
    () =>
      (data?.topRoutesByViews || [])
        .slice(0, 8)
        .map((r) => {
          const name = prettyRouteName(r.path);
          return {
            path: r.path,
            name,
            shortName: name.length > 22 ? `${name.slice(0, 21)}…` : name,
            value: r.views?.total ?? r.views ?? 0,
          };
        })
        .reverse(),
    [data?.topRoutesByViews]
  );

  /* ----- ranking de páginas más visitadas ----- */
  const routeItems = useMemo(
    () =>
      (data?.topRoutesByViews || []).slice(0, 10).map((r) => ({
        id: r.path,
        label: prettyRouteName(r.path),
        value: r.views?.total ?? r.views ?? 0,
        sub: shortPath(r.path),
      })),
    [data?.topRoutesByViews]
  );

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
        <motion.div variants={itemVariants}>
          <DashHeader
            title="Páginas"
            subtitle={`Tráfico por página y búsquedas · últimos ${rangeDays} días`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        {/* Tráfico por día */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Tráfico por día"
            subtitle="Page views a lo largo del tiempo"
            actions={
              <div className={styles.toggle}>
                {['total', hasAppData ? 'app' : null, 'web'].filter(Boolean).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`${styles.toggleBtn} ${trafficMode === m ? styles.toggleActive : ''}`}
                    onClick={() => setTrafficMode(m)}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            }
          >
            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficByDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashPagTrafficGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6D28D9" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6D28D9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                  <Tooltip content={<GlassTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={trafficMode}
                    name={trafficMode === 'total' ? 'Page views' : trafficMode.toUpperCase()}
                    stroke="#6D28D9"
                    strokeWidth={2.5}
                    fill="url(#dashPagTrafficGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              {!trafficByDay.length && <p className={styles.empty}>Sin tráfico en el rango seleccionado.</p>}
            </div>
          </GlassCard>
        </motion.div>

        <motion.div className={styles.grid2} variants={containerVariants}>
          {/* Top rutas (BarChart) */}
          <motion.div variants={itemVariants}>
            <GlassCard title="Top rutas" subtitle="Rutas con más page views">
              {routeBars.length === 0 ? (
                <p className={styles.empty}>Sin rutas registradas aún.</p>
              ) : (
                <div className={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={routeBars} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <defs>
                        <linearGradient id="dashPagBarGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#6D28D9" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="shortName"
                        width={130}
                        tick={{ fontSize: 12, fill: 'var(--gris-texto-secundario, #475569)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip cursor={{ fill: 'rgba(109, 40, 217, 0.06)' }} content={<GlassTooltip />} />
                      <Bar dataKey="value" name="Page views" radius={[0, 8, 8, 0]} fill="url(#dashPagBarGrad)" maxBarSize={26}>
                        {routeBars.map((entry, i) => (
                          <Cell key={entry.path || i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Páginas más visitadas (ranking) */}
          <motion.div variants={itemVariants}>
            <GlassCard title="Páginas más visitadas" subtitle="Landings y rutas por page views">
              <RankingConMiniaturas
                items={routeItems}
                valueLabel="visitas"
                emptyIcon="🧭"
                emptyText="Sin rutas registradas aún."
              />
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* Búsquedas */}
        <motion.div variants={itemVariants}>
          <GlassCard title="Búsquedas" subtitle="Términos más buscados por tus visitantes">
            <ul className={styles.miniList}>
              {(data?.topSearches || []).length ? (
                (data?.topSearches || []).slice(0, 15).map((s) => (
                  <li key={s.query}>
                    <span className={styles.ellipsis}>{s.query}</span>
                    <strong>{fmtInt(s.total)}</strong>
                  </li>
                ))
              ) : (
                <li className={styles.empty}>Sin búsquedas registradas aún.</li>
              )}
            </ul>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
