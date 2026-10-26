import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import { useParams } from 'react-router-dom';
import { EsqueletoPagina } from '../../componentes/kit/Esqueletos';
import { YORYO_PIEZAS } from '../../utils/yoryoPersonalizacion.mjs';

// Ambos estudios se cargan aparte: el respaldo no baja con el nuevo.
const EstudioDeTienda = lazy(() => import('../../components/crear/EstudioDeTienda'));
const CrearStudioViejo = lazy(() => import('./CrearStudioViejo'));
const PersonalizadorYoryo = lazy(() => import('../../components/crear/PersonalizadorYoryo'));

/** /crear/:id. CREAR.md P12: el kit alrededor del mismo lienzo de Fabric. */
export default function CrearStudioPage() {
  const { id } = useParams();
  const viejo = useLoViejo('crear');
  return (
    <Suspense fallback={<EsqueletoPagina forma="estudio" />}>
      {YORYO_PIEZAS.some((p) => p.id === id) ? <PersonalizadorYoryo key={id} /> : viejo ? <CrearStudioViejo key={id} /> : <EstudioDeTienda key={id} />}
    </Suspense>
  );
}
