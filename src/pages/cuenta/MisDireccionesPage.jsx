import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import DireccionesDeCuenta from '../../components/cuenta/DireccionesDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const MisDireccionesViejo = lazy(() => import('./MisDireccionesViejo'));

// Mis direcciones (PaginaDirecciones), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (MisDireccionesViejo.jsx).
const MisDireccionesPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <DireccionesDeCuenta />;
  return (
    <Suspense fallback={null}>
      <MisDireccionesViejo />
    </Suspense>
  );
};

export default MisDireccionesPage;
