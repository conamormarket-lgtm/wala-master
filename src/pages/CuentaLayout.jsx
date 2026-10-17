import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import MarcoDeCuenta from '../components/cuenta/MarcoDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const CuentaLayoutViejo = lazy(() => import('./CuentaLayoutViejo'));

// El marco de /cuenta (MarcoCuenta), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (CuentaLayoutViejo.jsx).
const CuentaLayout = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <MarcoDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CuentaLayoutViejo />
    </Suspense>
  );
};

export default CuentaLayout;
