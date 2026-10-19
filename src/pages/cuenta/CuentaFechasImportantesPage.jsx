import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import FechasDeCuenta from '../../components/cuenta/FechasDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const CuentaFechasImportantesViejo = lazy(() => import('./CuentaFechasImportantesViejo'));

// Fechas importantes (PaginaFechas), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (CuentaFechasImportantesViejo.jsx).
const CuentaFechasImportantesPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <FechasDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CuentaFechasImportantesViejo />
    </Suspense>
  );
};

export default CuentaFechasImportantesPage;
