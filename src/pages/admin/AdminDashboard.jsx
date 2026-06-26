import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { getGlobalAnalytics } from '../../services/adminAnalytics';
import GlassCard from '../../components/dashboard/GlassCard';
import KpiCard from '../../components/dashboard/KpiCard';
import RankingConMiniaturas from '../../components/dashboard/RankingConMiniaturas';
import { useProductThumbs } from '../../components/dashboard/useProductThumbs';
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

/* Convierte una ruta en un nombre legible para humanos. */
function prettyRouteName(path) {
  if (!path || path === '/') return 'Inicio';
  const clean = path.split('?')[0].replace(/\/+$/, '');
  const segs = clean.split('/').filter(Boolean);
  if (!segs.length) return 'Inicio';
  const map = {
    tienda: 'Tienda',
    producto: 'Producto',
    productos: 'Productos',
    categoria: 'Categoría',
    categorias: 'Categorías',
    coleccion: 'Colección',
    colecciones: 'Colecciones',
    checkout: 'Checkout',
    carrito: 'Carrito',
    cuenta: 'Mi cuenta',
    wishlist: 'Lista de deseos',
    editor: 'Editor',
    ofertas: 'Ofertas',
    buscar: 'Búsqueda',
  };
  const titled = segs.map((s) => {
    if (map[s]) return map[s];
    const decoded = decodeURIComponent(s).replace(/[-_]/g, ' ');
    return decoded.charAt(0).toUpperCase() + decoded.slice(1);
  });
  // Nombre principal = último segmento legible, con contexto del primero.
  if (titled.length === 1) return titled[0];
  return `${titled[0]} · ${titled[titled.length - 1]}`;
}

const ADD_TO_CART = 'add_to_cart';

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

