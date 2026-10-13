import React from 'react';
import { useCart } from '../contexts/CartContext';
import Cart from './Tienda/components/Cart';
// Fondo de marca suave (presentacional; la lógica del carrito vive en <Cart/>).
import { AuroraBackground } from '../components/ui';
import Boton from '../componentes/kit/Boton';
import styles from './CartPage.module.css';
import { T } from '../i18n/useTranslatedText';

const CartPage = () => {
  const { isEmpty } = useCart();

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
      <Cart />
    </div>
  );
};

export default CartPage;
