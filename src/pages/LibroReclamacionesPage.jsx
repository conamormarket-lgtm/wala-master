import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import ReclamacionesDeTienda from '../components/legales/ReclamacionesDeTienda';

// La página de antes solo baja si el interruptor legalesViejo está puesto.
const LibroReclamacionesViejo = lazy(() => import('./LibroReclamacionesViejo'));

/*
 * /libro-de-reclamaciones. Paso 6 de la migración (LEGALES.md): el libro del
 * kit por ReclamacionesDeTienda. legalesViejo (useLoViejo('legales'): en
 * Firestore `legalesViejo: true`; en localStorage, "legales") vuelve a la de
 * antes.
 */
const LibroReclamacionesPage = () => {
  const legalesViejo = useLoViejo('legales');
  if (!legalesViejo) return <ReclamacionesDeTienda />;
  return (
    <Suspense fallback={null}>
      <LibroReclamacionesViejo />
    </Suspense>
  );
};

export default LibroReclamacionesPage;
