import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import EncuestaDeTienda from '../components/encuesta/EncuestaDeTienda';

// La página de antes solo baja si el interruptor encuestaVieja está puesto.
const SubscriptionSurveyViejo = lazy(() => import('./SubscriptionSurveyViejo'));

/*
 * /encuesta-suscripcion. Paso 6 de la migración (ENCUESTA.md): la encuesta
 * del kit por EncuestaDeTienda. encuestaVieja (useLoViejo('encuesta'): en
 * Firestore `encuestaViejo: true`; en localStorage, "encuesta") vuelve a la
 * de antes.
 */
const SubscriptionSurveyPage = () => {
  const encuestaVieja = useLoViejo('encuesta');
  if (!encuestaVieja) return <EncuestaDeTienda />;
  return (
    <Suspense fallback={null}>
      <SubscriptionSurveyViejo />
    </Suspense>
  );
};

export default SubscriptionSurveyPage;
