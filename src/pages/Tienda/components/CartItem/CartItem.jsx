import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useCart } from '../../../../contexts/CartContext';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import { T } from '../../../../i18n/useTranslatedText';
import ComboProductImage from '../ComboProductImage/ComboProductImage';
import { queLeFalta } from '../../../../utils/cartValidation';
import styles from './CartItem.module.css';

const CartItem = ({ item, incompleto = false }) => {
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

  // Color elegido: el nombre vive en selectedVariant.name y, en los items que
  // vienen del editor, en variant.color. El hex (si lo hay) pinta la bolita.
  const colorName = item.variant?.selectedVariant?.name || item.variant?.color || null;
  const colorHex = item.variant?.selectedVariant?.colorHex || null;

  // A cantidad 1 el "-" llamaba a updateQuantity(0), que borra el artículo sin
  // avisar. Para quitarlo está la papelera; aquí el "-" simplemente se apaga.
  const canDecrease = item.quantity > 1;

  return (
    <div className={`${styles.item} ${!isSelected ? styles.itemDeselected : ''} ${incompleto ? styles.itemIncompleto : ''}`}>
      {/* Casilla de selección, como en cualquier carrito: decide qué se paga
          ahora sin sacar el artículo del carrito. */}
      <label className={styles.selectBox}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleItemSelected(item.id)}
        />
        <span className={styles.srOnly}>
          {isSelected ? 'Quitar de la compra' : 'Incluir en la compra'} {item.productName}
        </span>
      </label>

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
        
        {!isCombo && (colorName || item.variant.size) && (
          <dl className={styles.meta}>
            {colorName && (
              <div className={styles.metaRow}>
                <dt><T>Color</T></dt>
                <dd>
                  {colorHex && (
                    <span className={styles.swatch} style={{ background: colorHex }} aria-hidden="true" />
                  )}
                  <T>{colorName}</T>
                </dd>
              </div>
            )}
            {item.variant.size && (
              <div className={styles.metaRow}>
                <dt><T>Talla</T></dt>
                <dd>{item.variant.size}</dd>
              </div>
            )}
          </dl>
        )}

        {/* Línea creada por el antiguo botón rápido: entró sin color ni talla y
            no se puede despachar. Se marca y se manda a la ficha a elegirlos. */}
        {incompleto && (
          <div className={styles.incompleto}>
            <span className={styles.incompletoTexto}>
              <T>Falta elegir</T> {queLeFalta(item).join(' y ')}
            </span>
            <Link to={`/producto/${item.productId}`} className={styles.incompletoLink}>
              <T>Elegir ahora</T>
            </Link>
          </div>
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
        
        {/* El precio unitario solo aporta cuando hay más de una unidad; con
            cantidad 1 repetía el mismo número que el total de la fila. */}
        {item.quantity > 1 && (
          <div className={styles.price}>S/ {itemPrice.toFixed(2)} c/u</div>
        )}

        {/* Al desmarcarlo se dice por qué sigue ahí: no se ha borrado, solo no
            se paga en esta compra. */}
        {!isSelected && (
          <span className={styles.notaNoSeCobra}><T>No se cobrará en esta compra</T></span>
        )}
      </div>

      <div className={styles.quantity}>
        <button
          type="button"
          onClick={() => handleQuantityChange(item.quantity - 1)}
          disabled={!canDecrease}
          aria-label="Quitar una unidad"
          title={canDecrease ? 'Quitar una unidad' : 'Usa la papelera para eliminar el artículo'}
        >-</button>
        <span aria-live="polite">{item.quantity}</span>
        <button
          type="button"
          onClick={() => handleQuantityChange(item.quantity + 1)}
          aria-label="Añadir una unidad"
        >+</button>
      </div>

      <div className={styles.total}>
        <div className={styles.totalPrice}>S/ {totalPrice.toFixed(2)}</div>
        <button
          type="button"
          onClick={handleRemove}
          className={styles.removeButton}
          aria-label={`Eliminar ${item.productName} del carrito`}
          title="Eliminar del carrito"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default CartItem;
