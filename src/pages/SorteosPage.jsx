import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import SorteoDeTienda from '../components/campanas/SorteoDeTienda';

// La página de antes solo baja si el interruptor campanasViejo está puesto.
const SorteosViejo = lazy(() => import('./SorteosViejo'));

/*
 * /sorteos y /sorteos/:slug. Paso 6 de la migración (CAMPANAS.md): el sorteo
 * del kit por SorteoDeTienda. campanasViejo (useLoViejo('campanas'): en
 * Firestore `campanasViejo: true`; en localStorage, "campanas") vuelve a la
 * de antes.
 */
const SorteosPage = () => {
  const campanasViejo = useLoViejo('campanas');
  if (!campanasViejo) return <SorteoDeTienda />;
  return (
    <Suspense fallback={null}>
      <SorteosViejo />
    </Suspense>
  );
};

export default SorteosPage;
