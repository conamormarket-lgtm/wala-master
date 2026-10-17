import React, { lazy, Suspense } from 'react';
import { useCart } from '../contexts/CartContext';
import useLoViejo from '../hooks/useLoViejo';
import CarritoDeTienda from '../components/carrito/CarritoDeTienda';
// Fondo de marca suave (presentacional; la lógica del carrito vive en <Cart/>).
import { AuroraBackground } from '../components/ui';
import Boton from '../componentes/kit/Boton';
import styles from './CartPage.module.css';
import { T } from '../i18n/useTranslatedText';

// El carrito viejo solo baja si el interruptor carritoViejo está puesto.
const Cart = lazy(() => import('./Tienda/components/Cart'));

const CartPage = () => {
  const { isEmpty } = useCart();
  // Paso 6 de la migración: el carrito del kit. carritoViejo vuelve a Cart.jsx.
  const carritoViejo = useLoViejo('carrito');

  if (!carritoViejo) return <CarritoDeTienda />;

  return (
    <div className={styles.container}>
      {/* Fondo de marca MUY suave detrás del contenido (decorativo, no interactivo).
          Misma intensidad que Checkout, para que el paso previo del embudo de
          compra se sienta como la MISMA página, no como un salto de estilo. */}
      <AuroraBackground variant="subtle" intensity={0.18} />
      <div className={styles.header}>
        <h1><T>Carrito de Compras</T></h1>
        {!isEmpty && (
          <Boton variante="fantasma" to="/tienda">
            <T>Continuar comprando</T>
          </Boton>
        )}
      </div>
      <Suspense fallback={null}>
        <Cart />
      </Suspense>
    </div>
  );
};

export default CartPage;
