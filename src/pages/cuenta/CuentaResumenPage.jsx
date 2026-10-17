import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import ResumenDeCuenta from '../../components/cuenta/ResumenDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const CuentaResumenViejo = lazy(() => import('./CuentaResumenViejo'));

// El resumen de /cuenta (PaginaResumenCuenta), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (CuentaResumenViejo.jsx).
const CuentaResumenPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <ResumenDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CuentaResumenViejo />
    </Suspense>
  );
};

export default CuentaResumenPage;
