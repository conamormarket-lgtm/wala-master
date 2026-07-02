// ════════════════════════════════════════════════════════════════════════════
// PRE-AGREGACIÓN ANALÍTICA DIARIA (Fase 2, PARTE 1)
// ────────────────────────────────────────────────────────────────────────────
// Cloud Function gen2 onSchedule que, cada madrugada (00:20 hora Lima), agrega el
// día ANTERIOR completo de analytics_events + analytics_sessions en un único doc
// analytics_daily/{YYYY-MM-DD}. El dashboard pasa de leer ~5000 eventos crudos a
// leer N docs diarios (7/30/90), reduciendo lecturas de Firestore 60-170x.
//
// Diseño clave:
//   - Idempotente: reescribe el doc completo del día con .set() (sin merge). Re-
//     ejecutar = mismo resultado. Permite backfill de histórico.
//   - Paginación con cursor (orderBy clientTsMs, limit 2000, startAfter) para no
//     chocar con el techo de memoria/timeout al crecer el tráfico.
//   - Agrupa por DÍA LIMA de clientTsMs (el campo que ya grafica el dashboard).
//   - La lógica de agregación vive en ./analyticsAggregations (funciones puras),
//     compartiendo EXACTAMENTE los mismos campos que el cálculo legacy del cliente.
// ════════════════════════════════════════════════════════════════════════════

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { buildDailyDoc, ANALYTICS_EVENT_TYPES, safeNumber } = require("./analyticsAggregations");

const db = admin.firestore();

const EVENTS_COLLECTION = "analytics_events";
const SESSIONS_COLLECTION = "analytics_sessions";
const DAILY_COLLECTION = "analytics_daily";

// Tamaño de página de la query paginada con cursor. 2000 mantiene baja la memoria
// y permite procesar muchos días sin chocar con el timeout (540s).
const PAGE_SIZE = 2000;

// ── Ventana del día en hora Lima ─────────────────────────────────────────────
// Lima es UTC-5 fijo (Perú no usa DST). Un día Lima "YYYY-MM-DD" empieza a las
// 00:00 Lima = 05:00 UTC de esa fecha y dura 86_400_000 ms.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5
const DAY_MS = 24 * 60 * 60 * 1000;

