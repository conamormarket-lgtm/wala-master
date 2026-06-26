import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  PieChart,
  Pie,
} from 'recharts';
import GlassCard from './GlassCard';
import KpiCard from './KpiCard';
import { getTopSelling } from '../../services/salesAnalytics';
import styles from './MasVendidosSection.module.css';

const PRIMARY = 'var(--primary-color, #6D28D9)';
const GREEN = 'var(--verde-exito, #10B981)';

// Paleta para el donut de líneas (violeta de marca + acentos coherentes).
const LINE_COLORS = ['#6D28D9', '#8B5CF6', '#A78BFA', '#10B981', '#34D399', '#C4B5FD', '#7C3AED'];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatSoles(value) {
  const n = Number(value) || 0;
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInt(value) {
  return (Number(value) || 0).toLocaleString('es-PE');
}

/** Tooltip glass para el BarChart de productos. */
function ProductTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipName}>{item.name}</p>
      <p className={styles.tooltipRow}>
        Unidades: <strong>{formatInt(item.units)}</strong>
      </p>
      <p className={styles.tooltipRow}>
        Monto: <strong>{formatSoles(item.amount)}</strong>
      </p>
    </div>
  );
}

/** Tooltip glass para el donut de líneas. */
function LineTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipName}>{item.name}</p>
      <p className={styles.tooltipRow}>
        Ingresos: <strong>{formatSoles(item.amount)}</strong>
      </p>
      <p className={styles.tooltipRow}>
        Unidades: <strong>{formatInt(item.units)}</strong>
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.section}>
      <div className={styles.kpiRow}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skelKpi}`} />
        ))}
      </div>
      <div className={styles.chartsGrid}>
        <div className={`${styles.skeleton} ${styles.skelChart}`} />
        <div className={`${styles.skeleton} ${styles.skelChart}`} />
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">🛒</span>
      <p className={styles.emptyTitle}>Sin ventas en este periodo</p>
      <p className={styles.emptyText}>
        {message ||
          'Cuando se registren pedidos en el ERP aparecerán aquí los productos y líneas más vendidos.'}
      </p>
    </div>
  );
}

/**
 * MasVendidosSection — sección "Más vendidos" del dashboard, alimentada por el ERP.
 *
 * Props:
 *  - rangeDays?: number — ventana en días para el ranking (default 30).
 */
export default function MasVendidosSection({ rangeDays = 30 }) {
  const [metric, setMetric] = useState('units'); // 'units' | 'amount'
  const reduced = prefersReducedMotion();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['salesAnalytics', 'topSelling', rangeDays],
    queryFn: () => getTopSelling({ days: rangeDays }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const ranking = useMemo(() => {
    if (!data) return [];
    return metric === 'amount' ? data.topByAmount || [] : data.topByUnits || [];
  }, [data, metric]);

  // Datos para BarChart horizontal (top a abajo: el mayor primero).
  const barData = useMemo(
    () =>
      ranking
        .slice(0, 8)
        .map((p) => ({
          ...p,
          shortName: p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name,
          value: metric === 'amount' ? p.amount : p.units,
        }))
        .reverse(),
    [ranking, metric]
  );

  const lineData = useMemo(() => {
    if (!data?.topLines) return [];
    return data.topLines.filter((l) => l.amount > 0 || l.units > 0).slice(0, 7);
  }, [data]);

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    return (
      <GlassCard title="Más vendidos" subtitle="Datos del ERP">
        <EmptyState message={`No se pudieron cargar las ventas: ${error?.message || 'error desconocido'}`} />
      </GlassCard>
    );
  }

  const hasData = data && data.totalOrders > 0 && ranking.length > 0;
  const animateProps = reduced
    ? {}
    : { variants: containerVariants, initial: 'hidden', animate: 'show' };

  return (
    <motion.div className={styles.section} {...animateProps}>
      <div className={styles.headerRow}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.titleIcon} aria-hidden="true">🏆</span>
          Más vendidos
        </h2>
        <span style={{ fontSize: '0.82rem', color: 'var(--gris-texto-secundario, #475569)' }}>
          Últimos {data?.rangeDays ?? rangeDays} días · ERP
        </span>
      </div>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Ingresos del periodo"
          value={data?.totalRevenue || 0}
          format={formatSoles}
          accent={GREEN}
          icon="💰"
        />
        <KpiCard
          label="Pedidos"
          value={data?.totalOrders || 0}
          format={formatInt}
          accent={PRIMARY}
          icon="📦"
        />
        <KpiCard
          label="Unidades vendidas"
          value={data?.totalUnits || 0}
          format={formatInt}
          accent="#8B5CF6"
          icon="🧮"
        />
      </div>

      {!hasData ? (
        <GlassCard animate={!reduced}>
          <EmptyState />
        </GlassCard>
      ) : (
        <>
          <div className={styles.chartsGrid}>
            {/* BarChart horizontal con toggle */}
            <GlassCard
              animate={!reduced}
              title="Productos más vendidos"
              subtitle={metric === 'amount' ? 'Por monto (S/)' : 'Por unidades'}
              actions={
                <div className={styles.toggle} role="tablist" aria-label="Métrica">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={metric === 'units'}
                    className={`${styles.toggleBtn} ${metric === 'units' ? styles.toggleBtnActive : ''}`}
                    onClick={() => setMetric('units')}
                  >
                    Unidades
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={metric === 'amount'}
                    className={`${styles.toggleBtn} ${metric === 'amount' ? styles.toggleBtnActive : ''}`}
                    onClick={() => setMetric('amount')}
                  >
                    Monto
                  </button>
                </div>
              }
            >
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={barData}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="barGradMV" x1="0" y1="0" x2="1" y2="0">
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
                    <Tooltip
                      cursor={{ fill: 'rgba(109, 40, 217, 0.06)' }}
                      content={<ProductTooltip />}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 8, 8, 0]}
                      fill="url(#barGradMV)"
                      isAnimationActive={!reduced}
                      maxBarSize={26}
                    >
                      {barData.map((entry, i) => (
                        <Cell key={entry.productId || entry.name || i} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Donut de líneas */}
            <GlassCard
              animate={!reduced}
              title="Líneas más vendidas"
              subtitle="Participación por ingresos"
            >
              {lineData.length === 0 ? (
                <EmptyState message="Aún no hay líneas de producto registradas en los pedidos." />
              ) : (
                <>
                  <div className={styles.donutWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={lineData}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={92}
                          paddingAngle={2}
                          stroke="rgba(255,255,255,0.6)"
                          strokeWidth={2}
                          isAnimationActive={!reduced}
                        >
                          {lineData.map((entry, i) => (
                            <Cell key={entry.name || i} fill={LINE_COLORS[i % LINE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<LineTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className={styles.legend}>
                    {lineData.map((entry, i) => (
                      <li key={entry.name || i} className={styles.legendItem}>
                        <span
                          className={styles.legendDot}
                          style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}
                          aria-hidden="true"
                        />
                        <span className={styles.legendName}>{entry.name}</span>
                        <span className={styles.legendVal}>{formatSoles(entry.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </GlassCard>
          </div>

          {/* Tabla rankeada */}
          <GlassCard
            animate={!reduced}
            title="Ranking de productos"
            subtitle={`Top ${ranking.length} por ${metric === 'amount' ? 'monto' : 'unidades'}`}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th>Producto</th>
                    <th className={styles.alignRight}>Unidades</th>
                    <th className={styles.alignRight}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((p, i) => (
                    <tr key={p.productId || `${p.name}-${i}`}>
                      <td>
                        <span
                          className={`${styles.rankBadge} ${i > 2 ? styles.rankBadgeMuted : ''}`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <div className={styles.prodName} title={p.name}>
                          {p.name}
                        </div>
                      </td>
                      <td className={styles.alignRight}>{formatInt(p.units)}</td>
                      <td className={`${styles.alignRight} ${styles.amountCell}`}>
                        {formatSoles(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </motion.div>
  );
}
