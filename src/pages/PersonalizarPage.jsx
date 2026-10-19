import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import CrearDeTienda from '../components/crear/CrearDeTienda';

// La página de antes solo baja si el interruptor crearViejo está puesto.
const PersonalizarViejo = lazy(() => import('./PersonalizarViejo'));

/*
 * /personalizar (Crear). Paso 6 de la migración (CREAR.md): PaginaCrear por
 * CrearDeTienda. crearViejo (useLoViejo('crear'): en Firestore
 * `crearViejo: true`; en localStorage, "crear") vuelve a la de antes.
 */
const PersonalizarPage = () => {
  const crearViejo = useLoViejo('crear');
  if (!crearViejo) return <CrearDeTienda />;
  return (
    <Suspense fallback={null}>
      <PersonalizarViejo />
    </Suspense>
  );
};

export default PersonalizarPage;
