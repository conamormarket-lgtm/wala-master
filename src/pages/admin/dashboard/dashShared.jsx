import React, { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { getGlobalAnalytics, getRealtimeBlock } from '../../../services/adminAnalytics';
import { getAnalyticsDailyRange } from '../../../services/analyticsDaily';
import { getDocument } from '../../../services/firebase/firestore';
import { ANALYTICS_COLLECTIONS, safeNumber } from '../../../services/analytics/schema';
import { AuroraBackground, GlassButton } from '../../../components/ui';
import styles from '../AdminDashboard.module.css';
import extra from './dashShared.extra.module.css';

/* ============================================================================
 * dashShared — utilidades compartidas por el HUB y las sub-páginas del panel.
 *
 * Centraliza: formateadores, helpers de ruta, selector de rango (7/30/90 +
 * personalizado), el hook de datos globales (react-query, refresco SOLO manual,
 * staleTime alto) y un header reutilizable con título + "← Volver al resumen".
 *
 * FILTROS GLOBALES (contrato para el hub y las sub-páginas):
 *   - useDashboardFilters()  → rango (presets + personalizado), comparación con
 *     el periodo anterior, filtro de origen APP/WEB y métrica base. El estado
 *     vive en el QUERYSTRING (sin contexto ni estado duplicado); propagar con
 *     `filtersSearch` en los <Link>.
 *   - useDashboardAnalytics(filtros) → { data/actual, anterior, … } con la
 *     comparación cargada BARATA (solo docs de analytics_daily del rango previo).
 *   - Helpers: segTAW (corte por origen, null = "sin desglose"), leerIdentidades,
 *     calcularDelta / calcularDeltaPuntos (▲/▼ para KpiRow).
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

/* ---- Claves de día de LIMA (UTC-5 fijo, sin DST) ----------------------------
 * MISMA convención que analyticsDaily.js y la Cloud Function: los doc IDs de
 * `analytics_daily` son el día CIVIL de Lima ("YYYY-MM-DD"). Se duplican aquí
 * (~15 líneas) porque analyticsDaily.js no las exporta y esta capa de UI no
 * debe modificar ese archivo. Si cambian allí, deben cambiar aquí igual. */
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Tope defensivo de días por rango (lecturas BARATAS: 1 doc por día, y evita
// que un rango personalizado enorme dispare cientos de lecturas).
const MAX_DIAS_RANGO = 365;

// Instante (epoch ms) → clave "YYYY-MM-DD" del día civil de Lima.
function limaDayKey(ms) {
  const d = new Date(ms - LIMA_OFFSET_MS);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Clave "YYYY-MM-DD" (día civil Lima) → epoch ms de su medianoche en Lima.
function limaKeyToStartMs(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) + LIMA_OFFSET_MS;
}

// Claves de día de Lima cubiertas por [startMs, endMs], en orden ascendente.
// Lima no tiene DST: cada día son exactamente 24h y el salto fijo es correcto.
function limaDayKeysBetween(startMs, endMs) {
  const keys = [];
  let t = limaKeyToStartMs(limaDayKey(startMs));
  const endT = limaKeyToStartMs(limaDayKey(endMs));
  for (let guard = 0; t <= endT && guard < MAX_DIAS_RANGO; t += DAY_MS, guard += 1) {
    keys.push(limaDayKey(t));
  }
  return keys;
}

/** Clave "YYYY-MM-DD" (Lima) de HOY — útil como `max` de los date-pickers. */
export function limaHoyKey() {
  return limaDayKey(Date.now());
}

// "YYYY-MM-DD" → "DD/MM/YYYY" legible para etiquetas de rango.
function fmtDayKeyLegible(key) {
  const [y, m, d] = String(key || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/* ---- Constantes de los filtros globales del dashboard ---- */

/** Opciones del filtro global de ORIGEN (corte APP/WEB de los agregados). */
export const ORIGENES = [
  { value: 'todos', label: 'Todos' },
  { value: 'web', label: 'Web' },
  { value: 'app', label: 'App' },
];

/** Opciones del conmutador de MÉTRICA BASE del KPI principal. */
export const METRICAS = [
  { value: 'sesiones', label: 'Sesiones' },
  { value: 'identidades', label: 'Identidades' },
  { value: 'logueados', label: 'Logueados' },
];

const PRESET_DAYS = new Set(RANGES.map((r) => r.days));
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * useDashboardFilters — CONTRATO de filtros compartidos del panel de analítica.
 * ============================================================================
 * El estado vive en el QUERYSTRING (useSearchParams, replace:true): es lo más
 * simple que sobrevive a la navegación hub ⇄ sub-página SIN contexto ni estado
 * duplicado. Cualquier página que monte este hook (o useDateRange, que es un
 * alias) lee/escribe el MISMO estado. Para que los filtros viajen entre rutas,
 * los <Link> deben llevar `search: filtersSearch` (el hub y DashHeader ya lo
 * hacen; las sub-páginas heredan el back-link con filtros de DashHeader).
 *
 * Parámetros del querystring (todos opcionales; ausente = default):
 *   rango    '7' | '30' | '90' | 'custom'        (default: initialDays → 30)
 *   desde    'YYYY-MM-DD' (día civil de LIMA)     solo con rango=custom
 *   hasta    'YYYY-MM-DD' (día civil de LIMA)     solo con rango=custom
 *   comparar '1'                                  (default: apagado)
 *   origen   'app' | 'web'                        (default: 'todos')
 *   metrica  'identidades' | 'logueados'          (default: 'sesiones')
 *
 * Devuelve (API estable para el hub y las sub-páginas — agentes B y C):
 *   rangeDays      7|30|90 | 'custom'   — para pintar el RangePicker
 *   setRangeDays(v)                     — preset numérico o 'custom'
 *   customStart / customEnd             — 'YYYY-MM-DD' Lima (saneados: sin
 *                                         futuro, desde<=hasta)
 *   setCustomRange(desde, hasta)        — fija fechas y activa rango=custom
 *   dateRange      {startDateMs,endDateMs} — límites del periodo ACTUAL.
 *                    Presets: cálculo histórico (hora local del navegador),
 *                    idéntico al useDateRange original → mismas queryKeys.
 *                    Custom: medianoches EXACTAS de Lima (claves analytics_daily).
 *   rangeLabel     'últimos 30 días' | 'del 01/05/2026 al 15/05/2026'
 *                  (con custom, refleja las fechas EFECTIVAS del dateRange y
 *                  añade "(rango recortado a 365 días)" si se aplicó el tope)
 *   compare        boolean — "Comparar con periodo anterior"
 *   setCompare(v)
 *   prevDateRange  {startDateMs,endDateMs} del periodo INMEDIATAMENTE anterior
 *                  con la MISMA cantidad de días civiles de Lima (o null).
 *                  Nota honesta: si el rango actual incluye HOY (parcial), la
 *                  comparación es contra días completos; se etiqueta en la UI.
 *   prevRangeLabel 'del 01/04/2026 al 30/04/2026'
 *   origen         'todos'|'app'|'web'   — corte global de los agregados TAW
 *   setOrigen(v)
 *   metrica        'sesiones'|'identidades'|'logueados' — KPI principal
 *   setMetrica(v)
 *   filtersSearch  '?rango=…' — querystring actual para propagar en <Link>
 */
export function useDashboardFilters(initialDays = 30) {
  const [searchParams, setSearchParams] = useSearchParams();

  // -- Lectura VALIDADA del querystring (valores fuera de lista → default) --
  const rawRango = searchParams.get('rango');
  const presetInicial = PRESET_DAYS.has(Number(initialDays)) ? Number(initialDays) : 30;
  const rangeDays = rawRango === 'custom'
    ? 'custom'
    : (PRESET_DAYS.has(Number(rawRango)) ? Number(rawRango) : presetInicial);

  const hoyKey = limaDayKey(Date.now());
  const leerKey = (nombre, fallback) => {
    const v = searchParams.get(nombre);
    return v && DAY_KEY_RE.test(v) ? v : fallback;
  };
  // Defaults del modo custom (últimos 30 días) para que los pickers no salgan vacíos.
  let customStart = leerKey('desde', limaDayKey(Date.now() - 29 * DAY_MS));
  let customEnd = leerKey('hasta', hoyKey);
  // Saneado: sin fechas futuras y desde <= hasta (si vienen invertidas, se corrigen).
  if (customEnd > hoyKey) customEnd = hoyKey;
  if (customStart > customEnd) {
    const t = customStart;
    customStart = customEnd;
    customEnd = t;
  }

  const compare = searchParams.get('comparar') === '1';
  const rawOrigen = searchParams.get('origen');
  const origen = ORIGENES.some((o) => o.value === rawOrigen) ? rawOrigen : 'todos';
  const rawMetrica = searchParams.get('metrica');
  const metrica = METRICAS.some((m) => m.value === rawMetrica) ? rawMetrica : 'sesiones';

  // -- Setters: escriben el querystring (replace: no ensucian el historial). --
  // Los defaults se BORRAN del querystring para mantener URLs limpias.
  const mutar = useCallback((cambios) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(cambios).forEach(([k, v]) => {
        if (v == null || v === '' || v === false) next.delete(k);
        else next.set(k, String(v));
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setRangeDays = useCallback((v) => {
    // Conservamos desde/hasta al volver a un preset: si el admin regresa a
    // "Personalizado", encuentra sus fechas donde las dejó.
    mutar({ rango: v === 'custom' ? 'custom' : (PRESET_DAYS.has(Number(v)) ? Number(v) : null) });
  }, [mutar]);

  const setCustomRange = useCallback((desde, hasta) => {
    const cambios = { rango: 'custom' };
    if (desde && DAY_KEY_RE.test(desde)) cambios.desde = desde;
    if (hasta && DAY_KEY_RE.test(hasta)) cambios.hasta = hasta;
    mutar(cambios);
  }, [mutar]);

  const setCompare = useCallback((v) => mutar({ comparar: v ? '1' : null }), [mutar]);
  const setOrigen = useCallback((v) => mutar({ origen: v === 'todos' ? null : v }), [mutar]);
  const setMetrica = useCallback((v) => mutar({ metrica: v === 'sesiones' ? null : v }), [mutar]);

  // -- Rango ACTUAL en ms --
  const dateRange = useMemo(() => {
    if (rangeDays === 'custom') {
      // Días CIVILES DE LIMA exactos: las mismas claves que usa analytics_daily.
      let startMs = limaKeyToStartMs(customStart);
      const endMs = limaKeyToStartMs(customEnd) + DAY_MS - 1;
      // Tope de días (lecturas baratas): si el rango es enorme, recorta el inicio.
      if ((endMs - startMs) / DAY_MS > MAX_DIAS_RANGO) {
        startMs = endMs + 1 - MAX_DIAS_RANGO * DAY_MS;
      }
      return { startDateMs: startMs, endDateMs: endMs };
    }
    // Presets 7/30/90: EXACTAMENTE el cálculo histórico (hora local del navegador)
    // para no cambiar queryKeys ni el comportamiento existente del dashboard.
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - rangeDays);
    start.setHours(0, 0, 0, 0);
    return { startDateMs: start.getTime(), endDateMs: end.getTime() };
  }, [rangeDays, customStart, customEnd]);

  // -- Periodo ANTERIOR de la misma longitud (en días civiles de Lima) --
  const prevDateRange = useMemo(() => {
    // FIX auditoría (P2) — PRESETS: dateRange se calcula con la hora LOCAL del
    // navegador (queryKeys históricas intactas), pero fuera de UTC-5 ese rango
    // puede cubrir una clave Lima de más o de menos que las que realmente lee
    // el pre-agregado (getAnalyticsDailyRange/buildDayKeys anclan a HOY Lima).
    // Para que el periodo anterior tenga EXACTAMENTE la misma cantidad de
    // claves que el actual, lo anclamos también a HOY Lima: las N claves
    // inmediatamente anteriores a las del periodo actual, SIN tocar dateRange.
    if (rangeDays !== 'custom') {
      const dias = rangeToDays(dateRange); // mismas claves que lee la pre-agregada
      const hoyStartMs = limaKeyToStartMs(limaDayKey(Date.now()));
      const inicioActualMs = hoyStartMs - (dias - 1) * DAY_MS; // 1ª clave del actual
      return {
        startDateMs: inicioActualMs - dias * DAY_MS,
        endDateMs: inicioActualMs - 1,
      };
    }
    // CUSTOM: el dateRange ya viene en medianoches exactas de Lima.
    const keys = limaDayKeysBetween(dateRange.startDateMs, dateRange.endDateMs);
    if (!keys.length) return null;
    const primeraMs = limaKeyToStartMs(keys[0]);
    return {
      startDateMs: primeraMs - keys.length * DAY_MS,
      endDateMs: primeraMs - 1,
    };
  }, [dateRange, rangeDays]);

  // FIX auditoría (P2): la etiqueta del rango custom se deriva de los ms
  // EFECTIVOS de dateRange (no de customStart crudo): si el tope de 365 días
  // recortó el inicio en silencio, la etiqueta lo dice en vez de prometer
  // fechas que no se están leyendo.
  const inicioEfectivoKey = rangeDays === 'custom' ? limaDayKey(dateRange.startDateMs) : null;
  const finEfectivoKey = rangeDays === 'custom' ? limaDayKey(dateRange.endDateMs) : null;
  const rangoRecortado = rangeDays === 'custom' && inicioEfectivoKey !== customStart;
  const rangeLabel = rangeDays === 'custom'
    ? `del ${fmtDayKeyLegible(inicioEfectivoKey)} al ${fmtDayKeyLegible(finEfectivoKey)}${
      rangoRecortado ? ' (rango recortado a 365 días)' : ''
    }`
    : `últimos ${rangeDays} días`;
  const prevRangeLabel = prevDateRange
    ? `del ${fmtDayKeyLegible(limaDayKey(prevDateRange.startDateMs))} al ${fmtDayKeyLegible(limaDayKey(prevDateRange.endDateMs))}`
    : '';

  const qs = searchParams.toString();
  const filtersSearch = qs ? `?${qs}` : '';

  return {
    rangeDays,
    setRangeDays,
    customStart,
    customEnd,
    setCustomRange,
    dateRange,
    rangeLabel,
    compare,
    setCompare,
    prevDateRange,
    prevRangeLabel,
    origen,
    setOrigen,
    metrica,
    setMetrica,
    filtersSearch,
  };
}

/**
 * useDateRange — RETROCOMPATIBLE: hoy es un alias de useDashboardFilters.
 * Las sub-páginas que destructuran {rangeDays, setRangeDays, dateRange} siguen
 * funcionando igual, y además quedan automáticamente sincronizadas con los
 * filtros del hub vía querystring (sin estado duplicado).
 */
export function useDateRange(initialDays = 30) {
  return useDashboardFilters(initialDays);
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

/* ------------------ campos EXTENDIDOS del doc diario (P1) ------------------ */

// Deriva filas [{name,count}] APP/WEB desde un contador {total,app,web} de
// sesiones (fallback del legacy y de docs diarios viejos sin byClientType).
function deriveClientTypeRows(totalSessions) {
  const app = Number(totalSessions?.app) || 0;
  const web = Number(totalSessions?.web) || 0;
  if (app + web <= 0) return [];
  const rows = [];
  if (web > 0) rows.push({ name: 'WEB', count: web });
  if (app > 0) rows.push({ name: 'APP', count: app });
  return rows.sort((a, b) => b.count - a.count);
}

/**
 * ensureExtendedAnalytics — garantiza que el objeto que consumen las páginas
 * SIEMPRE tenga los campos NUEVOS del doc diario con forma predecible, venga
 * de la lectura pre-agregada (combineDailyDocs ya los combina), del legacy
 * (que solo conoce parte) o de docs viejos sin los campos nuevos.
 *
 * Contrato de salida (P1; la UI de filtros llega en P2):
 *   byCountry     [{ code, name, count }]  país real (IP) — [] = "sin datos"
 *   byDevice      [{ name, count }]        Mobile/Tablet/Desktop
 *   byBrowser     [{ name, count }]
 *   byOS          [{ name, count }]
 *   byClientType  [{ name, count }]        APP/WEB
 *   funnel        { events, users } | null misma forma que funnelStats
 *   identities    { logged?, anonymous?, … } TAWs — {} = "sin datos"
 *
 * Todo con ||/?? y valores neutros: NADA rompe si faltan los campos; las
 * páginas muestran "sin datos" cuando el array/objeto llega vacío.
 */
export function ensureExtendedAnalytics(data = {}) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const first = (...cands) => cands.map(arr).find((a) => a.length > 0) || [];
  return {
    ...data,
    // País por IP de sesión: solo existe con la CF nueva; el legacy NO lo sabe
    // (su geografía es por timeZone) → [] honesto en vez de inventar países.
    byCountry: arr(data.byCountry),
    // Dispositivo/navegador/SO: usa los nuevos; cae al desglose del UA que el
    // legacy ya calcula (deviceStats.top*) para no dejar el panel vacío.
    byDevice: first(data.byDevice, data.deviceStats?.topDevices),
    byBrowser: first(data.byBrowser, data.deviceStats?.topBrowsers),
    byOS: first(data.byOS, data.deviceStats?.topOS),
    // Segmento APP/WEB: usa el nuevo; cae a derivarlo de totalSessions.
    byClientType: arr(data.byClientType).length > 0
      ? arr(data.byClientType)
      : deriveClientTypeRows(data.totalSessions),
    // Embudo: alias estable (el legacy solo trae funnelStats).
    funnel: data.funnel || data.funnelStats || null,
    // Identidades desglosadas: objeto plano de TAWs; {} = "sin datos".
    identities:
      data.identities && typeof data.identities === 'object' && !Array.isArray(data.identities)
        ? data.identities
        : {},
  };
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
  // Rango PERSONALIZADO que termina ANTES de hoy: getAnalyticsDailyRange solo
  // sabe leer "últimos N días anclados a HOY", así que leería días equivocados.
  // Para esos rangos usamos el lector legacy, que SÍ filtra por
  // {startDateMs,endDateMs} (y conserva su caché de 30s y sus límites de
  // lectura). Los rangos que terminan hoy (presets y custom hasta hoy) siguen
  // saliendo BARATOS de analytics_daily.
  const terminaHoy = limaDayKey(dateRange?.endDateMs ?? Date.now()) >= limaDayKey(Date.now());
  if (terminaHoy) {
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
      // ensureExtendedAnalytics garantiza los campos NUEVOS (byCountry/byDevice/
      // byBrowser/byOS/byClientType/funnel/identities) con forma predecible.
      return ensureExtendedAnalytics({ ...daily, ...legacyBackfill, ...realtime });
    }
    // daily === null → fallback explícito al legacy.
  } catch (e) {
    // Error capturable en la lectura pre-agregada → fallback al legacy.
    if (typeof console !== 'undefined') {
      console.warn('[analytics] lectura pre-agregada falló, usando legacy:', e?.message || e);
    }
  }
  } // fin if(terminaHoy)

  // FALLBACK (y camino de los rangos personalizados PASADOS): lectura legacy,
  // filtrada por {startDateMs,endDateMs} con su caché de 30s y sus límites.
  const res = await getGlobalAnalytics(dateRange);
  if (res.error) throw new Error(res.error);
  // Cacheamos el resultado legacy (sin coste extra) para que futuras cargas
  // pre-agregadas de este rango puedan rellenar los 3 campos del FIX 3.
  if (typeof setLegacySnapshot === 'function') setLegacySnapshot(res.data);
  // También el camino legacy expone los campos NUEVOS (con sus fallbacks:
  // deviceStats→byDevice/..., totalSessions→byClientType, funnelStats→funnel;
  // byCountry/identities quedan vacíos = "sin datos", honesto).
  return ensureExtendedAnalytics(res.data);
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

/* ------------------- comparación con el periodo anterior ------------------- */

// Contador {total,app,web} vacío y suma tolerante (número plano u objeto TAW).
function tawVacio() {
  return { total: 0, app: 0, web: 0 };
}
function sumarTAW(acc, v) {
  if (v == null) return acc;
  if (typeof v === 'number') {
    acc.total += safeNumber(v);
    return acc;
  }
  acc.total += safeNumber(v.total);
  acc.app += safeNumber(v.app);
  acc.web += safeNumber(v.web);
  return acc;
}

// Acumula las identidades desglosadas de un doc diario (espejo del lector
// tolerante de analyticsDaily.js): forma anidada doc.identities = {clave: TAW}
// y/o claves planas doc.identitiesLoggedIn / identitiesAnon / … → acc[clave].
function acumularIdentidades(acc, doc) {
  if (!doc || typeof doc !== 'object') return;
  const nested = doc.identities;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    Object.entries(nested).forEach(([k, v]) => {
      if (!acc[k]) acc[k] = tawVacio();
      sumarTAW(acc[k], v);
    });
  }
  Object.keys(doc).forEach((k) => {
    const m = /^identities([A-Z].*)$/.exec(k);
    if (!m) return;
    const sub = m[1].charAt(0).toLowerCase() + m[1].slice(1);
    if (!acc[sub]) acc[sub] = tawVacio();
    sumarTAW(acc[sub], doc[k]);
  });
}

/**
 * fetchCompareKpis — carga BARATA del periodo anterior: SOLO los docs diarios
 * `analytics_daily/{día}` del rango previo (1 lectura por día, en paralelo; el
 * periodo anterior nunca incluye hoy, así que todos son días cerrados) y los
 * combina en un RESUMEN de KPIs. NO usa el lector legacy (evitamos duplicar la
 * carga pesada): si ningún día previo tiene doc (días anteriores al despliegue
 * de la CF), devuelve daysWithData=0 y la UI lo dice honestamente en vez de
 * mostrar ceros engañosos.
 *
 * @returns {{
 *   daysTotal:number, daysWithData:number,
 *   desdeKey:string|null, hastaKey:string|null,
 *   sessions:TAW, identities:TAW, pageViews:TAW, dwellMs:TAW,
 *   funnelEvents:{views:TAW,adds:TAW,checkouts:TAW,purchases:TAW},
 *   identitiesBreakdown:Object<string,TAW>,
 * }}
 */
async function fetchCompareKpis(prevDateRange) {
  const keys = limaDayKeysBetween(prevDateRange.startDateMs, prevDateRange.endDateMs);
  const resultados = await Promise.all(
    keys.map((k) => getDocument(ANALYTICS_COLLECTIONS.DAILY, k))
  );
  // Un error real de Firestore (distinto de "no encontrado") sí se propaga.
  const errorDuro = resultados.find((r) => r.error && r.error !== 'Documento no encontrado');
  if (errorDuro) throw new Error(`comparación analytics_daily falló: ${errorDuro.error}`);

  const docs = resultados.map((r) => r.data).filter(Boolean);

  const sessions = tawVacio();
  const identities = tawVacio(); // suma de diarios: misma aproximación etiquetada
  const pageViews = tawVacio();
  const dwellMs = tawVacio();
  const funnelEvents = {
    views: tawVacio(), adds: tawVacio(), checkouts: tawVacio(), purchases: tawVacio(),
  };
  const identitiesBreakdown = {};

  docs.forEach((doc) => {
    sumarTAW(sessions, doc.sessions);
    sumarTAW(identities, doc.activeIdentities);
    sumarTAW(pageViews, doc.pageViews);
    sumarTAW(dwellMs, doc.dwellMs);
    const fe = doc.funnel?.events || {};
    sumarTAW(funnelEvents.views, fe.views);
    sumarTAW(funnelEvents.adds, fe.adds);
    sumarTAW(funnelEvents.checkouts, fe.checkouts);
    sumarTAW(funnelEvents.purchases, fe.purchases);
    acumularIdentidades(identitiesBreakdown, doc);
  });

  return {
    daysTotal: keys.length,
    daysWithData: docs.length,
    desdeKey: keys[0] || null,
    hastaKey: keys[keys.length - 1] || null,
    sessions,
    identities,
    pageViews,
    dwellMs,
    funnelEvents,
    identitiesBreakdown,
  };
}

/**
 * useCompareAnalytics — query del periodo ANTERIOR (resumen de KPIs). Solo se
 * dispara con `enabled` (toggle "Comparar"); cacheada por rango previo con el
 * mismo staleTime alto que la query principal → activar/desactivar el toggle o
 * navegar entre páginas NO relee. Coste: UNA carga extra de docs diarios.
 */
export function useCompareAnalytics(prevDateRange, enabled) {
  return useQuery({
    queryKey: [
      'admin-dashboard-compare',
      prevDateRange?.startDateMs ?? 0,
      prevDateRange?.endDateMs ?? 0,
    ],
    queryFn: () => fetchCompareKpis(prevDateRange),
    enabled: Boolean(enabled && prevDateRange),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * useDashboardAnalytics — datos del panel con comparación opcional.
 * ============================================================================
 * Composición recomendada para el hub y las sub-páginas (agentes B y C):
 *
 *   const filtros = useDashboardFilters();
 *   const { data, isLoading, isFetching, error, refetch, dataUpdatedAt,
 *           actual, anterior, anteriorQuery } = useDashboardAnalytics(filtros);
 *
 *   data / actual   → shape completo de getGlobalAnalytics para filtros.dateRange
 *                     (con los campos extendidos de ensureExtendedAnalytics).
 *   anterior        → resumen de KPIs del periodo anterior (ver fetchCompareKpis)
 *                     o null si la comparación está apagada. Con comparación
 *                     encendida pero SIN docs diarios previos llega con
 *                     daysWithData=0 → mostrar "sin datos", nunca ceros.
 *                     OJO (métricas NO aditivas): anterior.identities /
 *                     identitiesBreakdown suman únicos POR DÍA. Solo son
 *                     comparables si el periodo ACTUAL también viene del
 *                     pre-agregado (data.__source === 'analytics_daily'); si
 *                     vino del legacy (únicos del RANGO completo), el consumidor
 *                     debe SUPRIMIR ese delta (así lo hace el hub AdminDashboard).
 *   anteriorQuery   → query cruda de la comparación (isFetching/error).
 *   refetch         → recarga el periodo actual Y (si aplica) el anterior.
 */
export function useDashboardAnalytics(filters) {
  const global = useGlobalAnalytics(filters.dateRange);
  const comparacion = useCompareAnalytics(filters.prevDateRange, filters.compare);
  const { refetch: refetchGlobal } = global;
  const { refetch: refetchComparacion } = comparacion;
  const compareActivo = Boolean(filters.compare);
  const refetch = useCallback(() => {
    refetchGlobal();
    if (compareActivo) refetchComparacion();
  }, [refetchGlobal, refetchComparacion, compareActivo]);
  return {
    ...global,
    actual: global.data || null,
    anterior: compareActivo ? (comparacion.data || null) : null,
    anteriorQuery: comparacion,
    isFetching: global.isFetching || (compareActivo && comparacion.isFetching),
    refetch,
  };
}

/* ---------------- helpers de corte por origen y deltas (▲/▼) ---------------- */

/**
 * segTAW — lee el corte de un contador {total,app,web} según el filtro global
 * de origen. Devuelve null cuando el corte NO existe para ese dato (número
 * plano sin desglose, o total>0 sin app/web — típico de fuentes sin segmentar):
 * el consumidor debe mostrar el TOTAL con una nota, nunca un 0 engañoso.
 */
export function segTAW(taw, origen = 'todos') {
  if (taw == null) return origen === 'todos' ? 0 : null;
  if (typeof taw === 'number') return origen === 'todos' ? (Number(taw) || 0) : null;
  const total = Number(taw.total) || 0;
  if (origen === 'todos') return total;
  const app = Number(taw.app) || 0;
  const web = Number(taw.web) || 0;
  // Hay total pero ningún desglose → la fuente no segmentó este dato.
  if (total > 0 && app === 0 && web === 0) return null;
  return origen === 'app' ? app : web;
}

/**
 * leerIdentidades — lee un sub-contador del objeto `identities` que expone
 * ensureExtendedAnalytics / identitiesBreakdown de la comparación, probando las
 * variantes de nombre con las que puede venir del doc diario (según versión de
 * la CF). Devuelve el TAW o null si el desglose no existe ("sin datos").
 * @param tipo 'total' | 'logueados' | 'anonimos'
 */
export function leerIdentidades(identities, tipo) {
  if (!identities || typeof identities !== 'object') return null;
  const CANDIDATAS = {
    total: ['identitiesTotal', 'total'],
    logueados: ['identitiesLoggedIn', 'loggedIn', 'logged', 'identitiesLogged', 'logueados'],
    anonimos: ['identitiesAnon', 'anon', 'anonymous', 'identitiesAnonymous', 'anonimos'],
  };
  const claves = CANDIDATAS[tipo] || [];
  for (const k of claves) {
    if (identities[k] != null) return identities[k];
  }
  return null;
}

/**
 * calcularDelta — variación porcentual actual vs. anterior para los KPIs.
 * Devuelve { delta:'▲ 12,5%', deltaPositive } (props que KpiRow ya entiende)
 * o null si no hay base de comparación (anterior null → no pintar delta).
 */
export function calcularDelta(actual, anterior) {
  if (actual == null || anterior == null) return null;
  const a = Number(actual) || 0;
  const b = Number(anterior) || 0;
  if (b === 0) {
    if (a === 0) return { delta: '= 0%', deltaPositive: true };
    // Sin base previa: no se puede expresar en % (división entre 0).
    return { delta: '▲ nuevo', deltaPositive: true };
  }
  const pct = ((a - b) / b) * 100;
  if (Math.round(pct * 10) === 0) return { delta: '= 0%', deltaPositive: true };
  const abs = Math.abs(pct).toLocaleString('es-PE', { maximumFractionDigits: 1 });
  return { delta: `${pct > 0 ? '▲' : '▼'} ${abs}%`, deltaPositive: pct > 0 };
}

/**
 * calcularDeltaPuntos — para métricas que YA son porcentajes (conversión):
 * diferencia en PUNTOS porcentuales ('▲ 0,4 pp'), no % de un % (confuso).
 */
export function calcularDeltaPuntos(actualPct, anteriorPct) {
  if (actualPct == null || anteriorPct == null) return null;
  const diff = (Number(actualPct) || 0) - (Number(anteriorPct) || 0);
  const redondeada = Math.round(diff * 10) / 10;
  if (redondeada === 0) return { delta: '= 0 pp', deltaPositive: true };
  const abs = Math.abs(redondeada).toLocaleString('es-PE', { maximumFractionDigits: 1 });
  return { delta: `${redondeada > 0 ? '▲' : '▼'} ${abs} pp`, deltaPositive: redondeada > 0 };
}

/* ------------------------------ controles UI ------------------------------ */

// Estilo compartido de los date-pickers nativos del rango personalizado.
// Inline con TOKENS de tema (no podemos añadir clases: los .css compartidos no
// se tocan desde aquí); los tokens semánticos cubren también el modo noche.
const ESTILO_INPUT_FECHA = {
  minHeight: 'var(--touch-target, 44px)',
  padding: '0.3rem 0.55rem',
  borderRadius: '10px',
  border: '1px solid var(--color-border, #e2e8f0)',
  background: 'var(--color-surface, #ffffff)',
  color: 'var(--color-text, #0f172a)',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  colorScheme: 'light dark', // el picker nativo respeta el tema del sistema
};

/**
 * RangePicker — selector de rango 7/30/90 (segmentado glass premium) con
 * opción "Personalizado" (dos date-pickers nativos, sin librerías).
 *
 * RETROCOMPATIBLE: con solo {rangeDays, setRangeDays} se comporta como siempre
 * (presets). Si además llegan {customStart, customEnd, setCustomRange} (del
 * contrato useDashboardFilters), aparece la píldora "Personalizado" y, al
 * activarla, los dos date-pickers (días civiles de Lima, máx. hoy).
 */
export function RangePicker({ rangeDays, setRangeDays, customStart, customEnd, setCustomRange }) {
  const conCustom = typeof setCustomRange === 'function';
  const customActivo = conCustom && rangeDays === 'custom';
  const hoy = limaHoyKey();
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
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
        {conCustom && (
          <button
            type="button"
            role="tab"
            aria-selected={customActivo}
            className={`${styles.rangeBtn} ${extra.rangeBtn} ${
              customActivo ? `${styles.rangeActive} ${extra.rangeActive}` : ''
            }`}
            onClick={() => setRangeDays('custom')}
            title="Elegir fechas exactas (desde / hasta)"
          >
            Personalizado
          </button>
        )}
      </div>

      {customActivo && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <input
            type="date"
            value={customStart || ''}
            max={customEnd || hoy}
            onChange={(e) => e.target.value && setCustomRange(e.target.value, customEnd)}
            aria-label="Desde (fecha inicial del rango)"
            style={ESTILO_INPUT_FECHA}
          />
          <span aria-hidden="true" style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '0.8rem' }}>
            →
          </span>
          <input
            type="date"
            value={customEnd || ''}
            min={customStart || undefined}
            max={hoy}
            onChange={(e) => e.target.value && setCustomRange(customStart, e.target.value)}
            aria-label="Hasta (fecha final del rango)"
            style={ESTILO_INPUT_FECHA}
          />
        </span>
      )}
    </div>
  );
}

/**
 * SegmentedPicker — segmentado glass genérico (interno) para los filtros
 * globales. Reusa las MISMAS clases del RangePicker (design system).
 */
function SegmentedPicker({ opciones, valor, onChange, ariaLabel }) {
  return (
    <div className={`${styles.rangePicker} ${extra.rangePicker}`} role="group" aria-label={ariaLabel}>
      {opciones.map((o) => {
        const activo = valor === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            className={`${styles.rangeBtn} ${extra.rangeBtn} ${
              activo ? `${styles.rangeActive} ${extra.rangeActive}` : ''
            }`}
            onClick={() => onChange(o.value)}
            title={o.title}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** OrigenPicker — filtro global de origen: Todos / Web / App. */
export function OrigenPicker({ origen, setOrigen }) {
  return (
    <SegmentedPicker
      opciones={ORIGENES}
      valor={origen}
      onChange={setOrigen}
      ariaLabel="Filtrar por origen (APP / WEB)"
    />
  );
}

/** MetricaPicker — métrica base del KPI principal: Sesiones / Identidades / Logueados. */
export function MetricaPicker({ metrica, setMetrica }) {
  return (
    <SegmentedPicker
      opciones={METRICAS}
      valor={metrica}
      onChange={setMetrica}
      ariaLabel="Métrica base del KPI principal"
    />
  );
}

/** CompareToggle — activa/desactiva "Comparar con periodo anterior" (▲/▼ en KPIs). */
export function CompareToggle({ compare, setCompare }) {
  return (
    <div className={`${styles.rangePicker} ${extra.rangePicker}`}>
      <button
        type="button"
        aria-pressed={compare}
        className={`${styles.rangeBtn} ${extra.rangeBtn} ${
          compare ? `${styles.rangeActive} ${extra.rangeActive}` : ''
        }`}
        onClick={() => setCompare(!compare)}
        title="Carga también el periodo inmediatamente anterior de la misma duración y muestra el cambio (▲/▼) en los KPIs"
      >
        ⇄ Comparar
      </button>
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
 *
 * Los props rangeDays/setRangeDays se mantienen (retrocompatibles); los extras
 * del rango PERSONALIZADO se toman directamente del contrato compartido
 * (useDashboardFilters lee el mismo querystring que el hook de la página), de
 * modo que TODAS las sub-páginas heredan el picker custom sin cambiar su
 * código. El back-link conserva el querystring para no perder los filtros.
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
  const { customStart, customEnd, setCustomRange, filtersSearch } = useDashboardFilters();
  return (
    <header className={`${styles.header} ${extra.header}`}>
      <div className={extra.headerMain}>
        <Link
          to={{ pathname: '/admin/dashboard', search: filtersSearch }}
          className={`${styles.backLink} ${extra.backLink}`}
        >
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
          <RangePicker
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            customStart={customStart}
            customEnd={customEnd}
            setCustomRange={setCustomRange}
          />
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
