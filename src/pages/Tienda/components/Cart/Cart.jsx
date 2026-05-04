import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../../contexts/CartContext';
import { useAuth } from '../../../../contexts/AuthContext';
import CartItem from '../CartItem/CartItem';
import Button from '../../../../components/common/Button';
import styles from './Cart.module.css';

const Cart = () => {
  const { items, getTotalPrice, clearCart } = useCart();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const total = getTotalPrice();
  const monedasCount = userProfile?.monedas || 0;
  const envioPrice = total > 100 ? 0 : 15;
  const theFinalTotal = total + envioPrice;

  // Si todos los items están en estado confirmación, mostramos un aviso
  const isPendingConfirmation = useMemo(() => {
    return items.length > 0 && items.every(item => item.status === 'pending_confirmation');
  }, [items]);

  const pendingOrderId = useMemo(() => {
    if (isPendingConfirmation && items.length > 0) {
      return items[0].pseudoOrderId;
    }
    return null;
  }, [isPendingConfirmation, items]);

  const handleClearCart = () => {
    if (window.confirm('¿Estás seguro de que quieres cancelar este pedido y vaciar tu carrito?')) {
      clearCart();
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.emptyCart}>
        <div className={styles.emptyIcon}>🛍️</div>
        <h2>Tu carrito está vacío</h2>
        <p>Parece que aún no has agregado productos.</p>
        <Button onClick={() => navigate('/tienda')}>Ir a la Tienda</Button>
      </div>
    );
  }

  return (
    <div className={styles.cartContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Tu Carrito {isPendingConfirmation && <span className={styles.pendingBadge}>Pendiente ⌛</span>}
        </h2>
        <button className={styles.clearBtn} onClick={handleClearCart}>
          {isPendingConfirmation ? 'Cancelar Pedido Activo' : 'Vaciar carrito'}
        </button>
      </div>

      {isPendingConfirmation && (
        <div className={styles.pendingNotice}>
          <div className={styles.pendingNoticeIcon}>🕒</div>
          <div className={styles.pendingNoticeText}>
            <h3>Pedido en Solicitud</h3>
            <p>Tienes una solicitud de pedido activa (Código: <strong>{pendingOrderId}</strong>). Estamos esperando la confirmación del pago por WhatsApp.</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>Este carrito se limpiará automáticamente una vez confirmado el pago final en nuestras oficinas.</p>
          </div>
        </div>
      )}

      <div className={styles.itemList}>
        {items.map(item => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>

      <div className={styles.summary}>
        {/* Monedas Notice */}
        {monedasCount > 0 && (
          <div style={{ marginBottom: '1rem', background: '#fef3c7', color: '#92400e', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🪙</span>
            <span>¡Tienes monedas disponibles! Podrás aplicarlas en el siguiente paso (Checkout) para obtener un descuento.</span>
          </div>
        )}
        <div className={styles.row}>
          <span>Subtotal</span>
          <span>S/ {total.toFixed(2)}</span>
        </div>
        <div className={styles.row}>
          <span>Envío estimado</span>
          <span>{envioPrice === 0 ? 'Gratis' : `S/ ${envioPrice.toFixed(2)}`}</span>
        </div>
        <div className={`${styles.row} ${styles.total}`}>
          <span>Total</span>
          <span>S/ {theFinalTotal.toFixed(2)}</span>
        </div>
        <Button
          variant="primary"
          fullWidth
          onClick={() => navigate('/checkout')}
          disabled={isPendingConfirmation}
        >
          {isPendingConfirmation ? 'Esperando Confirmación...' : 'Proceder al Pago'}
        </Button>
      </div>
    </div>
  );
};

export default Cart;
