import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import GlassCard from '../../../components/dashboard/GlassCard';
import MasVendidosSection from '../../../components/dashboard/MasVendidosSection';
import { useProductThumbs } from '../../../components/dashboard/useProductThumbs';
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from '../../../components/ui';
import { getTopSelling } from '../../../services/salesAnalytics';
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
import extra from './DashProductos.extra.module.css';

/* ============================================================================
 * DashProductos — sub-página de PRODUCTOS, rediseñada a COMPARACIÓN CLARA:
 *
 *   ┌─────────────────────────┬─────────────────────────┐
 *   │ 👀 Más vistos           │ 🏆 Más vendidos (ERP)   │
 *   │ topProducts + miniatura │ getTopSelling + miniat. │
 *   │ + tasa de conversión    │ + toggle unidades/monto │
 *   └─────────────────────────┴─────────────────────────┘
 *   (dos columnas en desktop, apiladas en móvil)
 *
 *   Debajo se conserva MasVendidosSection con el detalle profundo del ERP
 *   (KPIs, barras, donut de líneas y tabla rankeada).
 *
 * Conserva intacta la carga de datos previa:
 *   - useGlobalAnalytics (analítica web: vistas + carrito), cacheada por rango.
 *   - useProductThumbs (miniaturas/categoría de los IDs visibles).
 * Y añade, con el MISMO patrón que MasVendidosSection, la query de ventas del
 * ERP (getTopSelling) para poder cruzar VISTAS vs VENTAS y derivar la
 * conversión por producto.
 * ========================================================================== */

