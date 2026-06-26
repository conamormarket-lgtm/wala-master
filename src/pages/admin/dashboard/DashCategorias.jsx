import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import GlassCard from '../../../components/dashboard/GlassCard';
import RankingConMiniaturas from '../../../components/dashboard/RankingConMiniaturas';
import { useProductThumbs } from '../../../components/dashboard/useProductThumbs';
import Donut from '../../../components/dashboard/charts/Donut';
import CompareBars from '../../../components/dashboard/charts/CompareBars';
import { Reveal } from '../../../components/ui';
import { deriveLinesViewed } from '../../../services/analytics/derive';
import { getTopSelling } from '../../../services/salesAnalytics';
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
  useDateRange,
  useGlobalAnalytics,
} from './dashShared';
import styles from '../AdminDashboard.module.css';
import extra from './DashCategorias.extra.module.css';

/* Formatea soles con dos decimales (ingresos del ERP). */
const fmtSoles = (v) =>
  `S/ ${(Number(v) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * DashCategorias — sub-página de CATEGORÍAS / TAGS:
 *   - Categorías más vistas (Donut, derivado de los productos vistos)
 *   - Tags populares (RankingConMiniaturas, ponderados por vistas)
 *   - Líneas más vistas (analítica) vs. más vendidas (ERP) lado a lado
 *   - Conversión por línea: Vistas | Ventas | Conv% (cruce analítica + ERP)
 *   - Embudo de conversión (funnelStats)
 */
export default function DashCategorias() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  /* ----- ventas reales del ERP (líneas más vendidas) -----
   * Query independiente cacheada por rango. No bloquea la analítica global:
   * si el ERP no está disponible, los bloques de venta caen a estado vacío. */
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['salesAnalytics', 'topSelling', rangeDays],
    queryFn: () => getTopSelling({ days: rangeDays, topLimit: 12 }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

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

  const productIdsForThumbs = useMemo(
    () => topProducts.filter((p) => p.productId).map((p) => p.productId),
    [topProducts]
  );

  const { thumbs } = useProductThumbs(productIdsForThumbs);

  /* ----- categorías más vistas (donut) ----- */
  const categoryItems = useMemo(() => {
    const byCat = new Map();
    topProducts.forEach((p) => {
      const meta = (p.productId && thumbs[p.productId]) || {};
      const cat = meta.category || p.category || 'Sin categoría';
      byCat.set(cat, (byCat.get(cat) || 0) + (p.total || 0));
    });
    return [...byCat.entries()]
      .filter(([name]) => name && name !== 'Sin categoría')
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [topProducts, thumbs]);

  /* ----- líneas/categorías más VISTAS (donut, vía deriveLinesViewed) -----
   * Enriquecemos cada producto con la categoría resuelta (miniatura > producto)
   * para que deriveLinesViewed agrupe por la línea real. El recuento de vistas
   * vive en `total` (deriveLinesViewed lo lee como fallback de `views`). */
  const linesViewed = useMemo(() => {
    const enriched = topProducts.map((p) => {
      const meta = (p.productId && thumbs[p.productId]) || {};
      return {
        category: meta.category || p.category || null,
        total: p.total || 0,
      };
    });
    return deriveLinesViewed(enriched).filter((l) => l.name !== 'Sin categoría');
  }, [topProducts, thumbs]);

  const viewedDonut = useMemo(
    () => linesViewed.map((l) => ({ name: l.name, value: l.views })),
    [linesViewed]
  );
  const totalViewsLines = useMemo(
    () => linesViewed.reduce((acc, l) => acc + (l.views || 0), 0),
    [linesViewed]
  );

  /* ----- líneas más VENDIDAS (ERP, getTopSelling().topLines) ----- */
  const linesSold = useMemo(() => {
    const lines = Array.isArray(salesData?.topLines) ? salesData.topLines : [];
    return lines
      .filter((l) => l && (Number(l.amount) > 0 || Number(l.units) > 0) && l.name !== 'Sin línea')
      .map((l) => ({ name: l.name, units: Number(l.units) || 0, amount: Number(l.amount) || 0 }));
  }, [salesData?.topLines]);

  /* ----- conversión por línea: cruza VISTAS (analítica) con VENTAS (ERP) -----
   * Une por nombre de línea (case-insensitive) y calcula Conv% = ventas/vistas.
   * Tolera líneas que solo aparecen en uno de los dos orígenes. */
  const conversionByLine = useMemo(() => {
    const byName = new Map();
    const keyOf = (name) => String(name || '').trim().toLowerCase();

    linesViewed.forEach((l) => {
      const k = keyOf(l.name);
      if (!k) return;
      byName.set(k, { name: l.name, views: l.views || 0, units: 0 });
    });
    linesSold.forEach((l) => {
      const k = keyOf(l.name);
      if (!k) return;
      const prev = byName.get(k) || { name: l.name, views: 0, units: 0 };
      prev.units += l.units || 0;
      // Conservamos el nombre con mejor capitalización si la línea solo vino del ERP.
      if (!prev.name) prev.name = l.name;
      byName.set(k, prev);
    });

    return [...byName.values()]
      .map((row) => ({
        ...row,
        conv: row.views > 0 ? Math.round((row.units / row.views) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.units - a.units || b.views - a.views)
      .slice(0, 8);
  }, [linesViewed, linesSold]);

  const maxConv = useMemo(
    () => conversionByLine.reduce((m, r) => Math.max(m, r.conv), 0),
    [conversionByLine]
  );

  /* ----- tags populares (ranking con miniaturas) ----- */
  const tagItems = useMemo(() => {
    const byTag = new Map();
    topProducts.forEach((p) => {
      const meta = (p.productId && thumbs[p.productId]) || {};
      const tags = Array.isArray(meta.tags) ? meta.tags : [];
      tags.forEach((t) => {
        const tag = String(t || '').trim();
        if (!tag) return;
        byTag.set(tag, (byTag.get(tag) || 0) + (p.total || 0));
      });
    });
    return [...byTag.entries()]
      .map(([name, value]) => ({ id: name, label: `#${name}`, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [topProducts, thumbs]);

  /* ----- embudo de conversión ----- */
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
            title="Categorías y tags"
            subtitle={`Líneas, etiquetas y conversión · últimos ${rangeDays} días`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        <motion.div className={styles.grid2} variants={containerVariants}>
          {/* Categorías más vistas (donut) */}
          <motion.div variants={itemVariants}>
            <GlassCard title="Categorías más vistas" subtitle="Líneas de producto por vistas">
              {categoryItems.length === 0 ? (
                <p className={styles.empty}>Aún sin categoría asociada a los productos vistos.</p>
              ) : (
                <>
                  <div className={styles.chartBox}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryItems}
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
                          {categoryItems.map((entry, i) => (
                            <Cell key={entry.name || i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<GlassTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className={styles.legend}>
                    {categoryItems.map((entry, i) => (
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
            </GlassCard>
          </motion.div>

          {/* Tags populares */}
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
        </motion.div>

        {/* Líneas VISTAS vs. VENDIDAS — comparación lado a lado */}
        <motion.div className={styles.grid2} variants={containerVariants}>
          {/* Líneas/categorías más VISTAS (analítica) */}
          <motion.div variants={itemVariants}>
            <GlassCard
              title="Líneas más vistas"
              subtitle="Categorías por vistas de producto (analítica)"
            >
              <Reveal>
                <Donut
                  data={viewedDonut}
                  colors={CHART_COLORS}
                  height={240}
                  centerLabel="Vistas"
                  centerValue={totalViewsLines}
                  formatValue={fmtInt}
                  emptyText="Aún sin categoría asociada a los productos vistos."
                />
              </Reveal>
              {totalViewsLines > 0 && (
                <div className={extra.lineFoot}>
                  <span className={extra.lineFootLabel}>Total de vistas en líneas</span>
                  <span className={extra.lineFootValue}>{fmtInt(totalViewsLines)}</span>
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Líneas más VENDIDAS (ERP) */}
          <motion.div variants={itemVariants}>
            <GlassCard
              title="Líneas más vendidas"
              subtitle="Por ingresos reales del ERP (S/)"
            >
              <Reveal>
                {salesLoading && linesSold.length === 0 ? (
                  <p className={styles.empty}>Cargando ventas del ERP…</p>
                ) : (
                  <CompareBars
                    data={linesSold}
                    nameKey="name"
                    valueKey="amount"
                    formatValue={fmtSoles}
                    max={8}
                    emptyText="Aún no hay líneas vendidas en este periodo. Cuando se registren pedidos en el ERP aparecerán aquí."
                  />
                )}
              </Reveal>
              {salesData?.totalRevenue > 0 && (
                <div className={extra.lineFoot}>
                  <span className={extra.lineFootLabel}>Ingresos del periodo</span>
                  <span className={`${extra.lineFootValue} ${extra.green}`}>
                    {fmtSoles(salesData.totalRevenue)}
                  </span>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* Conversión por línea: Vistas | Ventas | Conv% */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Conversión por línea"
            subtitle="De vistas (analítica) a ventas (ERP) por línea de producto"
          >
            {conversionByLine.length === 0 ? (
              <p className={styles.empty}>
                Aún sin cruce de datos. Cuando una misma línea acumule vistas y ventas, verás aquí su
                tasa de conversión.
              </p>
            ) : (
              <Reveal>
                <div className={extra.convWrap}>
                  <table className={extra.convTable}>
                    <thead>
                      <tr>
                        <th>Línea de producto</th>
                        <th className={extra.alignRight}>Vistas</th>
                        <th className={extra.alignRight}>Ventas (uds)</th>
                        <th className={extra.alignRight}>Conv%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversionByLine.map((row, i) => {
                        const color = CHART_COLORS[i % CHART_COLORS.length];
                        const barPct = maxConv > 0 ? Math.round((row.conv / maxConv) * 100) : 0;
                        return (
                          <tr key={row.name || i}>
                            <td>
                              <span className={extra.lineName}>
                                <span
                                  className={extra.lineDot}
                                  style={{ background: color }}
                                  aria-hidden="true"
                                />
                                <span className={extra.lineNameText} title={row.name}>
                                  {row.name}
                                </span>
                              </span>
                            </td>
                            <td className={extra.alignRight}>{fmtInt(row.views)}</td>
                            <td className={extra.alignRight}>{fmtInt(row.units)}</td>
                            <td>
                              <span className={extra.convCell}>
                                <span className={extra.convBar} aria-hidden="true">
                                  <span
                                    className={extra.convBarFill}
                                    style={{ width: `${barPct}%` }}
                                  />
                                </span>
                                <span className={extra.convPct}>
                                  {row.views > 0 ? `${row.conv}%` : '—'}
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className={extra.convHint}>
                  Conv% = unidades vendidas ÷ vistas de la línea. Las líneas sin vistas registradas se
                  muestran con “—”. Vistas desde analítica, ventas desde el ERP.
                </p>
              </Reveal>
            )}
          </GlassCard>
        </motion.div>

        {/* Embudo de conversión */}
        <motion.div variants={itemVariants}>
          <GlassCard title="Embudo de conversión" subtitle="Recorrido de usuarios únicos hasta la compra">
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
                          background: CHART_COLORS[i % CHART_COLORS.length],
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
      </motion.div>
    </div>
  );
}
