import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import EnlacesDeTienda from '../components/campanas/EnlacesDeTienda';

// La página de antes solo baja si el interruptor campanasViejo está puesto.
const LinkInBioViejo = lazy(() => import('./LinkInBioViejo'));

/*
 * /l/:slug (Link en bio). Paso 6 de la migración (CAMPANAS.md): la página de
 * enlaces del kit por EnlacesDeTienda, sola (sin el marco de la tienda: lo
 * decide App.jsx). campanasViejo (useLoViejo('campanas'): en Firestore
 * `campanasViejo: true`; en localStorage, "campanas") vuelve a la de antes.
 */
const LinkInBioPage = () => {
  const campanasViejo = useLoViejo('campanas');
  if (!campanasViejo) return <EnlacesDeTienda />;
  return (
    <Suspense fallback={null}>
      <LinkInBioViejo />
    </Suspense>
  );
};

export default LinkInBioPage;
