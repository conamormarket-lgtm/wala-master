import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import InvitacionDeTienda from '../components/campanas/InvitacionDeTienda';

// La página de antes (que solo redirigía) baja solo con el interruptor campanasViejo.
const InvitarViejo = lazy(() => import('./InvitarViejo'));

/*
 * /invitar/:codigo (el link de invitación de cada cuenta). Paso 6 de la
 * migración (CAMPANAS.md): la invitación del kit por InvitacionDeTienda.
 * campanasViejo (useLoViejo('campanas'): en Firestore `campanasViejo: true`;
 * en localStorage, "campanas") vuelve a la de antes.
 */
const InvitarPage = () => {
  const campanasViejo = useLoViejo('campanas');
  if (!campanasViejo) return <InvitacionDeTienda />;
  return (
    <Suspense fallback={null}>
      <InvitarViejo />
    </Suspense>
  );
};

export default InvitarPage;
