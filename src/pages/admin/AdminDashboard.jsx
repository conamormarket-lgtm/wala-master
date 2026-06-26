import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { getGlobalAnalytics } from '../../services/adminAnalytics';
import GlassCard from '../../components/dashboard/GlassCard';
import KpiCard from '../../components/dashboard/KpiCard';
// Componentes provistos por OTROS agentes (existiran al compilar):
import MasVendidosSection from '../../components/dashboard/MasVendidosSection';
import HeatmapViewer from '../../components/dashboard/HeatmapViewer';
import styles from './AdminDashboard.module.css';

/* ------------------------------ helpers ------------------------------ */

const fmtInt = (v) => new Intl.NumberFormat('es-PE').format(Math.round(Number(v) || 0));

function fmtDuration(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function shortPath(path) {
  if (!path) return '/';
  return path.length > 26 ? `…${path.slice(-25)}` : path;
}

const DONUT_COLORS = ['#6D28D9', '#8B5CF6', '#A78BFA', '#C4B5FD', '#10B981', '#34D399', '#F59E0B'];

const RANGES = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

/* Tooltip con estilo glass reutilizable */
function GlassTooltip({ active, payload, label, suffix = '', formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={styles.tooltip}>
      {label != null && <div className={styles.tooltipLabel}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color || p.fill }} />
          <span className={styles.tooltipName}>{p.name}</span>
          <strong>{formatter ? formatter(p.value) : fmtInt(p.value)}{suffix}</strong>
        </div>
      ))}
    </div>
  );
}

/* Animacion contenedora con entrada escalonada */
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ------------------------------ page ------------------------------ */

