import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import RuletaDeTienda from '../../components/minijuegos/RuletaDeTienda';

// La página de antes solo baja si el interruptor juegosViejo está puesto.
const RuletaViejo = lazy(() => import('./RuletaViejo'));

/*
 * /ruleta (Ruleta Semanal). Paso 6 de la migración (JUEGOS.md): la del kit
 * por RuletaDeTienda. juegosViejo (useLoViejo('juegos'): en Firestore
 * `juegosViejo: true`; en localStorage, "juegos") vuelve a la de antes.
 * Las dos mandan al login sin cuenta.
 */
const RuletaPage = () => {
  const juegosViejo = useLoViejo('juegos');
  if (!juegosViejo) return <RuletaDeTienda />;
  return (
    <Suspense fallback={null}>
      <RuletaViejo />
    </Suspense>
  );
};

export default RuletaPage;
