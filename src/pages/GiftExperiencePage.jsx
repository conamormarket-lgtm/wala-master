import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import RegaloSorpresaDeTienda from '../components/regalar/RegaloSorpresaDeTienda';

// La página de antes (Kapi en CSS) solo baja con el interruptor regalarViejo.
const GiftExperienceViejo = lazy(() => import('./GiftExperienceViejo'));

// Abrir un regalo (/regalo/:orderId), paso 6 de la migración:
// PaginaRegaloSorpresa del kit. regalarViejo vuelve a la de antes
// (GiftExperienceViejo.jsx).
const GiftExperiencePage = () => {
  const regalarViejo = useLoViejo('regalar');
  if (!regalarViejo) return <RegaloSorpresaDeTienda />;
  return (
    <Suspense fallback={null}>
      <GiftExperienceViejo />
    </Suspense>
  );
};

export default GiftExperiencePage;
