import { getCollection, getDocument } from './firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES, formatDayKey, safeNumber, toMillis } from './analytics/schema';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';

const DEFAULT_EVENTS_LIMIT = 1200;
const DEFAULT_SESSIONS_LIMIT = 400;
const REALTIME_WINDOW_MS = 5 * 60 * 1000;

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

function parseUserAgent(ua) {
  if (!ua) return { browser: 'Desconocido', os: 'Desconocido', device: 'Desconocido' };
  const lower = ua.toLowerCase();
  
  let browser = 'Desconocido';
  if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('edg')) browser = 'Edge';
  else if (lower.includes('opr') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('chrome')) browser = 'Chrome';
  else if (lower.includes('safari')) browser = 'Safari';
  
  let os = 'Desconocido';
  if (lower.includes('win')) os = 'Windows';
  else if (lower.includes('mac')) os = 'MacOS';
  else if (lower.includes('linux')) os = 'Linux';
  if (lower.includes('android')) os = 'Android';
  if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  
  let device = 'Desktop';
  if (lower.includes('mobi') || lower.includes('android') || lower.includes('iphone') || lower.includes('ipad')) device = 'Mobile';
  
  return { browser, os, device };
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

export async function getUsersBaseList() {
  const { data, error } = await getCollection(
    PORTAL_USERS_COLLECTION,
    [],
    { field: 'updatedAt', direction: 'desc' },
    800
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

export async function getGlobalAnalytics(dateFilter = {}) {
  const { startDateMs, endDateMs } = dateFilter;
  const realtimeThreshold = Date.now() - REALTIME_WINDOW_MS;

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
    realtimeSessionsResult,
  ] = await Promise.all([
    getUsersBaseList(),
    getCollection(ANALYTICS_COLLECTIONS.EVENTS, eventFilters, { field: 'clientTsMs', direction: 'desc' }, startDateMs ? 10000 : DEFAULT_EVENTS_LIMIT),
    getCollection(ANALYTICS_COLLECTIONS.SESSIONS, sessionFilters, { field: 'startedAtClientMs', direction: 'desc' }, startDateMs ? 10000 : DEFAULT_SESSIONS_LIMIT),
    getDocument(ANALYTICS_COLLECTIONS.GLOBAL_SUMMARY, 'latest'),
    getCollection(
      ANALYTICS_COLLECTIONS.SESSIONS,
      [{ field: 'lastSeenAtClientMs', operator: '>=', value: realtimeThreshold }],
      { field: 'lastSeenAtClientMs', direction: 'desc' },
      1000
    ),
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
  
  const realtimeSessions = (realtimeSessionsResult.data || []).filter((s) => {
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

  const realtimeActiveLoggedUsers = countArr(uniqueRealtimeSessions, s => !!s.uid);
  const realtimeActiveRegisteredUsers = countArr(uniqueRealtimeSessions, s => s.uid && existingUserUids.has(s.uid));
  const realtimeActiveVisitors = countArr(uniqueRealtimeSessions, s => !s.uid);
  
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
    data: {
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
      deviceStats: aggregateDevices(sessions),
      utmStats: aggregateUTM(sessions),
      geographyStats: aggregateGeography(sessions),
      realtimeWindowMs: REALTIME_WINDOW_MS,
      realtimeActiveSessions: countArr(uniqueRealtimeSessions),
      realtimeActiveIdentities: countArr(uniqueRealtimeSessions),
      realtimeActiveLoggedUsers,
      realtimeActiveRegisteredUsers,
      realtimeActiveVisitors,
      realtimeSessionsDetails,
      realtimeRefreshedAtMs: Date.now(),
      estimatedSummary: globalSummaryResult.data || null,
      eventsForCharts: events // Para graficar
    },
    error:
      usersResult.error ||
      eventsResult.error ||
      sessionsResult.error ||
      realtimeSessionsResult.error ||
      null,
  };
}
