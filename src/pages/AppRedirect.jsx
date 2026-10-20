import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import DescargarAppDeTienda from '../components/generales/DescargarAppDeTienda';

// La de antes solo baja con el interruptor generalesViejo.
const AppRedirectViejo = lazy(() => import('./AppRedirectViejo'));

/** /descargar y /app (GENERALES.md P23): PaginaDescargarApp o la de antes. */
export default function AppRedirect() {
  const viejo = useLoViejo('generales');
  if (viejo) return <Suspense fallback={null}><AppRedirectViejo /></Suspense>;
  return <DescargarAppDeTienda />;
}
