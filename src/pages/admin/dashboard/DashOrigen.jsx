import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import GlassCard from '../../../components/dashboard/GlassCard';
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
  useDateRange,
  useGlobalAnalytics,
} from './dashShared';
import styles from '../AdminDashboard.module.css';

/**
 * Donut reutilizable: recibe items {name,value} y pinta un PieChart con leyenda.
 */
function DonutBlock({ title, items, emptyText }) {
  const data = (items || []).filter((d) => (d.value || 0) > 0).slice(0, 7);
  return (
    <div>
      <h4 className={styles.subhead}>{title}</h4>
      {data.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <>
          <div className={styles.chartBoxSm}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={2}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.name || i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<GlassTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className={styles.legend}>
            {data.map((entry, i) => (
              <li key={entry.name || i}>
                <span
                  className={styles.legendDot}
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  aria-hidden="true"
                />
                <span className={styles.ellipsis}>{entry.name}</span>
                <strong>{fmtInt(entry.value)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * DashOrigen — sub-página de ORIGEN / TRÁFICO:
 *   - Dispositivos / Navegador / Sistema operativo (donuts de deviceStats)
 *   - Fuentes UTM y regiones (utmStats / geographyStats)
 *   - Panel "En vivo" (sesiones activas en tiempo real)
 */
export default function DashOrigen() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  const deviceItems = useMemo(
    () => (data?.deviceStats?.topDevices || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.deviceStats]
  );
  const browserItems = useMemo(
    () => (data?.deviceStats?.topBrowsers || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.deviceStats]
  );
  const osItems = useMemo(
    () => (data?.deviceStats?.topOS || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.deviceStats]
  );

  const utmSources = data?.utmStats?.topSources || [];
  const utmCampaigns = data?.utmStats?.topCampaigns || [];
  const regions = data?.geographyStats?.topRegions || [];
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
        <motion.div variants={itemVariants}>
          <DashHeader
            title="Origen y tráfico"
            subtitle={`Dispositivos, fuentes y regiones · últimos ${rangeDays} días`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        {/* Dispositivos / navegador / OS */}
        <motion.div className={styles.grid3} variants={containerVariants}>
          <motion.div variants={itemVariants}>
            <GlassCard title="Dispositivos" subtitle="Escritorio vs. móvil">
              <DonutBlock title="Tipo de dispositivo" items={deviceItems} emptyText="Sin datos de dispositivo aún." />
            </GlassCard>
          </motion.div>
          <motion.div variants={itemVariants}>
            <GlassCard title="Navegador" subtitle="Navegadores más usados">
              <DonutBlock title="Navegador" items={browserItems} emptyText="Sin datos de navegador aún." />
            </GlassCard>
          </motion.div>
          <motion.div variants={itemVariants}>
            <GlassCard title="Sistema operativo" subtitle="Plataformas de tus visitantes">
              <DonutBlock title="Sistema operativo" items={osItems} emptyText="Sin datos de sistema operativo aún." />
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* UTM / regiones / en vivo */}
        <motion.div className={styles.grid3} variants={containerVariants}>
          <motion.div variants={itemVariants}>
            <GlassCard title="Origen y región" subtitle="Fuentes UTM y geografía">
              <h4 className={styles.subhead}>Fuentes de tráfico</h4>
              <ul className={styles.miniList}>
                {utmSources.length ? (
                  utmSources.slice(0, 6).map((s) => (
                    <li key={s.name}>
                      <span className={styles.ellipsis}>{s.name}</span>
                      <strong>{fmtInt(s.value)}</strong>
                    </li>
                  ))
                ) : (
                  <li className={styles.empty}>Solo tráfico directo.</li>
                )}
              </ul>

              <h4 className={styles.subhead}>Campañas</h4>
              <ul className={styles.miniList}>
                {utmCampaigns.length ? (
                  utmCampaigns.slice(0, 5).map((c) => (
                    <li key={c.name}>
                      <span className={styles.ellipsis}>{c.name}</span>
                      <strong>{fmtInt(c.count)}</strong>
                    </li>
                  ))
                ) : (
                  <li className={styles.empty}>Sin campañas UTM registradas.</li>
                )}
              </ul>

              <h4 className={styles.subhead}>Regiones</h4>
              <ul className={styles.miniList}>
                {regions.length ? (
                  regions.slice(0, 6).map((r) => (
                    <li key={r.name}>
                      <span className={styles.ellipsis}>{r.name}</span>
                      <strong>{fmtInt(r.count)}</strong>
                    </li>
                  ))
                ) : (
                  <li className={styles.empty}>Sin datos regionales aún.</li>
                )}
              </ul>
            </GlassCard>
          </motion.div>

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
                  liveSessions.slice(0, 12).map((s) => (
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

          <motion.div variants={itemVariants}>
            <GlassCard title="Búsquedas" subtitle="Términos más buscados">
              <ul className={styles.miniList}>
                {(data?.topSearches || []).length ? (
                  (data?.topSearches || []).slice(0, 12).map((s) => (
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
      </motion.div>
    </div>
  );
}