const RANGES = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

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

  /* ----------------------------------------------------------------
   * RENDIMIENTO / control de lecturas (evita "Quota exceeded"):
   *  - Sin refetchInterval automático (antes refrescaba cada 20s y
   *    disparaba lecturas masivas en bucle).
   *  - staleTime de 5 min: cambiar de rango o re-montar no reconsulta
   *    si los datos siguen frescos.
   *  - refetchOnWindowFocus desactivado para no reconsultar al volver
   *    a la pestaña.
   *  - Refresco SOLO manual mediante el botón "Actualizar".
   * ---------------------------------------------------------------- */
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-dashboard-global', dateRange.startDateMs, dateRange.endDateMs],
    queryFn: async () => {
      const res = await getGlobalAnalytics(dateRange);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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

  /* ----- agregados de carrito (add_to_cart) desde eventos crudos ----- */
  const cartAgg = useMemo(() => {
    const events = data?.eventsForCharts || [];
    const byProduct = new Map(); // productId -> { name, adds, qty, category }
    events.forEach((e) => {
      if (e.type !== ADD_TO_CART) return;
      const ed = e.eventData || {};
      const id = ed.productId || ed.name;
      if (!id) return;
      if (!byProduct.has(id)) {
        byProduct.set(id, {
          productId: ed.productId || null,
          name: ed.name || 'Producto',
          adds: 0,
          qty: 0,
          category: ed.category || null,
        });
      }
      const row = byProduct.get(id);
      row.adds += 1;
      row.qty += Number(ed.qty) || 1;
    });
    return [...byProduct.values()].sort((a, b) => b.adds - a.adds);
  }, [data?.eventsForCharts]);

  /* mapa rápido productId -> nº de "agregar al carrito" para los productos vistos */
  const cartAddsByProductId = useMemo(() => {
    const m = new Map();
    cartAgg.forEach((c) => {
      if (c.productId) m.set(c.productId, c.adds);
    });
    return m;
  }, [cartAgg]);

  /* ----- top productos vistos ----- */
  const topProducts = useMemo(
    () =>
      (data?.topProducts || []).slice(0, 10).map((p) => ({
        productId: p.productId || null,
        name: p.name || p.productId || 'Producto',
        total: p.total || 0,
        category: p.category || null,
      })),
    [data?.topProducts]
  );

  /* ----- IDs a resolver para miniaturas/tags (productos vistos + carrito) ----- */
  const productIdsForThumbs = useMemo(() => {
    const ids = [];
    topProducts.forEach((p) => p.productId && ids.push(p.productId));
    cartAgg.slice(0, 10).forEach((c) => c.productId && ids.push(c.productId));
    return ids;
  }, [topProducts, cartAgg]);

  const { thumbs } = useProductThumbs(productIdsForThumbs);

  /* ----- items para el panel "Productos más vistos" ----- */
  const topProductItems = useMemo(
    () =>
      topProducts.map((p) => {
        const meta = (p.productId && thumbs[p.productId]) || {};
        const adds = p.productId ? cartAddsByProductId.get(p.productId) : 0;
        return {
          id: p.productId || p.name,
          label: p.name,
          value: p.total,
          sub: meta.category || p.category || null,
          image: meta.mainImage || null,
          badge: adds ? `${fmtInt(adds)} al carrito` : null,
        };
      }),
    [topProducts, thumbs, cartAddsByProductId]
  );

  /* ----- items para el panel "Carrito" (más agregados) ----- */
  const cartItems = useMemo(
    () =>
      cartAgg.slice(0, 10).map((c) => {
        const meta = (c.productId && thumbs[c.productId]) || {};
        return {
          id: c.productId || c.name,
          label: c.name,
          value: c.adds,
          sub: c.qty > c.adds ? `${fmtInt(c.qty)} uds. agregadas` : (meta.category || c.category || null),
          image: meta.mainImage || null,
        };
      }),
    [cartAgg, thumbs]
  );

  /* ----- categorias / lineas mas vistas ----- */
  const categoryItems = useMemo(() => {
    const byCat = new Map();
    topProducts.forEach((p) => {
      const meta = (p.productId && thumbs[p.productId]) || {};
      const cat = meta.category || p.category || 'Sin categoría';
      byCat.set(cat, (byCat.get(cat) || 0) + (p.total || 0));
    });
    const arr = [...byCat.entries()]
      .filter(([name]) => name && name !== 'Sin categoría')
      .map(([name, value]) => ({ id: name, label: name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return arr;
  }, [topProducts, thumbs]);

  /* ----- landing / páginas más visitadas ----- */
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

  /* ----- tags populares (derivados de los tags de los productos vistos) ----- */
  const tagItems = useMemo(() => {
    const byTag = new Map();
    topProducts.forEach((p) => {
      const meta = (p.productId && thumbs[p.productId]) || {};
      const tags = Array.isArray(meta.tags) ? meta.tags : [];
      tags.forEach((t) => {
        const tag = String(t || '').trim();
        if (!tag) return;
        // Pondera el tag por las vistas del producto que lo lleva.
        byTag.set(tag, (byTag.get(tag) || 0) + (p.total || 0));
      });
    });
    return [...byTag.entries()]
      .map(([name, value]) => ({ id: name, label: `#${name}`, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [topProducts, thumbs]);

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
  const lastUpdated = dataUpdatedAt ? fmtTime(dataUpdatedAt) : null;

  const PCROFFEE_COLORS = ['#6D28D9', '#8B5CF6', '#A78BFA', '#C4B5FD', '#10B981', '#34D399', '#F59E0B'];

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
        {/* Header + selector de rango + actualizar */}
        <motion.header className={styles.header} variants={itemVariants}>
          <div>
            <h1 className={styles.title}>Panel de Analítica</h1>
            <p className={styles.subtitle}>
              Comportamiento de la tienda en los últimos {rangeDays} días
              {lastUpdated ? ` · actualizado ${lastUpdated}` : ''}
            </p>
          </div>
          <div className={styles.headerControls}>
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
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => refetch()}
              disabled={isFetching}
              title="Actualizar datos"
            >
              <span className={`${styles.refreshIcon} ${isFetching ? styles.spinning : ''}`} aria-hidden="true">
                ⟳
              </span>
              {isFetching ? 'Actualizando…' : 'Actualizar'}
            </button>
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

        {/* (2) Trafico por dia */}
        <motion.div variants={itemVariants}>
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
        </motion.div>

        {/* (3) PANELES CATEGORIZADOS CON MINIATURAS */}
        <motion.div className={styles.grid2} variants={containerVariants}>
          {/* Productos más vistos */}
          <GlassCard title="Productos más vistos" subtitle="Top 10 por vistas de producto · con miniatura">
            <RankingConMiniaturas
              items={topProductItems}
              valueLabel="vistas"
              emptyIcon="👀"
              emptyText="Aún sin vistas de producto en este rango."
            />
          </GlassCard>

          {/* Carrito: más agregados */}
          <GlassCard title="Carrito" subtitle="Productos más agregados al carrito">
            <RankingConMiniaturas
              items={cartItems}
              valueLabel="al carrito"
              emptyIcon="🛒"
              emptyText="Aún sin eventos de añadir al carrito en este rango."
            />
          </GlassCard>
        </motion.div>

        <motion.div className={styles.grid2} variants={containerVariants}>
          {/* Categorías / líneas más vistas */}
          <GlassCard title="Categorías más vistas" subtitle="Líneas de producto por vistas">
            <RankingConMiniaturas
              items={categoryItems}
              valueLabel="vistas"
              emptyIcon="🏷️"
              emptyText="Aún sin categoría asociada a los productos vistos."
            />
          </GlassCard>

          {/* Landing / páginas más visitadas */}
          <GlassCard title="Páginas más visitadas" subtitle="Landings y rutas por page views">
            <RankingConMiniaturas
              items={routeItems}
              valueLabel="visitas"
              emptyIcon="🧭"
              emptyText="Sin rutas registradas aún."
            />
          </GlassCard>
        </motion.div>

        {/* (4) Tags populares (ancho completo) */}
        <motion.div variants={itemVariants}>
          <GlassCard title="Tags populares" subtitle="Etiquetas de los productos más vistos">
            <RankingConMiniaturas
              items={tagItems}
              valueLabel="vistas"
              emptyIcon="🔖"
              emptyText="Aún sin datos de tags. Cuando los productos vistos tengan etiquetas, aparecerán aquí ponderadas por sus vistas."
            />
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
                          background: PCROFFEE_COLORS[i % PCROFFEE_COLORS.length],
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

        {/* (6) Origen / region / En vivo */}
        <motion.div className={styles.grid3} variants={containerVariants}>
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

          <GlassCard title="Búsquedas" subtitle="Términos más buscados">
            <ul className={styles.miniList}>
              {(data?.topSearches || []).length ? (
                (data?.topSearches || []).slice(0, 8).map((s) => (
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
