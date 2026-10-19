import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import SuscripcionesDeTienda from '../components/campanas/SuscripcionesDeTienda';

// La página de antes solo baja si el interruptor campanasViejo está puesto.
const SubscriptionLandingViejo = lazy(() => import('./SubscriptionLandingViejo'));

/*
 * /suscripciones. Paso 6 de la migración (CAMPANAS.md): PaginaSuscripciones
 * por SuscripcionesDeTienda. campanasViejo (useLoViejo('campanas'): en
 * Firestore `campanasViejo: true`; en localStorage, "campanas") vuelve a la
 * de antes.
 */
const SubscriptionLandingPage = () => {
  const campanasViejo = useLoViejo('campanas');
  if (!campanasViejo) return <SuscripcionesDeTienda />;
  return (
    <Suspense fallback={null}>
      <SubscriptionLandingViejo />
    </Suspense>
  );
};

export default SubscriptionLandingPage;
