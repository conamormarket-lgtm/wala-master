import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import LoginDeTienda from '../components/acceso/LoginDeTienda';

// La página de antes solo baja si el interruptor accesoViejo está puesto.
const LoginViejo = lazy(() => import('./LoginViejo'));

/*
 * Paso 6 de la migración (ACCESO.md): iniciar sesión (/login) con el kit
 * por LoginDeTienda. accesoViejo (useLoViejo('acceso'): en Firestore
 * `accesoViejo: true`; en localStorage, "acceso") vuelve a la de antes.
 */
const LoginPage = () => {
  const accesoViejo = useLoViejo('acceso');
  if (!accesoViejo) return <LoginDeTienda />;
  return (
    <Suspense fallback={null}>
      <LoginViejo />
    </Suspense>
  );
};

export default LoginPage;
