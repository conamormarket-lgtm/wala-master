import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import CuponesDeCuenta from '../../components/cuenta/CuponesDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const MisCuponesViejo = lazy(() => import('./MisCuponesViejo'));

// Mis cupones (PaginaCupones), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (MisCuponesViejo.jsx).
const MisCuponesPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <CuponesDeCuenta />;
  return (
    <Suspense fallback={null}>
      <MisCuponesViejo />
    </Suspense>
  );
};

export default MisCuponesPage;
