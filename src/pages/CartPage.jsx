import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import Cart from './Tienda/components/Cart';
// Design System "Aurora Violeta Serena": CTA premium + fondo de marca suave.
// Uso SOLO presentacional (aditivo); no toca la lógica del carrito (vive en <Cart/>).
import { GlassButton, AuroraBackground } from '../components/ui';
import styles from './CartPage.module.css';

const CartPage = () => {
  const navigate = useNavigate();
  const { isEmpty } = useCart();

  return (
    <div className={styles.container}>
      {/* Fondo de marca MUY suave detrás del contenido (decorativo, no interactivo). */}
      <AuroraBackground variant="subtle" intensity={0.16} />
      <div className={styles.header}>
        <h1>Carrito de Compras</h1>
        {!isEmpty && (
          <GlassButton variant="ghost" onClick={() => navigate('/tienda')}>
            Continuar Comprando
          </GlassButton>
        )}
      </div>
      <Cart />
    </div>
  );
};

export default CartPage;
