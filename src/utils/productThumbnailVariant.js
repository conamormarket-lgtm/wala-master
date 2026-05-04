/**
 * Decide qué variante mostrar en la miniatura de un producto según
 * defaultVariantId, variantDisplayBehavior y el comportamiento del usuario.
 */

import { getBehavior } from './productVariantBehavior';

/**
 * Obtiene el índice de la variante a mostrar en miniatura y su URL.
 * Prioridad (impressions first):
 * 1. Sin variantes o sin comportamiento -> variante por defecto
 * 2. variantDisplayBehavior === 'default_only' -> variante principal
 * 3. clicked && (by_engagement o both) && variantSeconds con datos -> variante con más tiempo
 * 4. !clicked && impressions >= threshold && (after_impressions o both) -> variante al azar
 * 5. Resto -> variante principal
 *
 * @param {Object} product - Producto normalizado (hasVariants, variants[], defaultVariantId, variantDisplayBehavior, behaviorImpressionsThreshold)
 * @param {{ impressions: number, clicked: boolean, variantSeconds: Record<string, number> }} [behavior] - Si no se pasa, se lee de localStorage
 * @returns {{ variantIndex: number, imageUrl: string }}
 */
const COMBO_PLACEHOLDER = 'https://via.placeholder.com/400x400/eee/999?text=Combo';

export function getThumbnailVariant(product, behavior = null) {
  // Combos: miniatura siempre desde images (ya normalizado) o placeholder; no usar variantes
  if (product?.isComboProduct && (!product.variants || product.variants.length === 0)) {
    const url = product?.comboPreviewImage || product?.images?.[0] || COMBO_PLACEHOLDER;
    return { variantIndex: -1, imageUrl: url };
  }

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const hasVariants = Boolean(product?.hasVariants) && variants.length > 0;

  if (!hasVariants) {
    const url = product?.mainImage || product?.images?.[0] || '';
    return { variantIndex: -1, imageUrl: url };
  }

  // Miniatura con diseño: usarla SOLO si la variante principal no tiene imagen directa de Firebase Storage
  // (las URLs de Firebase son la fuente de verdad actualizada; thumbnailWithDesignUrl puede ser obsoleto)
  if (product?.thumbnailWithDesignUrl && typeof product.thumbnailWithDesignUrl === 'string' && product.thumbnailWithDesignUrl.trim()) {
    const defaultVariantIdForThumb = product?.defaultVariantId || variants[0]?.id || '';
    const idx = defaultVariantIdForThumb ? Math.max(0, variants.findIndex((v) => v.id === defaultVariantIdForThumb)) : 0;
    const principalVariant = variants[idx >= 0 ? idx : 0];
    const variantIsFirebase = principalVariant?.imageUrl && principalVariant.imageUrl.includes('firebasestorage.googleapis.com');
    // Si la variante tiene imagen Firebase, usar esa directamente (más fresca y rápida)
    if (!variantIsFirebase) {
      return { variantIndex: idx >= 0 ? idx : 0, imageUrl: product.thumbnailWithDesignUrl };
    }
    // Si es Firebase, continuar la lógica normal abajo (leerá imageUrl de la variante)
  }

  const defaultVariantId = product?.defaultVariantId || variants[0]?.id || '';
  const displayBehavior = product?.variantDisplayBehavior ?? 'default_only';
  const threshold = typeof product?.behaviorImpressionsThreshold === 'number' && product.behaviorImpressionsThreshold >= 1
    ? product.behaviorImpressionsThreshold
    : 3;

  const defaultIndex = defaultVariantId
    ? Math.max(0, variants.findIndex((v) => v.id === defaultVariantId))
    : 0;
  const fallbackIndex = defaultIndex >= 0 ? defaultIndex : 0;
  const fallbackUrl = variants[fallbackIndex]?.imageUrl || '';

  const data = behavior !== null ? behavior : getBehavior(product?.id);

  // 2. Solo variante principal
  if (displayBehavior === 'default_only') {
    return { variantIndex: fallbackIndex, imageUrl: fallbackUrl };
  }

  const hasEngagement = displayBehavior === 'by_engagement' || displayBehavior === 'both';
  const hasImpressionsRule = displayBehavior === 'after_impressions' || displayBehavior === 'both';

  // 3. Usuario abrió producto y regla 2 activa: variante con más tiempo
  if (data.clicked && hasEngagement && data.variantSeconds && typeof data.variantSeconds === 'object') {
    const entries = Object.entries(data.variantSeconds).filter(([, sec]) => sec > 0);
    if (entries.length > 0) {
      const [variantId] = entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best));
      const idx = variants.findIndex((v) => v.id === variantId);
      if (idx >= 0) {
        return { variantIndex: idx, imageUrl: variants[idx].imageUrl || fallbackUrl };
      }
    }
  }

  // 4. No ha abierto y regla 1 activa: variante al azar
  if (!data.clicked && hasImpressionsRule && data.impressions >= threshold) {
    const randomIndex = Math.floor(Math.random() * variants.length);
    return {
      variantIndex: randomIndex,
      imageUrl: variants[randomIndex]?.imageUrl || fallbackUrl
    };
  }

  // 5. Variante principal
  return { variantIndex: fallbackIndex, imageUrl: fallbackUrl };
}