// dayKey ("YYYY-MM-DD") del día Lima que contiene el instante `nowMs`.
function limaDayKey(nowMs) {
  const lima = new Date(nowMs - LIMA_OFFSET_MS);
  const yyyy = lima.getUTCFullYear();
  const mm = String(lima.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(lima.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// dayKey del día Lima ANTERIOR al instante `nowMs` (lo que agrega el cron).
function previousLimaDayKey(nowMs) {
  return limaDayKey(nowMs - DAY_MS);
}

// [startMs, endMs] en epoch ms (UTC) que cubren un dayKey Lima.
// start = 00:00 Lima = (medianoche UTC del dayKey) + 5h. end = start + 1 día - 1ms.
// endMs es INCLUSIVO (la query usa <=), igual que el dashboard legacy.
function limaDayRange(dayKey) {
  const [y, m, d] = dayKey.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) {
    throw new Error(`dayKey inválido (se esperaba YYYY-MM-DD): ${dayKey}`);
  }
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + LIMA_OFFSET_MS;
  const endMs = startMs + DAY_MS - 1;
  return { startMs, endMs };
}

// Valida que un string tenga forma YYYY-MM-DD (defensa del backfill).
function isValidDayKey(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ── Query paginada con cursor sobre un campo de tiempo ───────────────────────
// Lee toda la colección filtrada por [field >= start, field <= end] en páginas de
// PAGE_SIZE ordenadas por `field`, avanzando con startAfter(doc). Devuelve un
// array plano de { id, ...data }. No carga todo de golpe vía .get() sin límite.
async function fetchAllPaged(collectionName, field, startMs, endMs) {
  const out = [];
  const base = db
    .collection(collectionName)
    .where(field, ">=", startMs)
    .where(field, "<=", endMs)
    .orderBy(field, "asc")
    .limit(PAGE_SIZE);

  let cursor = null;
  // Bucle de paginación: se detiene cuando una página devuelve < PAGE_SIZE docs.
  for (;;) {
    let q = base;
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
    if (snap.size < PAGE_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// CAMPOS ADITIVOS DEL DOC DIARIO (Fase 2, PARTE 2)
// ────────────────────────────────────────────────────────────────────────────
// Desgloses de sesión (país/dispositivo/navegador/SO/cliente), conteos de
// identidades, embudo completo del día y top de identidades. Se AÑADEN al doc
// que arma buildDailyDoc sin pisar ningún campo existente (retrocompatible:
// los lectores viejos los ignoran; los nuevos toleran su ausencia con ??/||).
// ════════════════════════════════════════════════════════════════════════════

// ── parseUserAgent del CONTRATO (copia de src/services/analytics/ua.js) ───────
// ¡MANTENER EN SYNC con src/services/analytics/ua.js! functions/ no comparte el
// árbol de src/, así que la lógica se duplica a propósito. Es el MISMO parser
// que usa la captura (tracker.js/useHeatmapTracker) y la lectura del dashboard:
// distingue Tablet (a diferencia del parseUserAgent legacy de
// ./analyticsAggregations, que se conserva intacto para no alterar el campo
// `devices` ya publicado) y devuelve 'Desconocido' SOLO si no hay UA.
function parseUserAgentContrato(ua) {
  if (!ua) return { browser: "Desconocido", os: "Desconocido", device: "Desconocido" };
  const lower = String(ua).toLowerCase();

  // Navegador: el orden importa (Edge/Opera incluyen 'chrome'; Chrome incluye 'safari')
  let browser = "Desconocido";
  if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg")) browser = "Edge";
  else if (lower.includes("opr") || lower.includes("opera")) browser = "Opera";
  else if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("safari")) browser = "Safari";

  // Sistema operativo: Android/iOS pisan a Windows/Mac/Linux a propósito
  // (algunos UA móviles incluyen tokens de escritorio).
  let os = "Desconocido";
  if (lower.includes("win")) os = "Windows";
  else if (lower.includes("mac")) os = "MacOS";
  else if (lower.includes("linux")) os = "Linux";
  if (lower.includes("android")) os = "Android";
  if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";

  // Dispositivo: tablets primero (iPad / 'tablet' / Android SIN 'mobi',
  // convención estándar de Android), luego móviles; el resto es escritorio.
  let device = "Desktop";
  const isTablet =
    lower.includes("ipad") ||
    lower.includes("tablet") ||
    (lower.includes("android") && !lower.includes("mobi"));
  const isMobile =
    lower.includes("mobi") || lower.includes("iphone") || lower.includes("android");
  if (isTablet) device = "Tablet";
  else if (isMobile) device = "Mobile";

  return { browser, os, device };
}

// ── Aproximación timeZone → país (SOLO sesiones viejas sin geo por IP) ────────
// Las sesiones nuevas traen countryCode/geoSource (agente A). Para el histórico
// solo hay timeZone (IANA), que se mapea a ISO-2 como APROXIMACIÓN y se publica
// en un mapa APARTE (byCountryAprox) para no mezclarlo con la geo confiable.
// Mapa acotado a los mercados relevantes de WALA; lo no mapeado va a "unknown".
const TIMEZONE_A_PAIS = {
  "America/Lima": "PE",
  "America/Bogota": "CO",
  "America/Mexico_City": "MX", "America/Cancun": "MX", "America/Monterrey": "MX",
  "America/Tijuana": "MX", "America/Merida": "MX", "America/Chihuahua": "MX",
  "America/Hermosillo": "MX", "America/Mazatlan": "MX",
  "America/Santiago": "CL", "America/Punta_Arenas": "CL", "Pacific/Easter": "CL",
  "America/Guayaquil": "EC", "Pacific/Galapagos": "EC",
  "America/La_Paz": "BO",
  "America/Caracas": "VE",
  "America/Asuncion": "PY",
  "America/Montevideo": "UY",
  "America/Panama": "PA",
  "America/Guatemala": "GT",
  "America/Costa_Rica": "CR",
  "America/El_Salvador": "SV",
  "America/Tegucigalpa": "HN",
  "America/Managua": "NI",
  "America/Santo_Domingo": "DO",
  "America/Havana": "CU",
  "America/Sao_Paulo": "BR", "America/Manaus": "BR", "America/Fortaleza": "BR",
  "America/Recife": "BR", "America/Bahia": "BR", "America/Belem": "BR",
  "America/Cuiaba": "BR", "America/Campo_Grande": "BR", "America/Rio_Branco": "BR",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "America/Detroit": "US", "Pacific/Honolulu": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Halifax": "CA",
  "Europe/Madrid": "ES", "Atlantic/Canary": "ES",
  "Europe/Lisbon": "PT",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
  "Europe/Rome": "IT",
  "Europe/Berlin": "DE",
};

// Devuelve ISO-2 aproximado desde una zona IANA, o null si no se puede mapear.
function paisDesdeTimeZone(tz) {
  if (!tz || typeof tz !== "string") return null;
  if (TIMEZONE_A_PAIS[tz]) return TIMEZONE_A_PAIS[tz];
  // Argentina usa subzona propia: "America/Argentina/Buenos_Aires", etc.
  // (más los alias legados sin el nivel intermedio).
  if (tz.startsWith("America/Argentina/")) return "AR";
  if (tz === "America/Buenos_Aires" || tz === "America/Cordoba" || tz === "America/Mendoza") return "AR";
  return null;
}

// ── Tope de cardinalidad de los mapas contados ────────────────────────────────
// Un mapa { clave: count } no puede crecer sin límite dentro del doc diario
// (1 MiB máx). Se conservan las top-49 claves por count y el resto se agrupa
// en "otros" (máx 50 claves por mapa).
const MAX_CLAVES_MAPA = 50;

function capMap(mapa, max = MAX_CLAVES_MAPA, claveOtros = "otros") {
  const entries = Object.entries(mapa);
  if (entries.length <= max) return mapa;
  entries.sort((a, b) => b[1] - a[1]);
  const out = {};
  let resto = 0;
  entries.forEach(([k, v], i) => {
    if (i < max - 1) out[k] = v;
    else resto += v;
  });
  if (resto > 0) out[claveOtros] = (out[claveOtros] || 0) + resto;
  return out;
}

// ── Desgloses desde las SESIONES del día ──────────────────────────────────────
// byCountry: countryCode SOLO cuando geoSource === "ip" (geo confiable). Todo lo
//   demás (fallback PE, sin dato, sesiones viejas) cuenta como "unknown", de modo
//   que sum(byCountry) === nº de sesiones del día.
// byCountryAprox: mapa APARTE, solo para sesiones viejas SIN geo (sin geoSource
//   ni countryCode), aproximando el país desde el timeZone crudo guardado.
// byDevice/byBrowser/byOS: usa los campos ya capturados (agente A) y, si faltan
//   (sesiones viejas), los deriva del userAgent crudo con el parser del contrato.
// byClientType: {APP, WEB} — todo lo no-APP cuenta como WEB (igual que segmentOf).
function aggregateSessionBreakdowns(sessions = []) {
  const byCountry = {};
  const byCountryAprox = {};
  const byDevice = {};
  const byBrowser = {};
  const byOS = {};
  const byClientType = { APP: 0, WEB: 0 };

  sessions.forEach((s) => {
    if (!s) return;

    // País confiable (solo fuente "ip"); el resto es "unknown".
    if (s.geoSource === "ip" && s.countryCode) {
      const code = String(s.countryCode).toUpperCase();
      byCountry[code] = (byCountry[code] || 0) + 1;
    } else {
      byCountry.unknown = (byCountry.unknown || 0) + 1;
    }

    // Aproximación por timeZone SOLO para sesiones viejas sin geo capturada.
    if (!s.geoSource && !s.countryCode) {
      const aprox = paisDesdeTimeZone(s.timeZone) || "unknown";
      byCountryAprox[aprox] = (byCountryAprox[aprox] || 0) + 1;
    }

    // Dispositivo/navegador/SO: campo guardado > derivado del UA crudo.
    const parsed = (s.device && s.browser && s.os)
      ? { device: s.device, browser: s.browser, os: s.os }
      : parseUserAgentContrato(s.userAgent);
    const device = s.device || parsed.device;
    const browser = s.browser || parsed.browser;
    const os = s.os || parsed.os;
    byDevice[device] = (byDevice[device] || 0) + 1;
    byBrowser[browser] = (byBrowser[browser] || 0) + 1;
    byOS[os] = (byOS[os] || 0) + 1;

    // Tipo de cliente: APP explícito; cualquier otro valor (o ausencia) es WEB.
    if (s.clientType === "APP") byClientType.APP += 1;
    else byClientType.WEB += 1;
  });

  return {
    byCountry: capMap(byCountry),
    byCountryAprox: capMap(byCountryAprox),
    byDevice: capMap(byDevice),
    byBrowser: capMap(byBrowser),
    byOS: capMap(byOS),
    byClientType,
  };
}

// ── Identidades del día (desde los EVENTOS) ───────────────────────────────────
// MISMA clave que activeIdentities/getUnique del dashboard: uid || email ||
// anonymousId. identitiesTotal coincide con activeIdentities.total (que ya
// existe en el doc y se conserva); aquí se añade el desglose logueado/anónimo.
// Un evento con uid usa el uid como clave → identitiesLoggedIn = uids únicos.
// NOTA: conteos diarios de únicos, NO sumables entre días.
function aggregateIdentityCounts(events = []) {
  const total = new Set();
  const logueados = new Set();
  events.forEach((e) => {
    if (!e) return;
    const id = e.uid || e.email || e.anonymousId;
    if (!id) return;
    total.add(id);
    if (e.uid) logueados.add(id);
  });
  return {
    identitiesTotal: total.size,
    identitiesLoggedIn: logueados.size,
    identitiesAnon: total.size - logueados.size,
  };
}

// ── Embudo COMPLETO del día, SIN topes ────────────────────────────────────────
// Cuenta sobre TODOS los eventos del día (fetchAllPaged pagina la colección
// entera del rango, sin límite tipo GLOBAL_EVENTS_LIMIT del cliente legacy).
// Se publica como funnelFull para NO pisar el campo funnel existente (que usa
// otra definición: views = page_view + route_dwell, y no cuenta product_view).
function aggregateFunnelFull(events = []) {
  const out = { views: 0, productViews: 0, addToCart: 0, checkoutStart: 0, purchases: 0 };
  events.forEach((e) => {
    if (!e) return;
    switch (e.type) {
      case ANALYTICS_EVENT_TYPES.PAGE_VIEW: out.views += 1; break;
      case ANALYTICS_EVENT_TYPES.PRODUCT_VIEW: out.productViews += 1; break;
      case ANALYTICS_EVENT_TYPES.ADD_TO_CART: out.addToCart += 1; break;
      case ANALYTICS_EVENT_TYPES.CHECKOUT_START: out.checkoutStart += 1; break;
      case ANALYTICS_EVENT_TYPES.PURCHASE_COMPLETE: out.purchases += 1; break;
      default: break;
    }
  });
  return out;
}

// ── Top identidades del día (para el futuro P2) ───────────────────────────────
// Clave por identidad = uid || anonymousId (los eventos siempre llevan ambos
// campos; si el usuario está logueado la clave es su uid). Acumula page_views y
// dwellMs por identidad y devuelve el top-25 ordenado por views (desempate por
// dwellMs). nombre = displayName || email || "anónimo" (el mejor visto en el día).
const TOP_IDENTIDADES = 25;

function aggregateTopIdentities(events = []) {
  const porIdentidad = new Map();
  events.forEach((e) => {
    if (!e) return;
    const clave = e.uid || e.anonymousId;
    if (!clave) return;
    if (!porIdentidad.has(clave)) {
      porIdentidad.set(clave, {
        clave,
        displayName: null,
        email: null,
        views: 0,
        dwellMs: 0,
        logueado: false,
      });
    }
    const ent = porIdentidad.get(clave);
    if (e.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW) ent.views += 1;
    if (e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) ent.dwellMs += safeNumber(e.dwellMs);
    // Se queda con el primer displayName/email no vacío visto en el día.
    if (e.displayName && !ent.displayName) ent.displayName = e.displayName;
    if (e.email && !ent.email) ent.email = e.email;
    if (e.uid) ent.logueado = true;
  });

  return [...porIdentidad.values()]
    .sort((a, b) => (b.views - a.views) || (b.dwellMs - a.dwellMs))
    .slice(0, TOP_IDENTIDADES)
    .map((ent) => ({
      clave: ent.clave,
      nombre: ent.displayName || ent.email || "anónimo",
      views: ent.views,
      dwellMs: ent.dwellMs,
      logueado: ent.logueado,
    }));
}

// ── Ensamblado de TODOS los campos aditivos de la Parte 2 ─────────────────────
// Devuelve un objeto plano que se mezcla (Object.assign) sobre el doc de
// buildDailyDoc. Ninguna clave colisiona con las existentes del contrato.
function buildDailyExtras(events = [], sessions = []) {
  return {
    ...aggregateSessionBreakdowns(sessions),
    ...aggregateIdentityCounts(events),
    funnelFull: aggregateFunnelFull(events),
    topIdentities: aggregateTopIdentities(events),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// procesarDia(dayKey): agrega un día concreto y reescribe su doc.
// Reutilizada por el cron (día anterior) y por el backfill (rango/un día).
// Idempotente: .set() sin merge reescribe el doc completo.
// ════════════════════════════════════════════════════════════════════════════
async function procesarDia(dayKey) {
  if (!isValidDayKey(dayKey)) {
    throw new Error(`procesarDia: dayKey inválido: ${dayKey}`);
  }
  const { startMs, endMs } = limaDayRange(dayKey);

  // Eventos del día (por clientTsMs, igual que el dashboard).
  const events = await fetchAllPaged(EVENTS_COLLECTION, "clientTsMs", startMs, endMs);
  // Sesiones del día (por startedAtClientMs, igual que getGlobalAnalytics).
  const sessions = await fetchAllPaged(SESSIONS_COLLECTION, "startedAtClientMs", startMs, endMs);

  // Ensamblar el doc del CONTRATO con las funciones puras compartidas.
  const doc = buildDailyDoc(dayKey, events, sessions);
  // Campos ADITIVOS (Parte 2): desgloses de sesión, identidades, embudo completo
  // y top identidades. No pisan ningún campo existente de buildDailyDoc.
  Object.assign(doc, buildDailyExtras(events, sessions));
  doc.generatedAt = FieldValue.serverTimestamp();

  // .set() sin merge: idempotente, reescribe el doc completo del día.
  await db.collection(DAILY_COLLECTION).doc(dayKey).set(doc);

  return { dayKey, eventCount: events.length, sessionCount: sessions.length };
}

// ── Genera los dayKeys del rango [fromDay, toDay] inclusive ──────────────────
function dayKeysInRange(fromDay, toDay) {
  const { startMs: fromStart } = limaDayRange(fromDay);
  const { startMs: toStart } = limaDayRange(toDay);
  if (toStart < fromStart) {
    throw new Error(`Rango inválido: toDay (${toDay}) es anterior a fromDay (${fromDay}).`);
  }
  const keys = [];
  for (let ms = fromStart; ms <= toStart; ms += DAY_MS) {
    // +1h de colchón evita errores de borde por aritmética (Lima no tiene DST).
    keys.push(limaDayKey(ms + 60 * 60 * 1000));
  }
  return keys;
}

// ════════════════════════════════════════════════════════════════════════════
// CF onSchedule: agrega el día anterior cada 00:20 hora Lima.
// gen2 → crea job en Cloud Scheduler + Pub/Sub. Memoria/timeout explícitos.
// ════════════════════════════════════════════════════════════════════════════
exports.aggregateAnalyticsDaily = onSchedule(
  {
    schedule: "20 0 * * *",        // 00:20 (tras cerrar el día anterior)
    timeZone: "America/Lima",       // hora de Lima
    retryCount: 2,                  // reintenta si falla (es idempotente)
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const dayKey = previousLimaDayKey(Date.now());
    try {
      const res = await procesarDia(dayKey);
      console.log(
        `aggregateAnalyticsDaily: ${dayKey} OK. eventos=${res.eventCount}, sesiones=${res.sessionCount}.`
      );
    } catch (e) {
      // Se propaga para que el retry de Cloud Scheduler vuelva a intentarlo.
      console.error(`aggregateAnalyticsDaily: error agregando ${dayKey}:`, e);
      throw e;
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// Callable de BACKFILL (solo admin): reconstruye días concretos con la MISMA
// lógica (procesarDia). Acepta { day } o { fromDay, toDay }. Pensado para llenar
// el histórico una vez tras desplegar, o re-agregar un día que cambió.
// ════════════════════════════════════════════════════════════════════════════
exports.aggregateAnalyticsDailyBackfill = functions
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    // Autorización: solo admin (custom claim admin === true).
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    }
    if (context.auth.token.admin !== true) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo un administrador puede ejecutar el backfill de analítica."
      );
    }

    const { day, fromDay, toDay } = data || {};

    // Resolver la lista de días a procesar.
    let dayKeys;
    if (day) {
      if (!isValidDayKey(day)) {
        throw new functions.https.HttpsError("invalid-argument", `day inválido (YYYY-MM-DD): ${day}`);
      }
      dayKeys = [day];
    } else if (fromDay && toDay) {
      if (!isValidDayKey(fromDay) || !isValidDayKey(toDay)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "fromDay/toDay inválidos (se espera YYYY-MM-DD)."
        );
      }
      try {
        dayKeys = dayKeysInRange(fromDay, toDay);
      } catch (e) {
        throw new functions.https.HttpsError("invalid-argument", e.message);
      }
    } else {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere { day } o { fromDay, toDay }."
      );
    }

    // Tope de seguridad para no procesar rangos absurdos en una sola llamada.
    const MAX_DAYS = 120;
    if (dayKeys.length > MAX_DAYS) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `El rango pedido (${dayKeys.length} días) supera el máximo de ${MAX_DAYS}. Divídelo en llamadas más cortas.`
      );
    }

    // Procesar secuencialmente (cada día pagina su propia query; evita saturar I/O).
    const results = [];
    for (const k of dayKeys) {
      try {
        const r = await procesarDia(k);
        results.push({ ...r, ok: true });
      } catch (e) {
        console.error(`aggregateAnalyticsDailyBackfill: error en ${k}:`, e);
        results.push({ dayKey: k, ok: false, error: e.message || String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return { processed: results.length, ok: okCount, results };
  });

// Exporta helpers internos para pruebas (no afecta a la CF desplegada).
exports._internals = {
  limaDayKey,
  previousLimaDayKey,
  limaDayRange,
  isValidDayKey,
  dayKeysInRange,
  procesarDia,
  // Parte 2 (campos aditivos del doc diario)
  parseUserAgentContrato,
  paisDesdeTimeZone,
  capMap,
  aggregateSessionBreakdowns,
  aggregateIdentityCounts,
  aggregateFunnelFull,
  aggregateTopIdentities,
  buildDailyExtras,
};
