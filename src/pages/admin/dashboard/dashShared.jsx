import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getGlobalAnalytics, getRealtimeBlock } from '../../../services/adminAnalytics';
import { getAnalyticsDailyRange } from '../../../services/analyticsDaily';
import { AuroraBackground, GlassButton } from '../../../components/ui';
import styles from '../AdminDashboard.module.css';
import extra from './dashShared.extra.module.css';

/* ============================================================================
 * dashShared — utilidades compartidas por el HUB y las sub-páginas del panel.
 *
 * Centraliza: formateadores, helpers de ruta, selector de rango (7/30/90),
 * el hook de datos globales (react-query, refresco SOLO manual, staleTime alto)
 * y un header reutilizable con título + botón "← Volver al resumen".
 *
 * Cada sub-página carga SOLO su parte de la UI, pero todas comparten la MISMA
 * query global cacheada por react-query (mismo queryKey por rango), de modo que
 * navegar entre sub-páginas no dispara lecturas extra mientras los datos estén
 * frescos.
 * ========================================================================== */

/* ------------------------------ formateadores ------------------------------ */

export const fmtInt = (v) => new Intl.NumberFormat('es-PE').format(Math.round(Number(v) || 0));

export function fmtDuration(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function shortPath(path) {
  if (!path) return '/';
  return path.length > 26 ? `…${path.slice(-25)}` : path;
}

/* Convierte una ruta en un nombre legible para humanos. */
export function prettyRouteName(path) {
  if (!path || path === '/') return 'Inicio';
  const clean = path.split('?')[0].replace(/\/+$/, '');
  const segs = clean.split('/').filter(Boolean);
  if (!segs.length) return 'Inicio';
  const map = {
    tienda: 'Tienda',
    producto: 'Producto',
    productos: 'Productos',
    categoria: 'Categoría',
    categorias: 'Categorías',
    coleccion: 'Colección',
    colecciones: 'Colecciones',
    checkout: 'Checkout',
    carrito: 'Carrito',
    cuenta: 'Mi cuenta',
    wishlist: 'Lista de deseos',
    editor: 'Editor',
    ofertas: 'Ofertas',
    buscar: 'Búsqueda',
  };
  const titled = segs.map((s) => {
    if (map[s]) return map[s];
    const decoded = decodeURIComponent(s).replace(/[-_]/g, ' ');
    return decoded.charAt(0).toUpperCase() + decoded.slice(1);
  });
  if (titled.length === 1) return titled[0];
  return `${titled[0]} · ${titled[titled.length - 1]}`;
}

export const ADD_TO_CART = 'add_to_cart';

export const CHART_COLORS = ['#6D28D9', '#8B5CF6', '#A78BFA', '#C4B5FD', '#10B981', '#34D399', '#F59E0B'];

/* ------------------------------ tooltip glass ------------------------------ */

export function GlassTooltip({ active, payload, label, suffix = '', formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={styles.tooltip}>
      {label != null && <div className={styles.tooltipLabel}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color || p.fill }} />
          <span className={styles.tooltipName}>{p.name}</span>
          <strong>
            {formatter ? formatter(p.value) : fmtInt(p.value)}
            {suffix}
          </strong>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ animaciones ------------------------------ */

export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ------------------------------ rango de fechas ------------------------------ */

export const RANGES = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

/**
 * useDateRange — calcula {startDateMs, endDateMs} a partir de un nº de días.
 * Devuelve también [rangeDays, setRangeDays] para enlazar al selector.
 */
export function useDateRange(initialDays = 30) {
  const [rangeDays, setRangeDays] = useState(initialDays);
  const dateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - rangeDays);
    start.setHours(0, 0, 0, 0);
    return { startDateMs: start.getTime(), endDateMs: end.getTime() };
  }, [rangeDays]);
  return { rangeDays, setRangeDays, dateRange };
}

