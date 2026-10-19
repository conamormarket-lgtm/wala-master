import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import RutaPrivada from '../../components/RutaPrivada/RutaPrivada';
import BolitasDeTienda from '../../components/minijuegos/BolitasDeTienda';

// La página de antes solo baja si el interruptor juegosViejo está puesto.
const BallSortViejo = lazy(() => import('./BallSortViejo'));

/*
 * /ball-sort (Las Bolitas de Kapi). Paso 6 de la migración (JUEGOS.md): la
 * del kit por BolitasDeTienda, que se juega también sin cuenta. juegosViejo
 * (useLoViejo('juegos'): en Firestore `juegosViejo: true`; en localStorage,
 * "juegos") vuelve a la de antes, que sigue pidiendo cuenta.
 */
const BallSortPage = () => {
  const juegosViejo = useLoViejo('juegos');
  if (!juegosViejo) return <BolitasDeTienda />;
  return (
    <RutaPrivada>
      <Suspense fallback={null}>
        <BallSortViejo />
      </Suspense>
    </RutaPrivada>
  );
};

export default BallSortPage;
