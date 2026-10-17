import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import CatalogoDeCuenta from '../../components/cuenta/CatalogoDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const CatalogRewardViejo = lazy(() => import('./CatalogRewardViejo'));

// Catálogo de recompensas (PaginaCatalogo), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (CatalogRewardViejo.jsx).
const CatalogReward = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <CatalogoDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CatalogRewardViejo />
    </Suspense>
  );
};

export default CatalogReward;