// Campos del bloque "en vivo" que produce computeRealtimeBlock y que la lectura
// pre-agregada (analytics_daily) NO calcula: cuando la lectura diaria tiene
// éxito, los tomamos prestados de getRealtimeBlock (lectura LIGERA: solo la query
// realtime barata + la base de usuarios, sin las queries pesadas del legacy) para
// que el panel "En vivo" siga funcionando.
const REALTIME_FIELDS = [
  'realtimeWindowMs',
  'realtimeActiveSessions',
  'realtimeActiveIdentities',
  'realtimeActiveLoggedUsers',
  'realtimeActiveRegisteredUsers',
  'realtimeActiveVisitors',
  'realtimeSessionsDetails',
  'realtimeRefreshedAtMs',
];

function pickRealtime(globalData = {}) {
  const out = {};
  REALTIME_FIELDS.forEach((k) => {
    if (globalData[k] !== undefined) out[k] = globalData[k];
  });
  return out;
}

// FIX 3: métricas que la lectura PRE-AGREGADA (analytics_daily) NO puede derivar
// porque requieren cruzar sesiones+eventos crudos que el doc diario no desglosa.
// combineDailyDocs las deja en su valor neutro (bounceRate=0, abandonedCarts=[],
// totalRegisteredUsers=0). En el legacy SÍ tienen valor, así que dejarlas en 0
// tras desplegar la CF sería una REGRESIÓN visible. Las rellenamos, SIN queries
// extra caras, desde el ÚLTIMO resultado legacy (getGlobalAnalytics) que el flujo
// ya obtuvo y dejó cacheado en react-query para este mismo rango, copiando SOLO
// estos campos si el snapshot existe.
const LEGACY_BACKFILL_FIELDS = ['bounceRate', 'abandonedCarts', 'totalRegisteredUsers'];

function pickLegacyBackfill(globalData = {}) {
  const out = {};
  LEGACY_BACKFILL_FIELDS.forEach((k) => {
    if (globalData[k] !== undefined) out[k] = globalData[k];
  });
  return out;
}

