import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import LegalDeTienda from '../components/legales/LegalDeTienda';
import { PRIVACIDAD } from '../config/legales/privacidad';

// La página de antes solo baja si el interruptor legalesViejo está puesto.
const PoliticasPrivacidadViejo = lazy(() => import('./PoliticasPrivacidadViejo'));

/*
 * Paso 6 de la migración (LEGALES.md): la política de privacidad (/politicas-privacidad) con el kit
 * (PaginaLegal). legalesViejo (useLoViejo('legales'): en Firestore
 * `legalesViejo: true`; en localStorage, "legales") vuelve a la de antes.
 */
const PoliticasPrivacidadPage = () => {
  const legalesViejo = useLoViejo('legales');
  if (!legalesViejo) return <LegalDeTienda tipo="privacidad" documento={PRIVACIDAD} />;
  return (
    <Suspense fallback={null}>
      <PoliticasPrivacidadViejo />
    </Suspense>
  );
};

export default PoliticasPrivacidadPage;
