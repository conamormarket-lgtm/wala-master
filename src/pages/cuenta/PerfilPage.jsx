import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import PerfilDeCuenta from '../../components/cuenta/PerfilDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const PerfilViejo = lazy(() => import('./PerfilViejo'));

// Mi perfil (PaginaPerfil), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (PerfilViejo.jsx).
const PerfilPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <PerfilDeCuenta />;
  return (
    <Suspense fallback={null}>
      <PerfilViejo />
    </Suspense>
  );
};

export default PerfilPage;
