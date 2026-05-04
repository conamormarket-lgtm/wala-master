import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import Cart from './Tienda/components/Cart';
import Button from '../components/common/Button';
import styles from './CartPage.module.css';

const CartPage = () => {
  const navigate = useNavigate();
  const { isEmpty } = useCart();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Carrito de Compras</h1>
        {!isEmpty && (
          <Button variant="outline" onClick={() => navigate('/tienda')}>
          Continuar Comprando
          </Button>
        )}
      </div>
      <Cart />
    </div>
  );
};

export default CartPage;
