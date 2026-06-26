import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import GlassCard from '../../../components/dashboard/GlassCard';
import RankingConMiniaturas from '../../../components/dashboard/RankingConMiniaturas';
import { useProductThumbs } from '../../../components/dashboard/useProductThumbs';
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

/**
 * DashCategorias — sub-página de CATEGORÍAS / TAGS:
 *   - Categorías más vistas (Donut, derivado de los productos vistos)
 *   - Tags populares (RankingConMiniaturas, ponderados por vistas)
 *   - Embudo de conversión (funnelStats)
 */
export default function DashCategorias() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

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
