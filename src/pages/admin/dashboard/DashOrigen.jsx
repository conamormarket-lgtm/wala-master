import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../components/dashboard/GlassCard';
import Donut from '../../../components/dashboard/charts/Donut';
import CompareBars from '../../../components/dashboard/charts/CompareBars';
import KpiRow from '../../../components/dashboard/KpiRow';
import { Reveal } from '../../../components/ui';
import { chartColors } from '../../../theme';
import {
  DashBackground,
  DashHeader,
  DashStates,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtTime,
  shortPath,
  useDashboardFilters,
  useDashboardAnalytics,
  OrigenPicker,
  CompareToggle,
  calcularDelta,
} from './dashShared';
import styles from '../AdminDashboard.module.css';
import extra from './DashOrigen.extra.module.css';

/* =========================================================================
 * DashOrigen — sub-página de ORIGEN / TRÁFICO (versión "Aurora Violeta Serena")
 *   - KPIs de cabecera (sesiones en vivo, muestras de dispositivo, fuente y
 *     región líder) con número animado.
 *   - Dispositivos / Navegador / Sistema operativo: donuts del design system,
 *     ahora alimentados por los campos NUEVOS del doc diario (byDevice con
 *     Tablet, byBrowser, byOS) con fallback automático al parseo de UA legacy.
 *   - NUEVO (P1): País real por IP (byCountry) con la serie APARTE aproximada
 *     por zona horaria (byCountryAprox, días históricos) y App vs Web
 *     (byClientType), con avisos HONESTOS cuando el rango incluye días previos
 *     al despliegue de la captura.
 *   - Fuentes UTM, campañas y regiones (utmStats / geographyStats) con barra
 *     de proporción.
 *   - Panel "En vivo" (sesiones activas en tiempo real).
 *   - Búsquedas más frecuentes (topSearches).
 *
 * Usa el CONTRATO de filtros compartidos (useDashboardFilters +
 * useDashboardAnalytics): rango 7/30/90/personalizado, comparación con el
 * periodo anterior y filtro de origen APP/WEB, todo en el querystring.
 * ========================================================================= */

/* "YYYY-MM-DD" → "DD/MM/AAAA" legible (helper local: dashShared no exporta el
 * suyo y esta capa no debe modificarlo). */
