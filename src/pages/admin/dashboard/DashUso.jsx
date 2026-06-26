import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../components/dashboard/GlassCard';
import KpiRow from '../../../components/dashboard/KpiRow';
import CompareBars from '../../../components/dashboard/charts/CompareBars';
import { Reveal } from '../../../components/ui';
import { deriveAppUsage } from '../../../services/analytics/derive';
import {
  CHART_COLORS,
  DashBackground,
  DashHeader,
  DashStates,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtDuration,
  fmtTime,
  shortPath,
  prettyRouteName,
  useDateRange,
  useGlobalAnalytics,
} from './dashShared';
import styles from '../AdminDashboard.module.css';
import extra from './DashUso.module.css';

/* ============================================================================
 * DashUso — sub-página "Uso de la app".
 *
 * Reúne el pulso de uso real de la plataforma a partir de la MISMA query global
 * compartida (useGlobalAnalytics): totales de actividad, áreas más usadas,
 * ranking de rutas por visitas y por permanencia, y términos más buscados.
 *
 * Es ADITIVA y de SOLO LECTURA sobre los datos existentes: tolera campos
 * vacíos/undefined con optional chaining y fallbacks, y no altera el fetching,
 * los rangos ni el refresco manual. Mobile-first y respetuosa con
 * prefers-reduced-motion (los componentes ui/ y de dashboard ya lo gestionan).
 * ========================================================================== */

/* Lee el "total" de un contador que puede ser número plano u objeto {total,app,web}. */
function readTotal(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object') {
    if (value.total != null) return Number(value.total) || 0;
    return (Number(value.app) || 0) + (Number(value.web) || 0);
  }
  return Number(value) || 0;
}

