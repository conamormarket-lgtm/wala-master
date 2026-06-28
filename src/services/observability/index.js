// ── Observabilidad (Fase 4): inicialización global ────────────────────────────
// Punto único de arranque. Registra:
//   1) window.onerror               -> reportClientError (source 'window.onerror')
//   2) unhandledrejection           -> reportClientError (source 'unhandledrejection')
//   3) Web Vitals (LCP/CLS/INP/FID) -> evento 'web_vital' al ocultar la página
//
// Todo es aditivo y retrocompatible: si algo falla, la app se comporta como hoy.
// No interfiere con los handlers existentes (index.jsx ya tiene los suyos para
// chunks obsoletos y errores de Fabric/Auth): nosotros NO hacemos preventDefault.

import { reportClientError, normalizeError } from './errorReporter';
import { initWebVitals } from './webVitals';

let initialized = false;

// Ignoramos ruido conocido que ya manejan otros handlers o que no es accionable.
function isIgnorableMessage(message) {
  if (!message || typeof message !== 'string') return false;
  // Errores de carga de chunk obsoleto: ya se autorecupera recargando (App.jsx).
  if (/Failed to fetch dynamically imported module|Failed to load module script|Importing a module script failed|error loading dynamically imported module/i.test(message)) {
    return true;
  }
  // Error de canvas de Fabric.js: ya silenciado en index.jsx / ErrorBoundary.
  if (message.includes("reading 'clearRect'")) return true;
  // ResizeObserver loop: ruido benigno común en navegadores.
  if (message.includes('ResizeObserver loop')) return true;
  // Config de Firebase Auth: ya manejado en index.jsx.
  if (message.includes('configuration-not-found')) return true;
  return false;
}

/**
 * Inicializa la observabilidad global. Idempotente y a prueba de fallos.
 */
export function initObservability() {
  try {
    if (initialized) return;
    if (typeof window === 'undefined') return;
    initialized = true;

    // 1) Errores síncronos no capturados.
    window.addEventListener('error', (event) => {
      try {
        // event.error es el Error real; event.message es el string del evento.
        const norm = normalizeError(event?.error);
        const message = norm.message || event?.message || null;
        if (isIgnorableMessage(message)) return;
        reportClientError({
          source: 'window.onerror',
          message,
          stack: norm.stack,
        });
      } catch {
        /* no-op */
      }
      // No llamamos preventDefault: respetamos el flujo/overlay existente.
    });

    // 2) Promesas rechazadas sin catch.
    window.addEventListener('unhandledrejection', (event) => {
      try {
        const norm = normalizeError(event?.reason);
        if (isIgnorableMessage(norm.message)) return;
        reportClientError({
          source: 'unhandledrejection',
          message: norm.message,
          stack: norm.stack,
        });
      } catch {
        /* no-op */
      }
    });

    // 3) Web Vitals (no-op si PerformanceObserver no existe).
    initWebVitals();
  } catch {
    /* la observabilidad nunca rompe la app */
  }
}

export { reportClientError } from './errorReporter';