export default function AdminDashboard() {
  const [rangeDays, setRangeDays] = useState(30);
  const [trafficMode, setTrafficMode] = useState('total'); // total | app | web

  const dateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - rangeDays);
    start.setHours(0, 0, 0, 0);
    return { startDateMs: start.getTime(), endDateMs: end.getTime() };
  }, [rangeDays]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dashboard-global', dateRange.startDateMs, dateRange.endDateMs],
    queryFn: async () => {
      const res = await getGlobalAnalytics(dateRange);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 20000,
    refetchIntervalInBackground: true,
  });

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

  /* ----- top rutas (barras horizontales) ----- */
  const topRoutes = useMemo(
    () =>
      (data?.topRoutesByViews || []).slice(0, 8).map((r) => ({
        name: shortPath(r.path),
        fullPath: r.path,
        views: r.views?.total ?? r.views ?? 0,
      })),
    [data?.topRoutesByViews]
  );

  /* ----- top productos vistos ----- */
  const topProducts = useMemo(
    () =>
      (data?.topProducts || []).slice(0, 10).map((p) => ({
        name: p.name || p.productId || 'Producto',
        total: p.total || 0,
        app: p.app || 0,
        web: p.web || 0,
        category: p.category || null,
      })),
    [data?.topProducts]
  );

  /* ----- categorias / lineas mas vistas (donut) ----- */
  const categoryData = useMemo(() => {
    const byCat = new Map();
    (data?.topProducts || []).forEach((p) => {
      const cat = p.category || 'Sin categoría';
      byCat.set(cat, (byCat.get(cat) || 0) + (p.total || 0));
    });
    return [...byCat.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [data?.topProducts]);

  const hasCategoryData =
    categoryData.length > 0 && !(categoryData.length === 1 && categoryData[0].name === 'Sin categoría');

  /* ----- embudo de conversion ----- */
  const funnel = useMemo(() => {
    const u = data?.funnelStats?.users || {};
    const steps = [
      { key: 'views', label: 'Visitas', value: u.views?.total || 0 },
      { key: 'adds', label: 'Al carrito', value: u.adds?.total || 0 },
      { key: 'checkouts', label: 'Checkout', value: u.checkouts?.total || 0 },
      { key: 'purchases', label: 'Compras', value: u.purchases?.total || 0 },
    ];
    const base = steps[0].value || 0;
    return steps.map((s, i) => {
      const prev = i === 0 ? s.value : steps[i - 1].value;
      const dropPct = prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : 0;
      const ofTotal = base > 0 ? Math.round((s.value / base) * 100) : 0;
      return { ...s, dropPct: i === 0 ? 0 : dropPct, ofTotal };
    });
  }, [data?.funnelStats]);

  const funnelEmpty = funnel.slice(1).every((s) => s.value === 0);

  /* ----- dispositivos (donut) ----- */
  const deviceData = useMemo(
    () => (data?.deviceStats?.topDevices || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.deviceStats]
  );

  const utmSources = data?.utmStats?.topSources || [];
  const regions = data?.geographyStats?.topRegions || [];
  const liveSessions = data?.realtimeSessionsDetails || [];

  /* ----- KPIs ----- */
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

  const liveCount = data?.realtimeActiveSessions?.total || 0;

  return (
    <div className={styles.page}>
      {/* Fondo: gradiente violeta + orbes difuminados */}
      <div className={styles.bg} aria-hidden="true">
        <span className={`${styles.orb} ${styles.orb1}`} />
        <span className={`${styles.orb} ${styles.orb2}`} />
        <span className={`${styles.orb} ${styles.orb3}`} />
      </div>

      <motion.div
        className={styles.content}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header + selector de rango */}
        <motion.header className={styles.header} variants={itemVariants}>
          <div>
            <h1 className={styles.title}>Panel de Analítica</h1>
            <p className={styles.subtitle}>
              Comportamiento de la tienda en los últimos {rangeDays} días · datos en vivo
            </p>
          </div>
          <div className={styles.rangePicker} role="tablist" aria-label="Rango de fechas">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                role="tab"
                aria-selected={rangeDays === r.days}
                className={`${styles.rangeBtn} ${rangeDays === r.days ? styles.rangeActive : ''}`}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </button>
            ))}
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

        {/* (2) Trafico por pagina */}
        <motion.div className={styles.grid2} variants={containerVariants}>
          <GlassCard
            title="Tráfico por día"
            subtitle="Page views a lo largo del tiempo"
            actions={
              <div className={styles.toggle}>
                {['total', hasAppData ? 'app' : null, 'web']
                  .filter(Boolean)
                  .map((m) => (
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
                    <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#trafficGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              {!trafficByDay.length && <p className={styles.empty}>Sin tráfico en el rango seleccionado.</p>}
            </div>
          </GlassCard>

          <GlassCard title="Rutas más visitadas" subtitle="Top páginas por page views">
            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topRoutes}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(109,40,217,0.06)' }} />
                  <Bar dataKey="views" name="Visitas" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {!topRoutes.length && <p className={styles.empty}>Sin rutas registradas aún.</p>}
            </div>
          </GlassCard>
        </motion.div>

        {/* (3) Productos mas vistos + (4) categorias */}
        <motion.div className={styles.grid2} variants={containerVariants}>
          <GlassCard title="Productos más vistos" subtitle="Top 10 por vistas de producto">
            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(109,40,217,0.06)' }} />
                  <Bar dataKey="total" name="Vistas" fill="#6D28D9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {!topProducts.length && <p className={styles.empty}>Sin vistas de producto en el rango.</p>}
            </div>
            {!!topProducts.length && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className={styles.num}>App</th>
                      <th className={styles.num}>Web</th>
                      <th className={styles.num}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => (
                      <tr key={p.name}>
                        <td className={styles.ellipsis}>{p.name}</td>
                        <td className={styles.num}>{fmtInt(p.app)}</td>
                        <td className={styles.num}>{fmtInt(p.web)}</td>
                        <td className={styles.num}><strong>{fmtInt(p.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          <GlassCard title="Categorías más vistas" subtitle="Distribución por línea de producto">
            {hasCategoryData ? (
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={2}
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth={2}
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={entry.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<GlassTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className={styles.empty}>
                Aún sin categoría asociada a los productos vistos.
              </p>
            )}
            {hasCategoryData && (
              <ul className={styles.legend}>
                {categoryData.map((c, i) => (
                  <li key={c.name}>
                    <span className={styles.legendDot} style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className={styles.ellipsis}>{c.name}</span>
                    <strong>{fmtInt(c.value)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </motion.div>

        {/* (5) Embudo de conversion */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Embudo de conversión"
            subtitle="Recorrido de usuarios únicos hasta la compra"
          >
            {funnelEmpty && (
              <div className={styles.notice}>
                Aún sin datos de carrito/compra. Cuando se registren eventos de añadir al carrito,
                checkout y compra, el embudo se completará automáticamente.
              </div>
            )}
            <div className={styles.funnel}>
              {funnel.map((step, i) => {
                const base = funnel[0].value || 1;
                const widthPct = Math.max(8, Math.round((step.value / base) * 100)) || 8;
                return (
                  <motion.div
                    key={step.key}
                    className={styles.funnelRow}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                  >
                    <div className={styles.funnelHead}>
                      <span className={styles.funnelLabel}>{step.label}</span>
                      <span className={styles.funnelValue}>{fmtInt(step.value)}</span>
                    </div>
                    <div className={styles.funnelTrack}>
                      <div
                        className={styles.funnelFill}
                        style={{
                          width: `${widthPct}%`,
                          background: DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                    </div>
                    <div className={styles.funnelMeta}>
                      <span>{step.ofTotal}% del total</span>
                      {i > 0 && step.dropPct > 0 && (
                        <span className={styles.funnelDrop}>−{step.dropPct}% vs paso previo</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>

        {/* (6) Uso / Tiempo real */}
        <motion.div className={styles.grid3} variants={containerVariants}>
          <GlassCard title="Dispositivos" subtitle="Sesiones por tipo de dispositivo">
            {deviceData.length ? (
              <>
                <div className={styles.chartBoxSm}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deviceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={74}
                        paddingAngle={2}
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth={2}
                      >
                        {deviceData.map((entry, i) => (
                          <Cell key={entry.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<GlassTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className={styles.legend}>
                  {deviceData.map((d, i) => (
                    <li key={d.name}>
                      <span className={styles.legendDot} style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className={styles.ellipsis}>{d.name}</span>
                      <strong>{fmtInt(d.value)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className={styles.empty}>Sin datos de dispositivos.</p>
            )}
          </GlassCard>

          <GlassCard title="Origen y región" subtitle="Fuentes UTM y geografía">
            <h4 className={styles.subhead}>Fuentes de tráfico</h4>
            <ul className={styles.miniList}>
              {utmSources.length ? (
                utmSources.slice(0, 5).map((s) => (
                  <li key={s.name}>
                    <span className={styles.ellipsis}>{s.name}</span>
                    <strong>{fmtInt(s.value)}</strong>
                  </li>
                ))
              ) : (
                <li className={styles.empty}>Solo tráfico directo.</li>
              )}
            </ul>
            <h4 className={styles.subhead}>Regiones</h4>
            <ul className={styles.miniList}>
              {regions.length ? (
                regions.slice(0, 5).map((r) => (
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
                liveSessions.slice(0, 8).map((s) => (
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

        {/* Seccion "Más vendidos" (componente de OTRO agente) */}
        <motion.div variants={itemVariants}>
          <MasVendidosSection startDateMs={dateRange.startDateMs} endDateMs={dateRange.endDateMs} rangeDays={rangeDays} />
        </motion.div>

        {/* Seccion "Mapa de calor" (componente de OTRO agente) */}
        <motion.div variants={itemVariants}>
          <HeatmapViewer startDateMs={dateRange.startDateMs} endDateMs={dateRange.endDateMs} />
        </motion.div>
      </motion.div>
    </div>
  );
}
