import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import ComunidadDeTienda from '../../components/crear/ComunidadDeTienda';

// La página de antes solo baja si el interruptor crearViejo está puesto.
const ComunidadViejo = lazy(() => import('./ComunidadViejo'));

/*
 * /comunidad. Paso 6 de la migración (CREAR.md P8): PaginaComunidad por
 * ComunidadDeTienda. crearViejo (useLoViejo('crear')) vuelve a la de antes.
 */
const ComunidadPage = () => {
  const crearViejo = useLoViejo('crear');
  if (!crearViejo) return <ComunidadDeTienda />;
  return (
    <Suspense fallback={null}>
      <ComunidadViejo />
    </Suspense>
  );
};

export default ComunidadPage;
