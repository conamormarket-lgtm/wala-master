/**
 * AppPrefetcher — Componente sin render que activa el prefetch de datos
 * mientras el usuario navega por la app. No muestra nada en pantalla.
 * También precarga los chunks (JS) de las páginas más pesadas para
 * lograr una navegación instantánea de cero latencia.
 */
import { useEffect } from 'react';
import { usePrefetchStoreData } from '../../../hooks/usePrefetchStoreData';

const prefetchChunks = () => {
    // Si el navegador soporta requestIdleCallback lo usamos, si no setTimeout
    const requestIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000));
    requestIdle(() => {
        // Precarga de módulos de las páginas más visitadas y pesadas
        import('../../../pages/Tienda/TiendaPage');
        import('../../../pages/ProductPage');
        import('../../../pages/EditorPage');
        import('../../../pages/PersonalizarPage');
        import('../../../pages/CheckoutPage');
        import('../../../pages/CartPage');
    });
};

const AppPrefetcher = () => {
    usePrefetchStoreData();

    useEffect(() => {
        prefetchChunks();
    }, []);

    return null;
};

export default AppPrefetcher;
