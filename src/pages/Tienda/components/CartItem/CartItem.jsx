import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../../../contexts/CartContext';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import { T } from '../../../../i18n/useTranslatedText';
import ComboProductImage from '../ComboProductImage/ComboProductImage';
import styles from './CartItem.module.css';

const CartItem = ({ item }) => {
  const { updateQuantity, removeFromCart, toggleItemSelected } = useCart();

  const handleQuantityChange = (newQuantity) => {
    updateQuantity(item.id, newQuantity);
  };

  const handleRemove = () => {
    removeFromCart(item.id);
  };

  const itemPrice = item.customization?.finalPrice || item.price;
  const totalPrice = itemPrice * item.quantity;
  const isCombo = item.isComboProduct;
  // Un item sin la propiedad 'selected' se considera seleccionado (se comprará).
  const isSelected = item.selected !== false;

  return (
    <div className={`${styles.item} ${!isSelected ? styles.itemDeselected : ''}`}>
      <Link to={`/producto/${item.productId}`} className={styles.imageLink}>
        {isCombo && item.comboItems ? (
          <ComboProductImage
            comboProduct={{
              id: item.productId,
              name: item.productName,
              comboItems: item.comboItems,
              comboLayout: item.comboLayout,
              comboPreviewImage: item.productImage
            }}
            variantSelections={item.comboVariantSelections || {}}
            className={styles.comboImage}
          />
        ) : (
          <img src={toDirectImageUrl(item.productImage)} alt={item.productName} className={styles.image} loading="lazy" />
        )}
      </Link>
      
      <div className={styles.details}>
        <Link to={`/producto/${item.productId}`} className={styles.name}>
          {/* Nombre dinámico del producto (viene de la BD): se traduce con <T>. */}
          <T>{item.productName}</T>
          {isCombo && <span className={styles.comboBadge}>Combo</span>}
        </Link>
        
        {isCombo && item.comboItems && item.comboItems.length > 0 && (
          <div className={styles.comboInfo}>
            <span className={styles.comboLabel}>Incluye {item.comboItems.length} producto{item.comboItems.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        
        {!isCombo && item.variant.selectedVariant?.name && (
          <div className={styles.variant}>Variante: {item.variant.selectedVariant.name}</div>
        )}
        {!isCombo && !item.variant.selectedVariant?.name && item.variant.color && (
          <div className={styles.variant}>Color: {item.variant.color}</div>
        )}
        {!isCombo && item.variant.size && (
          <div className={styles.variant}>Talla: {item.variant.size}</div>
        )}
        
        {isCombo && item.comboVariantSelections && Object.keys(item.comboVariantSelections).length > 0 && (
          <div className={styles.comboVariants}>
            {Object.entries(item.comboVariantSelections).map(([index, variant]) => (
              <div key={index} className={styles.comboVariantItem}>
                Producto {parseInt(index) + 1}: {variant.size && `Talla ${variant.size}`} {variant.color && `Color ${variant.color}`}
              </div>
            ))}
          </div>
        )}
        
        <div className={styles.price}>S/ {itemPrice.toFixed(2)} c/u</div>

        {/* Selección de compra: deja el item en el carrito pero lo excluye/incluye del pago. */}
        <button
          type="button"
          onClick={() => toggleItemSelected(item.id)}
          className={`${styles.selectToggle} ${!isSelected ? styles.selectToggleOff : ''}`}
          aria-pressed={!isSelected}
        >
          {isSelected ? 'No comprar esta vez' : '✓ Comprar esta vez'}
        </button>
      </div>

      <div className={styles.quantity}>
        <button onClick={() => handleQuantityChange(item.quantity - 1)}>-</button>
        <span>{item.quantity}</span>
        <button onClick={() => handleQuantityChange(item.quantity + 1)}>+</button>
      </div>

      <div className={styles.total}>
        <div className={styles.totalPrice}>S/ {totalPrice.toFixed(2)}</div>
        <button onClick={handleRemove} className={styles.removeButton}>
          🗑️
        </button>
      </div>
    </div>
  );
};

export default CartItem;
