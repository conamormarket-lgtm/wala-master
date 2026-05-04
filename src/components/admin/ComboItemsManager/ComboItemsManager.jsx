import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProduct } from '../../../services/products';
import { toDirectImageUrl, ensureSingleImageUrl } from '../../../utils/imageUrl';
import Button from '../../common/Button';
import styles from './ComboItemsManager.module.css';

const ComboItemsManager = ({ comboItems = [], onItemsChange, onAddItem }) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [scaleInputs, setScaleInputs] = useState({});

  const handleRemoveItem = (index) => {
    const newItems = comboItems.filter((_, i) => i !== index);
    onItemsChange(newItems);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newItems = [...comboItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    newItems[index - 1].position = index - 1;
    newItems[index].position = index;
    onItemsChange(newItems);
  };

  const handleMoveDown = (index) => {
    if (index === comboItems.length - 1) return;
    const newItems = [...comboItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    newItems[index].position = index;
    newItems[index + 1].position = index + 1;
    onItemsChange(newItems);
  };

  const handleScaleChange = (index, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;
    const newItems = [...comboItems];
    newItems[index] = { ...newItems[index], scale: numValue };
    onItemsChange(newItems);
  };

  const handleDisplayColorChange = (index, color) => {
    const newItems = [...comboItems];
    newItems[index] = {
      ...newItems[index],
      variantMapping: {
        ...(newItems[index].variantMapping || {}),
        color: color || undefined
      }
    };
    onItemsChange(newItems);
  };

  const handleAllowedColorsChange = (index, allowedColors) => {
    const newItems = [...comboItems];
    const currentMapping = newItems[index].variantMapping || {};

    // Si la lista cambia, aseguramos que el color principal esté dentro de los permitidos
    let newMainColor = currentMapping.color;
    if (allowedColors.length > 0 && (!newMainColor || !allowedColors.includes(newMainColor))) {
      newMainColor = allowedColors[0];
    } else if (allowedColors.length === 0) {
      newMainColor = undefined;
    }

    newItems[index] = {
      ...newItems[index],
      variantMapping: {
        ...currentMapping,
        color: newMainColor,
        allowedColors: allowedColors.length > 0 ? allowedColors : undefined
      }
    };
    onItemsChange(newItems);
  };

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <h4 className={styles.title}>Productos del Combo</h4>
        <Button type="button" variant="secondary" onClick={onAddItem}>
          + Añadir Producto
        </Button>
      </div>

      {comboItems.length === 0 ? (
        <div className={styles.empty}>
          <p>No hay productos en el combo. Haz clic en "Añadir Producto" para comenzar.</p>
        </div>
      ) : (
        <div className={styles.itemsList}>
          {comboItems.map((item, index) => (
            <ComboItemCard
              key={`${item.productId}-${item.viewId}-${index}`}
              item={item}
              index={index}
              onRemove={() => handleRemoveItem(index)}
              onMoveUp={index > 0 ? () => handleMoveUp(index) : null}
              onMoveDown={index < comboItems.length - 1 ? () => handleMoveDown(index) : null}
              onScaleChange={(value) => handleScaleChange(index, value)}
              onDisplayColorChange={(color) => handleDisplayColorChange(index, color)}
              onAllowedColorsChange={(colors) => handleAllowedColorsChange(index, colors)}
              scale={item.scale || 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ComboItemCard = ({
  item, index, onRemove, onMoveUp, onMoveDown, onScaleChange, onDisplayColorChange, onAllowedColorsChange, scale
}) => {
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', item.productId],
    queryFn: async () => {
      const { data, error } = await getProduct(item.productId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!item.productId
  });

  const view = product?.customizationViews?.find(v => v.id === item.viewId) || product?.customizationViews?.[0];
  const availableVariants = Array.isArray(product?.variants) ? product.variants : [];
  const availableColors = !availableVariants.length && product?.variants?.colors ? product.variants.colors : [];
  const variantOptions = availableVariants.length > 0 ? availableVariants : availableColors.map((c) => ({ id: c, name: c }));

  const displayColor = item.variantMapping?.color || '';
  const matchedVariant = availableVariants.find(v => v.name === displayColor);
  const viewImageRaw = matchedVariant?.imageUrl || view?.imagesByColor?.[displayColor] || product?.mainImage || view?.imagesByColor?.default || product?.images?.[0] || '';
  const viewImage = ensureSingleImageUrl(viewImageRaw) ? toDirectImageUrl(ensureSingleImageUrl(viewImageRaw)) : '';
  const productName = product?.name || 'Cargando...';

  return (
    <div className={styles.itemCard}>
      <div className={styles.itemHeader}>
        <span className={styles.itemNumber}>#{index + 1}</span>
        <div className={styles.itemActions}>
          {onMoveUp && (
            <button type="button" className={styles.actionBtn} onClick={onMoveUp} title="Mover arriba">
              ↑
            </button>
          )}
          {onMoveDown && (
            <button type="button" className={styles.actionBtn} onClick={onMoveDown} title="Mover abajo">
              ↓
            </button>
          )}
          <button type="button" className={styles.actionBtn} onClick={onRemove} title="Eliminar">
            ×
          </button>
        </div>
      </div>

      <div className={styles.itemContent}>
        {isLoading ? (
          <div className={styles.loading}>Cargando producto...</div>
        ) : (
          <>
            <div className={styles.itemThumbnail}>
              {viewImage && (
                <img
                  src={viewImage}
                  alt={productName}
                  className={styles.thumbnail}
                  loading="lazy"
                />
              )}
            </div>
            <div className={styles.itemInfo}>
              <div className={styles.itemName}>{productName}</div>
              <div className={styles.itemMeta}>
                Vista: {view?.name || 'Por defecto'}
              </div>
              {variantOptions.length > 0 && (
                <div className={styles.variantContainer}>
                  <div className={styles.colorControl}>
                    <label className={styles.fieldLabel}>Variante Principal:</label>
                    <select
                      value={displayColor}
                      onChange={(e) => onDisplayColorChange(e.target.value)}
                      className={styles.colorSelect}
                    >
                      <option value="">{availableVariants.length > 0 ? 'Sin variante...' : 'Por defecto'}</option>
                      {(item.variantMapping?.allowedColors || variantOptions.map(o => o.name)).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.allowedColorsControl}>
                    <label className={styles.fieldLabel}>Variantes Permitidas:</label>
                    <div className={styles.allowedGrid}>
                      {variantOptions.map((opt) => {
                        const isAllowed = (item.variantMapping?.allowedColors || []).includes(opt.name);
                        const order = (item.variantMapping?.allowedColors || []).indexOf(opt.name) + 1;

                        return (
                          <label
                            key={opt.id}
                            className={`${styles.allowedOption} ${isAllowed ? styles.allowedOptionActive : ''}`}
                            title={isAllowed ? `Orden en el editor: ${order}` : 'Habilitar variante'}
                          >
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              onChange={(e) => {
                                const current = item.variantMapping?.allowedColors || [];
                                if (e.target.checked) {
                                  onAllowedColorsChange([...current, opt.name]);
                                } else {
                                  onAllowedColorsChange(current.filter(c => c !== opt.name));
                                }
                              }}
                              className={styles.allowedCheckbox}
                            />
                            <span className={styles.allowedName}>{opt.name || opt.id}</span>
                            {isAllowed && <span className={styles.allowedOrder}>{order}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div className={styles.scaleControl}>
                <label className={styles.scaleLabel}>
                  Escala:
                  <input
                    type="number"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={scale}
                    onChange={(e) => onScaleChange(e.target.value)}
                    className={styles.scaleInput}
                  />
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComboItemsManager;
