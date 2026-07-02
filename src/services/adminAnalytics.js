import { getCollection, getDocument } from './firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES, formatDayKey, safeNumber, toMillis } from './analytics/schema';
// Parser de UA compartido con la captura (tracker.js escribe device/browser/os
// con este MISMO parseo): ver src/services/analytics/ua.js.
import { parseUserAgent } from './analytics/ua';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';

const DEFAULT_EVENTS_LIMIT = 1200;
const DEFAULT_SESSIONS_LIMIT = 400;
const REALTIME_WINDOW_MS = 5 * 60 * 1000;

// --- Límites de lectura para el dashboard global (anti "Quota exceeded") ---
// El dashboard refetchea cada 20s y SIEMPRE envía un rango de fechas, por lo que
// estos límites se aplican casi siempre. Mantenerlos bajos es clave para no
// agotar la cuota de lecturas de Firestore.
const GLOBAL_EVENTS_LIMIT = 5000;   // sube el tope: con 1500 (orden DESC) solo llegaban eventos del día más reciente → la serie de tráfico salía en un solo punto. 5000 cubre varios días del rango.
const GLOBAL_SESSIONS_LIMIT = 300;  // antes: 10000 con filtro de fecha
const GLOBAL_REALTIME_SESSIONS_LIMIT = 150; // antes: 1000
const GLOBAL_USERS_LIMIT = 400;     // base de usuarios para enriquecer realtime

// --- Cache en memoria para absorber el refetch cada 20s ---
// La misma query (mismo rango de fechas) se sirve desde cache durante este TTL
// en vez de releer miles de documentos en cada ciclo de polling.
const GLOBAL_CACHE_TTL_MS = 30 * 1000;
const globalAnalyticsCache = new Map(); // key -> { expiresAt, payload }

function readGlobalCache(key) {
  const hit = globalAnalyticsCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.payload;
  if (hit) globalAnalyticsCache.delete(key);
  return null;
}

function writeGlobalCache(key, payload) {
  // El campo realtime se recalcula al servir desde cache (ver getGlobalAnalytics),
  // por lo que cachear el resto durante 30s es seguro para el dashboard.
  globalAnalyticsCache.set(key, { expiresAt: Date.now() + GLOBAL_CACHE_TTL_MS, payload });
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function uniqById(arr = []) {
  const map = new Map();
  arr.forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return [...map.values()];
}

function aggregateRouteMetrics(events = []) {
  const byViews = new Map();
  const byDwell = new Map();
  events.forEach((ev) => {
    const route = ev.path || 'unknown';
    const type = ev.clientType === 'APP' ? 'app' : 'web';
    if (!byViews.has(route)) byViews.set(route, { total: 0, app: 0, web: 0 });
    if (!byDwell.has(route)) byDwell.set(route, { total: 0, app: 0, web: 0 });

    if (ev.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW) {
      byViews.get(route).total += 1;
      byViews.get(route)[type] += 1;
    }
    if (ev.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) {
      const dwell = safeNumber(ev.dwellMs);
      byDwell.get(route).total += dwell;
      byDwell.get(route)[type] += dwell;
    }
  });

  const topRoutesByViews = [...byViews.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }));

  const topRoutesByDwell = [...byDwell.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([path, dwellMs]) => ({ path, dwellMs }));

  const best = topRoutesByDwell[0] || null;
  return { topRoutesByViews, topRoutesByDwell, mostTimeRoute: best };
}

// Seguimiento de pedidos (engagement de WALA sobre el estado del pedido).
// Mide cuánta gente entra a ver el estado de su pedido, cuántos usuarios únicos
// y cuánto tiempo pasan, sobre las rutas que empiezan con '/cuenta/pedidos'
// (incluye el listado '/cuenta/pedidos' y el detalle '/cuenta/pedidos/:id').
// Trabaja sobre los eventos ya cargados (page_view + route_dwell). Tolerante a
// ausencia de datos: si no hay eventos relevantes devuelve ceros.
const ORDER_TRACKING_PREFIX = '/cuenta/pedidos';

function isOrderTrackingPath(path) {
  if (typeof path !== 'string') return false;
  // Normaliza query/hash antes de comparar el prefijo de la ruta.
  const clean = path.split('?')[0].split('#')[0];
  return clean === ORDER_TRACKING_PREFIX || clean.startsWith(`${ORDER_TRACKING_PREFIX}/`);
}

