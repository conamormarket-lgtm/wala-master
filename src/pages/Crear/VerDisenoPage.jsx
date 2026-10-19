import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import VerDisenoDeTienda from '../../components/crear/VerDisenoDeTienda';

// La página de antes solo baja si el interruptor crearViejo está puesto.
const VerDisenoViejo = lazy(() => import('./VerDisenoViejo'));

/*
 * /ver/:id (el diseño de un pedido, para el asesor). Paso 6 de la migración
 * (CREAR.md P10): PaginaVerDiseno por VerDisenoDeTienda. crearViejo
 * (useLoViejo('crear')) vuelve a la de antes.
 */
const VerDisenoPage = () => {
  const crearViejo = useLoViejo('crear');
  if (!crearViejo) return <VerDisenoDeTienda />;
  return (
    <Suspense fallback={null}>
      <VerDisenoViejo />
    </Suspense>
  );
};

export default VerDisenoPage;
