/**
 * AppPrefetcher — Componente sin render que adelanta, en segundo plano, lo que
 * hará falta en el SIGUIENTE paso del usuario. No muestra nada en pantalla.
 *
 * Adelantar chunks no es gratis: son megas de descarga y, sobre todo, tiempo de
 * CPU parseándolos en un móvil de gama media. Por eso se pide por tramos del
 * embudo en vez de todo de golpe:
 *
 *   - Desde cualquier sitio: ProductPage y CartPage. Es a donde va casi todo el
 *     mundo desde la tienda y pesan poco (47 + 14 KB).
 *   - Solo ya dentro de una ficha de producto: el editor y el checkout. Ahí
 *     entran EditorPage, PersonalizarPage y CheckoutPage, que arrastran fabric
 *     (310 KB) y el catálogo de formas (204 KB). Antes se pedían en TODAS las
 *     visitas, incluida la de quien solo pasaba a mirar la home: ~680 KB de
 *     descarga y parseo para una pantalla que la mayoría nunca abre.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePrefetchStoreData } from '../../../hooks/usePrefetchStoreData';

const cuandoEsteOcioso = (fn) => {
    const pedirOcio = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000));
    pedirOcio(fn, { timeout: 4000 });
};

// Rutas desde las que ya tiene sentido pagar el precio del editor/checkout.
const EN_FICHA_DE_PRODUCTO = /^\/(producto|personalizar|editor|carrito)/i;

const AppPrefetcher = () => {
    usePrefetchStoreData();
    const { pathname } = useLocation();

    useEffect(() => {
        cuandoEsteOcioso(() => {
            import('../../../pages/Tienda/TiendaPage');
            import('../../../pages/ProductPage');
            import('../../../pages/CartPage');

            if (EN_FICHA_DE_PRODUCTO.test(pathname)) {
                import('../../../pages/EditorPage');
                import('../../../pages/PersonalizarPage');
                import('../../../pages/CheckoutPage');
            }
        });
    }, [pathname]);

    return null;
};

export default AppPrefetcher;
