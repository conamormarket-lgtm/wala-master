import React, { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../../contexts/CartContext';
import { useAuth } from '../../../../contexts/AuthContext';
import CartItem from '../CartItem/CartItem';
import { idsDeItemsIncompletos } from '../../../../utils/cartValidation';
import { costoEnvio } from '../../../../constants/envio';
// Design System "Aurora Violeta Serena": las MISMAS superficies/CTA que ya usa
// CheckoutPage (GlassCard del resumen, GlassButton del pago). El carrito es el
// paso anterior del mismo embudo de compra, así que debe verse como la MISMA
// pagina en vez de una pantalla suelta con su propio estilo. Uso presentacional
// (aditivo): no toca la logica de items/totales/seleccion, vive toda en <Cart/>.
import { GlassCard, GlassButton, Badge, Stagger, StaggerItem } from '../../../../components/ui';
import styles from './Cart.module.css';
import { T } from '../../../../i18n/useTranslatedText';

const Cart = () => {
  const { items, getTotalPrice, clearCart, setAllItemsSelected, removeSelectedItems } = useCart();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const total = getTotalPrice();
  const monedasCount = userProfile?.monedas || 0;
  // El umbral se mide sobre el subtotal de los productos, igual que el checkout.
  const envioPrice = costoEnvio(total);
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

  // Artículos sin color o sin talla: los creaba el antiguo botón rápido de la
  // tarjeta y no se pueden despachar. Solo cuentan los que SÍ se van a comprar:
  // uno apartado con "no comprar esta vez" no debe bloquear el pago.
  const incompletos = useMemo(() => idsDeItemsIncompletos(items), [items]);
  const incompletosACobrar = useMemo(
    () => items.filter(i => i.selected !== false && incompletos.has(i.id)),
    [items, incompletos]
  );

  // ── Selección ──
  const selectedCount = useMemo(
    () => items.filter(i => i.selected !== false).length,
    [items]
  );
  const todosSeleccionados = items.length > 0 && selectedCount === items.length;
  const algunoSeleccionado = selectedCount > 0 && !todosSeleccionados;

  // El estado "indeterminado" (guion en vez de check) no existe como atributo en
  // HTML: hay que ponerlo por DOM.
  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = algunoSeleccionado;
  }, [algunoSeleccionado]);

  const handleRemoveSelected = () => {
    const n = selectedCount;
    const mensaje = n === 1
      ? '¿Quitar del carrito el artículo seleccionado?'
      : `¿Quitar del carrito los ${n} artículos seleccionados?`;
    if (window.confirm(mensaje)) removeSelectedItems();
  };

  const handleClearCart = () => {
    if (window.confirm('¿Estás seguro de que quieres cancelar este pedido y vaciar tu carrito?')) {
      clearCart();
    }
  };

  if (items.length === 0) {
    return (
      <GlassCard
        variant="soft"
        padding="lg"
        className={styles.emptyCart}
        bodyClassName={styles.emptyCartBody}
      >
        <div className={styles.emptyIcon}>🛍️</div>
        <h2><T>Tu carrito está vacío</T></h2>
        <p><T>Parece que aún no has agregado productos.</T></p>
        <GlassButton variant="primary" onClick={() => navigate('/tienda')}>
          <T>Ir a la Tienda</T>
        </GlassButton>
      </GlassCard>
    );
  }

  return (
    <div className={styles.cartContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Tu Carrito <span className={styles.itemCount}>({items.length})</span>
          {isPendingConfirmation && (
            <Badge tone="warning" variant="soft" size="sm" className={styles.pendingBadge}>
              Pendiente ⌛
            </Badge>
          )}
        </h2>
        <button className={styles.clearBtn} onClick={handleClearCart}>
          {isPendingConfirmation ? 'Cancelar Pedido Activo' : 'Vaciar carrito'}
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.itemsColumn}>
          {/* Barra de selección, como en cualquier carrito: se decide qué se paga
              ahora sin tener que sacar nada del carrito. */}
          <div className={styles.selectionBar}>
            <label className={styles.selectAll}>
              <input
                type="checkbox"
                ref={selectAllRef}
                checked={todosSeleccionados}
                onChange={(e) => setAllItemsSelected(e.target.checked)}
              />
              <span>{todosSeleccionados ? 'Quitar todo de la compra' : 'Seleccionar todo'}</span>
            </label>

            <span className={styles.selectionCount}>
              {selectedCount} de {items.length} seleccionado{items.length !== 1 ? 's' : ''}
            </span>

            {selectedCount > 0 && (
              <button type="button" className={styles.bulkRemove} onClick={handleRemoveSelected}>
                Eliminar seleccionados
              </button>
            )}
          </div>

          {isPendingConfirmation && (
            <div className={styles.pendingNotice}>
              <div className={styles.pendingNoticeIcon}>🕒</div>
              <div className={styles.pendingNoticeText}>
                <h3><T>Pedido en Solicitud</T></h3>
                {/* Se corta en frases COMPLETAS, no a los lados del codigo: un trozo
                    suelto como "(Codigo:" no se puede traducir bien. */}
                <p><T>Tienes una solicitud de pedido activa</T> (<T>Código</T>: <strong>{pendingOrderId}</strong>). <T>Estamos esperando la confirmación del pago por WhatsApp.</T></p>
                <p style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}><T>Este carrito se limpiará automáticamente una vez confirmado el pago final en nuestras oficinas.</T></p>
              </div>
            </div>
          )}

          {/* El antiguo aviso de "N artículos no se comprarán" desaparece: la barra
              de selección ya dice cuántos entran, y cada fila desmarcada lo indica. */}

          {incompletosACobrar.length > 0 && (
            <div className={styles.incompletoNotice}>
              <span aria-hidden="true">⚠</span>
              <span>
                {incompletosACobrar.length === 1
                  ? 'Un artículo no tiene color o talla elegidos. Ábrelo y elígelos para poder pagar.'
                  : `${incompletosACobrar.length} artículos no tienen color o talla elegidos. Ábrelos y elígelos para poder pagar.`}
              </span>
            </div>
          )}

          {/* Cascada de entrada (mismo preset que las tarjetas del home/tienda),
              respeta prefers-reduced-motion vía Stagger/StaggerItem. */}
          <Stagger className={styles.itemList}>
            {items.map(item => (
              <StaggerItem key={item.id}>
                <CartItem item={item} incompleto={incompletos.has(item.id)} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className={styles.summaryColumn}>
          <GlassCard
            variant="solid"
            padding="lg"
            animate={false}
            className={styles.summaryGlass}
            bodyClassName={styles.summaryBody}
          >
            {/* Monedas Notice */}
            {monedasCount > 0 && (
              <div className={styles.coinsNotice}>
                <span>🪙</span>
                <span><T>¡Tienes monedas disponibles! Podrás aplicarlas en el siguiente paso (Checkout) para obtener un descuento.</T></span>
              </div>
            )}
            <div className={styles.row}>
              <span>
                Subtotal{' '}
                <span className={styles.rowHint}>
                  ({selectedCount} artículo{selectedCount !== 1 ? 's' : ''})
                </span>
              </span>
              <span>S/ {total.toFixed(2)}</span>
            </div>
            <div className={styles.row}>
              <span><T>Envío estimado</T></span>
              <span>{envioPrice === 0 ? 'Gratis' : `S/ ${envioPrice.toFixed(2)}`}</span>
            </div>
            <div className={`${styles.row} ${styles.total}`}>
              <span><T>Total</T></span>
              <span>S/ {theFinalTotal.toFixed(2)}</span>
            </div>
            <GlassButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/checkout')}
              disabled={isPendingConfirmation || incompletosACobrar.length > 0 || selectedCount === 0}
            >
              {isPendingConfirmation
                ? 'Esperando Confirmación...'
                : selectedCount === 0
                  ? 'Selecciona algún artículo'
                  : incompletosACobrar.length > 0
                    ? 'Falta elegir color o talla'
                    : `Proceder al Pago (${selectedCount})`}
            </GlassButton>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default Cart;
