import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import GlassCard from '../../components/dashboard/GlassCard';
import KpiRow from '../../components/dashboard/KpiRow';
import TrendChart from '../../components/dashboard/charts/TrendChart';
import { AuroraBackground, Reveal, Stagger, StaggerItem } from '../../components/ui';
import { deriveConversion } from '../../services/analytics/derive';
import {
  DashBackground,
  RangePicker,
  RefreshButton,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtDuration,
  fmtTime,
  shortPath,
  useDateRange,
  useGlobalAnalytics,
} from './dashboard/dashShared';
import styles from './AdminDashboard.module.css';
import extra from './AdminDashboard.extra.module.css';

/* ----------------------------------------------------------------------------
 * AdminDashboard — HUB "Resumen" del panel de analítica.
 *
 * Antes era una única página enorme. Ahora es un hub ligero:
 *   - fila de KPIs (de getGlobalAnalytics),
 *   - grid de tarjetas-botón que enlazan a cada sub-página dedicada
 *     (Mapa de calor, Productos, Origen/Tráfico, Páginas, Categorías/Tags),
 *   - panel "En vivo".
 *
 * Cada sub-página carga SOLO su parte. La query global se comparte por react-query
 * (mismo queryKey por rango), así que entrar a una sub-página con el mismo rango
 * reutiliza la caché y no dispara lecturas extra.
 * -------------------------------------------------------------------------- */

const NAV_CARDS = [
  {
    to: 'heatmap',
    icon: '🗺️',
    title: 'Mapa de calor',
    desc: 'Dónde hacen clic tus visitantes, página por página.',
  },
  {
    to: 'productos',
    icon: '📦',
    title: 'Productos',
    desc: 'Más vistos, agregados al carrito y los más vendidos del ERP.',
  },
  {
    to: 'origen',
    icon: '🌐',
    title: 'Origen y tráfico',
    desc: 'Dispositivos, navegador, fuentes UTM y regiones.',
  },
  {
    to: 'paginas',
    icon: '🧭',
    title: 'Páginas',
    desc: 'Tráfico por página, top rutas y búsquedas.',
  },
  {
    to: 'categorias',
    icon: '🏷️',
    title: 'Categorías y tags',
    desc: 'Líneas más vistas, etiquetas y embudo de conversión.',
  },
  {
    // Tarjeta NUEVA: enlaza a la sub-página de Uso de la app.
    to: 'uso',
    icon: '📱',
    title: 'Uso de la app',
    desc: 'Áreas más usadas, sesiones por dispositivo y permanencia.',
    accent: true,
  },
];

