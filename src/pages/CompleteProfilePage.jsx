import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import CompletarPerfilDeTienda from '../components/acceso/CompletarPerfilDeTienda';

// La página de antes solo baja si el interruptor accesoViejo está puesto.
const CompleteProfileViejo = lazy(() => import('./CompleteProfileViejo'));

/*
 * Paso 6 de la migración (ACCESO.md): completar el perfil (/completar-perfil) con el kit
 * por CompletarPerfilDeTienda. accesoViejo (useLoViejo('acceso'): en Firestore
 * `accesoViejo: true`; en localStorage, "acceso") vuelve a la de antes.
 */
const CompleteProfilePage = () => {
  const accesoViejo = useLoViejo('acceso');
  if (!accesoViejo) return <CompletarPerfilDeTienda />;
  return (
    <Suspense fallback={null}>
      <CompleteProfileViejo />
    </Suspense>
  );
};

export default CompleteProfilePage;
