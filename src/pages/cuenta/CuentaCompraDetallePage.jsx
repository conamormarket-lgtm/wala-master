import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import DetallePedidoDeCuenta from '../../components/cuenta/DetallePedidoDeCuenta';

// La página de antes solo baja con un interruptor.
const CuentaCompraDetalleViejo = lazy(() => import('./CuentaCompraDetalleViejo'));

// Detalle de una compra (PaginaDetallePedido), paso 7 de la migración: el kit.
// Vuelve a la de antes (CuentaCompraDetalleViejo.jsx) con cuentaVieja
// (useLoViejo('cuenta'): en Firestore el campo es cuentaViejo) o con
// pagosViejo: aquí se paga el saldo.
const CuentaCompraDetallePage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  const pagosViejo = useLoViejo('pagos');
  if (!cuentaVieja && !pagosViejo) return <DetallePedidoDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CuentaCompraDetalleViejo />
    </Suspense>
  );
};

export default CuentaCompraDetallePage;
