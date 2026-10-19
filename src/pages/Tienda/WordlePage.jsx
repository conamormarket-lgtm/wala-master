import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import PalabraDeTienda from '../../components/minijuegos/PalabraDeTienda';

// La página de antes solo baja si el interruptor juegosViejo está puesto.
const WordleViejo = lazy(() => import('./WordleViejo'));

/*
 * /palabra-del-dia (La Palabra del Día). Paso 6 de la migración (JUEGOS.md):
 * la del kit por PalabraDeTienda. juegosViejo (useLoViejo('juegos'): en
 * Firestore `juegosViejo: true`; en localStorage, "juegos") vuelve a la de
 * antes.
 */
const WordlePage = () => {
  const juegosViejo = useLoViejo('juegos');
  if (!juegosViejo) return <PalabraDeTienda />;
  return (
    <Suspense fallback={null}>
      <WordleViejo />
    </Suspense>
  );
};

export default WordlePage;
