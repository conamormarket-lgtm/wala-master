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
const { buildDailyDoc } = require("./analyticsAggregations");

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
};
