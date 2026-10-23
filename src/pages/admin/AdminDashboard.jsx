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
  'Una visita es alguien que entra a la tienda y ve al menos una página. Varias pestañas ' +
  'o recargas del mismo dispositivo con menos de 30 min entre sí cuentan como UNA visita ' +
  '(como Google Analytics). No cuenta bots ni al equipo admin.';
const INFO_IDENTIDADES =
  'Personas aproximadas: dispositivos o navegadores distintos (y la cuenta, si inició ' +
  'sesión). La misma persona en el celular y en la computadora cuenta 2. "Con cuenta" = ' +
  'navegó con su sesión iniciada.';
const INFO_TIEMPO =
  'Suma del tiempo que las visitas pasan en cada página. Cada página cuenta hasta 30 min: ' +
  'una pestaña olvidada abierta no suma horas.';
const INFO_LOGUEADOS =
  'Identidades que navegaron con sesión iniciada (email/cuenta) en el rango. ' +
  'Solo cuenta los días con la medición nueva de identidades.';
const INFO_CONVERSION =
  'Pedidos enviados ÷ sesiones del rango (sin bots ni admin): de cada 100 visitas, ' +
  'cuántas terminan en un pedido. Un pedido cuenta al enviarse, aunque todavía esté pendiente de pago.';
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

  // Filtro por canal de origen (tabla "De dónde vienen las visitas").
  const [canal, setCanal] = useState('');
  const canalSel = canal ? (data?.canales || []).find((c) => c.canal === canal) || null : null;

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
      sessions: pick(data?.totalSessions),
    });
  }, [data?.funnelStats, data?.totalSessions, origen]);

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
      sessions: pick(anterior.sessions),
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
      return { label: 'Visitas', ...c, ...conDelta(c.value, anterior?.sessions) };
    };
    const kpiIdentidades = () => {
      // Personas únicas del rango (une los días); sin la medición nueva, la suma de días.
      const c = conCorte(data?.personas || data?.activeIdentities, INFO_IDENTIDADES);
      // Delta suprimido para este rango: nota corta y honesta en la leyenda ⓘ.
      if (hayAnterior && !hayAnteriorNoAditivo) c.info = `${c.info} ${NOTA_SIN_COMPARACION}`;
      return { label: 'Personas', ...c, ...conDeltaNoAditivo(c.value, anterior?.personas || anterior?.identities) };
    };
    const kpiLogueados = () => {
      const taw = leerIdentidades(data?.identities, 'logueados');
      if (!taw) {
        // HONESTO: el rango no trae este desglose (días previos al despliegue
        // de la medición de identidades) → "Sin datos", nunca un 0 engañoso.
        return {
          label: 'Con cuenta',
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
      return { label: 'Con cuenta', ...c, ...conDeltaNoAditivo(c.value, tawPrev) };
    };

    // KPI principal según el conmutador de métrica base; el complementario
    // muestra el "otro" conteo para no duplicar tarjetas.
    const principal =
      metrica === 'identidades' ? kpiIdentidades()
        : metrica === 'logueados' ? kpiLogueados()
          : kpiSesiones();
    const complementario = metrica === 'sesiones' ? kpiIdentidades() : kpiSesiones();

    const tiempo = conCorte(data?.totalDwellMs, INFO_TIEMPO);

    const base = [
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
        // KPI de conversión: pedidos ÷ sesiones reales (deriveConversion.porSesion).
        // El delta va en PUNTOS porcentuales (pp), no "% de un %" (confuso).
        label: 'Conversión',
        value: conversion?.porSesion || 0,
        format: (v) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`,
        accent: '#EC4899',
        info: `${INFO_CONVERSION} De quienes empiezan el checkout, el ${(conversion?.checkoutACompra || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}% envía el pedido.`,
        ...((hayAnterior && conversionAnterior
          ? calcularDeltaPuntos(conversion?.porSesion ?? 0, conversionAnterior.porSesion ?? 0)
          : null) || {}),
      },
    ];
    // Filtro por CANAL (de dónde vino la visita): Visitas, Page views, Tiempo y
    // Conversión pasan a ser solo de ese canal. Personas no tiene ese corte.
    if (!canalSel) return base;
    const nota = `Solo visitas de "${canalSel.canal}" (sin corte APP/WEB ni comparación).`;
    const soloCanal = (k, value, extraInfo = '') => {
      const { delta, deltaPositive, sparkData, ...resto } = k;
      return { ...resto, value, info: `${k.info || ''} ${nota}${extraInfo}`.trim() };
    };
    return base.map((k) => {
      if (k.label === 'Visitas') return soloCanal(k, canalSel.visitas);
      if (k.label === 'Page views') return soloCanal(k, canalSel.paginas);
      if (k.label === 'Tiempo navegado') return soloCanal(k, canalSel.dwellMs);
      if (k.label === 'Conversión') return soloCanal(k, canalSel.visitas ? Math.round((canalSel.pedidos / canalSel.visitas) * 1000) / 10 : 0);
      return { ...k, info: `${k.info || ''} Sin corte por canal: muestra todas.`.trim() };
    });
  }, [
    data, trafficByDay, trafficTotals, conversion, conversionAnterior,
    origen, segKey, metrica, hayAnterior, hayAnteriorNoAditivo, anterior, canalSel,
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
              {data?.actualizadoEnMs
                ? ` · datos al ${fmtTime(data.actualizadoEnMs)} (hoy se actualiza cada 30 min)`
                : (lastUpdated ? ` · actualizado ${lastUpdated}` : '')}
              {canalSel && (
                <>
                  {' · canal: '}<strong>{canalSel.canal}</strong>{' '}
                  <button type="button" className={extra.quitarFiltro} onClick={() => setCanal('')} aria-label="Quitar el filtro de canal">✕</button>
                </>
              )}
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

        <Reveal delay={0.03}>
          <div className={extra.dosColumnas}>
            <GlassCard
              title="De dónde vienen las visitas"
              subtitle="Toca un canal para ver los indicadores solo de ese canal"
            >
              {(data?.canales || []).length === 0 ? (
                <p className={extra.notaCanal}>Sin datos de canal en este rango (se mide desde el 23/10/2026).</p>
              ) : (
                <table className={extra.tablaCanales}>
                  <thead>
                    <tr><th>Canal</th><th>Visitas</th><th>Con interacción</th><th>Pedidos</th><th>Conversión</th></tr>
                  </thead>
                  <tbody>
                    {data.canales.map((c) => {
                      const total = data.visitas?.total?.total || 1;
                      const activo = canal === c.canal;
                      return (
                        <tr key={c.canal} className={activo ? extra.filaActiva : ''}>
                          <td>
                            <button type="button" className={extra.botonCanal} aria-pressed={activo} onClick={() => setCanal(activo ? '' : c.canal)}>
                              {c.canal}
                            </button>
                          </td>
                          <td>{fmtInt(c.visitas)} <span className={extra.pct}>{Math.round((c.visitas / total) * 100)}%</span></td>
                          <td>{c.visitas ? Math.round((c.conInteraccion / c.visitas) * 100) : 0}%</td>
                          <td>{fmtInt(c.pedidos)}</td>
                          <td>{c.visitas ? (Math.round((c.pedidos / c.visitas) * 1000) / 10).toLocaleString('es-PE') : 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className={extra.notaCanal}>
                <strong>Directo o sin dato:</strong> escribieron wala.pe, usaron un favorito o vinieron de una app que
                oculta el origen (Instagram y WhatsApp suelen hacerlo). Para saber de qué publicación vienen, comparte
                los enlaces con <code>?utm_source=instagram</code> (o tiktok, facebook, whatsapp).
              </p>
            </GlassCard>

            <GlassCard title="Calidad de los datos" subtitle="Qué se registró, qué se descartó y cómo se mide">
              {data?.calidad?.diasMedidos > 0 ? (
                <ul className={extra.listaCalidad}>
                  <li><span>Pestañas registradas</span><strong>{fmtInt(data.calidad.sesionesRegistradas)}</strong></li>
                  <li><span>− Bots (buscadores y navegadores automáticos)</span><strong>{fmtInt(data.calidad.sesionesBot)}</strong></li>
                  <li><span>− Equipo admin (panel y lo que navega en la tienda)</span><strong>{fmtInt(data.calidad.sesionesAdmin)}</strong></li>
                  <li><span>− Sin ninguna página vista</span><strong>{fmtInt(data.calidad.sinPaginas)}</strong></li>
                  <li><span>− Otra pestaña de la misma visita (menos de 30 min)</span><strong>{fmtInt(data.calidad.unidas)}</strong></li>
                  <li className={extra.totalCalidad}><span>= Visitas reales</span><strong>{fmtInt(data.visitas?.total?.total)}</strong></li>
                  <li><span>Visitas con interacción (2+ páginas, 10 s o un pedido)</span><strong>{data.visitas?.total?.total ? Math.round((data.visitas.conInteraccion.total / data.visitas.total.total) * 100) : 0}%</strong></li>
                </ul>
              ) : (
                <p className={extra.notaCanal}>Este rango es anterior a la medición nueva.</p>
              )}
              {data?.calidad?.diasMedidos > 0 && data.calidad.diasMedidos < (data?.extendedCoverage?.closedDocs || 0) && (
                <p className={extra.notaCanal}>Solo {data.calidad.diasMedidos} días del rango tienen la medición nueva.</p>
              )}
              <p className={extra.notaCanal}>
                Fuente: los eventos que registra la tienda (web y app). Cada día se suma de madrugada y el día de hoy
                cada 30 minutos, con las mismas reglas. Un pedido cuenta al enviarse, aunque esté pendiente de pago.
              </p>
            </GlassCard>
          </div>
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
