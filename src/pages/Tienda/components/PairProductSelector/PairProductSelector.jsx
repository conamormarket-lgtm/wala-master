import React from 'react';
import styles from './PairProductSelector.module.css';

/**
 * Componente para seleccionar variantes independientes de cada prenda en productos pareja
 */
const PairProductSelector = ({ 
  sizes = [], 
  colors = [], 
  pairVariants = { item1: { size: '', color: '' }, item2: { size: '', color: '' } },
  onChange 
}) => {
  const handleItem1SizeChange = (size) => {
    onChange({
      item1: { ...pairVariants.item1, size },
      item2: pairVariants.item2
    });
  };

  const handleItem1ColorChange = (color) => {
    onChange({
      item1: { ...pairVariants.item1, color },
      item2: pairVariants.item2
    });
  };

  const handleItem2SizeChange = (size) => {
    onChange({
      item1: pairVariants.item1,
      item2: { ...pairVariants.item2, size }
    });
  };

  const handleItem2ColorChange = (color) => {
    onChange({
      item1: pairVariants.item1,
      item2: { ...pairVariants.item2, color }
    });
  };

  return (
    <div className={styles.container}>
      {/* Prenda 1 */}
      <div className={styles.itemSection}>
        <h3 className={styles.itemLabel}>Prenda 1</h3>
        
        {sizes.length > 0 && (
          <div className={styles.variantGroup}>
            <label className={styles.variantLabel}>Talla:</label>
            <div className={styles.variantOptions}>
              {sizes.map(size => (
                <button
                  key={`item1-${size}`}
                  type="button"
                  className={`${styles.variantButton} ${pairVariants.item1?.size === size ? styles.active : ''}`}
                  onClick={() => handleItem1SizeChange(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {colors.length > 0 && (
          <div className={styles.variantGroup}>
            <label className={styles.variantLabel}>Color:</label>
            <div className={styles.variantOptions}>
              {colors.map(color => (
                <button
                  key={`item1-${color}`}
                  type="button"
                  className={`${styles.colorButton} ${pairVariants.item1?.color === color ? styles.active : ''}`}
                  onClick={() => handleItem1ColorChange(color)}
                  style={{ backgroundColor: /^#|[a-fA-F0-9]{6}$/.test(color) ? color : undefined }}
                  title={color}
                >
                  {/^#|[a-fA-F0-9]{6}$/.test(color) ? '' : color.slice(0, 1).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prenda 2 */}
      <div className={styles.itemSection}>
        <h3 className={styles.itemLabel}>Prenda 2</h3>
        
        {sizes.length > 0 && (
          <div className={styles.variantGroup}>
            <label className={styles.variantLabel}>Talla:</label>
            <div className={styles.variantOptions}>
              {sizes.map(size => (
                <button
                  key={`item2-${size}`}
                  type="button"
                  className={`${styles.variantButton} ${pairVariants.item2?.size === size ? styles.active : ''}`}
                  onClick={() => handleItem2SizeChange(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {colors.length > 0 && (
          <div className={styles.variantGroup}>
            <label className={styles.variantLabel}>Color:</label>
            <div className={styles.variantOptions}>
              {colors.map(color => (
                <button
                  key={`item2-${color}`}
                  type="button"
                  className={`${styles.colorButton} ${pairVariants.item2?.color === color ? styles.active : ''}`}
                  onClick={() => handleItem2ColorChange(color)}
                  style={{ backgroundColor: /^#|[a-fA-F0-9]{6}$/.test(color) ? color : undefined }}
                  title={color}
                >
                  {/^#|[a-fA-F0-9]{6}$/.test(color) ? '' : color.slice(0, 1).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PairProductSelector;
