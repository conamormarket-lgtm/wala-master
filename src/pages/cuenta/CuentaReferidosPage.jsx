import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import ReferidosDeCuenta from '../../components/cuenta/ReferidosDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const CuentaReferidosViejo = lazy(() => import('./CuentaReferidosViejo'));

// Mis referidos (PaginaReferidos), paso 6 de la migración: el kit. cuentaVieja
// (useLoViejo('cuenta'): en Firestore el campo es cuentaViejo) vuelve a la de
// antes (CuentaReferidosViejo.jsx).
const CuentaReferidosPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <ReferidosDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CuentaReferidosViejo />
    </Suspense>
  );
};

export default CuentaReferidosPage;
