/**
 * usePrefetchStoreData
 *
 * Precarga en SEGUNDO PLANO los datos que necesitarán otras pantallas, para
 * que al navegar ya estén en el caché de React Query.
 * El catálogo completo se carga solo cuando una pantalla lo necesita.
 *
 * Dos cosas importantes, aprendidas por las malas:
 *
 * 1. Corre en tiempo OCIOSO, no al montar. Antes salía inmediatamente y sus
 *    cinco peticiones —una de ellas, el catálogo ENTERO sin límite— competían
 *    por la conexión justo con las consultas de las que depende la primera
 *    pintada de la home. Adelantar datos para una navegación que quizá no
 *    ocurra nunca no puede retrasar la pantalla que la persona está mirando.
 *
 * 2. Van marcadas con `meta.segundoPlano`. TiendaPage mantiene puesta la
 *    pantalla de carga mientras queden consultas en vuelo (useIsFetching);
 *    sin la marca, el splash se quedaba esperando también a ESTAS, que no
 *    pinta ninguna de ellas. La marca deja excluirlas de ese recuento.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCategories, getFeaturedProducts } from '../services/products';
import { getMessage } from '../services/messages';
import { getStorefrontConfig } from '../pages/Tienda/services/storefront';

const STALE_TIME = 60 * 60 * 1000; // 1 hour

// Lo lee el filtro de useIsFetching en TiendaPage (ver punto 2 de arriba).
export const EN_SEGUNDO_PLANO = { segundoPlano: true };

const cuandoEsteOcioso = (fn) => {
    if (typeof window === 'undefined') return () => {};
    if (typeof window.requestIdleCallback === 'function') {
        // El timeout es el tope: si el navegador nunca queda ocioso (scroll
        // continuo, animaciones), a los 4 s se lanza igual.
        const id = window.requestIdleCallback(fn, { timeout: 4000 });
        return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(fn, 2000);
    return () => clearTimeout(id);
};

export function usePrefetchStoreData() {
    const queryClient = useQueryClient();
    useEffect(() => {
        // Todas se lanzan en paralelo, pero solo cuando el navegador esté ocioso.
        const cancelar = cuandoEsteOcioso(() => {
            queryClient.prefetchQuery({
                queryKey: ['storefront-config', 'home'],
                queryFn: async () => {
                    const { sections, error } = await getStorefrontConfig();
                    if (error) throw new Error(error);
                    return { sections: sections ?? [] };
                },
                staleTime: 10 * 60 * 1000,
                meta: EN_SEGUNDO_PLANO,
            });

            queryClient.prefetchQuery({
                queryKey: ['categories'],
                queryFn: async () => {
                    const { data, error } = await getCategories();
                    if (error) throw new Error(error);
                    return data;
                },
                staleTime: STALE_TIME,
                meta: EN_SEGUNDO_PLANO,
            });

            queryClient.prefetchQuery({
                queryKey: ['featured-products', null],
                queryFn: async () => {
                    const { data, error } = await getFeaturedProducts();
                    if (error) throw new Error(error);
                    return data;
                },
                staleTime: STALE_TIME,
                meta: EN_SEGUNDO_PLANO,
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
                meta: EN_SEGUNDO_PLANO,
            });
        });

        return cancelar;
    }, [queryClient]);
}
