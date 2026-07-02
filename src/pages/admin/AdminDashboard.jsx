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
  OrigenPicker,
  MetricaPicker,
  CompareToggle,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtDuration,
  fmtTime,
  shortPath,
  useDashboardFilters,
  useDashboardAnalytics,
  segTAW,
  leerIdentidades,
  calcularDelta,
  calcularDeltaPuntos,
} from './dashboard/dashShared';
import BackfillAnaliticaButton from './dashboard/BackfillAnaliticaButton';
import RecepcionPedidos from './dashboard/RecepcionPedidos';
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
  {
    // Recepción de Pedidos: organización de ENVÍOS del portal (también embebida abajo).
    to: 'recepcion',
    icon: '📦',
    title: 'Recepción de pedidos',
    desc: 'Organiza los envíos del portal: dirección, cliente y estado.',
    accent: true,
  },
];

/* ---- Leyendas honestas de los KPIs (ⓘ): qué cuenta (y qué NO) cada número ---- */
const INFO_SESIONES =
  'Visitas a la tienda: se cuenta una por pestaña del navegador. ' +
  'Si la persona cierra y vuelve más tarde, cuenta como otra sesión.';
const INFO_IDENTIDADES =
  'Navegadores/dispositivos únicos: un ID guardado en el navegador, más tu cuenta ' +
  'si inicias sesión. Es un techo de personas, no personas exactas: la misma persona ' +
  'en 2 dispositivos cuenta 2 veces. "Logueados" = con email/cuenta.';
const INFO_LOGUEADOS =
  'Identidades que navegaron con sesión iniciada (email/cuenta) en el rango. ' +
  'Solo cuenta los días con la medición nueva de identidades.';
const INFO_CONVERSION =
  'Compras ÷ vistas (páginas vistas + permanencias) del rango. Con pocas compras ' +
  'frente a miles de vistas puede mostrarse 0% por redondeo a 1 decimal.';
// Nota de honestidad cuando un dato no trae el corte APP/WEB pedido.
const NOTA_SIN_DESGLOSE =
  'Este dato no tiene desglose APP/WEB en el rango seleccionado; se muestra el total.';
// Nota cuando se SUPRIME el delta ▲/▼ de una métrica NO ADITIVA: el periodo
// actual no viene del pre-agregado diario y los dos periodos contarían únicos
// con criterios distintos (únicos del rango vs. únicos por día sumados).
const NOTA_SIN_COMPARACION =
  'Comparación ▲/▼ no disponible para este rango: los dos periodos contarían únicos con criterios distintos.';

