/**
 * usePrefetchStoreData
 *
 * Precarga INMEDIATA de los datos de la tienda al montar la app.
 * Se ejecuta sin esperar requestIdleCallback porque la prioridad
 * es tener los datos listos ANTES de que el usuario navegue a /tienda.
 *
 * Con Firestore persistence activado, las lecturas posteriores
 * se sirven desde IndexedDB (~10ms). Este prefetch asegura que
 * la primera visita también sea rápida al poblar el caché de React Query.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getProducts, getCategories, getFeaturedProducts } from '../services/products';
import { getMessage } from '../services/messages';
import { getStorefrontConfig } from '../pages/Tienda/services/storefront';
const STALE_TIME = 60 * 60 * 1000; // 1 hour

export function usePrefetchStoreData() {
    const queryClient = useQueryClient();
    const ran = useRef(false);

    useEffect(() => {
        // Solo ejecutar una vez
        if (ran.current) return;
        ran.current = true;

        // Iniciar prefetch EN PARALELO sin esperar
        // Usamos setTimeout(0) solo para salir del ciclo de render actual
        const t = setTimeout(() => {
            // Todas las queries se lanzan en paralelo
            queryClient.prefetchQuery({
                queryKey: ['storefront-config'],
                queryFn: async () => {
                    const { sections, error } = await getStorefrontConfig();
                    if (error) throw new Error(error);
                    return { sections: sections ?? [] };
                },
                staleTime: 10 * 60 * 1000,
            });

            queryClient.prefetchQuery({
                queryKey: ['products', null, '', 'name'],
                queryFn: async () => {
                    const result = await getProducts([], null, null);
                    if (result.error) throw new Error(result.error);
                    return [...(result.data || [])].sort((a, b) =>
                        (a.name || '').localeCompare(b.name || '')
                    );
                },
                staleTime: STALE_TIME,
            });

            queryClient.prefetchQuery({
                queryKey: ['categories'],
                queryFn: async () => {
                    const { data, error } = await getCategories();
                    if (error) throw new Error(error);
                    return data;
                },
                staleTime: STALE_TIME,
            });

            queryClient.prefetchQuery({
                queryKey: ['featured-products'],
                queryFn: async () => {
                    const { data, error } = await getFeaturedProducts();
                    if (error) throw new Error(error);
                    return data;
                },
                staleTime: STALE_TIME,
            });

            queryClient.prefetchQuery({
                queryKey: ['store-messages'],
                queryFn: async () => {
                    const [titleRes, subtitleRes, emptyRes] = await Promise.all([
                        getMessage('store_title'),
                        getMessage('store_subtitle'),
                        getMessage('store_empty_message')
                    ]);
                    return {
                        title: titleRes.data?.trim() || 'Nuestra Tienda',
                        subtitle: subtitleRes.data?.trim() || 'Explora nuestros productos y personaliza el que más te guste.',
                        emptyMessage: emptyRes.data?.trim() || ''
                    };
                },
                staleTime: 15 * 60 * 1000,
            });
        }, 0);

        return () => clearTimeout(t);
    }, [queryClient]);
}
