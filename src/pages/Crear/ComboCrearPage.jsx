import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import ComboDeTienda from '../../components/crear/ComboDeTienda';

// La página de antes solo baja si el interruptor crearViejo está puesto.
const ComboCrearViejo = lazy(() => import('./ComboCrearViejo'));

/*
 * /combo/:id (armar un combo de Crear: pareja, trío o conjunto). Paso 6 de
 * la migración (CREAR.md P11): PaginaCombo por ComboDeTienda.
 * crearViejo (useLoViejo('crear')) vuelve a la de antes.
 */
const ComboCrearPage = () => {
  const crearViejo = useLoViejo('crear');
  if (!crearViejo) return <ComboDeTienda />;
  return (
    <Suspense fallback={null}>
      <ComboCrearViejo />
    </Suspense>
  );
};

export default ComboCrearPage;