export default function AdminDashboard() {
  // Filtros globales compartidos (querystring): rango (presets + personalizado),
  // comparación con el periodo anterior, origen APP/WEB y métrica base.
  const filtros = useDashboardFilters(30);
  const {
    rangeDays, setRangeDays, customStart, customEnd, setCustomRange,
    dateRange, rangeLabel, compare, setCompare, prevRangeLabel,
    origen, setOrigen, metrica, setMetrica, filtersSearch,
  } = filtros;
  const {
    data, isLoading, isFetching, error, refetch, dataUpdatedAt,
    anterior, anteriorQuery,
  } = useDashboardAnalytics(filtros);

  // Clave del corte activo ('total' | 'app' | 'web') según el filtro de origen.
  const segKey = origen === 'todos' ? 'total' : origen;
  // ¿Hay datos comparables del periodo anterior? (honesto: sin docs diarios
  // previos NO se pintan deltas — nunca ceros engañosos).
  const hayAnterior = Boolean(compare && anterior && anterior.daysWithData > 0);
  // FIX auditoría (P2): las métricas NO ADITIVAS (identidades / logueados) solo
  // se comparan cuando el periodo ACTUAL viene del pre-agregado diario. Con un
  // rango personalizado que termina ANTES de hoy, el actual sale del legacy
  // (identidades ÚNICAS del rango completo) y el anterior de la suma de docs
  // diarios (únicos POR DÍA sumados): semánticas distintas → ▼ falsos. Las
  // aditivas (page views, tiempo navegado, sesiones) sí son comparables.
  const esPreAgregado = data?.__source === 'analytics_daily';
  const hayAnteriorNoAditivo = hayAnterior && esPreAgregado;

  // Segmentación del gráfico de tendencia: total / app / web. Si el filtro
  // GLOBAL de origen está activo, manda él (el toggle local queda fijado).
  const [trafficMode, setTrafficMode] = useState('total');
  const modoEfectivo = origen !== 'todos' ? origen : trafficMode;

  /* ----- serie temporal de page_views por día -----
     MISMO origen que DashPaginas (data.eventsForCharts → page_view por día):
     reutilizamos su construcción para alimentar tanto los sparklines de los
     KPIs como el gráfico grande de tendencia. Cada fila lleva `name` (DD/MM)
     para servir de eje X en TrendChart. */
  const trafficByDay = useMemo(() => {
    const events = data?.eventsForCharts || [];
    const byDay = new Map();
    // Pre-sembramos TODOS los días del rango con 0 para que el eje X muestre el
    // rango completo (y no un solo punto) aunque algún día no tenga eventos.
    // Los días se derivan de dateRange (no de un nº fijo): así el modo
    // "Personalizado" (incluidos rangos pasados) también pinta el eje entero.
    const cursor = new Date(dateRange.startDateMs);
    cursor.setHours(0, 0, 0, 0);
    let guard = 0; // tope defensivo; el rango ya viene acotado por el hook
    while (cursor.getTime() <= dateRange.endDateMs && guard < 400) {
      const key = `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      byDay.set(key, { name: key, total: 0, app: 0, web: 0, ts: cursor.getTime() });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    events.forEach((e) => {
      if (e.type !== 'page_view') return;
      const ts = e.clientTsMs || e.createdAt || 0;
      const d = new Date(typeof ts === 'object' && ts?.toMillis ? ts.toMillis() : ts);
      if (Number.isNaN(d.getTime())) return;
      const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byDay.has(key)) return; // evento fuera del rango pre-sembrado
      const row = byDay.get(key);
      row.total += 1;
      if (e.clientType === 'APP') row.app += 1;
      else row.web += 1;
    });
    return [...byDay.values()].sort((a, b) => a.ts - b.ts);
  }, [data?.eventsForCharts, dateRange]);

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

  // Conversión del embudo (vista → compra) derivada de funnelStats, con el
  // corte de origen aplicado (los contadores del embudo son {total,app,web}).
  // Si el corte no existe para el dato, se usa el total (sin ceros engañosos).
  const conversion = useMemo(() => {
    const fe = data?.funnelStats?.events || data?.funnelStats || {};
    const pick = (taw) => segTAW(taw, origen) ?? segTAW(taw, 'todos');
    return deriveConversion({
      views: pick(fe.views),
      adds: pick(fe.adds),
      checkouts: pick(fe.checkouts),
      purchases: pick(fe.purchases),
    });
  }, [data?.funnelStats, origen]);

  // Conversión del PERIODO ANTERIOR (solo con comparación activa y datos).
  const conversionAnterior = useMemo(() => {
    if (!hayAnterior) return null;
    const fe = anterior.funnelEvents || {};
    const pick = (taw) => segTAW(taw, origen) ?? segTAW(taw, 'todos');
    return deriveConversion({
      views: pick(fe.views),
      adds: pick(fe.adds),
      checkouts: pick(fe.checkouts),
      purchases: pick(fe.purchases),
    });
  }, [hayAnterior, anterior, origen]);

  // Serie de tendencia para TrendChart (una sola serie según el modo EFECTIVO:
  // el filtro global de origen manda sobre el toggle local del gráfico).
  const trendSeries = useMemo(
    () => [
      {
        key: modoEfectivo,
        name: modoEfectivo === 'total' ? 'Page views' : modoEfectivo.toUpperCase(),
        color: '#6D28D9',
      },
    ],
    [modoEfectivo]
  );

  const kpis = useMemo(() => {
    // Valor con el corte de origen aplicado, SIN ceros engañosos: si el dato no
    // trae desglose APP/WEB (segTAW → null), se muestra el TOTAL y la leyenda ⓘ
    // lo dice (regla de honestidad del panel).
    const conCorte = (taw, infoBase) => {
      const v = segTAW(taw, origen);
      if (v != null) return { value: v, info: infoBase || undefined };
      return {
        value: segTAW(taw, 'todos') || 0,
        info: infoBase ? `${infoBase} ${NOTA_SIN_DESGLOSE}` : NOTA_SIN_DESGLOSE,
      };
    };
    // Mismo corte para el periodo ANTERIOR (comparar manzanas con manzanas).
    const valorAnterior = (taw) => {
      if (!hayAnterior || taw == null) return null;
      const v = segTAW(taw, origen);
      return v != null ? v : segTAW(taw, 'todos');
    };
    // Delta ▲/▼ % (props delta/deltaPositive que KpiRow ya entiende); {} = sin delta.
    const conDelta = (valor, tawAnterior) =>
      (hayAnterior ? calcularDelta(valor, valorAnterior(tawAnterior)) : null) || {};
    // Delta para métricas NO ADITIVAS (identidades/logueados): exige además que
    // el periodo actual venga del pre-agregado (misma semántica de únicos que
    // el anterior); si no, se suprime el delta (ver NOTA_SIN_COMPARACION).
    const conDeltaNoAditivo = (valor, tawAnterior) =>
      (hayAnteriorNoAditivo ? calcularDelta(valor, valorAnterior(tawAnterior)) : null) || {};

    const spark = trafficByDay.map((d) => d[segKey]);

    // KPIs de conteo base; se intercambian según la métrica elegida.
    const kpiSesiones = () => {
      const c = conCorte(data?.totalSessions, INFO_SESIONES);
      return { label: 'Sesiones', ...c, ...conDelta(c.value, anterior?.sessions) };
    };
    const kpiIdentidades = () => {
      const c = conCorte(data?.activeIdentities, INFO_IDENTIDADES);
      // Delta suprimido para este rango: nota corta y honesta en la leyenda ⓘ.
      if (hayAnterior && !hayAnteriorNoAditivo) c.info = `${c.info} ${NOTA_SIN_COMPARACION}`;
      return { label: 'Identidades activas', ...c, ...conDeltaNoAditivo(c.value, anterior?.identities) };
    };
    const kpiLogueados = () => {
      const taw = leerIdentidades(data?.identities, 'logueados');
      if (!taw) {
        // HONESTO: el rango no trae este desglose (días previos al despliegue
        // de la medición de identidades) → "Sin datos", nunca un 0 engañoso.
        return {
          label: 'Solo logueados',
          value: 0,
          format: () => 'Sin datos',
          info:
            'Sin datos de este desglose en el rango elegido: los días previos al ' +
            'despliegue de la medición de identidades no lo registran.',
        };
      }
      const c = conCorte(taw, INFO_LOGUEADOS);
      // Igual que identidades: métrica NO aditiva → delta solo con pre-agregado.
      if (hayAnterior && !hayAnteriorNoAditivo) c.info = `${c.info} ${NOTA_SIN_COMPARACION}`;
      const tawPrev = leerIdentidades(anterior?.identitiesBreakdown, 'logueados');
      return { label: 'Solo logueados', ...c, ...conDeltaNoAditivo(c.value, tawPrev) };
    };

    // KPI principal según el conmutador de métrica base; el complementario
    // muestra el "otro" conteo para no duplicar tarjetas.
    const principal =
      metrica === 'identidades' ? kpiIdentidades()
        : metrica === 'logueados' ? kpiLogueados()
          : kpiSesiones();
    const complementario = metrica === 'sesiones' ? kpiIdentidades() : kpiSesiones();

    const tiempo = conCorte(data?.totalDwellMs, '');

    return [
      { ...principal, accent: '#6D28D9', sparkData: spark },
      { ...complementario, accent: '#8B5CF6', sparkData: spark },
      {
        label: 'Page views',
        value: trafficTotals[segKey] || 0,
        accent: '#10B981',
        sparkData: spark,
        ...conDelta(trafficTotals[segKey] || 0, anterior?.pageViews),
      },
      {
        label: 'Tiempo navegado',
        ...tiempo,
        format: fmtDuration,
        accent: '#F59E0B',
        sparkData: spark,
        ...conDelta(tiempo.value, anterior?.dwellMs),
      },
      {
        // KPI de conversión global (vista → compra) vía deriveConversion.
        // El delta va en PUNTOS porcentuales (pp), no "% de un %" (confuso).
        label: 'Conversión',
        value: conversion?.global || 0,
        format: (v) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`,
        accent: '#EC4899',
        info: INFO_CONVERSION,
        ...((hayAnterior && conversionAnterior
          ? calcularDeltaPuntos(conversion?.global ?? 0, conversionAnterior.global ?? 0)
          : null) || {}),
      },
    ];
  }, [
    data, trafficByDay, trafficTotals, conversion, conversionAnterior,
    origen, segKey, metrica, hayAnterior, hayAnteriorNoAditivo, anterior,
  ]);

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
        {/* Header + filtros globales (rango/comparar/origen/métrica) + actualizar */}
        <motion.header className={styles.header} variants={itemVariants}>
          <div>
            <h1 className={styles.title}>Panel de Analítica</h1>
            <p className={styles.subtitle}>
              Resumen · {rangeLabel}
              {origen !== 'todos' ? ` · solo ${origen.toUpperCase()}` : ''}
              {lastUpdated ? ` · actualizado ${lastUpdated}` : ''}
            </p>
            {compare && (
              /* Nota HONESTA de la comparación: contra qué periodo se compara y,
                 si faltan agregados diarios previos, que NO se pintan deltas. */
              <p
                style={{
                  margin: '0.35rem 0 0',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-muted, #64748b)',
                }}
              >
                {anteriorQuery?.isFetching
                  ? 'Cargando periodo anterior…'
                  : anteriorQuery?.error
                    ? 'No se pudo cargar el periodo anterior; los deltas ▲/▼ no se muestran.'
                    : hayAnterior
                      ? `Comparando con el periodo anterior (${prevRangeLabel})${
                        anterior.daysWithData < anterior.daysTotal
                          ? ` · solo ${anterior.daysWithData} de ${anterior.daysTotal} días con datos agregados`
                          : ''
                      }${esPreAgregado
                        ? ''
                        /* Métricas NO aditivas sin delta (periodo actual legacy):
                           nota corta y honesta, sin ▼ falsos. */
                        : ' · identidades/logueados sin ▲/▼: comparación no disponible para este rango'}`
                      : `Sin datos agregados del periodo anterior (${prevRangeLabel}): los deltas ▲/▼ no se muestran. Ese desglose diario existe solo desde el despliegue de la medición.`}
              </p>
            )}
          </div>
          <div className={styles.headerControls}>
            <RangePicker
              rangeDays={rangeDays}
              setRangeDays={setRangeDays}
              customStart={customStart}
              customEnd={customEnd}
              setCustomRange={setCustomRange}
            />
            <CompareToggle compare={compare} setCompare={setCompare} />
            <OrigenPicker origen={origen} setOrigen={setOrigen} />
            <MetricaPicker metrica={metrica} setMetrica={setMetrica} />
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
                <p className={extra.trendSubtitle}>Page views por día · {rangeLabel}</p>
              </div>
              <div className={extra.segment} role="group" aria-label="Segmentar tráfico">
                {/* SIEMPRE los 3 modos visibles (Total / Web / App), en ese orden.
                    App nunca se oculta: si no hay tráfico de APP, se muestra
                    deshabilitado (con título explicativo) en lugar de desaparecer,
                    para que el dueño vea siempre la opción. Si el filtro GLOBAL
                    de origen está activo, el toggle queda fijado a ese corte. */}
                {['total', 'web', 'app'].map((m) => {
                  const isApp = m === 'app';
                  const fijadoPorFiltro = origen !== 'todos' && m !== origen;
                  const disabled = (isApp && !hasAppData) || fijadoPorFiltro;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${extra.segmentBtn} ${modoEfectivo === m ? extra.segmentActive : ''}`}
                      onClick={() => !disabled && setTrafficMode(m)}
                      aria-pressed={modoEfectivo === m}
                      disabled={disabled}
                      title={fijadoPorFiltro
                        ? 'Fijado por el filtro global de origen (arriba)'
                        : disabled ? 'Sin tráfico desde la APP en el rango' : undefined}
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
                {/* El querystring de filtros viaja con el link: la sub-página
                    abre con el MISMO rango/comparación/origen (contrato
                    useDashboardFilters de dashShared). */}
                <Link
                  to={{ pathname: c.to, search: filtersSearch }}
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

        {/* (4) Administración: reconstruir el histórico de analítica diaria.
             Acción de admin (claim admin) que re-agrega analytics_events →
             analytics_daily vía la Cloud Function 'aggregateAnalyticsDailyBackfill'.
             No bloquea la página: su estado de carga/resultado vive en el componente. */}
        <motion.div variants={itemVariants}>
          <BackfillAnaliticaButton />
        </motion.div>

        {/* (5) Recepción de Pedidos — organización de ENVÍOS del portal WALA.
             SOLO-LECTURA (capa adminOrders.js → ERP pedidos_web/pedidos). Va al
             final, debajo de toda la analítica. También existe como ruta dedicada
             /admin/dashboard/recepcion, pero aquí queda embebida para que el admin
             la vea de inmediato. No toca carrito/precios/cobro. */}
        <motion.div variants={itemVariants}>
          <RecepcionPedidos embebido />
        </motion.div>
      </motion.div>
    </div>
  );
}
