import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import LegalDeTienda from '../components/legales/LegalDeTienda';
import { TERMINOS } from '../config/legales/terminos';

// La página de antes solo baja si el interruptor legalesViejo está puesto.
const TerminosCondicionesViejo = lazy(() => import('./TerminosCondicionesViejo'));

/*
 * Paso 6 de la migración (LEGALES.md): los términos y condiciones (/terminos-y-condiciones) con el kit
 * (PaginaLegal). legalesViejo (useLoViejo('legales'): en Firestore
 * `legalesViejo: true`; en localStorage, "legales") vuelve a la de antes.
 */
const TerminosCondicionesPage = () => {
  const legalesViejo = useLoViejo('legales');
  if (!legalesViejo) return <LegalDeTienda tipo="terminos" documento={TERMINOS} />;
  return (
    <Suspense fallback={null}>
      <TerminosCondicionesViejo />
    </Suspense>
  );
};

export default TerminosCondicionesPage;