export function deriveOrderTracking(events = []) {
  let views = 0;            // total de page_view sobre el estado de pedido
  let totalDwellMs = 0;     // suma de route_dwell.dwellMs
  let dwellEvents = 0;      // nº de eventos de permanencia (para el promedio)
  const uniqueUsers = new Set(); // uid distintos (cae a anonymousId/email si no hay uid)

  events.forEach((ev) => {
    if (!isOrderTrackingPath(ev?.path)) return;

    if (ev.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW) {
      views += 1;
    }
    if (ev.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) {
      totalDwellMs += safeNumber(ev.dwellMs);
      dwellEvents += 1;
    }

    // Usuario único: prioriza uid; si es anónimo usa anonymousId/email como fallback.
    const identity = ev.uid || ev.anonymousId || ev.email;
    if (identity) uniqueUsers.add(identity);
  });

  return {
    views,
    uniqueUsers: uniqueUsers.size,
    totalDwellMs,
    // Tiempo promedio por evento de permanencia (ms). 0 si no hay permanencias.
    avgDwellMs: dwellEvents > 0 ? Math.round(totalDwellMs / dwellEvents) : 0,
  };
}

function aggregateDevices(sessions = []) {
  const byDevice = new Map();
  const byBrowser = new Map();
  const byOS = new Map();
  
  sessions.forEach(s => {
    const { device, browser, os } = parseUserAgent(s.userAgent);
    byDevice.set(device, (byDevice.get(device) || 0) + 1);
    byBrowser.set(browser, (byBrowser.get(browser) || 0) + 1);
    byOS.set(os, (byOS.get(os) || 0) + 1);
  });
  
  return {
    topDevices: [...byDevice.entries()].map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count),
    topBrowsers: [...byBrowser.entries()].map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count),
    topOS: [...byOS.entries()].map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count),
  };
}

function aggregateUTM(sessions = []) {
  const bySource = new Map();
  const byCampaign = new Map();

  sessions.forEach(s => {
    const src = s.utm_source || 'Directo';
    bySource.set(src, (bySource.get(src) || 0) + 1);
    if (s.utm_campaign) byCampaign.set(s.utm_campaign, (byCampaign.get(s.utm_campaign) || 0) + 1);
  });

  return {
    topSources: [...bySource.entries()].map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
    topCampaigns: [...byCampaign.entries()].map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count),
  };
}

function aggregateGeography(sessions = []) {
  const byTimezone = new Map();

  sessions.forEach(s => {
    if (s.timeZone) {
      const region = s.timeZone.split('/')[1] || s.timeZone;
      byTimezone.set(region, (byTimezone.get(region) || 0) + 1);
    }
  });

  return {
    topRegions: [...byTimezone.entries()].map(([name, count]) => ({ name: name.replace(/_/g, ' '), count })).sort((a,b) => b.count - a.count),
  };
}

function aggregateFrequency(events = []) {
  const days = new Set();
  events.forEach((ev) => {
    const key = formatDayKey(ev.createdAt || ev.clientTsMs);
    if (key) days.add(key);
  });
  return {
    activeDays: days.size,
    frequencyPerActiveDay: days.size > 0 ? events.length / days.size : 0,
  };
}

function computeLastAccess(events = [], sessions = []) {
  const eventMax = events.reduce((acc, ev) => Math.max(acc, toMillis(ev.createdAt || ev.clientTsMs)), 0);
  const sessionMax = sessions.reduce((acc, s) => Math.max(acc, toMillis(s.updatedAt || s.lastSeenAtClientMs || s.createdAt)), 0);
  return Math.max(eventMax, sessionMax) || null;
}

function aggregateTopSearches(events = []) {
  const byQuery = new Map();
  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.SEARCH_QUERY && ev.eventData?.query) {
      const q = ev.eventData.query.toLowerCase();
      const type = ev.clientType === 'APP' ? 'app' : 'web';
      if (!byQuery.has(q)) byQuery.set(q, { total: 0, app: 0, web: 0 });
      byQuery.get(q).total++;
      byQuery.get(q)[type]++;
    }
  });
  return [...byQuery.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([query, stats]) => ({ query, ...stats }));
}

