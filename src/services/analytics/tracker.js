import { createDocument, updateDocument } from '../firebase/firestore';
import {
  ANALYTICS_COLLECTIONS,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_KEYS,
  normalizeRoute,
} from './schema';

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

function getStoredSessionId() {
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

function getClientMeta() {
  if (typeof window === 'undefined') {
    return { referrer: null, userAgent: null, language: null, platform: null, timeZone: null };
  }
  return {
    referrer: document?.referrer || null,
    userAgent: window.navigator?.userAgent || null,
    language: window.navigator?.language || null,
    platform: window.navigator?.platform || null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
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

export async function ensureAnalyticsSession(userCtx = {}, entryPath = '/') {
  const stored = getStoredSessionId();
  if (runtimeSessionDocId) return runtimeSessionDocId;
  if (stored) {
    runtimeSessionDocId = stored;
    return runtimeSessionDocId;
  }
  const anonymousId = getAnonymousId();
  const sessionKey = randomId('sess');
  const now = Date.now();
  const meta = getClientMeta();
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
    ...parseUTM(),
  };
  const { id, error } = await createDocument(ANALYTICS_COLLECTIONS.SESSIONS, payload);
  if (error || !id) {
    return null;
  }
  runtimeSessionDocId = id;
  setStoredSessionId(id);
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
    eventData: orderInfo // Expected: { orderId, totalCents, currency }
  });
}