export default function DashUso() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  /* ----- KPIs de uso (totales de actividad) ----- */
  const totalSessions = readTotal(data?.totalSessions);
  const totalEvents = readTotal(data?.totalEvents);
  const avgScroll = data?.scrollDepth?.avgTotal ?? 0;
  const avgDwellMs = readTotal(data?.avgDwellPerSessionMs);

  /* page views totales: suma de las vistas de todas las rutas registradas. */
  const totalPageViews = useMemo(
    () => (data?.topRoutesByViews || []).reduce((acc, r) => acc + readTotal(r?.views), 0),
    [data?.topRoutesByViews]
  );

  const kpis = useMemo(
    () => [
      {
        label: 'Sesiones',
        value: totalSessions,
        format: fmtInt,
        accent: '#6D28D9',
        icon: '👥',
      },
      {
        label: 'Páginas vistas',
        value: totalPageViews,
        format: fmtInt,
        accent: '#8B5CF6',
        icon: '📄',
      },
      {
        label: 'Scroll medio',
        value: avgScroll,
        format: (n) => `${fmtInt(n)}%`,
        accent: '#10B981',
        icon: '📜',
      },
      {
        label: 'Tiempo medio / sesión',
        value: avgDwellMs,
        format: (n) => fmtDuration(n),
        accent: '#F59E0B',
        icon: '⏱️',
      },
    ],
    [totalSessions, totalPageViews, avgScroll, avgDwellMs]
  );

  /* ----- Áreas más usadas (CompareBars con deriveAppUsage) ----- */
  const appUsage = useMemo(() => deriveAppUsage(data?.topRoutesByViews), [data?.topRoutesByViews]);

  /* ----- Ranking: rutas más visitadas ----- */
  const routesByViews = useMemo(
    () =>
      (data?.topRoutesByViews || []).slice(0, 10).map((r, i) => ({
        id: r?.path || `view-${i}`,
        name: prettyRouteName(r?.path),
        path: r?.path,
        value: readTotal(r?.views),
      })),
    [data?.topRoutesByViews]
  );
  const maxViews = routesByViews[0]?.value || 0;

  /* ----- Ranking: rutas de mayor permanencia ----- */
  const routesByDwell = useMemo(
    () =>
      (data?.topRoutesByDwell || []).slice(0, 10).map((r, i) => ({
        id: r?.path || `dwell-${i}`,
        name: prettyRouteName(r?.path),
        path: r?.path,
        value: readTotal(r?.dwellMs),
      })),
    [data?.topRoutesByDwell]
  );
  const maxDwell = routesByDwell[0]?.value || 0;

  /* ----- Top búsquedas ----- */
  const searches = useMemo(() => (data?.topSearches || []).slice(0, 15), [data?.topSearches]);

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
            title="Uso de la app"
            subtitle={`Actividad, áreas y permanencia · últimos ${rangeDays} días`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        {/* (1) KPIs de uso */}
        <motion.div variants={itemVariants}>
          <KpiRow items={kpis} />
        </motion.div>

        {/* (2) Áreas más usadas */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Áreas más usadas"
            subtitle="Reparto del tráfico por zona de la app"
          >
            <CompareBars
              data={appUsage}
              nameKey="area"
              valueKey="views"
              color="#6D28D9"
              max={10}
              formatValue={(v) => fmtInt(v)}
              emptyText="Aún no hay tráfico suficiente para repartir por áreas."
            />
          </GlassCard>
        </motion.div>

        {/* (3) Rankings: rutas más visitadas + mayor permanencia */}
        <motion.div className={styles.grid2} variants={containerVariants}>
          <motion.div variants={itemVariants}>
            <GlassCard title="Rutas más visitadas" subtitle="Por número de páginas vistas">
              {routesByViews.length === 0 ? (
                <p className={styles.empty}>Sin rutas registradas aún.</p>
              ) : (
                <ol className={extra.ranking}>
                  {routesByViews.map((r, i) => (
                    <Reveal as="li" key={r.id} delay={i * 0.04} className={extra.rankRow}>
                      <span className={extra.rankPos} data-top={i < 3 ? 'true' : undefined}>
                        {i + 1}
                      </span>
                      <span className={extra.rankInfo}>
                        <span className={extra.rankName}>{r.name}</span>
                        <span className={extra.rankSub}>{shortPath(r.path)}</span>
                        <span className={extra.rankBarTrack} aria-hidden="true">
                          <span
                            className={extra.rankBarFill}
                            style={{
                              width: `${maxViews > 0 ? Math.max(6, (r.value / maxViews) * 100) : 0}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </span>
                      </span>
                      <strong className={extra.rankValue}>{fmtInt(r.value)}</strong>
                    </Reveal>
                  ))}
                </ol>
              )}
            </GlassCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <GlassCard title="Mayor permanencia" subtitle="Rutas donde más tiempo se pasa">
              {routesByDwell.length === 0 ? (
                <p className={styles.empty}>Sin tiempos de permanencia aún.</p>
              ) : (
                <ol className={extra.ranking}>
                  {routesByDwell.map((r, i) => (
                    <Reveal as="li" key={r.id} delay={i * 0.04} className={extra.rankRow}>
                      <span className={extra.rankPos} data-top={i < 3 ? 'true' : undefined}>
                        {i + 1}
                      </span>
                      <span className={extra.rankInfo}>
                        <span className={extra.rankName}>{r.name}</span>
                        <span className={extra.rankSub}>{shortPath(r.path)}</span>
                        <span className={extra.rankBarTrack} aria-hidden="true">
                          <span
                            className={extra.rankBarFill}
                            style={{
                              width: `${maxDwell > 0 ? Math.max(6, (r.value / maxDwell) * 100) : 0}%`,
                              background: CHART_COLORS[(i + 2) % CHART_COLORS.length],
                            }}
                          />
                        </span>
                      </span>
                      <strong className={extra.rankValue}>{fmtDuration(r.value)}</strong>
                    </Reveal>
                  ))}
                </ol>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* (4) Top búsquedas */}
        <motion.div variants={itemVariants}>
          <GlassCard title="Búsquedas más frecuentes" subtitle="Lo que tus visitantes intentan encontrar">
            {searches.length === 0 ? (
              <p className={styles.empty}>Sin búsquedas registradas aún.</p>
            ) : (
              <ul className={extra.chips}>
                {searches.map((s, i) => (
                  <Reveal
                    as="li"
                    key={s?.query || i}
                    delay={i * 0.03}
                    className={extra.chip}
                  >
                    <span className={extra.chipText}>{s?.query}</span>
                    <span className={extra.chipCount}>{fmtInt(s?.total)}</span>
                  </Reveal>
                ))}
              </ul>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
