import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import PagoRapidoDeTienda from '../components/pago/PagoRapidoDeTienda';

// La página de antes solo baja con el interruptor pagosViejo.
const PagoRapidoViejo = lazy(() => import('./PagoRapidoViejo'));

// Pago rápido (/pago-rapido/:id), paso 6 de la migración: PaginaPagoRapido del
// kit. pagosViejo vuelve a la página de antes (PagoRapidoViejo.jsx).
const PagoRapidoPage = () => {
  const pagosViejo = useLoViejo('pagos');
  if (!pagosViejo) return <PagoRapidoDeTienda />;
  return (
    <Suspense fallback={null}>
      <PagoRapidoViejo />
    </Suspense>
  );
};

export default PagoRapidoPage;
