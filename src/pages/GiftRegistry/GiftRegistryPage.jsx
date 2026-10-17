import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import RegalarDeTienda from '../../components/regalar/RegalarDeTienda';

// La página de antes (fechas arrastrables) solo baja con el interruptor regalarViejo.
const GiftRegistryPageViejo = lazy(() => import('./GiftRegistryPageViejo'));

// Regalar para una fecha (/regalar/:referralCode), paso 6 de la migración:
// PaginaRegalar del kit. regalarViejo vuelve a la de antes
// (GiftRegistryPageViejo.jsx).
const GiftRegistryPage = () => {
  const regalarViejo = useLoViejo('regalar');
  if (!regalarViejo) return <RegalarDeTienda />;
  return (
    <Suspense fallback={null}>
      <GiftRegistryPageViejo />
    </Suspense>
  );
};

export default GiftRegistryPage;
