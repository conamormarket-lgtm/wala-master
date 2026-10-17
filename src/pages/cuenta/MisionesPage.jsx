import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import MisionesDeCuenta from '../../components/cuenta/MisionesDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const MisionesViejo = lazy(() => import('./MisionesViejo'));

// Misiones diarias (PaginaMisiones), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (MisionesViejo.jsx).
const MisionesPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <MisionesDeCuenta />;
  return (
    <Suspense fallback={null}>
      <MisionesViejo />
    </Suspense>
  );
};

export default MisionesPage;
