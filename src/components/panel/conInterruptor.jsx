import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';

/*
 * Una página del admin con su interruptor (guia/ADMIN.md, "Cómo se une un
 * apartado"): la del kit por su conector; con `<interruptor>Viejo` (en
 * Firestore configuracion/kit_interruptores, o en localStorage
 * wala_kit_viejo) vuelve la de antes, que solo baja en ese caso.
 *   export default conInterruptor('adminCatalogo', CategoriasDelPanel, () => import('./AdminCategoriasViejo'));
 */
export default function conInterruptor(interruptor, Nueva, cargarVieja) {
  const Vieja = lazy(cargarVieja);
  return function PaginaConInterruptor(props) {
    const vieja = useLoViejo(interruptor);
    if (!vieja) return <Nueva {...props} />;
    return (
      <Suspense fallback={null}>
        <Vieja {...props} />
      </Suspense>
    );
  };
}
