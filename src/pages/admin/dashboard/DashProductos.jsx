import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../components/dashboard/GlassCard';
import RankingConMiniaturas from '../../../components/dashboard/RankingConMiniaturas';
import MasVendidosSection from '../../../components/dashboard/MasVendidosSection';
import { useProductThumbs } from '../../../components/dashboard/useProductThumbs';
import {
  ADD_TO_CART,
  DashBackground,
  DashHeader,
  DashStates,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtTime,
  useDateRange,
  useGlobalAnalytics,
} from './dashShared';
import styles from '../AdminDashboard.module.css';

/**
 * DashProductos — sub-página de PRODUCTOS:
 *   - Productos más vistos (RankingConMiniaturas)
 *   - Carrito: productos más agregados (RankingConMiniaturas)
 *   - MasVendidosSection (ventas del ERP)
 *
 * Reutiliza la query global compartida (cacheada por rango). El selector de
 * rango 7/30/90 alimenta tanto la analítica como MasVendidosSection.
 */
export default function DashProductos() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  /* ----- agregados de carrito (add_to_cart) desde eventos crudos ----- */
  const cartAgg = useMemo(() => {
    const events = data?.eventsForCharts || [];
    const byProduct = new Map();
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

  const productIdsForThumbs = useMemo(() => {
    const ids = [];
    topProducts.forEach((p) => p.productId && ids.push(p.productId));
    cartAgg.slice(0, 10).forEach((c) => c.productId && ids.push(c.productId));
    return ids;
  }, [topProducts, cartAgg]);

  const { thumbs } = useProductThumbs(productIdsForThumbs);

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
            title="Productos"
            subtitle={`Vistas, carrito y ventas · últimos ${rangeDays} días`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        <motion.div className={styles.grid2} variants={containerVariants}>
          <motion.div variants={itemVariants}>
            <GlassCard title="Productos más vistos" subtitle="Top 10 por vistas de producto · con miniatura">
              <RankingConMiniaturas
                items={topProductItems}
                valueLabel="vistas"
                emptyIcon="👀"
                emptyText="Aún sin vistas de producto en este rango."
              />
            </GlassCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <GlassCard title="Carrito" subtitle="Productos más agregados al carrito">
              <RankingConMiniaturas
                items={cartItems}
                valueLabel="al carrito"
                emptyIcon="🛒"
                emptyText="Aún sin eventos de añadir al carrito en este rango."
              />
            </GlassCard>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <MasVendidosSection
            startDateMs={dateRange.startDateMs}
            endDateMs={dateRange.endDateMs}
            rangeDays={rangeDays}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
