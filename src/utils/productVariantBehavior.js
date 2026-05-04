/**
 * Tracking de comportamiento por producto para decidir qué variante mostrar en miniaturas.
 * Optimizada para no bloquear el Hilo Principal de JS con localStorage síncrono.
 */

const KEY_PREFIX = 'variant_behavior_';

// Caché en memoria para lecturas/escrituras INMEDIATAS sin tocar el disco
const cache = new Map();
let saveTimer = null;

const defaultBehavior = () => ({
  impressions: 0,
  clicked: false,
  variantSeconds: {}
});

function getStorageKey(productId) {
  return `${KEY_PREFIX}${String(productId)}`;
}

/**
 * Lee el comportamiento guardado para un producto (desde caché en memoria, con fallback a localStorage único)
 * @param {string} productId
 * @returns {{ impressions: number, clicked: boolean, variantSeconds: Record<string, number> }}
 */
export function getBehavior(productId) {
  if (!productId) return defaultBehavior();

  // 1. Si está en memoria, devolver inmediatamente (¡0ms!)
  if (cache.has(productId)) {
    return cache.get(productId);
  }

  // 2. Fallback a localStorage solo la primera vez por producto
  try {
    const raw = localStorage.getItem(getStorageKey(productId));
    let parsed;
    if (!raw) {
      parsed = defaultBehavior();
    } else {
      const data = JSON.parse(raw);
      parsed = {
        impressions: typeof data.impressions === 'number' ? data.impressions : 0,
        clicked: Boolean(data.clicked),
        variantSeconds: data.variantSeconds && typeof data.variantSeconds === 'object' ? data.variantSeconds : {}
      };
    }
    // Guardar en caché para futuras llamadas síncronas durante el render
    cache.set(productId, parsed);
    return parsed;
  } catch {
    const def = defaultBehavior();
    cache.set(productId, def);
    return def;
  }
}

function setBehavior(productId, data) {
  if (!productId) return;
  // Actualizar inmediatamente en memoria
  cache.set(productId, data);

  // Batch updates: Escribir a localStorage solo 1 vez por segundo, 
  // en lugar de bloquear el hilo principal en cada scroll/impresión.
  if (!saveTimer) {
    saveTimer = setTimeout(flushToStorage, 1500);
  }
}

function flushToStorage() {
  saveTimer = null;
  // requestIdleCallback asegura que no interrumpimos animaciones ni scrolls
  const saveAction = () => {
    cache.forEach((data, productId) => {
      try {
        localStorage.setItem(getStorageKey(productId), JSON.stringify(data));
      } catch (e) {
        // Ignorar errores de cuota
      }
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(saveAction, { timeout: 2000 });
  } else {
    setTimeout(saveAction, 100);
  }
}

export function recordThumbnailImpression(productId) {
  if (!productId) return;
  const current = getBehavior(productId);
  current.impressions += 1;
  setBehavior(productId, current);
}

export function recordProductClick(productId) {
  if (!productId) return;
  const current = getBehavior(productId);
  current.clicked = true;
  setBehavior(productId, current);
}

export function recordVariantViewTime(productId, variantId, seconds) {
  if (!productId || !variantId || typeof seconds !== 'number' || seconds <= 0) return;
  const current = getBehavior(productId);
  const prev = current.variantSeconds[variantId] ?? 0;
  current.variantSeconds[variantId] = prev + seconds;
  setBehavior(productId, current);
}
