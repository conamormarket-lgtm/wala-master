import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../components/dashboard/GlassCard';
import Donut from '../../../components/dashboard/charts/Donut';
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
  useDateRange,
  useGlobalAnalytics,
} from './dashShared';
import styles from '../AdminDashboard.module.css';
import extra from './DashOrigen.extra.module.css';

/* =========================================================================
 * DashOrigen — sub-página de ORIGEN / TRÁFICO (versión "Aurora Violeta Serena")
 *   - KPIs de cabecera (sesiones en vivo, muestras de dispositivo, fuente y
 *     región líder) con número animado.
 *   - Dispositivos / Navegador / Sistema operativo: donuts del design system.
 *   - Fuentes UTM, campañas y regiones (utmStats / geographyStats) con barra
 *     de proporción.
 *   - Panel "En vivo" (sesiones activas en tiempo real).
 *   - Búsquedas más frecuentes (topSearches).
 *
 * Conserva intacto el comportamiento: el fetching compartido
 * (useGlobalAnalytics), el rango 7/30/90, el refresco manual y las rutas.
 * ========================================================================= */

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
  const { rangeDays, setRangeDays, dateRange } = useDateRange(30);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useGlobalAnalytics(dateRange);

  /* ----- donuts de dispositivo / navegador / OS (sin cambios de origen) ----- */
  const deviceItems = useMemo(
    () => (data?.deviceStats?.topDevices || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.deviceStats]
  );
  const browserItems = useMemo(
    () => (data?.deviceStats?.topBrowsers || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.deviceStats]
  );
  const osItems = useMemo(
    () => (data?.deviceStats?.topOS || []).map((d) => ({ name: d.name, value: d.count })),
    [data?.deviceStats]
  );

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
            subtitle={`Dispositivos, fuentes y regiones · últimos ${rangeDays} días`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        {/* KPIs de cabecera */}
        <Reveal className={extra.kpis}>
          <KpiRow items={kpiItems} />
        </Reveal>

        {/* Dispositivos / navegador / OS — donuts del design system */}
        <Reveal as="section" className={`${styles.grid3} ${extra.section}`}>
          <Reveal>
            <GlassCard title="Dispositivos" subtitle="Escritorio vs. móvil">
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