function fmtDiaLegible(key) {
  const [y, m, d] = String(key || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/* Nombre legible de país en español desde su código ISO-2 (Intl.DisplayNames),
 * respetando las claves especiales del doc diario ("unknown"/"otros"). Si el
 * doc ya trae un nombre distinto del código, se respeta. */
function nombreDePais(code, nombreGuardado) {
  const c = String(code || '').toUpperCase();
  if (!c || c === 'UNKNOWN') return 'Sin identificar';
  if (c === 'OTROS') return 'Otros';
  if (nombreGuardado && nombreGuardado !== code) return nombreGuardado;
  try {
    const dn = new Intl.DisplayNames(['es'], { type: 'region' });
    const nombre = dn.of(c);
    if (nombre && nombre !== c) return nombre;
  } catch {
    /* código no ISO o Intl sin soporte: caemos al código tal cual */
  }
  return c;
}

/**
 * BloqueDona — envoltura fina sobre el <Donut> del sistema para reutilizar el
 * mismo encabezado con acento, el total al centro y un pie informativo. Recibe
 * items {name, value} ya preparados por el consumidor; tolera datos vacíos.
 */
function BloqueDona({ titulo, accent, items, emptyText, caption }) {
  // Solo segmentos con valor positivo cuentan para el total del centro.
  const total = (items || []).reduce(
    (acc, d) => acc + (Number(d?.value) > 0 ? Number(d.value) : 0),
    0
  );

  return (
    <div>
      <div className={extra.blockHead} style={{ color: accent }}>
        <span className={extra.blockDot} aria-hidden="true" />
        <h4 className={extra.blockTitle}>{titulo}</h4>
      </div>
      <Donut
        data={items}
        colors={chartColors}
        height={210}
        centerLabel="Muestras"
        centerValue={total}
        formatValue={(n) => fmtInt(n)}
        emptyText={emptyText}
      />
      {total > 0 && caption && <p className={extra.donutCaption}>{caption}</p>}
    </div>
  );
}

/**
 * ListaProporcion — lista compacta con nombre, valor y barra de proporción
 * (relativa al valor máximo de la propia lista). Cae a un chip vacío sereno.
 */
function ListaProporcion({ items, accent, emptyText }) {
  const lista = Array.isArray(items) ? items : [];
  if (!lista.length) {
    return <p className={extra.emptyChip}>{emptyText}</p>;
  }
  const max = Math.max(...lista.map((d) => Number(d.value) || 0), 1);
  return (
    <ul className={extra.propList}>
      {lista.map((d) => {
        const valor = Number(d.value) || 0;
        const pct = Math.max(6, Math.round((valor / max) * 100));
        return (
          <li key={d.key} className={extra.propItem}>
            <span className={extra.propName}>{d.name}</span>
            <strong className={extra.propValue}>{fmtInt(valor)}</strong>
            <span className={extra.propTrack} aria-hidden="true">
              <span
                className={extra.propFill}
                style={{ width: `${pct}%`, background: accent }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashOrigen() {
  /* Filtros compartidos del panel (querystring): rango + comparación + origen. */
  const filtros = useDashboardFilters(30);
  const {
    rangeDays, setRangeDays, rangeLabel,
    origen, setOrigen, compare, setCompare, prevRangeLabel,
  } = filtros;
  const {
    data, anterior, isLoading, isFetching, error, refetch, dataUpdatedAt,
  } = useDashboardAnalytics(filtros);

  /* ----- donuts de dispositivo / navegador / OS -----
   * Fuente NUEVA (P1): byDevice/byBrowser/byOS del doc diario (incluye Tablet).
   * ensureExtendedAnalytics ya garantiza el fallback al parseo de UA legacy
   * (deviceStats.top*) cuando el rango solo tiene docs viejos. */
  const deviceItems = useMemo(
    () => (data?.byDevice || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.byDevice]
  );
  const browserItems = useMemo(
    () => (data?.byBrowser || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.byBrowser]
  );
  const osItems = useMemo(
    () => (data?.byOS || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.byOS]
  );

  /* ----- desgloses NUEVOS: país por IP, aproximado por timezone y App/Web ----- */
  const countryItems = useMemo(
    () => (data?.byCountry || []).map((c) => ({
      name: nombreDePais(c.code, c.name),
      value: Number(c.count) || 0,
    })),
    [data?.byCountry]
  );
  const countryAproxItems = useMemo(
    () => (data?.byCountryAprox || []).map((c) => ({
      name: nombreDePais(c.code, c.name),
      value: Number(c.count) || 0,
    })),
    [data?.byCountryAprox]
  );
  const clientTypeItems = useMemo(
    () => (data?.byClientType || []).map((c) => ({
      name: c.name === 'APP' ? 'App (instalada)' : 'Web (navegador)',
      value: Number(c.count) || 0,
    })),
    [data?.byClientType]
  );

  /* ----- avisos HONESTOS -----
   * Cobertura de los campos nuevos dentro del rango: si hay días cerrados sin
   * el desglose (anteriores al despliegue de la CF), se dice con fecha; nunca
   * se muestran ceros engañosos. El camino legacy no trae cobertura → los
   * arrays vacíos ya caen al emptyText honesto de cada chart. */
  const cobertura = data?.extendedCoverage || null;
  const diasSinDesglose = cobertura
    ? Math.max(0, cobertura.closedDocs - cobertura.docsWithBreakdowns)
    : 0;
  const avisoDesglosesViejos = cobertura && diasSinDesglose > 0
    ? (cobertura.firstBreakdownDay
      ? `Sin datos para este desglose antes del ${fmtDiaLegible(cobertura.firstBreakdownDay)} (despliegue de la captura): ${diasSinDesglose} día(s) del rango no lo incluyen.`
      : `Sin datos para este desglose en ${diasSinDesglose} día(s) del rango (anteriores al despliegue de la captura).`)
    : null;

  /* Filtro de origen: estos desgloses de sesión NO segmentan APP/WEB (son
   * conteos simples por clave) → con el filtro activo se muestra el TOTAL con
   * nota, en vez de un 0 engañoso (regla de honestidad del contrato, segTAW=null). */
  const avisoOrigen = origen !== 'todos'
    ? `Filtro de origen "${origen === 'app' ? 'App' : 'Web'}" activo: estos desgloses no distinguen APP/WEB por separado, se muestra el TOTAL del rango. El corte App/Web vive en la tarjeta "App vs Web".`
    : null;

  /* Comparación: el resumen del periodo anterior solo trae KPIs segmentados
   * (sessions TAW) → aplicamos ▲/▼ donde ES posible (App vs Web) y lo decimos
   * honestamente donde no. */
  const deltasClientType = useMemo(() => {
    if (!compare || !anterior) return null;
    if (!anterior.daysWithData) return { sinDatos: true };
    const buscar = (nombre) => (data?.byClientType || [])
      .find((c) => c.name === nombre)?.count ?? 0;
    return {
      sinDatos: false,
      app: calcularDelta(buscar('APP'), anterior.sessions?.app),
      web: calcularDelta(buscar('WEB'), anterior.sessions?.web),
    };
  }, [compare, anterior, data?.byClientType]);

  /* ----- listas de origen / geografía / búsquedas (mismas fuentes) ----- */
  const utmSources = useMemo(
    () =>
      (data?.utmStats?.topSources || []).slice(0, 6).map((s) => ({
        key: s.name,
        name: s.name,
        value: s.value,
      })),
    [data?.utmStats]
  );
  const utmCampaigns = useMemo(
    () =>
      (data?.utmStats?.topCampaigns || []).slice(0, 5).map((c) => ({
        key: c.name,
        name: c.name,
        value: c.count,
      })),
    [data?.utmStats]
  );
  const regions = useMemo(
    () =>
      (data?.geographyStats?.topRegions || []).slice(0, 6).map((r) => ({
        key: r.name,
        name: r.name,
        value: r.count,
      })),
    [data?.geographyStats]
  );
  const searches = useMemo(
    () =>
      (data?.topSearches || []).slice(0, 12).map((s) => ({
        key: s.query,
        name: s.query,
        value: s.total,
      })),
    [data?.topSearches]
  );

  const liveSessions = data?.realtimeSessionsDetails || [];
  const liveCount = data?.realtimeActiveSessions?.total || 0;
  const lastUpdated = dataUpdatedAt ? fmtTime(dataUpdatedAt) : null;

  /* ----- KPIs de cabecera derivados de los mismos datos ----- */
  const totalDeviceSamples = useMemo(
    () => deviceItems.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    [deviceItems]
  );
  const topSource = utmSources[0] || null;
  const topRegion = regions[0] || null;

  const kpiItems = useMemo(
    () => [
      {
        label: 'Sesiones en vivo',
        value: liveCount,
        format: fmtInt,
        accent: '#10B981',
        icon: '🟢',
      },
      {
        label: 'Muestras de dispositivo',
        value: totalDeviceSamples,
        format: fmtInt,
        accent: '#6D28D9',
        icon: '🖥️',
      },
      {
        label: topSource ? `Fuente líder · ${topSource.name}` : 'Fuente líder',
        value: topSource ? topSource.value : 0,
        format: fmtInt,
        accent: '#8B5CF6',
        icon: '🌐',
      },
      {
        label: topRegion ? `Región líder · ${topRegion.name}` : 'Región líder',
        value: topRegion ? topRegion.value : 0,
        format: fmtInt,
        accent: '#F59E0B',
        icon: '📍',
      },
    ],
    [liveCount, totalDeviceSamples, topSource, topRegion]
  );

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
            title="Origen y tráfico"
            subtitle={`Dispositivos, países, fuentes y regiones · ${rangeLabel}`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        {/* Filtros compartidos del contrato: origen APP/WEB + comparación. */}
        <motion.div
          variants={itemVariants}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}
        >
          <OrigenPicker origen={origen} setOrigen={setOrigen} />
          <CompareToggle compare={compare} setCompare={setCompare} />
        </motion.div>
        {avisoOrigen && (
          <motion.p
            variants={itemVariants}
            className={extra.emptyChip}
            style={{ marginBottom: '0.85rem' }}
          >
            {avisoOrigen}
          </motion.p>
        )}

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        {/* KPIs de cabecera */}
        <Reveal className={extra.kpis}>
          <KpiRow items={kpiItems} />
        </Reveal>

        {/* Dispositivos / navegador / OS — donuts del design system,
            fuente nueva byDevice/byBrowser/byOS (con fallback legacy) */}
        <Reveal as="section" className={`${styles.grid3} ${extra.section}`}>
          <Reveal>
            <GlassCard title="Dispositivos" subtitle="Escritorio, móvil y tablet">
              <BloqueDona
                titulo="Tipo de dispositivo"
                accent={chartColors[0]}
                items={deviceItems}
                emptyText="Sin datos de dispositivo aún."
                caption="Distribución de sesiones por tipo de dispositivo."
              />
            </GlassCard>
          </Reveal>
          <Reveal delay={0.05}>
            <GlassCard title="Navegador" subtitle="Navegadores más usados">
              <BloqueDona
                titulo="Navegador"
                accent={chartColors[1]}
                items={browserItems}
                emptyText="Sin datos de navegador aún."
                caption="Reparto de sesiones por navegador."
              />
            </GlassCard>
          </Reveal>
          <Reveal delay={0.1}>
            <GlassCard title="Sistema operativo" subtitle="Plataformas de tus visitantes">
              <BloqueDona
                titulo="Sistema operativo"
                accent={chartColors[2]}
                items={osItems}
                emptyText="Sin datos de sistema operativo aún."
                caption="Plataformas desde las que navegan tus visitantes."
              />
            </GlassCard>
          </Reveal>
        </Reveal>

        {/* NUEVO (P1): país real por IP + App vs Web (campos nuevos del doc diario) */}
        <Reveal as="section" className={`${styles.grid2} ${extra.section}`}>
          <Reveal>
            <GlassCard title="País de tus visitantes" subtitle="Geolocalización por IP de la sesión">
              <div className={extra.blockHead} style={{ color: chartColors[4] }}>
                <span className={extra.blockDot} aria-hidden="true" />
                <h4 className={extra.blockTitle}>País (geo confiable por IP)</h4>
              </div>
              <CompareBars
                data={countryItems}
                nameKey="name"
                valueKey="value"
                color={chartColors[4]}
                max={8}
                formatValue={(v) => fmtInt(v)}
                emptyText="Sin datos para este desglose antes del despliegue de la captura."
              />
              {countryItems.length > 0 && avisoDesglosesViejos && (
                <p className={extra.donutCaption}>{avisoDesglosesViejos}</p>
              )}

              {/* Serie APARTE: aproximación por zona horaria (días históricos sin geo) */}
              <div className={extra.blockHead} style={{ color: chartColors[6] }}>
                <span className={extra.blockDot} aria-hidden="true" />
                <h4 className={extra.blockTitle}>Aproximado por zona horaria (histórico)</h4>
              </div>
              <CompareBars
                data={countryAproxItems}
                nameKey="name"
                valueKey="value"
                color={chartColors[6]}
                max={8}
                formatValue={(v) => fmtInt(v)}
                emptyText="Sin sesiones históricas que aproximar en este rango."
              />
              {countryAproxItems.length > 0 && (
                <p className={extra.donutCaption}>
                  Serie aparte para sesiones antiguas SIN geolocalización por IP: el país
                  se aproxima por la zona horaria del navegador (menos fiable, no se mezcla
                  con la serie confiable).
                </p>
              )}
            </GlassCard>
          </Reveal>

          <Reveal delay={0.05}>
            <GlassCard title="App vs Web" subtitle="Sesiones por tipo de cliente">
              <BloqueDona
                titulo="Tipo de cliente"
                accent={chartColors[3]}
                items={clientTypeItems}
                emptyText="Sin datos de sesiones para este rango."
                caption="Sesiones según lleguen desde la app instalada o el navegador."
              />
              {deltasClientType?.sinDatos && (
                <p className={extra.emptyChip} style={{ marginTop: '0.6rem' }}>
                  Sin datos del periodo anterior ({prevRangeLabel}) para comparar.
                </p>
              )}
              {deltasClientType && !deltasClientType.sinDatos && (
                <p className={extra.donutCaption}>
                  Vs. periodo anterior ({prevRangeLabel}): App{' '}
                  {deltasClientType.app ? deltasClientType.app.delta : 'sin dato'} · Web{' '}
                  {deltasClientType.web ? deltasClientType.web.delta : 'sin dato'}
                </p>
              )}
            </GlassCard>
          </Reveal>
        </Reveal>

        {/* UTM / regiones / en vivo */}
        <Reveal as="section" className={`${styles.grid3} ${extra.section}`}>
          <Reveal>
            <GlassCard title="Origen y región" subtitle="Fuentes UTM y geografía">
              <div className={extra.blockHead} style={{ color: chartColors[0] }}>
                <span className={extra.blockDot} aria-hidden="true" />
                <h4 className={extra.blockTitle}>Fuentes de tráfico</h4>
              </div>
              <ListaProporcion
                items={utmSources}
                accent={chartColors[0]}
                emptyText="Solo tráfico directo."
              />

              <div className={extra.blockHead} style={{ color: chartColors[1] }}>
                <span className={extra.blockDot} aria-hidden="true" />
                <h4 className={extra.blockTitle}>Campañas</h4>
              </div>
              <ListaProporcion
                items={utmCampaigns}
                accent={chartColors[1]}
                emptyText="Sin campañas UTM registradas."
              />

              <div className={extra.blockHead} style={{ color: chartColors[6] }}>
                <span className={extra.blockDot} aria-hidden="true" />
                <h4 className={extra.blockTitle}>Regiones</h4>
              </div>
              <ListaProporcion
                items={regions}
                accent={chartColors[6]}
                emptyText="Sin datos regionales aún."
              />
            </GlassCard>
          </Reveal>

          <Reveal delay={0.05}>
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
                  liveSessions.slice(0, 12).map((s) => (
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
          </Reveal>

          <Reveal delay={0.1}>
            <GlassCard title="Búsquedas" subtitle="Términos más buscados">
              <ListaProporcion
                items={searches}
                accent={chartColors[1]}
                emptyText="Sin búsquedas registradas aún."
              />
            </GlassCard>
          </Reveal>
        </Reveal>
      </motion.div>
    </div>
  );
}
