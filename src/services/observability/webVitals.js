// ── Observabilidad (Fase 4): Web Vitals básicos SIN dependencias ──────────────
// Medimos LCP, CLS e INP (y FID si está disponible) usando PerformanceObserver
// nativo. Al ocultarse la página (visibilitychange -> hidden) o en pagehide,
// enviamos UN evento 'web_vital' a analytics_events (fire-and-forget).
//
// Si PerformanceObserver no existe (navegadores viejos / SSR), todo es no-op.
// Nunca lanzamos: cada bloque va envuelto en try/catch.

import { createDocument } from '../firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES, ANALYTICS_KEYS } from '../analytics/schema';
import { getAnonymousId } from '../analytics/tracker';

let initialized = false;
let flushed = false;

// Métricas acumuladas durante la vida de la página.
const metrics = {
  lcp: null, // Largest Contentful Paint (ms) — mayor valor observado
  cls: 0, // Cumulative Layout Shift — suma de shifts sin input reciente
  inp: null, // Interaction to Next Paint aproximado (ms) — mayor duración observada
  fid: null, // First Input Delay (ms) — primer input
};

const observers = [];

function safeNow() {
  try {
    return Date.now();
  } catch {
    return 0;
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

function getCurrentPath() {
  try {
    return (typeof window !== 'undefined' && window.location?.pathname) || null;
  } catch {
    return null;
  }
}

function observe(type, callback, extraOpts) {
  try {
    if (typeof PerformanceObserver === 'undefined') return;
    // Algunos tipos no están soportados; PerformanceObserver lanza si el type
    // no se reconoce, por eso cada observe va en su propio try/catch.
    const obs = new PerformanceObserver((list) => {
      try {
        callback(list.getEntries());
      } catch {
        /* no-op */
      }
    });
    obs.observe({ type, buffered: true, ...(extraOpts || {}) });
    observers.push(obs);
  } catch {
    /* type no soportado: no-op */
  }
}

function setupObservers() {
  // LCP: nos quedamos con el mayor startTime/renderTime observado.
  observe('largest-contentful-paint', (entries) => {
    for (const entry of entries) {
      const value = entry.renderTime || entry.startTime || 0;
      if (metrics.lcp == null || value > metrics.lcp) metrics.lcp = value;
    }
  });

  // CLS: sumamos shifts que no fueron causados por input reciente.
  observe('layout-shift', (entries) => {
    for (const entry of entries) {
      if (!entry.hadRecentInput) {
        metrics.cls += entry.value || 0;
      }
    }
  });

  // FID (first-input): primer retraso de interacción.
  observe('first-input', (entries) => {
    for (const entry of entries) {
      const value = (entry.processingStart || 0) - (entry.startTime || 0);
      if (metrics.fid == null) metrics.fid = value;
    }
  });

  // INP aproximado: usamos la mayor duración de event timing como proxy simple.
  // (No es el INP oficial percentil-based, pero da una señal útil sin libs.)
  observe('event', (entries) => {
    for (const entry of entries) {
      const value = entry.duration || 0;
      if (metrics.inp == null || value > metrics.inp) metrics.inp = value;
    }
  }, { durationThreshold: 40 });
}

function round(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

// Envía las métricas acumuladas UNA sola vez (fire-and-forget).
function flush() {
  try {
    if (flushed) return;
    // Si no se observó ninguna métrica, no enviamos nada.
    const hasData = metrics.lcp != null || metrics.cls > 0 || metrics.inp != null || metrics.fid != null;
    if (!hasData) return;
    flushed = true;

    // Desconectar observers; ya no necesitamos seguir midiendo.
    for (const obs of observers) {
      try {
        obs.disconnect();
      } catch {
        /* no-op */
      }
    }

    const payload = {
      type: ANALYTICS_EVENT_TYPES.WEB_VITAL,
      path: getCurrentPath(),
      lcp: round(metrics.lcp),
      cls: metrics.cls > 0 ? Number(metrics.cls.toFixed(4)) : 0,
      inp: round(metrics.inp),
      fid: round(metrics.fid),
      anonymousId: getAnonymousId(),
      sessionId: getSessionId(),
      clientTsMs: safeNow(),
      clientType: getClientType(),
    };

    Promise.resolve(createDocument(ANALYTICS_COLLECTIONS.EVENTS, payload)).catch(() => {});
  } catch {
    /* la observabilidad nunca rompe la app */
  }
}

/**
 * Inicializa la medición de Web Vitals. Idempotente: solo actúa una vez.
 * No-op si PerformanceObserver no existe.
 */
export function initWebVitals() {
  try {
    if (initialized) return;
    if (typeof window === 'undefined') return;
    if (typeof PerformanceObserver === 'undefined') return;
    initialized = true;

    setupObservers();

    // Enviamos al ocultarse la página: visibilitychange (hidden) es el momento
    // más fiable en móvil; pagehide cubre el cierre real de la pestaña.
    const onHidden = () => {
      try {
        if (document.visibilityState === 'hidden') flush();
      } catch {
        flush();
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush, { once: true });
  } catch {
    /* no-op */
  }
}
