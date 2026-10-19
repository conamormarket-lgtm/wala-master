import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import CreacionDeTienda from '../../components/crear/CreacionDeTienda';

// La página de antes solo baja si el interruptor crearViejo está puesto.
const CreacionViejo = lazy(() => import('./CreacionViejo'));

/*
 * /creacion/:id (una creación del cliente; la ruta pide cuenta). Paso 6 de
 * la migración (CREAR.md P9): PaginaCreacion por CreacionDeTienda.
 * crearViejo (useLoViejo('crear')) vuelve a la de antes.
 */
const CreacionPage = () => {
  const crearViejo = useLoViejo('crear');
  if (!crearViejo) return <CreacionDeTienda />;
  return (
    <Suspense fallback={null}>
      <CreacionViejo />
    </Suspense>
  );
};

export default CreacionPage;
