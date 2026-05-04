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
    if (ev.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW) {
      byViews.set(route, (byViews.get(route) || 0) + 1);
    }
    if (ev.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) {
      byDwell.set(route, (byDwell.get(route) || 0) + safeNumber(ev.dwellMs));
    }
  });

  const topRoutesByViews = [...byViews.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }));

  const topRoutesByDwell = [...byDwell.entries()]
    .sort((a, b) => b[1] - a[1])
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
  let views = 0;
  let adds = 0;
  let checkouts = 0;
  let purchases = 0;
  const uniqueUsersInFunnel = { views: new Set(), adds: new Set(), checkouts: new Set(), purchases: new Set() };

  events.forEach(e => {
    const id = e.uid || e.anonymousId || e.sessionId;
    if (e.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW || e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) {
      views++;
      if (id) uniqueUsersInFunnel.views.add(id);
    }
    if (e.type === ANALYTICS_EVENT_TYPES.ADD_TO_CART) {
      adds++;
      if (id) uniqueUsersInFunnel.adds.add(id);
    }
    if (e.type === ANALYTICS_EVENT_TYPES.CHECKOUT_START) {
      checkouts++;
      if (id) uniqueUsersInFunnel.checkouts.add(id);
    }
    if (e.type === ANALYTICS_EVENT_TYPES.PURCHASE_COMPLETE) {
      purchases++;
      if (id) uniqueUsersInFunnel.purchases.add(id);
    }
  });

  return {
    events: { views, adds, checkouts, purchases },
    users: {
      views: uniqueUsersInFunnel.views.size,
      adds: uniqueUsersInFunnel.adds.size,
      checkouts: uniqueUsersInFunnel.checkouts.size,
      purchases: uniqueUsersInFunnel.purchases.size,
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

export async function getGlobalAnalytics() {
  const realtimeThreshold = Date.now() - REALTIME_WINDOW_MS;
  const [
    usersResult,
    eventsResult,
    sessionsResult,
    globalSummaryResult,
    realtimeSessionsResult,
  ] = await Promise.all([
    getUsersBaseList(),
    getCollection(ANALYTICS_COLLECTIONS.EVENTS, [], { field: 'createdAt', direction: 'desc' }, DEFAULT_EVENTS_LIMIT),
    getCollection(ANALYTICS_COLLECTIONS.SESSIONS, [], { field: 'createdAt', direction: 'desc' }, DEFAULT_SESSIONS_LIMIT),
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
  const uniqueUsers = new Set(
    events
      .map((e) => e.uid || e.email || e.anonymousId)
      .filter(Boolean)
  );
  const routeStats = aggregateRouteMetrics(events);
  const globalDwellMs = events
    .filter((e) => e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL)
    .reduce((acc, e) => acc + safeNumber(e.dwellMs), 0);
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

  const activeLogged = uniqueRealtimeSessions.filter(s => !!s.uid).length;
  const activeRegistered = uniqueRealtimeSessions.filter(s => s.uid && existingUserUids.has(s.uid)).length;
  const activeVisitors = uniqueRealtimeSessions.filter(s => !s.uid).length;
  
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
    hasAccount: !!s.uid
  })).sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);

  return {
    data: {
      totalRegisteredUsers: users.length,
      activeIdentities: uniqueUsers.size,
      totalSessions: sessions.length,
      totalEvents: events.length,
      totalDwellMs: globalDwellMs,
      avgDwellPerSessionMs: sessions.length > 0 ? Math.round(globalDwellMs / sessions.length) : 0,
      funnelStats: aggregateFunnel(events),
      abandonedCarts: aggregateAbandonedCarts(events, sessions),
      topRoutesByViews: routeStats.topRoutesByViews,
      topRoutesByDwell: routeStats.topRoutesByDwell,
      mostTimeRoute: routeStats.mostTimeRoute,
      deviceStats: aggregateDevices(sessions),
      utmStats: aggregateUTM(sessions),
      geographyStats: aggregateGeography(sessions),
      realtimeWindowMs: REALTIME_WINDOW_MS,
      realtimeActiveSessions: uniqueRealtimeSessions.length,
      realtimeActiveIdentities: uniqueRealtimeSessions.length,
      realtimeActiveLoggedUsers: activeLogged,
      realtimeActiveRegisteredUsers: activeRegistered,
      realtimeActiveVisitors: activeVisitors,
      realtimeSessionsDetails,
      realtimeRefreshedAtMs: Date.now(),
      estimatedSummary: globalSummaryResult.data || null,
    },
    error:
      usersResult.error ||
      eventsResult.error ||
      sessionsResult.error ||
      realtimeSessionsResult.error ||
      null,
  };
}
