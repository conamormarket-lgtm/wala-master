import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import GlassCard from '../../../components/dashboard/GlassCard';
import RankingConMiniaturas from '../../../components/dashboard/RankingConMiniaturas';
import KpiRow from '../../../components/dashboard/KpiRow';
import TrendChart from '../../../components/dashboard/charts/TrendChart';
import { AnimatedNumber } from '../../../components/ui';
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
  fmtDuration,
  shortPath,
  prettyRouteName,
  useDateRange,
  useGlobalAnalytics,
} from './dashShared';
import styles from '../AdminDashboard.module.css';
import extra from './DashPaginas.extra.module.css';

/**
 * DashPaginas — sub-página de PÁGINAS:
 *   - Fila de KPIs resumen (page views, días con tráfico, ruta líder, búsquedas)
 *   - Tráfico por día (TrendChart de page_views, toggle total/app/web)
 *   - Top rutas por page views (BarChart horizontal)
 *   - Páginas más visitadas (RankingConMiniaturas)
 *   - Búsquedas más frecuentes
 *
 * Conserva el comportamiento original: mismo origen de datos
 * (useGlobalAnalytics), misma serie temporal derivada de `eventsForCharts`,
 * el toggle Total/App/Web, el ranking de rutas y el de búsquedas. La capa
 * visual se eleva al sistema de diseño (TrendChart + KpiRow + AnimatedNumber +
 * tooltips glass) sin alterar la lógica.
 */
