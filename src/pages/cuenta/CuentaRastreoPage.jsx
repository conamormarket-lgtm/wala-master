import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import PedidosDeCuenta from '../../components/cuenta/PedidosDeCuenta';

// La página de antes solo baja con un interruptor.
const CuentaRastreoViejo = lazy(() => import('./CuentaRastreoViejo'));

// Mis pedidos (PaginaPedidos), paso 7 de la migración: el kit. Vuelve a la de
// antes (CuentaRastreoViejo.jsx) con cuentaVieja (useLoViejo('cuenta'): en
// Firestore el campo es cuentaViejo) o con pagosViejo: los pedidos llevan a
// pagar las deudas, así que siguen también al interruptor de los pagos.
const CuentaRastreoPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  const pagosViejo = useLoViejo('pagos');
  if (!cuentaVieja && !pagosViejo) return <PedidosDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CuentaRastreoViejo />
    </Suspense>
  );
};

export default CuentaRastreoPage;