// Nº de días del rango a partir de {startDateMs,endDateMs} (para la lectura
// pre-agregada, que lee 1 doc por día). useDateRange genera el rango como
// [hoy-rangeDays 00:00, hoy 23:59], por lo que cubre rangeDays+1 claves de día;
// usamos ceil del span en días para no quedarnos cortos.
function rangeToDays(dateRange) {
  const span = (dateRange?.endDateMs || 0) - (dateRange?.startDateMs || 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.ceil(span / dayMs);
  return Math.max(1, Number.isFinite(days) ? days : 30);
}

/**
 * fetchDashboardGlobal — orquesta la lectura del dashboard con FALLBACK SEGURO:
 *
 *   1. Intenta la lectura PRE-AGREGADA (analytics_daily): N lecturas (1/día) +
 *      el día en curso en vivo, combinadas en el MISMO shape que getGlobalAnalytics.
 *   2. Si esa lectura devuelve null (no hay docs diarios: la CF aún no se
 *      desplegó/ejecutó) o LANZA, cae a getGlobalAnalytics legacy (el de hoy),
 *      SIN romper el dashboard.
 *   3. Cuando la pre-agregada funciona, fusiona el bloque "en vivo" desde una
 *      lectura LIGERA (getRealtimeBlock: solo la query realtime barata + la base
 *      de usuarios) para no perder el panel "En vivo" SIN disparar las queries
 *      pesadas del legacy (eventos/sesiones del rango).
 *
 * Así, desplegar este frontend ANTES de que exista la CF muestra el dashboard
 * EXACTAMENTE como hoy.
 *
 * @param dateRange  {startDateMs,endDateMs}
 * @param backfill   getter/setter opcional de un snapshot legacy cacheado por
 *                   react-query (sin coste de red) para el FIX 3. Ver pickLegacyBackfill.
 */
async function fetchDashboardGlobal(dateRange, backfill = {}) {
  const { getLegacySnapshot, setLegacySnapshot } = backfill;
  try {
    const daily = await getAnalyticsDailyRange({ days: rangeToDays(dateRange) });
    if (daily) {
      // Bloque realtime con lectura LIGERA (solo sesiones en vivo + base de
      // usuarios), NO el getGlobalAnalytics completo: así no disparamos las
      // queries pesadas de eventos/sesiones del rango, que ya cubre la lectura
      // pre-agregada. No rompe si falla: dejamos lo que haya.
      let realtime = {};
      try {
        const live = await getRealtimeBlock();
        if (!live.error && live.data) realtime = pickRealtime(live.data);
      } catch {
        realtime = {};
      }

      // FIX 3: bounceRate/abandonedCarts/totalRegisteredUsers NO se pueden derivar
      // de los docs diarios (requieren cruzar sesiones+eventos crudos), y la lectura
      // LIGERA realtime tampoco los trae; combineDailyDocs los deja neutros (0/[]).
      // Para no introducir una REGRESIÓN visible (en el legacy SÍ tienen valor), los
      // rellenamos SIN queries extra caras desde el ÚLTIMO resultado legacy que ya
      // se obtuvo y quedó cacheado por react-query para este mismo rango (p. ej. tras
      // un fallback previo). Si no hay snapshot legacy disponible, se conservan los
      // valores neutros de la pre-agregada (no rompe nada).
      let legacyBackfill = {};
      if (typeof getLegacySnapshot === 'function') {
        const snap = getLegacySnapshot();
        if (snap) legacyBackfill = pickLegacyBackfill(snap);
      }

      // Orden de fusión: pre-agregada → backfill legacy → realtime. El backfill
      // SOLO sobreescribe los 3 campos neutros; si no había snapshot legacy, no
      // rompe nada y se conservan los valores neutros de la pre-agregada.
      return { ...daily, ...legacyBackfill, ...realtime };
    }
    // daily === null → fallback explícito al legacy.
  } catch (e) {
    // Error capturable en la lectura pre-agregada → fallback al legacy.
    if (typeof console !== 'undefined') {
      console.warn('[analytics] lectura pre-agregada falló, usando legacy:', e?.message || e);
    }
  }

  // FALLBACK: lectura legacy actual (la que el dashboard usa hoy).
  const res = await getGlobalAnalytics(dateRange);
  if (res.error) throw new Error(res.error);
  // Cacheamos el resultado legacy (sin coste extra) para que futuras cargas
  // pre-agregadas de este rango puedan rellenar los 3 campos del FIX 3.
  if (typeof setLegacySnapshot === 'function') setLegacySnapshot(res.data);
  return res.data;
}

/**
 * useGlobalAnalytics — query global compartida (mismo queryKey por rango que el
 * hub). Sin refetch automático: refresco SOLO manual. staleTime alto para que
 * navegar entre sub-páginas reutilice la caché y no dispare lecturas.
 *
 * Lee desde analytics_daily (pre-agregado) con fallback al legacy. El shape de
 * salida es idéntico al de getGlobalAnalytics, así que ninguna sub-página cambia.
 */
export function useGlobalAnalytics(dateRange) {
  const queryClient = useQueryClient();
  // Snapshot legacy cacheado (sin red) para el FIX 3: clave aparte por rango, que
  // NO colisiona con la query principal. getLegacySnapshot lo lee; setLegacySnapshot
  // lo guarda cuando el flujo cae al legacy completo.
  const legacyKey = ['admin-dashboard-legacy-backfill', dateRange.startDateMs, dateRange.endDateMs];
  const backfill = {
    getLegacySnapshot: () => queryClient.getQueryData(legacyKey),
    setLegacySnapshot: (data) => queryClient.setQueryData(legacyKey, data),
  };
  return useQuery({
    queryKey: ['admin-dashboard-global', dateRange.startDateMs, dateRange.endDateMs],
    queryFn: () => fetchDashboardGlobal(dateRange, backfill),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/* ------------------------------ controles UI ------------------------------ */

/**
 * RangePicker — selector de rango 7/30/90 (segmentado glass premium).
 * Mantiene la misma API y semántica tablist; el look se eleva con el design
 * system (superficie glass + píldora activa con gradiente de marca).
 */
export function RangePicker({ rangeDays, setRangeDays }) {
  return (
    <div
      className={`${styles.rangePicker} ${extra.rangePicker}`}
      role="tablist"
      aria-label="Rango de fechas"
    >
      {RANGES.map((r) => {
        const activo = rangeDays === r.days;
        return (
          <button
            key={r.days}
            type="button"
            role="tab"
            aria-selected={activo}
            className={`${styles.rangeBtn} ${extra.rangeBtn} ${
              activo ? `${styles.rangeActive} ${extra.rangeActive}` : ''
            }`}
            onClick={() => setRangeDays(r.days)}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * RefreshButton — botón de refresco manual sobre GlassButton (variante glass).
 * Preserva el comportamiento: onClick dispara la recarga, isFetching deshabilita
 * e indica el estado. Usa el icono ⟳ giratorio propio (en vez del spinner de
 * carga de GlassButton) para mantener la metáfora visual de "actualizar".
 */
export function RefreshButton({ onClick, isFetching }) {
  return (
    <GlassButton
      variant="glass"
      size="sm"
      onClick={onClick}
      disabled={isFetching}
      title="Actualizar datos"
      icon={
        <span
          className={`${extra.refreshIcon} ${isFetching ? extra.spinning : ''}`}
          aria-hidden="true"
        >
          ⟳
        </span>
      }
    >
      {isFetching ? 'Actualizando…' : 'Actualizar'}
    </GlassButton>
  );
}

/**
 * DashHeader — encabezado estándar de sub-página:
 *   enlace "← Volver al resumen" + título + subtítulo,
 *   y a la derecha el selector de rango (opcional) + botón Actualizar.
 */
export function DashHeader({
  title,
  subtitle,
  rangeDays,
  setRangeDays,
  showRange = true,
  onRefresh,
  isFetching,
  lastUpdated,
}) {
  return (
    <header className={`${styles.header} ${extra.header}`}>
      <div className={extra.headerMain}>
        <Link to="/admin/dashboard" className={`${styles.backLink} ${extra.backLink}`}>
          <span className={extra.backArrow} aria-hidden="true">
            ←
          </span>
          Volver al resumen
        </Link>
        <h1 className={`${styles.title} ${extra.title}`}>{title}</h1>
        {subtitle && (
          <p className={`${styles.subtitle} ${extra.subtitle}`}>
            <span>{subtitle}</span>
            {lastUpdated && (
              <span className={extra.subtitleUpdated}>
                <span className={extra.subtitleDot} aria-hidden="true" />
                actualizado {lastUpdated}
              </span>
            )}
          </p>
        )}
      </div>
      <div className={`${styles.headerControls} ${extra.headerControls}`}>
        {showRange && setRangeDays && (
          <RangePicker rangeDays={rangeDays} setRangeDays={setRangeDays} />
        )}
        {onRefresh && <RefreshButton onClick={onRefresh} isFetching={isFetching} />}
      </div>
    </header>
  );
}

/**
 * DashBackground — fondo de marca reutilizado en todas las páginas del panel.
 * Eleva los orbes manuales a la malla "aurora" del design system
 * (AuroraBackground), sobre un lavado de gradiente premium casi blanco. Sigue
 * siendo puramente decorativo (aria-hidden, detrás del contenido).
 */
export function DashBackground() {
  return (
    <div className={extra.bgBase} aria-hidden="true">
      <AuroraBackground variant="vivid" />
    </div>
  );
}

/** Estados de carga/error compartidos. */
export function DashStates({ isLoading, hasData, error }) {
  return (
    <>
      {error && <div className={styles.errorBox}>Error al cargar datos: {error.message}</div>}
      {isLoading && !hasData && <div className={styles.loading}>Cargando analítica…</div>}
    </>
  );
}
