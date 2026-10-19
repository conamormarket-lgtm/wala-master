import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import BusquedaDeTienda from '../components/busqueda/BusquedaDeTienda';

// La página de antes solo baja si el interruptor busquedaVieja está puesto.
const SearchPageViejo = lazy(() => import('./SearchPageViejo'));

/*
 * /buscar. Paso 6 de la migración (BUSCAR.md): la página del kit por
 * BusquedaDeTienda. busquedaVieja (useLoViejo('busqueda'): en Firestore
 * `busquedaViejo: true`; en localStorage, "busqueda") vuelve a la de antes.
 */
const SearchPage = () => {
  const busquedaVieja = useLoViejo('busqueda');
  if (!busquedaVieja) return <BusquedaDeTienda />;
  return (
    <Suspense fallback={null}>
      <SearchPageViejo />
    </Suspense>
  );
};

export default SearchPage;
