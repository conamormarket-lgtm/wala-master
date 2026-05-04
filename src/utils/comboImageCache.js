/**
 * Sistema de cache para imágenes compuestas de combos
 * Usa localStorage para persistencia
 */

const CACHE_PREFIX = 'combo_image_cache_';
const MAX_CACHE_SIZE = 50; // Máximo número de imágenes en cache
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

/**
 * Genera clave de cache basada en productIds, viewIds y variantSelections
 */
export const generateCacheKey = (comboItems, variantSelections) => {
  const keyParts = comboItems.map((item, index) => {
    const variant = variantSelections[index] || {};
    return `${item.productId}_${item.viewId}_${variant.size || ''}_${variant.color || ''}`;
  });
  return `${CACHE_PREFIX}${keyParts.join('|')}`;
};

/**
 * Obtiene imagen del cache si existe y no ha expirado
 */
export const getCachedImage = (cacheKey) => {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const { dataUrl, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Verificar expiración
    if (now - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return dataUrl;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
};

/**
 * Guarda imagen en cache
 */
export const setCachedImage = (cacheKey, dataUrl) => {
  try {
    // Limpiar cache antiguo si es necesario
    cleanupCache();

    const cacheData = {
      dataUrl,
      timestamp: Date.now()
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error writing to cache:', error);
    // Si el localStorage está lleno, intentar limpiar y reintentar
    if (error.name === 'QuotaExceededError') {
      cleanupCache(true);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          dataUrl,
          timestamp: Date.now()
        }));
      } catch (retryError) {
        console.error('Error retrying cache write:', retryError);
      }
    }
  }
};

/**
 * Limpia cache expirado y reduce tamaño si es necesario
 */
const cleanupCache = (force = false) => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
    
    if (keys.length <= MAX_CACHE_SIZE && !force) return;

    // Eliminar expirados
    const now = Date.now();
    keys.forEach(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (now - timestamp > CACHE_EXPIRY) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Si hay error al leer, eliminar la clave
        localStorage.removeItem(key);
      }
    });

    // Si aún hay demasiadas, eliminar las más antiguas
    const remainingKeys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
    if (remainingKeys.length > MAX_CACHE_SIZE) {
      const keysWithTimestamps = remainingKeys.map(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            return { key, timestamp };
          }
        } catch (error) {
          return { key, timestamp: 0 };
        }
        return { key, timestamp: 0 };
      }).sort((a, b) => a.timestamp - b.timestamp);

      // Eliminar las más antiguas
      const toRemove = keysWithTimestamps.slice(0, remainingKeys.length - MAX_CACHE_SIZE);
      toRemove.forEach(({ key }) => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error('Error cleaning cache:', error);
  }
};

/**
 * Invalida cache para un producto específico
 */
export const invalidateProductCache = (productId) => {
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(CACHE_PREFIX) && key.includes(productId)
    );
    keys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
};

/**
 * Limpia todo el cache de combos
 */
export const clearComboCache = () => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
    keys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};