const fmtSoles = (value) =>
  `S/ ${(Number(value) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/* Normaliza un nombre de producto para cruzar vistas (web) con ventas (ERP)
   cuando no compartimos un productId fiable. */
function normName(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

export default function DashProductos() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  /* Métrica de la columna "vendidos": unidades o monto. */
  const [salesMetric, setSalesMetric] = useState('units'); // 'units' | 'amount'

  /* ----- ventas del ERP (mismo patrón/clave que MasVendidosSection) ----- */
  const {
    data: salesData,
    isLoading: salesLoading,
    isError: salesError,
  } = useQuery({
    queryKey: ['salesAnalytics', 'topSelling', rangeDays],
    queryFn: () => getTopSelling({ days: rangeDays, topLimit: 10 }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

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

  /* ----- top productos vistos (analítica web) ----- */
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

  /* ----- ranking de ventas según métrica activa ----- */
  const salesRanking = useMemo(() => {
    if (!salesData) return [];
    const list = salesMetric === 'amount' ? salesData.topByAmount : salesData.topByUnits;
    return (list || []).slice(0, 10);
  }, [salesData, salesMetric]);

  /* ----- índices de ventas (por id y por nombre) para cruzar conversión ----- */
  const unitsByProductId = useMemo(() => {
    const m = new Map();
    (salesData?.topByUnits || []).forEach((p) => {
      if (p.productId) m.set(p.productId, (m.get(p.productId) || 0) + (p.units || 0));
    });
    return m;
  }, [salesData?.topByUnits]);

  const unitsByName = useMemo(() => {
    const m = new Map();
    (salesData?.topByUnits || []).forEach((p) => {
      const key = normName(p.name);
      if (key) m.set(key, (m.get(key) || 0) + (p.units || 0));
    });
    return m;
  }, [salesData?.topByUnits]);

  /* Unidades vendidas estimadas para un producto visto (por id o por nombre). */
  const lookupUnitsSold = useMemo(
    () => (p) => {
      if (p.productId && unitsByProductId.has(p.productId)) return unitsByProductId.get(p.productId);
      const byName = unitsByName.get(normName(p.name));
      return byName || 0;
    },
    [unitsByProductId, unitsByName]
  );

  /* ----- miniaturas: IDs de vistos + carrito + ventas ----- */
  const productIdsForThumbs = useMemo(() => {
    const ids = [];
    topProducts.forEach((p) => p.productId && ids.push(p.productId));
    cartAgg.slice(0, 10).forEach((c) => c.productId && ids.push(c.productId));
    salesRanking.forEach((p) => p.productId && ids.push(p.productId));
    return ids;
  }, [topProducts, cartAgg, salesRanking]);

  const { thumbs } = useProductThumbs(productIdsForThumbs);

  /* ----- filas de la columna "Más vistos" (con conversión) ----- */
  const viewItems = useMemo(() => {
    const maxViews = topProducts.reduce((m, p) => Math.max(m, p.total || 0), 0) || 1;
    return topProducts.map((p) => {
      const meta = (p.productId && thumbs[p.productId]) || {};
      const adds = p.productId ? cartAddsByProductId.get(p.productId) || 0 : 0;
      const sold = lookupUnitsSold(p);
      // Conversión vista->venta (acotada a 100% por seguridad ante ruido de datos).
      const convPct = p.total > 0 ? Math.min(100, Math.round((sold / p.total) * 100)) : 0;
      return {
        id: p.productId || p.name,
        name: p.name,
        sub: meta.category || p.category || null,
        image: meta.mainImage || null,
        value: p.total,
        pct: Math.max(4, Math.round(((p.total || 0) / maxViews) * 100)),
        adds,
        sold,
        convPct,
      };
    });
  }, [topProducts, thumbs, cartAddsByProductId, lookupUnitsSold]);

  /* ----- filas de la columna "Más vendidos" (ERP) ----- */
  const saleItems = useMemo(() => {
    const valueOf = (p) => (salesMetric === 'amount' ? p.amount || 0 : p.units || 0);
    const maxVal = salesRanking.reduce((m, p) => Math.max(m, valueOf(p)), 0) || 1;
    return salesRanking.map((p) => {
      const meta = (p.productId && thumbs[p.productId]) || {};
      const val = valueOf(p);
      // Sublínea: la métrica "secundaria" (si miramos unidades, mostramos monto y viceversa).
      const sub =
        salesMetric === 'amount'
          ? `${fmtInt(p.units || 0)} uds.`
          : fmtSoles(p.amount || 0);
      return {
        id: p.productId || p.name,
        name: p.name,
        sub: meta.category || sub,
        image: meta.mainImage || null,
        value: val,
        units: p.units || 0,
        amount: p.amount || 0,
        pct: Math.max(4, Math.round((val / maxVal) * 100)),
      };
    });
  }, [salesRanking, thumbs, salesMetric]);

  /* ----- resumen numérico de cada columna ----- */
  const viewsSummary = useMemo(() => {
    const totalViews = topProducts.reduce((acc, p) => acc + (p.total || 0), 0);
    const totalAdds = cartAgg.reduce((acc, c) => acc + (c.adds || 0), 0);
    return { totalViews, totalAdds, count: topProducts.length };
  }, [topProducts, cartAgg]);

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
            subtitle={`Vistos vs vendidos · últimos ${rangeDays} días`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        {/* ====================== COMPARACIÓN: VISTOS vs VENDIDOS ====================== */}
        <motion.div className={extra.compareGrid} variants={containerVariants}>
          {/* ---------- Columna IZQUIERDA: Más vistos ---------- */}
          <motion.div variants={itemVariants}>
            <GlassCard
              title={
                <span className={extra.colHead}>
                  <span className={`${extra.colIcon} ${extra.colIconViews}`} aria-hidden="true">
                    👀
                  </span>
                  <span className={extra.colHeadTexts}>
                    <span className={extra.colTitle}>Más vistos</span>
                    <span className={extra.colSubtitle}>Top por vistas de producto · web</span>
                  </span>
                </span>
              }
            >
              {/* Resumen numérico de la columna */}
              <div className={extra.colSummary}>
                <span className={extra.summaryChip}>
                  <span className={extra.summaryChipValue}>
                    <AnimatedNumber value={viewsSummary.totalViews} format={fmtInt} />
                  </span>
                  <span className={extra.summaryChipLabel}>Vistas (top 10)</span>
                </span>
                <span className={extra.summaryChip}>
                  <span className={extra.summaryChipValue}>
                    <AnimatedNumber value={viewsSummary.totalAdds} format={fmtInt} />
                  </span>
                  <span className={extra.summaryChipLabel}>Al carrito</span>
                </span>
              </div>

              {viewItems.length === 0 ? (
                <div className={extra.colEmpty}>
                  <span className={extra.colEmptyIcon} aria-hidden="true">👀</span>
                  Aún sin vistas de producto en este rango.
                </div>
              ) : (
                <Stagger as="ul" className={extra.rankList}>
                  {viewItems.map((it, i) => (
                    <StaggerItem as="li" key={it.id} className={extra.rankRow}>
                      <span
                        className={`${extra.rankNum} ${i < 3 ? extra.rankNumTopViews : ''}`}
                      >
                        {i + 1}
                      </span>
                      <span className={extra.thumb}>
                        {it.image ? (
                          <img
                            className={extra.thumbImg}
                            src={it.image}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className={extra.thumbFallback}>
                            {String(it.name || '?').trim()[0] || '?'}
                          </span>
                        )}
                      </span>
                      <span className={extra.rowMain}>
                        <span className={extra.rowName} title={it.name}>
                          {it.name}
                        </span>
                        {it.sub && <span className={extra.rowSub}>{it.sub}</span>}
                        <span className={extra.rowTrack} aria-hidden="true">
                          <span
                            className={`${extra.rowFill} ${extra.rowFillViews}`}
                            style={{ width: `${it.pct}%` }}
                          />
                        </span>
                        {/* Indicador de conversión vista -> venta (si hay ventas cruzadas) */}
                        <span
                          className={`${extra.convPill} ${it.sold > 0 ? '' : extra.convPillMuted}`}
                          title={
                            it.sold > 0
                              ? `${fmtInt(it.sold)} uds. vendidas de ${fmtInt(it.value)} vistas`
                              : 'Sin ventas cruzadas en el ERP para este rango'
                          }
                        >
                          {it.sold > 0 ? `⇄ ${it.convPct}% convierte` : '⇄ sin ventas'}
                        </span>
                      </span>
                      <span className={extra.rowValue}>
                        <span className={extra.rowValueNum}>{fmtInt(it.value)}</span>
                        <span className={extra.rowValueLabel}>vistas</span>
                      </span>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </GlassCard>
          </motion.div>

          {/* ---------- Columna DERECHA: Más vendidos (ERP) ---------- */}
          <motion.div variants={itemVariants}>
            <GlassCard
              title={
                <span className={extra.colHead}>
                  <span className={`${extra.colIcon} ${extra.colIconSales}`} aria-hidden="true">
                    🏆
                  </span>
                  <span className={extra.colHeadTexts}>
                    <span className={extra.colTitle}>Más vendidos</span>
                    <span className={extra.colSubtitle}>Top por ventas reales · ERP</span>
                  </span>
                </span>
              }
              actions={
                <div className={extra.toggle} role="tablist" aria-label="Métrica de ventas">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={salesMetric === 'units'}
                    className={`${extra.toggleBtn} ${salesMetric === 'units' ? extra.toggleBtnActive : ''}`}
                    onClick={() => setSalesMetric('units')}
                  >
                    Unidades
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={salesMetric === 'amount'}
                    className={`${extra.toggleBtn} ${salesMetric === 'amount' ? extra.toggleBtnActive : ''}`}
                    onClick={() => setSalesMetric('amount')}
                  >
                    Monto
                  </button>
                </div>
              }
            >
              {/* Resumen numérico de la columna (ingresos / unidades del periodo) */}
              <div className={extra.colSummary}>
                <span className={extra.summaryChip}>
                  <span className={extra.summaryChipValue}>
                    <AnimatedNumber value={salesData?.totalRevenue || 0} format={fmtSoles} />
                  </span>
                  <span className={extra.summaryChipLabel}>Ingresos</span>
                </span>
                <span className={extra.summaryChip}>
                  <span className={extra.summaryChipValue}>
                    <AnimatedNumber value={salesData?.totalUnits || 0} format={fmtInt} />
                  </span>
                  <span className={extra.summaryChipLabel}>Unidades</span>
                </span>
                <span className={extra.summaryChip}>
                  <span className={extra.summaryChipValue}>
                    <AnimatedNumber value={salesData?.totalOrders || 0} format={fmtInt} />
                  </span>
                  <span className={extra.summaryChipLabel}>Pedidos</span>
                </span>
              </div>

              {salesLoading ? (
                <div className={extra.skelList}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={extra.skelRow} />
                  ))}
                </div>
              ) : salesError ? (
                <div className={extra.colEmpty}>
                  <span className={extra.colEmptyIcon} aria-hidden="true">⚠️</span>
                  No se pudieron cargar las ventas del ERP.
                </div>
              ) : saleItems.length === 0 ? (
                <div className={extra.colEmpty}>
                  <span className={extra.colEmptyIcon} aria-hidden="true">🏆</span>
                  Sin ventas registradas en este periodo.
                </div>
              ) : (
                <Stagger as="ul" className={extra.rankList}>
                  {saleItems.map((it, i) => (
                    <StaggerItem as="li" key={it.id} className={extra.rankRow}>
                      <span
                        className={`${extra.rankNum} ${i < 3 ? extra.rankNumTopSales : ''}`}
                      >
                        {i + 1}
                      </span>
                      <span className={extra.thumb}>
                        {it.image ? (
                          <img
                            className={extra.thumbImg}
                            src={it.image}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className={extra.thumbFallback}>
                            {String(it.name || '?').trim()[0] || '?'}
                          </span>
                        )}
                      </span>
                      <span className={extra.rowMain}>
                        <span className={extra.rowName} title={it.name}>
                          {it.name}
                        </span>
                        {it.sub && <span className={extra.rowSub}>{it.sub}</span>}
                        <span className={extra.rowTrack} aria-hidden="true">
                          <span
                            className={`${extra.rowFill} ${extra.rowFillSales}`}
                            style={{ width: `${it.pct}%` }}
                          />
                        </span>
                      </span>
                      <span className={extra.rowValue}>
                        <span className={extra.rowValueNum}>
                          {salesMetric === 'amount' ? fmtSoles(it.amount) : fmtInt(it.units)}
                        </span>
                        <span className={extra.rowValueLabel}>
                          {salesMetric === 'amount' ? 'monto' : 'uds.'}
                        </span>
                      </span>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* Leyenda de lectura de la conversión */}
        <Reveal as="p" className={extra.convLegend}>
          <span className={extra.convLegendItem}>
            <span
              className={extra.convLegendSwatch}
              style={{ background: 'var(--primary-color, #6D28D9)' }}
              aria-hidden="true"
            />
            Vistas (analítica web)
          </span>
          <span className={extra.convLegendItem}>
            <span
              className={extra.convLegendSwatch}
              style={{ background: 'var(--verde-exito, #10B981)' }}
              aria-hidden="true"
            />
            Ventas (ERP)
          </span>
          <span className={extra.convLegendItem}>
            ⇄ La conversión cruza las vistas de cada producto con sus unidades vendidas en el mismo
            rango.
          </span>
        </Reveal>

        {/* ====================== DETALLE PROFUNDO DEL ERP (intacto) ====================== */}
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
