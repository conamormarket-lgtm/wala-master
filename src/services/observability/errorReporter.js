// ── Observabilidad (Fase 4): reportador ligero de errores de cliente ──────────
// Captura errores de render (vía ErrorBoundary), window.onerror y
// unhandledrejection, y los registra en `analytics_events` con type
// 'client_error'. Todo es fire-and-forget y va envuelto en try/catch para que
// NUNCA afecte el render ni el rendimiento.
//
// Reglas:
//  - Sin PII: solo message, stack recortado, url, userAgent.
//  - Dedupe + throttle por sesión: máximo N eventos por sesión y se ignoran
//    errores idénticos repetidos (misma firma) dentro de una ventana corta.
//  - Si falta Firestore/servicio, se comporta como hoy (no-op silencioso).

import { createDocument } from '../firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES, ANALYTICS_KEYS } from '../analytics/schema';
import { getAnonymousId } from '../analytics/tracker';

// Límite duro de eventos de error por sesión para no inundar Firestore.
const MAX_ERRORS_PER_SESSION = 20;
// Longitud máxima de campos de texto (recorte para no almacenar PII ni stacks enormes).
const MAX_MESSAGE_LEN = 500;
const MAX_STACK_LEN = 2000;
// Ventana de dedupe: errores con la misma firma dentro de este lapso se ignoran.
const DEDUPE_WINDOW_MS = 10000;

// Estado en memoria (por carga de página). No persiste entre recargas; suficiente
// para evitar tormentas de errores dentro de una misma sesión activa.
let sentCount = 0;
const recentSignatures = new Map(); // firma -> último ts enviado

function safeNow() {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

function truncate(value, max) {
  if (typeof value !== 'string') return null;
  if (value.length <= max) return value;
  return value.slice(0, max);
}

function getCurrentUrl() {
  try {
    // Solo pathname + search; evitamos hash que a veces lleva tokens.
    if (typeof window === 'undefined') return null;
    const { pathname, search } = window.location || {};
    return `${pathname || ''}${search || ''}` || null;
  } catch {
    return null;
  }
}

function getUserAgent() {
  try {
    return typeof navigator !== 'undefined' ? navigator.userAgent || null : null;
  } catch {
    return null;
  }
}

function getSessionId() {
  try {
    if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null;
    return window.sessionStorage.getItem(ANALYTICS_KEYS.SESSION_ID);
  } catch {
    return null;
  }
}

function getClientType() {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? 'APP' : 'WEB';
  } catch {
    return 'WEB';
  }
}

// Firma estable para dedupe: source + primeros chars del mensaje.
function buildSignature(source, message) {
  const msg = (message || '').slice(0, 120);
  return `${source}|${msg}`;
}

// Decide si debemos enviar este error (respeta tope y dedupe).
function shouldSend(signature) {
  if (sentCount >= MAX_ERRORS_PER_SESSION) return false;
  const now = safeNow();
  const last = recentSignatures.get(signature);
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  recentSignatures.set(signature, now);
  // Limpieza ocasional para no crecer sin límite.
  if (recentSignatures.size > 100) {
    recentSignatures.clear();
  }
  return true;
}

/**
 * Registra un error de cliente en analytics_events (fire-and-forget).
 * @param {Object} info
 * @param {string} info.source   - origen: 'render' | 'window.onerror' | 'unhandledrejection'
 * @param {string} [info.message]
 * @param {string} [info.stack]
 * @param {string} [info.componentStack] - solo para errores de render
 */
export function reportClientError(info = {}) {
  try {
    const source = info.source || 'unknown';
    const message = truncate(info.message, MAX_MESSAGE_LEN);
    const signature = buildSignature(source, message);
    if (!shouldSend(signature)) return;
    sentCount += 1;

    const payload = {
      type: ANALYTICS_EVENT_TYPES.CLIENT_ERROR,
      source,
      message: message || null,
      stack: truncate(info.stack, MAX_STACK_LEN),
      componentStack: truncate(info.componentStack, MAX_STACK_LEN),
      url: getCurrentUrl(),
      userAgent: getUserAgent(),
      anonymousId: getAnonymousId(),
      sessionId: getSessionId(),
      clientTsMs: safeNow(),
      clientType: getClientType(),
    };

    // Fire-and-forget: nunca propagamos el rechazo de la promesa.
    Promise.resolve(createDocument(ANALYTICS_COLLECTIONS.EVENTS, payload)).catch(() => {});
  } catch {
    // Silencioso: la observabilidad jamás debe romper la app.
  }
}

// Normaliza un Error/valor desconocido a { message, stack }.
export function normalizeError(value) {
  try {
    if (value instanceof Error) {
      return { message: value.message, stack: value.stack };
    }
    if (value && typeof value === 'object') {
      const message = typeof value.message === 'string' ? value.message : null;
      const stack = typeof value.stack === 'string' ? value.stack : null;
      return { message: message || safeStringify(value), stack };
    }
    return { message: value == null ? null : String(value), stack: null };
  } catch {
    return { message: null, stack: null };
  }
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}
