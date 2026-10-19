import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import RegistroDeTienda from '../components/acceso/RegistroDeTienda';

// La página de antes solo baja si el interruptor accesoViejo está puesto.
const RegisterViejo = lazy(() => import('./RegisterViejo'));

/*
 * Paso 6 de la migración (ACCESO.md): crear cuenta (/registro) con el kit
 * por RegistroDeTienda. accesoViejo (useLoViejo('acceso'): en Firestore
 * `accesoViejo: true`; en localStorage, "acceso") vuelve a la de antes.
 */
const RegisterPage = () => {
  const accesoViejo = useLoViejo('acceso');
  if (!accesoViejo) return <RegistroDeTienda />;
  return (
    <Suspense fallback={null}>
      <RegisterViejo />
    </Suspense>
  );
};

export default RegisterPage;