function aggregateTopProducts(events = []) {
  const byProduct = new Map();
  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.PRODUCT_VIEW && ev.eventData?.productId) {
      const id = ev.eventData.productId;
      const type = ev.clientType === 'APP' ? 'app' : 'web';
      if (!byProduct.has(id)) byProduct.set(id, { name: ev.eventData.name, total: 0, app: 0, web: 0 });
      byProduct.get(id).total++;
      byProduct.get(id)[type]++;
    }
  });
  return [...byProduct.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

// Top categorias por vistas: cuenta eventos que llevan categoryId/categoryName
// en eventData. Se nutre de PRODUCT_VIEW, CATEGORY_VIEW y ADD_TO_CART.
// Tolera la ausencia de estos campos (devuelve [] si no hay datos).
function aggregateTopCategories(events = []) {
  const RELEVANT = new Set([
    ANALYTICS_EVENT_TYPES.PRODUCT_VIEW,
    ANALYTICS_EVENT_TYPES.CATEGORY_VIEW,
    ANALYTICS_EVENT_TYPES.ADD_TO_CART,
  ]);
  const byCategory = new Map();
  events.forEach((ev) => {
    if (!RELEVANT.has(ev.type)) return;
    const id = ev.eventData?.categoryId;
    const name = ev.eventData?.categoryName;
    // Solo agregamos si hay un identificador o un nombre de categoria.
    const key = id || name;
    if (!key) return;
    if (!byCategory.has(key)) byCategory.set(key, { id: id || null, name: name || id || null, total: 0 });
    byCategory.get(key).total++;
    // Si llega un nombre legible mas tarde, lo conservamos.
    if (name && !byCategory.get(key).name) byCategory.get(key).name = name;
  });
  return [...byCategory.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

// Top colecciones por vistas: cuenta eventos con collectionId/collectionName.
// Se nutre de COLLECTION_VIEW y PRODUCT_VIEW. Tolera ausencia de campos.
function aggregateTopCollections(events = []) {
  const RELEVANT = new Set([
    ANALYTICS_EVENT_TYPES.COLLECTION_VIEW,
    ANALYTICS_EVENT_TYPES.PRODUCT_VIEW,
  ]);
  const byCollection = new Map();
  events.forEach((ev) => {
    if (!RELEVANT.has(ev.type)) return;
    const id = ev.eventData?.collectionId;
    const name = ev.eventData?.collectionName;
    const key = id || name;
    if (!key) return;
    if (!byCollection.has(key)) byCollection.set(key, { id: id || null, name: name || id || null, total: 0 });
    byCollection.get(key).total++;
    if (name && !byCollection.get(key).name) byCollection.get(key).name = name;
  });
  return [...byCollection.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

// Uso de funcionalidades: agrupa eventos por area funcional para medir adopcion.
// editor (EDITOR_OPEN/SAVE), minijuegos (MINIGAME_*), misiones (MISSION_COMPLETE),
// wishlist (WISHLIST_ADD) y busqueda (SEARCH_QUERY). Devuelve solo areas con uso > 0.
function aggregateFeatureUsage(events = []) {
  const counters = {
    editor: 0,
    minijuegos: 0,
    misiones: 0,
    wishlist: 0,
    busqueda: 0,
  };
  events.forEach((ev) => {
    switch (ev.type) {
      case ANALYTICS_EVENT_TYPES.EDITOR_OPEN:
      case ANALYTICS_EVENT_TYPES.EDITOR_SAVE:
        counters.editor++;
        break;
      case ANALYTICS_EVENT_TYPES.MINIGAME_START:
      case ANALYTICS_EVENT_TYPES.MINIGAME_COMPLETE:
        counters.minijuegos++;
        break;
      case ANALYTICS_EVENT_TYPES.MISSION_COMPLETE:
        counters.misiones++;
        break;
      case ANALYTICS_EVENT_TYPES.WISHLIST_ADD:
        counters.wishlist++;
        break;
      case ANALYTICS_EVENT_TYPES.SEARCH_QUERY:
        counters.busqueda++;
        break;
      default:
        break;
    }
  });
  return Object.entries(counters)
    .filter(([, total]) => total > 0)
    .map(([area, total]) => ({ area, total }))
    .sort((a, b) => b.total - a.total);
}

function aggregateBannerClicks(events = []) {
  const byBanner = new Map();
  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.BANNER_CLICK && ev.eventData?.bannerId) {
      const id = ev.eventData.bannerId;
      const type = ev.clientType === 'APP' ? 'app' : 'web';
      if (!byBanner.has(id)) byBanner.set(id, { total: 0, app: 0, web: 0 });
      byBanner.get(id).total++;
      byBanner.get(id)[type]++;
    }
  });
  return [...byBanner.entries()]
    .map(([bannerId, stats]) => ({ bannerId, ...stats }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function aggregateScrollDepth(events = []) {
  let count = { total: 0, app: 0, web: 0 };
  let sum = { total: 0, app: 0, web: 0 };

  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.SCROLL_DEPTH && typeof ev.eventData?.depth === 'number') {
      const depth = ev.eventData.depth;
      const type = ev.clientType === 'APP' ? 'app' : 'web';
      count.total++; sum.total += depth;
      count[type]++; sum[type] += depth;
    }
  });

  return {
    avgTotal: count.total > 0 ? Math.round(sum.total / count.total) : 0,
    avgApp: count.app > 0 ? Math.round(sum.app / count.app) : 0,
    avgWeb: count.web > 0 ? Math.round(sum.web / count.web) : 0,
  };
}

function aggregateBounceRate(events = [], sessions = []) {
  let count = { total: 0, app: 0, web: 0 };
  let bounced = { total: 0, app: 0, web: 0 };

  sessions.forEach(s => {
    const id = s.id || s.sessionKey;
    const type = s.clientType === 'APP' ? 'app' : 'web';
    const sEvents = events.filter(e => e.sessionId === id);
    if (sEvents.length > 0) {
      count.total++;
      count[type]++;
      // Consider bounce if they only had 1 page_view and no other meaningful interactions
      const hasInteraction = sEvents.some(e => e.type !== ANALYTICS_EVENT_TYPES.SESSION_START && e.type !== ANALYTICS_EVENT_TYPES.SESSION_END && e.type !== ANALYTICS_EVENT_TYPES.PAGE_VIEW);
      if (!hasInteraction && sEvents.filter(e => e.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW).length <= 1) {
        bounced.total++;
        bounced[type]++;
      }
    }
  });

  return {
    total: count.total > 0 ? Math.round((bounced.total / count.total) * 100) : 0,
    app: count.app > 0 ? Math.round((bounced.app / count.app) * 100) : 0,
    web: count.web > 0 ? Math.round((bounced.web / count.web) * 100) : 0,
  };
}

function aggregateFunnel(events = []) {
  const counters = {
    views: { total: 0, app: 0, web: 0 },
    adds: { total: 0, app: 0, web: 0 },
    checkouts: { total: 0, app: 0, web: 0 },
    purchases: { total: 0, app: 0, web: 0 },
  };
  const uniqueUsersInFunnel = {
    views: { total: new Set(), app: new Set(), web: new Set() },
    adds: { total: new Set(), app: new Set(), web: new Set() },
    checkouts: { total: new Set(), app: new Set(), web: new Set() },
    purchases: { total: new Set(), app: new Set(), web: new Set() },
  };

  events.forEach(e => {
    const id = e.uid || e.anonymousId || e.sessionId;
    const type = e.clientType === 'APP' ? 'app' : 'web';
    const track = (key) => {
      counters[key].total++;
      counters[key][type]++;
      if (id) {
        uniqueUsersInFunnel[key].total.add(id);
        uniqueUsersInFunnel[key][type].add(id);
      }
    };
    
    if (e.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW || e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) track('views');
    if (e.type === ANALYTICS_EVENT_TYPES.ADD_TO_CART) track('adds');
    if (e.type === ANALYTICS_EVENT_TYPES.CHECKOUT_START) track('checkouts');
    if (e.type === ANALYTICS_EVENT_TYPES.PURCHASE_COMPLETE) track('purchases');
  });

  return {
    events: counters,
    users: {
      views: { total: uniqueUsersInFunnel.views.total.size, app: uniqueUsersInFunnel.views.app.size, web: uniqueUsersInFunnel.views.web.size },
      adds: { total: uniqueUsersInFunnel.adds.total.size, app: uniqueUsersInFunnel.adds.app.size, web: uniqueUsersInFunnel.adds.web.size },
      checkouts: { total: uniqueUsersInFunnel.checkouts.total.size, app: uniqueUsersInFunnel.checkouts.app.size, web: uniqueUsersInFunnel.checkouts.web.size },
      purchases: { total: uniqueUsersInFunnel.purchases.total.size, app: uniqueUsersInFunnel.purchases.app.size, web: uniqueUsersInFunnel.purchases.web.size },
    }
  };
}

function aggregateAbandonedCarts(events = [], sessions = []) {
  const cartSessions = new Set();
  const purchaseSessions = new Set();
  const sessionLatestCartEvent = new Map();
  
  events.forEach(e => {
    if (!e.sessionId) return;
    if (e.type === ANALYTICS_EVENT_TYPES.ADD_TO_CART) {
      cartSessions.add(e.sessionId);
      if (!sessionLatestCartEvent.has(e.sessionId) || toMillis(e.createdAt || e.clientTsMs) > toMillis(sessionLatestCartEvent.get(e.sessionId).createdAt || sessionLatestCartEvent.get(e.sessionId).clientTsMs)) {
         sessionLatestCartEvent.set(e.sessionId, e);
      }
    }
    if (e.type === ANALYTICS_EVENT_TYPES.PURCHASE_COMPLETE) {
      purchaseSessions.add(e.sessionId);
    }
  });
  
  const abandonedIds = [...cartSessions].filter(id => !purchaseSessions.has(id));
  
  const abandoned = [];
  abandonedIds.forEach(id => {
    const session = sessions.find(s => s.id === id || s.sessionKey === id);
    if (session) {
       const lastCartEvent = sessionLatestCartEvent.get(id);
       abandoned.push({
         ...session,
         lastCartValue: lastCartEvent?.eventData?.totalCents || 0,
         abandonedAtMs: toMillis(session.lastSeenAtClientMs || session.updatedAt || session.createdAt)
       });
    }
  });

  return abandoned.sort((a,b) => b.abandonedAtMs - a.abandonedAtMs).slice(0, 50);
}

// Calcula el bloque de métricas "en vivo" a partir de las sesiones realtime.
// Aislado para poder recomputarlo barato en cada refetch sin releer eventos/sesiones.
function computeRealtimeBlock(realtimeSessionsData = [], realtimeThreshold, existingUserUids = new Set()) {
  const countArr = (arr, cond = () => true) => {
    let t = 0, a = 0, w = 0;
    arr.forEach(i => {
      if (!cond(i)) return;
      t++;
      if (i.clientType === 'APP') a++; else w++;
    });
    return { total: t, app: a, web: w };
  };

  const realtimeSessions = realtimeSessionsData.filter((s) => {
    const seenAt = toMillis(s.lastSeenAtClientMs || s.updatedAt || s.createdAt);
    const endedAt = toMillis(s.endedAtClientMs);
    return seenAt >= realtimeThreshold && (!endedAt || endedAt < seenAt);
  });

  const latestSessionsByIdentity = new Map();
  realtimeSessions.forEach(s => {
    const identityKey = s.uid || s.anonymousId || s.email || s.sessionKey || s.id;
    const seenAt = toMillis(s.lastSeenAtClientMs || s.updatedAt || s.createdAt);
    if (!latestSessionsByIdentity.has(identityKey)) {
      latestSessionsByIdentity.set(identityKey, s);
    } else {
      const existing = latestSessionsByIdentity.get(identityKey);
      const existingSeenAt = toMillis(existing.lastSeenAtClientMs || existing.updatedAt || existing.createdAt);
      if (seenAt > existingSeenAt) {
        latestSessionsByIdentity.set(identityKey, s);
      }
    }
  });

  const uniqueRealtimeSessions = Array.from(latestSessionsByIdentity.values());

  const realtimeSessionsDetails = uniqueRealtimeSessions.map(s => ({
    id: s.id || s.sessionKey,
    uid: s.uid,
    email: s.email,
    displayName: s.displayName,
    anonymousId: s.anonymousId,
    lastPath: s.lastPath || 'Desconocido',
    lastSeenAtMs: toMillis(s.lastSeenAtClientMs || s.updatedAt || s.createdAt),
    startedAtMs: toMillis(s.startedAtClientMs || s.createdAt),
    platform: s.platform || parseUserAgent(s.userAgent).os,
    device: parseUserAgent(s.userAgent).device,
    browser: parseUserAgent(s.userAgent).browser,
    referrer: s.referrer,
    isRegistered: s.uid ? existingUserUids.has(s.uid) : false,
    hasAccount: !!s.uid,
    clientType: s.clientType || 'WEB'
  })).sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);

  return {
    realtimeWindowMs: REALTIME_WINDOW_MS,
    realtimeActiveSessions: countArr(uniqueRealtimeSessions),
    realtimeActiveIdentities: countArr(uniqueRealtimeSessions),
    realtimeActiveLoggedUsers: countArr(uniqueRealtimeSessions, s => !!s.uid),
    realtimeActiveRegisteredUsers: countArr(uniqueRealtimeSessions, s => s.uid && existingUserUids.has(s.uid)),
    realtimeActiveVisitors: countArr(uniqueRealtimeSessions, s => !s.uid),
    realtimeSessionsDetails,
    realtimeRefreshedAtMs: Date.now(),
  };
}

export async function getUsersBaseList(limitCount = 800) {
  const { data, error } = await getCollection(
    PORTAL_USERS_COLLECTION,
    [],
    { field: 'updatedAt', direction: 'desc' },
    limitCount
  );
  if (error) return { data: [], error };
  const users = (data || []).map((u) => ({
    id: u.id,
    uid: u.id,
    displayName: u.displayName || u.nombre || 'Sin nombre',
    dni: u.dni || u.clienteNumeroDocumento || null,
    tipoDocumento: u.tipoDocumento || null,
    email: normalizeEmail(u.email) || null,
    updatedAt: u.updatedAt || null,
  }));
  return { data: users, error: null };
}

async function getAnalyticsEventsForUser(uid, email) {
  const byUid = uid
    ? await getCollection(
      ANALYTICS_COLLECTIONS.EVENTS,
      [{ field: 'uid', operator: '==', value: uid }],
      { field: 'createdAt', direction: 'desc' },
      DEFAULT_EVENTS_LIMIT
    )
    : { data: [], error: null };
  const byEmail = email
    ? await getCollection(
      ANALYTICS_COLLECTIONS.EVENTS,
      [{ field: 'email', operator: '==', value: email }],
      { field: 'createdAt', direction: 'desc' },
      DEFAULT_EVENTS_LIMIT
    )
    : { data: [], error: null };
  const err = byUid.error || byEmail.error;
  return { data: uniqById([...(byUid.data || []), ...(byEmail.data || [])]), error: err || null };
}

async function getSessionsForUser(uid, email) {
  const byUid = uid
    ? await getCollection(
      ANALYTICS_COLLECTIONS.SESSIONS,
      [{ field: 'uid', operator: '==', value: uid }],
      { field: 'createdAt', direction: 'desc' },
      DEFAULT_SESSIONS_LIMIT
    )
    : { data: [], error: null };
  const byEmail = email
    ? await getCollection(
      ANALYTICS_COLLECTIONS.SESSIONS,
      [{ field: 'email', operator: '==', value: email }],
      { field: 'createdAt', direction: 'desc' },
      DEFAULT_SESSIONS_LIMIT
    )
    : { data: [], error: null };
  const err = byUid.error || byEmail.error;
  return { data: uniqById([...(byUid.data || []), ...(byEmail.data || [])]), error: err || null };
}

export async function getUserAnalytics(uid, email) {
  const emailNorm = normalizeEmail(email);
  const [{ data: events, error: eventsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    getAnalyticsEventsForUser(uid, emailNorm),
    getSessionsForUser(uid, emailNorm),
  ]);
  const { data: estByUid } = uid
    ? await getDocument(ANALYTICS_COLLECTIONS.USER_SUMMARY, uid)
    : { data: null, error: null };
  const { data: estByEmailList } = emailNorm
    ? await getCollection(
      ANALYTICS_COLLECTIONS.USER_SUMMARY,
      [{ field: 'email', operator: '==', value: emailNorm }],
      { field: 'updatedAt', direction: 'desc' },
      1
    )
    : { data: [], error: null };
  const estimatedSummary = estByUid || estByEmailList?.[0] || null;

  const pageViews = events.filter((e) => e.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW);
  const dwellEvents = events.filter((e) => e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL);
  const totalDwellMs = dwellEvents.reduce((acc, e) => acc + safeNumber(e.dwellMs), 0);
  const totalSessions = sessions.length;
  const avgSessionMs = totalSessions > 0 ? Math.round(totalDwellMs / totalSessions) : 0;
  const routeStats = aggregateRouteMetrics(events);
  const frequency = aggregateFrequency(pageViews);
  const lastAccessAtMs = computeLastAccess(events, sessions);
  return {
    data: {
      uid: uid || null,
      email: emailNorm || null,
      metrics: {
        totalSessions,
        totalEvents: events.length,
        totalPageViews: pageViews.length,
        totalDwellMs,
        avgSessionMs,
        activeDays: frequency.activeDays,
        frequencyPerActiveDay: frequency.frequencyPerActiveDay,
        topRoutesByViews: routeStats.topRoutesByViews,
        topRoutesByDwell: routeStats.topRoutesByDwell,
        mostTimeRoute: routeStats.mostTimeRoute,
        lastAccessAtMs,
      },
      sessions,
      recentEvents: events.slice(0, 50),
      estimatedSummary,
    },
    error: eventsError || sessionsError || null,
  };
}

// Lectura LIGERA del bloque "en vivo" (realtime), sin las queries PESADAS de
// getGlobalAnalytics (eventos/sesiones del rango). Pensada para el dashboard
// cuando la lectura pre-agregada (analytics_daily) ya cubre el resto: así solo
// hacemos lo mínimo para alimentar el panel "En vivo":
//   - la query barata de sesiones realtime (ventana de 5 min, tope 150 docs)
//   - la base de usuarios (para marcar en el detalle qué sesiones son de
//     usuarios registrados, igual que hace computeRealtimeBlock)
// Devuelve EXACTAMENTE los mismos campos realtime y la misma forma { data, error }
// que getGlobalAnalytics, para que el consumidor no distinga la fuente.
export async function getRealtimeBlock() {
  const realtimeThreshold = Date.now() - REALTIME_WINDOW_MS;

  const [usersResult, realtimeSessionsResult] = await Promise.all([
    getUsersBaseList(GLOBAL_USERS_LIMIT),
    getCollection(
      ANALYTICS_COLLECTIONS.SESSIONS,
      [{ field: 'lastSeenAtClientMs', operator: '>=', value: realtimeThreshold }],
      { field: 'lastSeenAtClientMs', direction: 'desc' },
      GLOBAL_REALTIME_SESSIONS_LIMIT
    ),
  ]);

  const existingUserUids = new Set(
    (usersResult.data || []).map((u) => u.uid).filter(Boolean)
  );
  const realtimeBlock = computeRealtimeBlock(
    realtimeSessionsResult.data || [],
    realtimeThreshold,
    existingUserUids
  );

  return {
    data: realtimeBlock,
    error: usersResult.error || realtimeSessionsResult.error || null,
  };
}

export async function getGlobalAnalytics(dateFilter = {}) {
  const { startDateMs, endDateMs } = dateFilter;
  const realtimeThreshold = Date.now() - REALTIME_WINDOW_MS;
  const cacheKey = `${startDateMs || 0}:${endDateMs || 0}`;

  // --- Realtime: lectura barata y siempre fresca (no se cachea) ---
  // Se calcula incluso en cache HIT para que el panel "en vivo" no quede congelado.
  const realtimeSessionsResult = await getCollection(
    ANALYTICS_COLLECTIONS.SESSIONS,
    [{ field: 'lastSeenAtClientMs', operator: '>=', value: realtimeThreshold }],
    { field: 'lastSeenAtClientMs', direction: 'desc' },
    GLOBAL_REALTIME_SESSIONS_LIMIT
  );

  // --- Cache HIT: reusar la parte pesada y solo recomputar realtime ---
  const cached = readGlobalCache(cacheKey);
  if (cached) {
    const existingUserUids = cached.__existingUserUids || new Set();
    const realtime = computeRealtimeBlock(realtimeSessionsResult.data || [], realtimeThreshold, existingUserUids);
    return {
      data: { ...cached.data, ...realtime },
      error: realtimeSessionsResult.error || null,
    };
  }

  const eventFilters = [];
  const sessionFilters = [];
  if (startDateMs) {
    eventFilters.push({ field: 'clientTsMs', operator: '>=', value: startDateMs });
    sessionFilters.push({ field: 'startedAtClientMs', operator: '>=', value: startDateMs });
  }
  if (endDateMs) {
    eventFilters.push({ field: 'clientTsMs', operator: '<=', value: endDateMs });
    sessionFilters.push({ field: 'startedAtClientMs', operator: '<=', value: endDateMs });
  }

  const [
    usersResult,
    eventsResult,
    sessionsResult,
    globalSummaryResult,
  ] = await Promise.all([
    getUsersBaseList(GLOBAL_USERS_LIMIT),
    getCollection(ANALYTICS_COLLECTIONS.EVENTS, eventFilters, { field: 'clientTsMs', direction: 'desc' }, GLOBAL_EVENTS_LIMIT),
    getCollection(ANALYTICS_COLLECTIONS.SESSIONS, sessionFilters, { field: 'startedAtClientMs', direction: 'desc' }, GLOBAL_SESSIONS_LIMIT),
    getDocument(ANALYTICS_COLLECTIONS.GLOBAL_SUMMARY, 'latest'),
  ]);

  const events = eventsResult.data || [];
  const sessions = sessionsResult.data || [];
  const users = usersResult.data || [];
  const existingUserUids = new Set(users.map((u) => u.uid).filter(Boolean));

  const countArr = (arr, cond = () => true) => {
    let t = 0, a = 0, w = 0;
    arr.forEach(i => {
      if (!cond(i)) return;
      t++;
      if (i.clientType === 'APP') a++; else w++;
    });
    return { total: t, app: a, web: w };
  };

  const getUnique = (arr) => {
    const sT = new Set(), sA = new Set(), sW = new Set();
    arr.forEach(e => {
      const id = e.uid || e.email || e.anonymousId;
      if (!id) return;
      sT.add(id);
      if (e.clientType === 'APP') sA.add(id); else sW.add(id);
    });
    return { total: sT.size, app: sA.size, web: sW.size };
  };

  const activeIdentities = getUnique(events);
  const totalSessions = countArr(sessions);
  const totalEvents = countArr(events);

  const globalDwellMs = { total: 0, app: 0, web: 0 };
  events.forEach(e => {
    if (e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) {
      const d = safeNumber(e.dwellMs);
      globalDwellMs.total += d;
      if (e.clientType === 'APP') globalDwellMs.app += d; else globalDwellMs.web += d;
    }
  });

  const avgDwellPerSessionMs = {
    total: totalSessions.total > 0 ? Math.round(globalDwellMs.total / totalSessions.total) : 0,
    app: totalSessions.app > 0 ? Math.round(globalDwellMs.app / totalSessions.app) : 0,
    web: totalSessions.web > 0 ? Math.round(globalDwellMs.web / totalSessions.web) : 0,
  };

  const routeStats = aggregateRouteMetrics(events);

  // Parte "pesada" (cacheable durante GLOBAL_CACHE_TTL_MS): depende solo del rango
  // de fechas, no del instante exacto. Excluye el bloque realtime, que se recalcula
  // siempre con datos frescos.
  const cacheableData = {
    totalRegisteredUsers: users.length,
    activeIdentities,
    totalSessions,
    totalEvents,
    totalDwellMs: globalDwellMs,
    avgDwellPerSessionMs,
    funnelStats: aggregateFunnel(events),
    abandonedCarts: aggregateAbandonedCarts(events, sessions),
    topRoutesByViews: routeStats.topRoutesByViews,
    topRoutesByDwell: routeStats.topRoutesByDwell,
    mostTimeRoute: routeStats.mostTimeRoute,
    topSearches: aggregateTopSearches(events),
    topProducts: aggregateTopProducts(events),
    // Nuevas metricas aditivas: categorias/colecciones por vistas y uso de funciones.
    topCategoriesByViews: aggregateTopCategories(events),
    topCollectionsByViews: aggregateTopCollections(events),
    featureUsage: aggregateFeatureUsage(events),
    bannerClicks: aggregateBannerClicks(events),
    // Seguimiento de pedidos (engagement sobre el estado del pedido en WALA).
    orderTracking: deriveOrderTracking(events),
    scrollDepth: aggregateScrollDepth(events),
    bounceRate: aggregateBounceRate(events, sessions),
    deviceStats: aggregateDevices(sessions),
    utmStats: aggregateUTM(sessions),
    geographyStats: aggregateGeography(sessions),
    estimatedSummary: globalSummaryResult.data || null,
    eventsForCharts: events, // Para graficar
  };

  // Guardar en cache (incluye el set de uids registrados para recomputar realtime
  // en próximos cache hits sin volver a leer la base de usuarios).
  writeGlobalCache(cacheKey, { data: cacheableData, __existingUserUids: existingUserUids });

  const realtimeBlock = computeRealtimeBlock(realtimeSessionsResult.data || [], realtimeThreshold, existingUserUids);

  return {
    data: {
      ...cacheableData,
      ...realtimeBlock,
    },
    error:
      usersResult.error ||
      eventsResult.error ||
      sessionsResult.error ||
      realtimeSessionsResult.error ||
      null,
  };
}
