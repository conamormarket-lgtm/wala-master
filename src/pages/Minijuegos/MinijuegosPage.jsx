import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import MinijuegosDeTienda from '../../components/minijuegos/MinijuegosDeTienda';

// La página de antes solo baja si el interruptor minijuegosViejo está puesto.
const MinijuegosViejo = lazy(() => import('./MinijuegosViejo'));

/*
 * /minijuegos (Zona Arcade). Paso 6 de la migración (MINIJUEGOS.md): la del
 * kit por MinijuegosDeTienda. minijuegosViejo (useLoViejo('minijuegos'): en
 * Firestore `minijuegosViejo: true`; en localStorage, "minijuegos") vuelve a
 * la de antes.
 */
const MinijuegosPage = () => {
  const minijuegosViejo = useLoViejo('minijuegos');
  if (!minijuegosViejo) return <MinijuegosDeTienda />;
  return (
    <Suspense fallback={null}>
      <MinijuegosViejo />
    </Suspense>
  );
};

export default MinijuegosPage;
