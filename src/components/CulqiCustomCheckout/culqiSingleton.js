// ── Singleton del checkout de Culqi ──────────────────────────────────────────
// PROBLEMA (confirmado inspeccionando el SDK checkout-js en runtime): CADA
// `new CulqiCheckout()` añade UN listener global de `message` a `window` y NUNCA
// lo quita (además de su iframe). Al re-montar el componente —p. ej. el REINTENTO
// del checkout que bumpea `culqiKey`, o StrictMode en dev— se acumulan 2, 3…
// listeners vivos. Cuando el iframe de Culqi emite su `postMessage`, TODOS
// responden y el modal se abre/reabre varias veces ("se cierra y se vuelve a
// abrir", "aparece 3 veces").
//
// SOLUCIÓN: una ÚNICA instancia de Culqi viva a la vez. Al construir, INTERCEPTAMOS
// window.addEventListener para CAPTURAR el/los listener(s) 'message' que el SDK
// registra y los guardamos en la instancia. Al destruir (antes de crear otra, en
// la limpieza del efecto o al desmontar) los QUITAMOS con removeEventListener,
// cerramos la instancia y purgamos su iframe. Así el neto de listeners se mantiene
// en 1 (el de la instancia actual) y nunca se acumulan. No toca la tokenización/cobro.

const GLOBAL_KEY = '__walaCulqiInstance';

// Elimina del DOM los iframes/overlays que deja Culqi (incluidos huérfanos).
// Conservador: solo iframes cuyo src menciona "culqi" y elementos cuyo id empieza
// por "culqi" (NUNCA el <script> del SDK, id `culqi-js-v4`). No escanea clases.
export function purgeCulqiDom() {
  try {
    document.querySelectorAll('iframe').forEach((f) => {
      const src = (f.getAttribute('src') || '').toLowerCase();
      if (!src.includes('culqi')) return;
      const parent = f.parentElement;
      f.remove();
      if (
        parent &&
        parent !== document.body &&
        /culqi/i.test(parent.id || '') &&
        parent.children.length === 0
      ) {
        parent.remove();
      }
    });
    document.querySelectorAll('[id]').forEach((el) => {
      if (el.tagName === 'SCRIPT') return; // no tocar el SDK
      if (el.id === 'culqi-js-v4') return;
      if (/^culqi/i.test(el.id)) el.remove();
    });
  } catch (e) {
    /* best-effort: la limpieza nunca debe romper el flujo de pago */
  }
}

// Quita los listeners globales de 'message' que una instancia registró al construir.
function removeInstanceListeners(instance) {
  try {
    const list = (instance && instance.__walaMessageListeners) || [];
    list.forEach(({ fn, opts }) => {
      try { window.removeEventListener('message', fn, opts); } catch (e) { /* noop */ }
    });
    if (instance) instance.__walaMessageListeners = [];
  } catch (e) {
    /* noop */
  }
}

// Cierra y descarta la instancia global previa (si existe): quita sus listeners,
// la cierra y purga su iframe. `onlyIf`: si se pasa una instancia y NO coincide
// con la global actual, no hace nada (evita que un componente destruya la
// instancia viva de otro). Sin `onlyIf`, destruye lo que haya.
export function destroyCulqi(onlyIf) {
  try {
    const prev = typeof window !== 'undefined' ? window[GLOBAL_KEY] : null;
    if (onlyIf && prev && prev !== onlyIf) return;
    if (prev) {
      if (typeof prev.close === 'function') {
        try { prev.close(); } catch (e) { /* noop */ }
      }
      removeInstanceListeners(prev);
    }
    if (typeof window !== 'undefined') window[GLOBAL_KEY] = null;
  } catch (e) {
    /* noop */
  }
  purgeCulqiDom();
}

// Construye una instancia nueva capturando los listeners 'message' del SDK.
function buildInstance(publicKey, config, orderKey) {
  const captured = [];
  const origAdd = window.addEventListener.bind(window);
  // Intercepta SOLO durante la construcción para capturar el listener del SDK.
  window.addEventListener = function (type, fn, opts) {
    if (type === 'message') captured.push({ fn, opts });
    return origAdd(type, fn, opts);
  };

  let instance;
  try {
    instance = new window.CulqiCheckout(publicKey, config);
  } finally {
    window.addEventListener = origAdd; // restaura SIEMPRE, aunque el ctor lance
  }

  instance.__walaMessageListeners = captured;
  instance.__walaOrderKey = orderKey != null ? String(orderKey) : null;
  if (typeof window !== 'undefined') window[GLOBAL_KEY] = instance;
  return instance;
}

// Crea la ÚNICA instancia de Culqi: destruye cualquier anterior (con sus listeners).
// Úsalo cuando NO necesitas reutilización por pedido (botón manual: SorteosPage,
// PagoSuscripcion). Requiere que `window.CulqiCheckout` ya esté cargado.
export function createCulqi(publicKey, config) {
  destroyCulqi();
  return buildInstance(publicKey, config, null);
}

// Devuelve la instancia de Culqi REUTILIZÁNDOLA si ya existe una para el MISMO
// `orderKey`. Clave para el checkout con autoOpen: los remontes del componente
// (StrictMode en dev, re-renders del padre, toggle de la tarjeta de recuperación)
// NO deben destruir/recrear el modal —eso causaba el PARPADEO (3 inits) y la
// reapertura—. Al reutilizar la misma instancia, un remonte es inofensivo: el
// modal abierto se mantiene y no se añade otro listener. Solo se destruye y
// recrea cuando cambia el pedido (`orderKey` distinto). El SDK conserva open()/
// close(), así que reabrir tras cerrar (reintento) funciona sobre la misma
// instancia.
export function getOrCreateCulqi(orderKey, publicKey, config) {
  const prev = typeof window !== 'undefined' ? window[GLOBAL_KEY] : null;
  const key = orderKey != null ? String(orderKey) : null;
  if (prev && key != null && prev.__walaOrderKey === key) {
    return prev; // reutiliza: sin teardown, sin parpadeo, sin listener nuevo
  }
  destroyCulqi(); // pedido distinto (o sin instancia previa): limpia el anterior
  return buildInstance(publicKey, config, key);
}
