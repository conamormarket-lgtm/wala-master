import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import AjustesDeCuenta from '../../components/cuenta/AjustesDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const CuentaAjustesViejo = lazy(() => import('./CuentaAjustesViejo'));

// Ajustes (PaginaAjustes), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (CuentaAjustesViejo.jsx).
const CuentaAjustesPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <AjustesDeCuenta />;
  return (
    <Suspense fallback={null}>
      <CuentaAjustesViejo />
    </Suspense>
  );
};

export default CuentaAjustesPage;
