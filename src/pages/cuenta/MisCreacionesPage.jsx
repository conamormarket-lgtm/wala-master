import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import CreacionesDeCuenta from '../../components/cuenta/CreacionesDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const MisCreacionesViejo = lazy(() => import('./MisCreacionesViejo'));

// Mis creaciones (PaginaCreaciones), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (MisCreacionesViejo.jsx).
const MisCreacionesPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <CreacionesDeCuenta />;
  return (
    <Suspense fallback={null}>
      <MisCreacionesViejo />
    </Suspense>
  );
};

export default MisCreacionesPage;