export default function DashPaginas() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);
  const [trafficMode, setTrafficMode] = useState('total');

  /* ----- series temporales de page_views por dia (mismo origen que antes) ----- */
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

  /* Serie del TrendChart según el modo activo: una sola serie cuyo color y
     etiqueta dependen del toggle. La `key` apunta a la métrica correspondiente
     de cada fila (total/app/web), preservando el comportamiento del toggle. */
  const trafficSeries = useMemo(() => {
    const meta = {
      total: { name: 'Page views', color: CHART_COLORS[0] },
      app: { name: 'APP', color: CHART_COLORS[4] },
      web: { name: 'WEB', color: CHART_COLORS[1] },
    };
    const m = meta[trafficMode] || meta.total;
    return [{ key: trafficMode, name: m.name, color: m.color }];
  }, [trafficMode]);

  /* ----- KPIs resumen derivados de los datos ya disponibles ----- */
  const kpiItems = useMemo(() => {
    // Total de page views en el rango (según el modo activo del toggle).
    const totalPageViews = trafficByDay.reduce((acc, d) => acc + (d[trafficMode] || 0), 0);
    // Días con al menos una visita registrada.
    const daysWithTraffic = trafficByDay.filter((d) => (d[trafficMode] || 0) > 0).length;
    // Ruta líder por page views (la primera del ranking ya ordenado).
    const topRoute = (data?.topRoutesByViews || [])[0];
    const topRouteViews = topRoute ? (topRoute.views?.total ?? topRoute.views ?? 0) : 0;
    // Total de búsquedas registradas (suma de los términos disponibles).
    const totalSearches = (data?.topSearches || []).reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    // Sparkline reutilizable: la propia curva de tráfico por día.
    const trafficSpark = trafficByDay.map((d) => d[trafficMode] || 0);

    return [
      {
        label: trafficMode === 'total' ? 'Page views' : `Page views · ${trafficMode.toUpperCase()}`,
        value: totalPageViews,
        format: fmtInt,
        accent: trafficSeries[0]?.color || CHART_COLORS[0],
        sparkData: trafficSpark,
        icon: '👁️',
      },
      {
        label: 'Días con tráfico',
        value: daysWithTraffic,
        format: fmtInt,
        accent: CHART_COLORS[2],
        icon: '📅',
      },
      {
        label: 'Ruta líder',
        value: topRouteViews,
        format: fmtInt,
        accent: CHART_COLORS[1],
        delta: topRoute ? prettyRouteName(topRoute.path) : undefined,
        deltaPositive: true,
        icon: '🏆',
      },
      {
        label: 'Búsquedas',
        value: totalSearches,
        format: fmtInt,
        accent: CHART_COLORS[6],
        icon: '🔎',
      },
    ];
  }, [trafficByDay, trafficMode, trafficSeries, data?.topRoutesByViews, data?.topSearches]);

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

  // Total de búsquedas (para el contador animado del encabezado de la sección).
  const totalSearchesCount = useMemo(
    () => (data?.topSearches || []).reduce((acc, s) => acc + (Number(s.total) || 0), 0),
    [data?.topSearches]
  );

  /* ----- Seguimiento de pedidos (engagement sobre el estado del pedido) -----
     Usa el derivado `orderTracking` del servicio si está disponible. Si por
     cualquier motivo no llegara (compatibilidad), reconstruye las métricas a
     partir de `eventsForCharts` sobre las rutas que empiezan con
     '/cuenta/pedidos'. Tolerante a 0/ausencia de datos. */
  const orderTracking = useMemo(() => {
    if (data?.orderTracking) return data.orderTracking;
    const events = data?.eventsForCharts || [];
    let views = 0;
    let totalDwellMs = 0;
    let dwellEvents = 0;
    const users = new Set();
    events.forEach((e) => {
      const path = typeof e.path === 'string' ? e.path.split('?')[0].split('#')[0] : '';
      if (path !== '/cuenta/pedidos' && !path.startsWith('/cuenta/pedidos/')) return;
      if (e.type === 'page_view') views += 1;
      if (e.type === 'route_dwell') {
        totalDwellMs += Number(e.dwellMs) || 0;
        dwellEvents += 1;
      }
      const identity = e.uid || e.anonymousId || e.email;
      if (identity) users.add(identity);
    });
    return {
      views,
      uniqueUsers: users.size,
      totalDwellMs,
      avgDwellMs: dwellEvents > 0 ? Math.round(totalDwellMs / dwellEvents) : 0,
    };
  }, [data?.orderTracking, data?.eventsForCharts]);

  /* KPIs de la tarjeta "Seguimiento de pedidos": visitas, usuarios únicos y
     tiempo promedio. El tiempo se anima sobre los ms crudos pero se muestra con
     fmtDuration. Tolerante a 0/ausencia (los valores caen a 0). */
  const orderTrackingKpis = useMemo(
    () => [
      {
        label: 'Visitas al estado',
        value: orderTracking.views || 0,
        format: fmtInt,
        accent: CHART_COLORS[0],
        icon: '📦',
      },
      {
        label: 'Usuarios únicos',
        value: orderTracking.uniqueUsers || 0,
        format: fmtInt,
        accent: CHART_COLORS[4],
        icon: '👤',
      },
      {
        label: 'Tiempo promedio',
        value: orderTracking.avgDwellMs || 0,
        format: fmtDuration,
        accent: CHART_COLORS[6],
        icon: '⏱️',
      },
    ],
    [orderTracking]
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

        {/* KPIs resumen — números con contador animado (KpiRow usa AnimatedNumber). */}
        <motion.div variants={itemVariants}>
          <KpiRow items={kpiItems} />
        </motion.div>

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
            {/* Migrado a TrendChart del sistema de diseño: áreas con degradado
                animado, ejes finos y GlassTooltip. Mantiene el toggle vía la
                serie dinámica `trafficSeries`. */}
            <TrendChart
              data={trafficByDay}
              series={trafficSeries}
              xKey="name"
              height={280}
              formatY={fmtInt}
              emptyText="Sin tráfico en el rango seleccionado."
            />
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
                        tick={{ fontSize: 12, fill: '#475569' }}
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
          <GlassCard
            title="Búsquedas"
            subtitle="Términos más buscados por tus visitantes"
            actions={
              totalSearchesCount > 0 ? (
                <span className={extra.cardBadge}>
                  <AnimatedNumber value={totalSearchesCount} format={fmtInt} /> totales
                </span>
              ) : null
            }
          >
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

        {/* Seguimiento de pedidos (WALA) — engagement sobre el estado del pedido.
            Mide cuánta gente entra a ver el estado de su pedido, cuántos usuarios
            únicos y cuánto tiempo pasan, sobre las rutas '/cuenta/pedidos'.
            Tolerante a 0/ausencia: muestra ceros y un mensaje cuando no hay datos. */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Seguimiento de pedidos (WALA)"
            subtitle="Engagement de tus clientes con el estado de su pedido"
            actions={
              orderTracking.totalDwellMs > 0 ? (
                <span className={extra.cardBadge}>
                  {fmtDuration(orderTracking.totalDwellMs)} en total
                </span>
              ) : null
            }
          >
            {orderTracking.views > 0 || orderTracking.uniqueUsers > 0 ? (
              <KpiRow items={orderTrackingKpis} />
            ) : (
              <p className={styles.empty}>
                Aún nadie ha entrado a ver el estado de su pedido.
              </p>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
