import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import ListaPublicaDeTienda from '../../components/regalar/ListaPublicaDeTienda';

// La página de antes solo baja con el interruptor regalarViejo.
const WishlistPublicViejo = lazy(() => import('./WishlistPublicViejo'));

// La lista de deseos de otra persona (/wishlist/:userCode), paso 6 de la
// migración: PaginaListaPublica del kit. regalarViejo vuelve a la de antes
// (WishlistPublicViejo.jsx).
const WishlistPublic = () => {
  const regalarViejo = useLoViejo('regalar');
  if (!regalarViejo) return <ListaPublicaDeTienda />;
  return (
    <Suspense fallback={null}>
      <WishlistPublicViejo />
    </Suspense>
  );
};

export default WishlistPublic;
