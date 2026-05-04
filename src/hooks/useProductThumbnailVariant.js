import { useMemo, useCallback } from 'react';
import { getThumbnailVariant } from '../utils/productThumbnailVariant';
import { recordThumbnailImpression } from '../utils/productVariantBehavior';

/**
 * Hook para obtener la URL de imagen de miniatura de un producto según
 * variante principal y reglas de comportamiento, y para registrar impresiones.
 * No se pasa behavior para que getThumbnailVariant lea siempre de localStorage (datos actualizados).
 *
 * @param {Object} product - Producto normalizado
 * @returns {{ thumbnailImageUrl: string, variantIndex: number, recordImpression: () => void }}
 */
export function useProductThumbnailVariant(product) {
  const { variantIndex, imageUrl } = useMemo(() => {
    if (!product) return { variantIndex: -1, imageUrl: '' };
    return getThumbnailVariant(product);
  }, [product]);

  const recordImpression = useCallback(() => {
    if (product?.id) recordThumbnailImpression(product.id);
  }, [product?.id]);

  return {
    thumbnailImageUrl: imageUrl || '',
    variantIndex,
    recordImpression
  };
}
