import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../components/dashboard/GlassCard';
import KpiRow from '../../../components/dashboard/KpiRow';
import CompareBars from '../../../components/dashboard/charts/CompareBars';
import { Reveal } from '../../../components/ui';
import { deriveAppUsage } from '../../../services/analytics/derive';
import {
  CHART_COLORS,
  DashBackground,
  DashHeader,
  DashStates,
  containerVariants,
  itemVariants,
  fmtInt,
  fmtDuration,
  fmtTime,
  shortPath,
  prettyRouteName,
  useDashboardFilters,
  useDashboardAnalytics,
  segTAW,
} from './dashShared';
import styles from '../AdminDashboard.module.css';
import extra from './DashUso.module.css';

/* ============================================================================
 * DashUso — sub-página "Uso de la app".
 *
 * Reúne el pulso de uso real de la plataforma a partir de la MISMA query global
 * compartida (useGlobalAnalytics): totales de actividad, áreas más usadas,
 * ranking de rutas por visitas y por permanencia, y términos más buscados.
 *
 * Es ADITIVA y de SOLO LECTURA sobre los datos existentes: tolera campos
 * vacíos/undefined con optional chaining y fallbacks, y no altera el fetching,
 * los rangos ni el refresco manual. Mobile-first y respetuosa con
 * prefers-reduced-motion (los componentes ui/ y de dashboard ya lo gestionan).
 * ========================================================================== */

/* Lee el "total" de un contador que puede ser número plano u objeto {total,app,web}. */
function readTotal(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object') {
    if (value.total != null) return Number(value.total) || 0;
    return (Number(value.app) || 0) + (Number(value.web) || 0);
  }
  return Number(value) || 0;
}

/* Corte de origen SIN ceros engañosos (regla segTAW del contrato dashShared):
 * si el dato trae desglose {total,app,web} devuelve el corte pedido; si NO lo
 * trae (segTAW → null), cae al TOTAL y lo marca para el aviso honesto. */
function cortarPorOrigen(taw, origen) {
  const v = segTAW(taw, origen);
  if (v != null) return { value: v, sinDesglose: false };
  return { value: readTotal(taw), sinDesglose: origen !== 'todos' };
}

