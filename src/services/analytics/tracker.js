import { createDocument, updateDocument } from '../firebase/firestore';
import {
  ANALYTICS_COLLECTIONS,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_KEYS,
  normalizeRoute,
} from './schema';
import { parseUserAgent } from './ua';
import { detectCountry, getCachedCountry } from '../geo';

let runtimeSessionDocId = null;

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function randomId(prefix) {
  const base = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${base}`;
}

export function getAnonymousId() {
  if (!canUseBrowserStorage()) return randomId('anon');
  const existing = window.localStorage.getItem(ANALYTICS_KEYS.ANON_ID);
  if (existing) return existing;
  const generated = randomId('anon');
  window.localStorage.setItem(ANALYTICS_KEYS.ANON_ID, generated);
  return generated;
}

// Exportado: useHeatmapTracker lo usa para vincular cada lote de clics
// con la sesión de analítica activa (misma clave de sessionStorage).
export function getStoredSessionId() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null;
  return window.sessionStorage.getItem(ANALYTICS_KEYS.SESSION_ID);
}

function setStoredSessionId(id) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return;
  if (!id) {
    window.sessionStorage.removeItem(ANALYTICS_KEYS.SESSION_ID);
    return;
  }
  window.sessionStorage.setItem(ANALYTICS_KEYS.SESSION_ID, id);
}

// Exportado: es el ÚNICO detector APP/WEB de la analítica (lo reutiliza
// useHeatmapTracker para etiquetar los lotes del mapa de calor).
export function getClientType() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? 'APP' : 'WEB';
}

function getClientMeta() {
  if (typeof window === 'undefined') {
    return { referrer: null, userAgent: null, language: null, platform: null, timeZone: null, clientType: 'WEB' };
  }
  return {
    referrer: document?.referrer || null,
    userAgent: window.navigator?.userAgent || null,
    language: window.navigator?.language || null,
    platform: window.navigator?.platform || null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    clientType: getClientType(),
  };
}

function parseUTM() {
  if (typeof window === 'undefined') return {};
  const query = new URLSearchParams(window.location.search);
  const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const res = {};
  utmParams.forEach(param => {
    if (query.has(param)) {
      res[param] = query.get(param);
    }
  });
  return res;
}

// Promesa de creación en curso: serializa llamadas CONCURRENTES (p.ej.
// trackPageView + trackProductView en el primer render pasaban ambas los
// checks antes del primer await y creaban DOS sesiones). Con la promesa
// memoizada, la segunda llamada espera a la primera en vez de duplicar.
let sessionCreationPromise = null;

export async function ensureAnalyticsSession(userCtx = {}, entryPath = '/') {
  const stored = getStoredSessionId();
  if (runtimeSessionDocId) return runtimeSessionDocId;
  if (stored) {
    runtimeSessionDocId = stored;
    return runtimeSessionDocId;
  }
  if (sessionCreationPromise) return sessionCreationPromise;
  sessionCreationPromise = crearSesion(userCtx, entryPath).finally(() => {
    // Se limpia siempre: si la creación tuvo éxito, runtimeSessionDocId ya está
    // seteado y las siguientes llamadas retornan temprano; si falló (null),
    // permite reintentar en el próximo evento.
    sessionCreationPromise = null;
  });
  return sessionCreationPromise;
}

// Cuerpo real de la creación de sesión (solo lo invoca ensureAnalyticsSession).
async function crearSesion(userCtx = {}, entryPath = '/') {
  const anonymousId = getAnonymousId();
  const sessionKey = randomId('sess');
  const now = Date.now();
  const meta = getClientMeta();

  // ── Enriquecimiento de dispositivo (síncrono, costo cero) ───────────────
  // Deriva device/browser/os con el MISMO parser que usa el dashboard en
  // lectura (./ua.js): así lo guardado y lo derivado nunca discrepan.
  // Si no hay UA (entorno raro) simplemente no se escriben los campos:
  // los lectores toleran su ausencia (retrocompatible).
  let uaFields = {};
  try {
    if (meta.userAgent) {
      const { device, browser, os } = parseUserAgent(meta.userAgent);
      uaFields = { device, browser, os };
    }
  } catch {
    uaFields = {}; // el parseo jamás debe romper la creación de la sesión
  }

  // ── País SIN bloquear ────────────────────────────────────────────────────
  // Si geo.js ya tiene caché vigente (detección IP previa, TTL 24h) el país
  // viaja en el MISMO create. La caché solo existe tras una detección IP
  // exitosa (el fallback PE nunca se cachea) → fuente "ip" garantizada.
  // Si no hay caché, la sesión se crea sin país y se completa en background
  // (ver detectCountry() más abajo, fire-and-forget).
  let geoFields = {};
  try {
    const cachedCountry = getCachedCountry();
    if (cachedCountry?.code) {
      geoFields = {
        countryCode: cachedCountry.code,
        countryName: cachedCountry.name || cachedCountry.code,
        geoSource: 'ip',
      };
    }
  } catch {
    geoFields = {}; // sin caché legible: se resuelve en background
  }

  const payload = {
    sessionKey,
    anonymousId,
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    entryPath: normalizeRoute(entryPath),
    lastPath: normalizeRoute(entryPath),
    startedAtClientMs: now,
    lastSeenAtClientMs: now,
    ...meta,
    ...uaFields,
    ...geoFields,
    ...parseUTM(),
  };
  const { id, error } = await createDocument(ANALYTICS_COLLECTIONS.SESSIONS, payload);
  if (error || !id) {
    return null;
  }
  runtimeSessionDocId = id;
  setStoredSessionId(id);

  // País en background si no hubo caché: fire-and-forget, JAMÁS bloquea la
  // UX ni el flujo de tracking. Al resolver, se completa la sesión con un
  // update. geoSource viene EXPLÍCITO de detectCountry() (country.source:
  // "ip" = ipwho.is respondió; "fallback" = default PE) — así una detección
  // IP exitosa no se etiqueta mal aunque localStorage esté bloqueado
  // (modo privado/WebView) y la caché no se haya podido escribir.
  if (!geoFields.countryCode) {
    try {
      detectCountry()
        .then((country) => {
          if (!country?.code) return null;
          return updateDocument(ANALYTICS_COLLECTIONS.SESSIONS, id, {
            countryCode: country.code,
            countryName: country.name || country.code,
            geoSource: country.source === 'ip' ? 'ip' : 'fallback',
          });
        })
        .catch(() => {
          /* la geolocalización nunca debe romper el tracking */
        });
    } catch {
      /* fire-and-forget: cualquier fallo aquí se ignora */
    }
  }
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.SESSION_START,
    sessionId: id,
    sessionKey,
    anonymousId,
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    path: normalizeRoute(entryPath),
    clientTsMs: now,
    clientType: getClientType(),
  });
  return runtimeSessionDocId;
}

export async function trackPageView(pathname, userCtx = {}) {
  const route = normalizeRoute(pathname);
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx, route);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.PAGE_VIEW,
    path: route,
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
  });
  if (sessionId) {
    await updateDocument(ANALYTICS_COLLECTIONS.SESSIONS, sessionId, {
      uid: userCtx?.uid || null,
      email: userCtx?.email || null,
      displayName: userCtx?.displayName || null,
      anonymousId,
      lastPath: route,
      lastSeenAtClientMs: now,
    });
  }
}

export async function trackRouteDwell(pathname, dwellMs, userCtx = {}) {
  const route = normalizeRoute(pathname);
  if (!dwellMs || dwellMs < 500) return;
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx, route);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.ROUTE_DWELL,
    path: route,
    dwellMs: Math.round(dwellMs),
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
  });
  if (sessionId) {
    await updateDocument(ANALYTICS_COLLECTIONS.SESSIONS, sessionId, {
      lastPath: route,
      lastSeenAtClientMs: now,
    });
  }
}

export async function linkSessionToUser(userCtx = {}) {
  const sessionId = runtimeSessionDocId || getStoredSessionId();
  if (!sessionId || !userCtx?.uid) return;
  await updateDocument(ANALYTICS_COLLECTIONS.SESSIONS, sessionId, {
    uid: userCtx.uid,
    email: userCtx.email || null,
    displayName: userCtx.displayName || null,
    linkedToUserAtClientMs: Date.now(),
  });
}

export async function endAnalyticsSession(userCtx = {}, lastPath = '/') {
  const sessionId = runtimeSessionDocId || getStoredSessionId();
  if (!sessionId) return;
  const now = Date.now();
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.SESSION_END,
    path: normalizeRoute(lastPath),
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId: getAnonymousId(),
    sessionId,
    clientTsMs: now,
    clientType: getClientType(),
  });
  await updateDocument(ANALYTICS_COLLECTIONS.SESSIONS, sessionId, {
    endedAtClientMs: now,
    lastPath: normalizeRoute(lastPath),
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
  });
}

export async function trackAddToCart(productInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.ADD_TO_CART,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: productInfo // Expected: { totalCents, currency, items: [...] }
  });
}

export async function trackCheckoutStart(checkoutInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx, window.location.pathname || '/checkout');
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.CHECKOUT_START,
    path: window.location.pathname || '/checkout',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: checkoutInfo
  });
}

export async function trackPurchaseComplete(orderInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx, window.location.pathname || '/checkout/success');
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.PURCHASE_COMPLETE,
    path: window.location.pathname || '/checkout/success',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: orderInfo // Expected: { orderId, totalCents, currency }
  });
}

export async function trackProductView(productInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.PRODUCT_VIEW,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: productInfo // Expected: { productId, name, category, isCombo }
  });
}

export async function trackSearchQuery(query, userCtx = {}) {
  if (!query) return;
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.SEARCH_QUERY,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: { query: query.trim() }
  });
}

export async function trackScrollDepth(percentage, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.SCROLL_DEPTH,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: { depth: percentage }
  });
}

export async function trackBannerClick(bannerId, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.BANNER_CLICK,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: { bannerId }
  });
}

export async function trackCategoryView(categoryInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.CATEGORY_VIEW,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: categoryInfo // Esperado: { categoryId, categoryName }
  });
}

export async function trackCollectionView(collectionInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.COLLECTION_VIEW,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: collectionInfo // Esperado: { collectionId, collectionName }
  });
}

export async function trackEditorOpen(editorInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.EDITOR_OPEN,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: editorInfo // Esperado: { productId, editorType }
  });
}

export async function trackEditorSave(editorInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.EDITOR_SAVE,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: editorInfo // Esperado: { productId, editorType }
  });
}

export async function trackMinigame(type, gameInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  // Selecciona el tipo de evento segun 'type' (start o complete)
  const eventType = type === 'complete'
    ? ANALYTICS_EVENT_TYPES.MINIGAME_COMPLETE
    : ANALYTICS_EVENT_TYPES.MINIGAME_START;
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: eventType,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: gameInfo // Esperado: { gameId, gameName, ... }
  });
}

export async function trackMissionComplete(missionInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.MISSION_COMPLETE,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: missionInfo // Esperado: { missionId, missionName, coins }
  });
}

export async function trackWishlist(wishlistInfo = {}, userCtx = {}) {
  const now = Date.now();
  const anonymousId = getAnonymousId();
  const sessionId = await ensureAnalyticsSession(userCtx);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: ANALYTICS_EVENT_TYPES.WISHLIST_ADD,
    path: window.location.pathname || '/',
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId,
    sessionId: sessionId || null,
    clientTsMs: now,
    clientType: getClientType(),
    eventData: wishlistInfo // Esperado: { action, productId, categoryId }
  });
}
