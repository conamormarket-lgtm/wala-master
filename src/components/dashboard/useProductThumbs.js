import { useQuery } from '@tanstack/react-query';
import { getProduct } from '../../services/products';

/**
 * useProductThumbs — resuelve miniatura (mainImage) + tags + categoría para un
 * conjunto reducido de productIds (los que aparecen en los rankings del panel).
 *
 * RENDIMIENTO / control de lecturas:
 *  - Sólo se piden los IDs únicos visibles en los rankings (típicamente <= 20),
 *    NO miles de productos.
 *  - staleTime muy alto (30 min): las miniaturas/tags casi no cambian, así que
 *    el navegar entre rangos de fecha reutiliza la caché y no relee Firestore.
 *  - La queryKey se basa en los IDs ordenados, de modo que rangos distintos que
 *    comparten productos reutilizan los datos ya cacheados.
 *  - Si no hay IDs, la query queda deshabilitada (cero lecturas).
 *
 * Devuelve un Map { productId -> { mainImage, tags, category, name } } envuelto
 * en el objeto de react-query.
 */
export function useProductThumbs(productIds = []) {
  const ids = Array.from(new Set((productIds || []).filter(Boolean))).sort();
  const key = ids.join(',');

  const query = useQuery({
    queryKey: ['dashboard', 'productThumbs', key],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const { data } = await getProduct(id);
            if (!data) return [id, null];
            return [
              id,
              {
                mainImage: data.mainImage || (Array.isArray(data.images) ? data.images[0] : '') || '',
                tags: Array.isArray(data.tags) ? data.tags : [],
                category: data.category || data.categoria || null,
                name: data.name || null,
              },
            ];
          } catch {
            return [id, null];
          }
        })
      );
      const map = {};
      entries.forEach(([id, val]) => {
        if (val) map[id] = val;
      });
      return map;
    },
  });

  return {
    thumbs: query.data || {},
    isLoading: query.isLoading,
  };
}