/* "YYYY-MM-DD" → "DD/MM/AAAA" legible (helper local: dashShared no exporta el suyo). */
function fmtDiaLegible(key) {
  const [y, m, d] = String(key || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/* Etiqueta corta y legible de una identidad anónima: la clave completa es
 * "anon_<timestamp>_<aleatorio>" (tracker.js randomId) → mostramos solo
 * "anon_" + los primeros 6 caracteres del sufijo aleatorio. */
function claveAnonCorta(clave) {
  const s = String(clave || '');
  const partes = s.split('_');
  const sufijo = partes[partes.length - 1] || s;
  return `anon_${sufijo.slice(0, 6)}`;
}

export default function DashUso() {
  /* Filtros compartidos del contrato (querystring): rango + comparación + origen. */
  const filtros = useDashboardFilters(30);
  const { rangeDays, setRangeDays, rangeLabel, origen, compare } = filtros;
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useDashboardAnalytics(filtros);

  /* ----- KPIs de uso, con el corte de ORIGEN aplicado (FIX auditoría) -----
   * Donde el dato trae desglose {total,app,web} se aplica segTAW; si no lo
   * trae, se muestra el TOTAL y el chip avisoOrigen lo dice (nunca ceros
   * engañosos — regla de honestidad del contrato dashShared). */
  const kSesiones = cortarPorOrigen(data?.totalSessions, origen);
  const kDwell = cortarPorOrigen(data?.avgDwellPerSessionMs, origen);
  const totalSessions = kSesiones.value;
  const avgDwellMs = kDwell.value;

  /* Scroll medio: el doc diario trae avgApp/avgWeb; si el corte pedido no
   * existe (camino legacy sin desglose), caemos al promedio total con aviso. */
  const scrollCorte = origen === 'app'
    ? data?.scrollDepth?.avgApp
    : origen === 'web' ? data?.scrollDepth?.avgWeb : null;
  const avgScroll = origen !== 'todos' && scrollCorte != null
    ? scrollCorte
    : (data?.scrollDepth?.avgTotal ?? 0);
  const scrollSinDesglose = origen !== 'todos' && scrollCorte == null;

  /* FIX auditoría: "Páginas vistas" con fuente COMPLETA, no la suma del top-10
   * de rutas (que subcontaba el total real del rango).
   *  - Pre-agregado (__source === 'analytics_daily'): data.pageViews ya es el
   *    contador {total,app,web} de TODO el rango.
   *  - Legacy (rangos pasados sin docs diarios): contamos los eventos page_view
   *    de eventsForCharts separando APP/WEB, el mismo patrón que trafficTotals
   *    en el hub AdminDashboard. */
  const pageViewsTAW = useMemo(() => {
    if (data?.__source === 'analytics_daily' && data?.pageViews != null) {
      return data.pageViews;
    }
    const acc = { total: 0, app: 0, web: 0 };
    (data?.eventsForCharts || []).forEach((e) => {
      if (e?.type !== 'page_view') return;
      acc.total += 1;
      if (e.clientType === 'APP') acc.app += 1;
      else acc.web += 1;
    });
    return acc;
  }, [data]);
  const kPageViews = cortarPorOrigen(pageViewsTAW, origen);
  const totalPageViews = kPageViews.value;

  const kpis = useMemo(
    () => [
      {
        label: 'Sesiones',
        value: totalSessions,
        format: fmtInt,
        accent: '#6D28D9',
        icon: '👥',
      },
      {
        label: 'Páginas vistas',
        value: totalPageViews,
        format: fmtInt,
        accent: '#8B5CF6',
        icon: '📄',
      },
      {
        label: 'Scroll medio',
        value: avgScroll,
        format: (n) => `${fmtInt(n)}%`,
        accent: '#10B981',
        icon: '📜',
      },
      {
        label: 'Tiempo medio / sesión',
        value: avgDwellMs,
        format: (n) => fmtDuration(n),
        accent: '#F59E0B',
        icon: '⏱️',
      },
    ],
    [totalSessions, totalPageViews, avgScroll, avgDwellMs]
  );

  /* ----- Top visitantes (topIdentities recombinado de los docs diarios) -----
   * El dueño quiere ver QUÉ PERSONA visita más: el lector pre-agregado
   * (combineDailyDocs) ya recombina el top-25 diario sumando views/dwell por
   * clave de identidad en el rango; aquí solo re-ordenamos defensivamente y
   * cortamos el top-10. El camino legacy (rangos pasados sin docs diarios) no
   * trae el campo → lista vacía y mensaje honesto, nunca ceros inventados. */
  const topVisitantes = useMemo(() => {
    const lista = Array.isArray(data?.topIdentities) ? data.topIdentities : [];
    return lista
      .filter((v) => v && v.clave != null)
      .slice()
      .sort((a, b) =>
        ((Number(b.views) || 0) - (Number(a.views) || 0)) ||
        ((Number(b.dwellMs) || 0) - (Number(a.dwellMs) || 0)))
      .slice(0, 10);
  }, [data?.topIdentities]);
  const maxVisitasTop = Number(topVisitantes[0]?.views) || 0;

  /* Cobertura del desglose en el rango (aviso honesto con fecha si hay días
   * cerrados sin topIdentities, anteriores al despliegue de la CF). */
  const cobertura = data?.extendedCoverage || null;
  const diasSinTop = cobertura
    ? Math.max(0, cobertura.closedDocs - cobertura.docsWithTopIdentities)
    : 0;

  /* ----- Áreas más usadas (CompareBars con deriveAppUsage) -----
   * Con el filtro de origen activo, cada ruta entra con el VALOR DEL CORTE
   * (o su total si la fila no trae desglose) para que el reparto lo respete. */
  const appUsage = useMemo(() => {
    const rutas = (data?.topRoutesByViews || []).map((r) => ({
      ...r,
      views: cortarPorOrigen(r?.views, origen).value,
    }));
    return deriveAppUsage(rutas);
  }, [data?.topRoutesByViews, origen]);

  /* ----- Uso de funciones (datos PRECISOS en vivo) -----
   * getGlobalAnalytics ahora expone featureUsage: [{ area, total }] con áreas
   * funcionales (editor, minijuegos, misiones, wishlist, búsqueda) contadas a
   * partir de eventos reales. Mapeamos las claves internas a etiquetas legibles.
   * Si viene vacío/undefined el bloque no se renderiza (aditivo, sin romper). */
  const FEATURE_LABELS = {
    editor: 'Editor de prendas',
    minijuegos: 'Minijuegos',
    misiones: 'Misiones',
    wishlist: 'Lista de deseos',
    busqueda: 'Búsqueda',
  };
  const featureUsage = useMemo(() => {
    const list = Array.isArray(data?.featureUsage) ? data.featureUsage : [];
    return list
      .map((f) => ({
        area: FEATURE_LABELS[f?.area] || f?.area || null,
        views: Number(f?.total) || 0,
      }))
      .filter((f) => f.area && f.views > 0)
      .sort((a, b) => b.views - a.views);
  }, [data?.featureUsage]);

  /* ----- Ranking: rutas más visitadas (corte de origen por fila) -----
   * Con el corte activo el orden por TOTAL puede cambiar y hay rutas sin
   * tráfico de ese origen: reordenamos por el valor del corte y ocultamos los
   * ceros. Si alguna fila no trae desglose, cae al total y se avisa. */
  const rutasVistas = useMemo(() => {
    let sinDesglose = false;
    const rows = (data?.topRoutesByViews || [])
      .map((r, i) => {
        const corte = cortarPorOrigen(r?.views, origen);
        if (corte.sinDesglose) sinDesglose = true;
        return {
          id: r?.path || `view-${i}`,
          name: prettyRouteName(r?.path),
          path: r?.path,
          value: corte.value,
        };
      })
      .filter((r) => origen === 'todos' || r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return { rows, sinDesglose };
  }, [data?.topRoutesByViews, origen]);
  const routesByViews = rutasVistas.rows;
  const maxViews = routesByViews[0]?.value || 0;

  /* ----- Ranking: rutas de mayor permanencia (mismo corte de origen) ----- */
  const rutasDwell = useMemo(() => {
    let sinDesglose = false;
    const rows = (data?.topRoutesByDwell || [])
      .map((r, i) => {
        const corte = cortarPorOrigen(r?.dwellMs, origen);
        if (corte.sinDesglose) sinDesglose = true;
        return {
          id: r?.path || `dwell-${i}`,
          name: prettyRouteName(r?.path),
          path: r?.path,
          value: corte.value,
        };
      })
      .filter((r) => origen === 'todos' || r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return { rows, sinDesglose };
  }, [data?.topRoutesByDwell, origen]);
  const routesByDwell = rutasDwell.rows;
  const maxDwell = routesByDwell[0]?.value || 0;

  /* ----- Top búsquedas ----- */
  const searches = useMemo(() => (data?.topSearches || []).slice(0, 15), [data?.topSearches]);

  /* ----- Aviso HONESTO del filtro de origen (mismo patrón que DashOrigen) -----
   * Chip visible bajo el header cuando origen !== 'todos': dice qué bloques
   * respetan el corte APP/WEB y cuáles siguen mostrando totales del rango. */
  const hayFallbackTotales =
    kSesiones.sinDesglose || kPageViews.sinDesglose || kDwell.sinDesglose ||
    scrollSinDesglose || rutasVistas.sinDesglose || rutasDwell.sinDesglose;
  const avisoOrigen = origen !== 'todos'
    ? `Filtro de origen "${origen === 'app' ? 'App' : 'Web'}" activo: los KPIs, las áreas y los rankings de rutas muestran SOLO ese corte cuando el dato trae desglose APP/WEB${
      hayFallbackTotales ? ' (parte de los datos de este rango no lo trae y muestra el TOTAL)' : ''
    }. Top visitantes, funciones y búsquedas no distinguen APP/WEB: muestran el total del rango.`
    : null;

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
            title="Uso de la app"
            subtitle={`Actividad, áreas y permanencia · ${rangeLabel}`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={lastUpdated}
          />
        </motion.div>

        {/* Chip honesto del filtro de origen (patrón avisoOrigen de DashOrigen). */}
        {avisoOrigen && (
          <motion.p variants={itemVariants} className={extra.avisoChip}>
            {avisoOrigen}
          </motion.p>
        )}

        <DashStates isLoading={isLoading} hasData={!!data} error={error} />

        {/* (1) KPIs de uso */}
        <motion.div variants={itemVariants}>
          <KpiRow items={kpis} />
        </motion.div>

        {/* (1b) Top visitantes — topIdentities recombinado de los docs diarios.
            Responde a "qué persona visita más": nombre/email si se logueó en el
            rango, o "Visitante anónimo (anon_xxxxxx)" si no, con badge y las
            advertencias honestas (identidades ≠ personas; días sin el desglose). */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Top visitantes"
            subtitle="Identidades con más páginas vistas en el rango"
          >
            {topVisitantes.length === 0 ? (
              <p className={styles.empty}>
                {!cobertura || diasSinTop > 0
                  ? 'Sin datos para este desglose en el rango elegido (días anteriores al despliegue de la captura de identidades).'
                  : 'Aún sin visitas registradas en este rango.'}
              </p>
            ) : (
              <ol className={extra.ranking}>
                {topVisitantes.map((v, i) => {
                  const esLogueado = Boolean(v.logueado);
                  const nombre = esLogueado
                    ? ((v.nombre && v.nombre !== 'anónimo') ? v.nombre : 'Cliente logueado')
                    : `Visitante anónimo (${claveAnonCorta(v.clave)})`;
                  const visitas = Number(v.views) || 0;
                  return (
                    <Reveal as="li" key={v.clave} delay={i * 0.04} className={extra.rankRow}>
                      <span className={extra.rankPos} data-top={i < 3 ? 'true' : undefined}>
                        {i + 1}
                      </span>
                      <span className={extra.rankInfo}>
                        <span className={extra.rankName}>{nombre}</span>
                        <span className={extra.rankSub}>
                          <span
                            className={`${styles.liveBadge} ${esLogueado ? styles.badgeUser : styles.badgeGuest}`}
                          >
                            {esLogueado ? 'Logueado' : 'Anónimo'}
                          </span>
                          {' '}· {fmtDuration(Number(v.dwellMs) || 0)} de permanencia
                        </span>
                        <span className={extra.rankBarTrack} aria-hidden="true">
                          <span
                            className={extra.rankBarFill}
                            style={{
                              width: `${maxVisitasTop > 0 ? Math.max(6, (visitas / maxVisitasTop) * 100) : 0}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </span>
                      </span>
                      <strong className={extra.rankValue}>{fmtInt(visitas)}</strong>
                    </Reveal>
                  );
                })}
              </ol>
            )}
            {/* Advertencias HONESTAS del desglose (siempre que haya datos). */}
            {topVisitantes.length > 0 && (
              <p
                style={{
                  margin: '0.65rem 0 0',
                  fontSize: '0.75rem',
                  lineHeight: 1.45,
                  color: 'var(--gris-texto-secundario, #64748b)',
                }}
              >
                Identidades ≠ personas exactas: la misma persona puede aparecer como
                logueada y anónima, o desde varios dispositivos/navegadores.
                {diasSinTop > 0 && (
                  ` · El rango incluye ${diasSinTop} día(s) sin este desglose` +
                  `${cobertura?.firstTopIdentitiesDay ? ` (sin datos antes del ${fmtDiaLegible(cobertura.firstTopIdentitiesDay)})` : ''}` +
                  ': los totales pueden estar incompletos.'
                )}
                {origen !== 'todos' && (
                  ' · Este desglose no distingue APP/WEB: se muestra el total del rango.'
                )}
                {compare && ' · La comparación de periodos (▲/▼) no aplica a este desglose.'}
              </p>
            )}
          </GlassCard>
        </motion.div>

        {/* (2) Áreas más usadas */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Áreas más usadas"
            subtitle="Reparto del tráfico por zona de la app"
          >
            <CompareBars
              data={appUsage}
              nameKey="area"
              valueKey="views"
              color="#6D28D9"
              max={10}
              formatValue={(v) => fmtInt(v)}
              emptyText="Aún no hay tráfico suficiente para repartir por áreas."
            />
          </GlassCard>
        </motion.div>

        {/* (2b) Uso de funciones (datos PRECISOS en vivo) — solo si hay datos.
            Complementa "Áreas más usadas" (por ruta) con la adopción real de
            funciones clave. Si featureUsage está vacío no se renderiza nada. */}
        {featureUsage.length > 0 && (
          <motion.div variants={itemVariants}>
            <GlassCard
              title="Uso de funciones"
              subtitle="Adopción de funciones clave · datos en vivo"
            >
              <CompareBars
                data={featureUsage}
                nameKey="area"
                valueKey="views"
                color="#8B5CF6"
                max={8}
                formatValue={(v) => fmtInt(v)}
                emptyText="Aún sin uso registrado de estas funciones."
              />
            </GlassCard>
          </motion.div>
        )}

        {/* (3) Rankings: rutas más visitadas + mayor permanencia */}
        <motion.div className={styles.grid2} variants={containerVariants}>
          <motion.div variants={itemVariants}>
            <GlassCard title="Rutas más visitadas" subtitle="Por número de páginas vistas">
              {routesByViews.length === 0 ? (
                <p className={styles.empty}>Sin rutas registradas aún.</p>
              ) : (
                <ol className={extra.ranking}>
                  {routesByViews.map((r, i) => (
                    <Reveal as="li" key={r.id} delay={i * 0.04} className={extra.rankRow}>
                      <span className={extra.rankPos} data-top={i < 3 ? 'true' : undefined}>
                        {i + 1}
                      </span>
                      <span className={extra.rankInfo}>
                        <span className={extra.rankName}>{r.name}</span>
                        <span className={extra.rankSub}>{shortPath(r.path)}</span>
                        <span className={extra.rankBarTrack} aria-hidden="true">
                          <span
                            className={extra.rankBarFill}
                            style={{
                              width: `${maxViews > 0 ? Math.max(6, (r.value / maxViews) * 100) : 0}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </span>
                      </span>
                      <strong className={extra.rankValue}>{fmtInt(r.value)}</strong>
                    </Reveal>
                  ))}
                </ol>
              )}
            </GlassCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <GlassCard title="Mayor permanencia" subtitle="Rutas donde más tiempo se pasa">
              {routesByDwell.length === 0 ? (
                <p className={styles.empty}>Sin tiempos de permanencia aún.</p>
              ) : (
                <ol className={extra.ranking}>
                  {routesByDwell.map((r, i) => (
                    <Reveal as="li" key={r.id} delay={i * 0.04} className={extra.rankRow}>
                      <span className={extra.rankPos} data-top={i < 3 ? 'true' : undefined}>
                        {i + 1}
                      </span>
                      <span className={extra.rankInfo}>
                        <span className={extra.rankName}>{r.name}</span>
                        <span className={extra.rankSub}>{shortPath(r.path)}</span>
                        <span className={extra.rankBarTrack} aria-hidden="true">
                          <span
                            className={extra.rankBarFill}
                            style={{
                              width: `${maxDwell > 0 ? Math.max(6, (r.value / maxDwell) * 100) : 0}%`,
                              background: CHART_COLORS[(i + 2) % CHART_COLORS.length],
                            }}
                          />
                        </span>
                      </span>
                      <strong className={extra.rankValue}>{fmtDuration(r.value)}</strong>
                    </Reveal>
                  ))}
                </ol>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* (4) Top búsquedas */}
        <motion.div variants={itemVariants}>
          <GlassCard title="Búsquedas más frecuentes" subtitle="Lo que tus visitantes intentan encontrar">
            {searches.length === 0 ? (
              <p className={styles.empty}>Sin búsquedas registradas aún.</p>
            ) : (
              <ul className={extra.chips}>
                {searches.map((s, i) => (
                  <Reveal
                    as="li"
                    key={s?.query || i}
                    delay={i * 0.03}
                    className={extra.chip}
                  >
                    <span className={extra.chipText}>{s?.query}</span>
                    <span className={extra.chipCount}>{fmtInt(s?.total)}</span>
                  </Reveal>
                ))}
              </ul>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