export default function AdminDashboard() {
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  // Segmentación del gráfico de tendencia: total / app / web.
  const [trafficMode, setTrafficMode] = useState('total');

  /* ----- serie temporal de page_views por día -----
     MISMO origen que DashPaginas (data.eventsForCharts → page_view por día):
     reutilizamos su construcción para alimentar tanto los sparklines de los
     KPIs como el gráfico grande de tendencia. Cada fila lleva `name` (DD/MM)
     para servir de eje X en TrendChart. */
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

  // ¿Hay tráfico desde la APP? Si no, ocultamos el segmento APP del toggle.
  const hasAppData = useMemo(
    () => trafficByDay.some((d) => d.app > 0) || (data?.totalEvents?.app || 0) > 0,
    [trafficByDay, data?.totalEvents]
  );

  // Totales del rango para el pie de la tarjeta de tendencia.
  const trafficTotals = useMemo(
    () =>
      trafficByDay.reduce(
        (acc, d) => ({
          total: acc.total + d.total,
          app: acc.app + d.app,
          web: acc.web + d.web,
        }),
        { total: 0, app: 0, web: 0 }
      ),
    [trafficByDay]
  );

  // Conversión del embudo (vista → compra) derivada de funnelStats.
  const conversion = useMemo(() => deriveConversion(data?.funnelStats), [data?.funnelStats]);

  // Serie de tendencia para TrendChart (una sola serie según el modo activo).
  const trendSeries = useMemo(
    () => [
      {
        key: trafficMode,
        name: trafficMode === 'total' ? 'Page views' : trafficMode.toUpperCase(),
        color: '#6D28D9',
      },
    ],
    [trafficMode]
  );

  const kpis = useMemo(
    () => [
      {
        label: 'Sesiones',
        value: data?.totalSessions?.total || 0,
        accent: '#6D28D9',
        sparkData: trafficByDay.map((d) => d.total),
      },
      {
        label: 'Identidades activas',
        value: data?.activeIdentities?.total || 0,
        accent: '#8B5CF6',
        sparkData: trafficByDay.map((d) => d.web),
      },
      {
        label: 'Page views',
        value: trafficTotals.total,
        accent: '#10B981',
        sparkData: trafficByDay.map((d) => d.total),
      },
      {
        label: 'Tiempo navegado',
        value: data?.totalDwellMs?.total || 0,
        format: fmtDuration,
        accent: '#F59E0B',
        sparkData: trafficByDay.map((d) => d.app + d.web),
      },
      {
        // KPI de conversión global (vista → compra) vía deriveConversion.
        label: 'Conversión',
        value: conversion?.global || 0,
        format: (v) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`,
        accent: '#EC4899',
      },
    ],
    [data, trafficByDay, trafficTotals, conversion]
  );

  const liveSessions = data?.realtimeSessionsDetails || [];
  const liveCount = data?.realtimeActiveSessions?.total || 0;
  const lastUpdated = dataUpdatedAt ? fmtTime(dataUpdatedAt) : null;

  return (
    <div className={styles.page}>
      {/* Atmósfera Aurora del sistema de diseño (decorativa, detrás de todo). */}
      <div className={extra.aurora} aria-hidden="true">
        <AuroraBackground />
      </div>
      <DashBackground />

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
              Resumen de los últimos {rangeDays} días
              {lastUpdated ? ` · actualizado ${lastUpdated}` : ''}
            </p>
          </div>
          <div className={styles.headerControls}>
            <RangePicker rangeDays={rangeDays} setRangeDays={setRangeDays} />
            <RefreshButton onClick={() => refetch()} isFetching={isFetching} />
          </div>
        </motion.header>

        {error && <div className={styles.errorBox}>Error al cargar datos: {error.message}</div>}
        {isLoading && !data && <div className={styles.loading}>Cargando analítica…</div>}

        {/* (1) Fila de KPIs (sistema de diseño: KpiRow con sparklines) */}
        <Reveal>
          <KpiRow items={kpis} />
        </Reveal>

        {/* (2) Gráfico grande de tendencia de tráfico.
             Reutiliza la MISMA serie temporal que DashPaginas (page_views por
             día). Si no hay datos, TrendChart muestra su propio estado vacío. */}
        <Reveal delay={0.05}>
          <section className={extra.trendCard}>
            <div className={extra.trendHead}>
              <div>
                <h2 className={extra.trendTitle}>Tráfico</h2>
                <p className={extra.trendSubtitle}>Page views por día · últimos {rangeDays} días</p>
              </div>
              <div className={extra.segment} role="group" aria-label="Segmentar tráfico">
                {/* SIEMPRE los 3 modos visibles (Total / Web / App), en ese orden.
                    App nunca se oculta: si no hay tráfico de APP, se muestra
                    deshabilitado (con título explicativo) en lugar de desaparecer,
                    para que el dueño vea siempre la opción. */}
                {['total', 'web', 'app'].map((m) => {
                  const isApp = m === 'app';
                  const disabled = isApp && !hasAppData;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${extra.segmentBtn} ${trafficMode === m ? extra.segmentActive : ''}`}
                      onClick={() => !disabled && setTrafficMode(m)}
                      aria-pressed={trafficMode === m}
                      disabled={disabled}
                      title={disabled ? 'Sin tráfico desde la APP en el rango' : undefined}
                    >
                      {m.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            <TrendChart
              data={trafficByDay}
              series={trendSeries}
              xKey="name"
              height={300}
              formatY={(v) => fmtInt(v)}
              emptyText="Sin tráfico en el rango seleccionado."
            />

            <div className={extra.trendFoot}>
              {/* Resumen numérico: SIEMPRE los 3 (Total / Web / App), igual que el
                  toggle. App se muestra en 0 aunque no haya tráfico de APP. */}
              <div className={extra.trendStat}>
                <span className={extra.trendStatLabel}>Total</span>
                <span className={extra.trendStatValue}>{fmtInt(trafficTotals.total)}</span>
              </div>
              <div className={extra.trendStat}>
                <span className={extra.trendStatLabel}>Web</span>
                <span className={extra.trendStatValue}>{fmtInt(trafficTotals.web)}</span>
              </div>
              <div className={extra.trendStat}>
                <span className={extra.trendStatLabel}>App</span>
                <span className={extra.trendStatValue}>{fmtInt(trafficTotals.app)}</span>
              </div>
            </div>
          </section>
        </Reveal>

        {/* (3) Grid de tarjetas-botón hacia cada sub-página (entrada escalonada) */}
        <Reveal delay={0.1}>
          <Stagger className={styles.navGrid}>
            {NAV_CARDS.map((c) => (
              <StaggerItem key={c.to}>
                <Link
                  to={c.to}
                  className={`${styles.navCard} ${c.accent ? extra.navCardAccent : ''}`}
                >
                  <span className={styles.highlight} aria-hidden="true" />
                  <span className={styles.navIcon} aria-hidden="true">{c.icon}</span>
                  <h3 className={styles.navCardTitle}>{c.title}</h3>
                  <p className={styles.navCardDesc}>{c.desc}</p>
                  <span className={styles.navArrow} aria-hidden="true">→</span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        {/* (3) Panel "En vivo" */}
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
                liveSessions.slice(0, 10).map((s) => (
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
      </motion.div>
    </div>
  );
}
