import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import { EsqueletoPagina } from '../../componentes/kit/Esqueletos';

// Ambos estudios se cargan aparte: el respaldo no baja con el nuevo.
const EstudioDeTienda = lazy(() => import('../../components/crear/EstudioDeTienda'));
const CrearStudioViejo = lazy(() => import('./CrearStudioViejo'));

/** /crear/:id. CREAR.md P12: el kit alrededor del mismo lienzo de Fabric. */
export default function CrearStudioPage() {
  const viejo = useLoViejo('crear');
  return (
    <Suspense fallback={<EsqueletoPagina forma="estudio" />}>
      {viejo ? <CrearStudioViejo /> : <EstudioDeTienda />}
    </Suspense>
  );
}
