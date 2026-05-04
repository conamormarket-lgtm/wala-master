import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProduct } from '../../../services/products';
import UnifiedComboEditor from '../UnifiedComboEditor/UnifiedComboEditor';
import { toDirectImageUrl, ensureSingleImageUrl } from '../../../utils/imageUrl';
import styles from './ComboEditor.module.css';

const ComboEditor = forwardRef(({
  comboItems = [],
  comboLayout = { orientation: 'horizontal', spacing: 20 },
  onItemsChange,
  comboItemCustomization,
  onComboItemCustomizationChange,
  onCaptureDefaultThumbnail,
  onColorChange,
  triggerCaptureRef
}, ref) => {
  useImperativeHandle(ref, () => ({}), []);

  if (comboItems.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No hay productos en el combo. Añade productos desde la configuración del combo.</p>
      </div>
    );
  }

  return (
    <div className={styles.comboEditor}>
      <UnifiedComboEditor
        canEditZones={true}
        comboItems={comboItems}
        comboLayout={comboLayout}
        comboItemCustomization={comboItemCustomization}
        onComboItemCustomizationChange={onComboItemCustomizationChange}
        onCaptureDefaultThumbnail={onCaptureDefaultThumbnail}
        onColorChange={onColorChange}
        triggerCaptureRef={triggerCaptureRef}
      />
    </div>
  );
});

ComboEditor.displayName = 'ComboEditor';

const ComboPreview = forwardRef(({ comboItems, comboLayout }, ref) => {
  const [previewImages, setPreviewImages] = useState({});
  const previewRef = React.useRef(null);

  React.useImperativeHandle(ref, () => ({
    getPreviewElement: () => previewRef.current
  }), []);

  React.useEffect(() => {
    comboItems.forEach(async (item, index) => {
      try {
        const { data: product } = await getProduct(item.productId);
        if (product) {
          const view = product.customizationViews?.find((v) => v.id === item.viewId) || product.customizationViews?.[0];
          const displayColor = item.variantMapping?.color || '';
          const rawUrl = view?.imagesByColor?.[displayColor] || view?.imagesByColor?.default || product.images?.[0] || '';
          const imageUrl = ensureSingleImageUrl(rawUrl) ? toDirectImageUrl(ensureSingleImageUrl(rawUrl)) : '';
          const cacheKey = `${item.productId}-${index}-${displayColor}`;
          if (imageUrl) {
            setPreviewImages((prev) => ({ ...prev, [cacheKey]: imageUrl }));
          }
        }
      } catch (error) {
        console.error(`Error loading preview for product ${item.productId}:`, error);
      }
    });
  }, [comboItems]);

  const isHorizontal = comboLayout.orientation === 'horizontal';

  return (
    <div
      ref={previewRef}
      className={styles.preview}
      style={{
        flexDirection: isHorizontal ? 'row' : 'column',
        gap: `${comboLayout.spacing || 20}px`
      }}
    >
      {comboItems.map((item, index) => {
        const cacheKey = `${item.productId}-${index}-${item.variantMapping?.color || ''}`;
        const imageUrl = previewImages[cacheKey];
        if (!imageUrl) {
          return (
            <div key={`${item.productId}-${index}`} className={styles.previewPlaceholder}>
              Cargando...
            </div>
          );
        }
        return (
          <div
            key={`${item.productId}-${index}`}
            className={styles.previewItem}
            style={{
              transform: `scale(${item.scale || 1})`,
              flex: isHorizontal ? '0 0 auto' : '1 1 auto'
            }}
          >
            <img src={imageUrl} alt={`Producto ${index + 1}`} className={styles.previewImage} loading="lazy" />
          </div>
        );
      })}
    </div>
  );
});

ComboPreview.displayName = 'ComboPreview';

export { ComboPreview };
export default ComboEditor;
