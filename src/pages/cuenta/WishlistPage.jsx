import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import ListaDeseosDeCuenta from '../../components/cuenta/ListaDeseosDeCuenta';

// La página de antes solo baja con el interruptor cuentaVieja.
const WishlistViejo = lazy(() => import('./WishlistViejo'));

// Lista de deseos (PaginaListaDeseos), paso 6 de la migración: el kit. cuentaVieja (useLoViejo('cuenta'):
// en Firestore el campo es cuentaViejo) vuelve a la de antes (WishlistViejo.jsx).
const WishlistPage = () => {
  const cuentaVieja = useLoViejo('cuenta');
  if (!cuentaVieja) return <ListaDeseosDeCuenta />;
  return (
    <Suspense fallback={null}>
      <WishlistViejo />
    </Suspense>
  );
};

export default WishlistPage;
