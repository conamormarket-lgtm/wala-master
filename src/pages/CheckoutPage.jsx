import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { productoLandingDeCompra } from '../utils/checkoutOrigin.mjs';
import useLoViejo from '../hooks/useLoViejo';
import CheckoutDeTienda from '../components/checkout/CheckoutDeTienda';

// La página de antes solo baja con el interruptor pagosViejo.
const CheckoutViejo = lazy(() => import('./CheckoutViejo'));

// El checkout (/checkout), paso 6 de la migración: PaginaCheckout del kit.
// pagosViejo vuelve a la página de antes (CheckoutViejo.jsx). El pedido lo
// arman las dos con services/pedidoCheckout.js.
const CheckoutPage = () => {
  const pagosViejo = useLoViejo('pagos');
  const location = useLocation();
  if (!pagosViejo || productoLandingDeCompra(location)) return <CheckoutDeTienda />;
  return (
    <Suspense fallback={null}>
      <CheckoutViejo />
    </Suspense>
  );
};

export default CheckoutPage;
