import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import RecuperarDeTienda from '../components/acceso/RecuperarDeTienda';

// La página de antes solo baja si el interruptor accesoViejo está puesto.
const ResetPasswordViejo = lazy(() => import('./ResetPasswordViejo'));

/*
 * Paso 6 de la migración (ACCESO.md): recuperar la contraseña (/recuperar-contrasena) con el kit
 * por RecuperarDeTienda. accesoViejo (useLoViejo('acceso'): en Firestore
 * `accesoViejo: true`; en localStorage, "acceso") vuelve a la de antes.
 */
const ResetPasswordPage = () => {
  const accesoViejo = useLoViejo('acceso');
  if (!accesoViejo) return <RecuperarDeTienda />;
  return (
    <Suspense fallback={null}>
      <ResetPasswordViejo />
    </Suspense>
  );
};

export default ResetPasswordPage;
