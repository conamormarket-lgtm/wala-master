import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fabric } from 'fabric';
import { getProduct } from '../../../../../../services/products';
import { EditorProvider, useEditor } from '../../../contexts/EditorContext';
import { useAuth } from '../../../../../../contexts/AuthContext';
import EditorCanvas from '../EditorCanvas/EditorCanvas';
import Toolbar from '../Toolbar/Toolbar';
import { toDirectImageUrl } from '../../../../../../utils/imageUrl';
import { getCloudinaryOptimized } from '../../../../../common/OptimizedImage/OptimizedImage';
import ComboProductImage from '../../../../../../pages/Tienda/components/ComboProductImage/ComboProductImage';
import DraggableContainer from '../../../../../common/DraggableContainer/DraggableContainer';
import MobileFloatingTools from '../MobileFloatingTools/MobileFloatingTools';
import styles from './ComboUserEditor.module.css';

/**
 * Editor de usuario para productos combo
 * Muestra imagen unificada y permite editar por áreas
 */
const ComboUserEditorContent = ({
  comboProduct,
  comboItems = [],
  comboLayout = { orientation: 'horizontal', spacing: 20 },
  initialVariantSelections = {},
  onVariantChange,
  onLayersChange
}) => {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [variantSelections, setVariantSelections] = useState(initialVariantSelections);
  const canvasRefs = useRef({});

  // Inicializar variantes desde comboItems
  useEffect(() => {
    if (comboItems.length > 0 && Object.keys(variantSelections).length === 0) {
      const initial = {};
      comboItems.forEach((item, index) => {
        initial[index] = {
          color: item.variantMapping?.color || 'default',
          size: ''
        };
      });
      setVariantSelections(initial);
    }
  }, [comboItems]);

  const activeItem = comboItems[activeItemIndex];

  // Cargar producto activo
  const { data: activeProduct } = useQuery({
    queryKey: ['combo-item-product', activeItem?.productId],
    queryFn: async () => {
      if (!activeItem?.productId) return null;
      const { data, error } = await getProduct(activeItem.productId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!activeItem?.productId
  });

  const comboItemCustomization = comboProduct?.comboItemCustomization || [];

  const activeView = useMemo(() => {
    if (!activeProduct || !activeItem) return null;
    const productView = activeProduct.customizationViews?.find(v => v.id === activeItem.viewId)
      || activeProduct.customizationViews?.[0];
    if (!productView) return null;
    const custom = comboItemCustomization[activeItemIndex];
    if (!custom) return productView;
    return {
      ...productView,
      printAreas: Array.isArray(custom.printAreas) && custom.printAreas.length > 0
        ? custom.printAreas
        : (productView.printAreas || []),
      initialLayersByColor: custom.initialLayersByColor && typeof custom.initialLayersByColor === 'object'
        ? custom.initialLayersByColor
        : (productView.initialLayersByColor || { default: [] })
    };
  }, [activeProduct, activeItem, activeItemIndex, comboItemCustomization]);

  const activeProductImage = useMemo(() => {
    if (!activeView) return '';
    const variant = variantSelections[activeItemIndex] || {};
    const colorKey = variant.color || 'default';
    const matchedVar = activeProduct?.variants?.find(v => v.name === colorKey);
    return activeView.imagesByColor?.[colorKey]
      || matchedVar?.imageUrl
      || activeProduct?.mainImage
      || activeView.imagesByColor?.default
      || activeProduct?.images?.[0]
      || '';
  }, [activeView, activeProduct, variantSelections, activeItemIndex]);

  const activePrintAreas = useMemo(() => {
    if (!activeView) return [];
    return Array.isArray(activeView.printAreas) && activeView.printAreas.length > 0
      ? activeView.printAreas
      : [];
  }, [activeView]);

  // Colores reales del producto activo para pre-renderizar Canvases y conmutar instantáneamente
  const activeColorsToRender = useMemo(() => {
    if (!activeProduct || !activeView) return ['default'];
    const productColors = activeProduct.hasVariants
      ? activeProduct.variants.map(v => v.name).filter(Boolean)
      : [];

    const allowed = activeItem?.variantMapping?.allowedColors;
    const allowedLower = allowed && Array.isArray(allowed) ? allowed.map(c => c.trim().toLowerCase()) : [];
    let filtered = allowedLower.length > 0
      ? productColors.filter(c => allowedLower.includes((c || '').trim().toLowerCase()))
      : productColors;

    if (filtered.length === 0) filtered = ['default'];
    return filtered.includes('default') ? filtered : [...filtered];
  }, [activeProduct, activeView, activeItem]);

  const { setLayersForView, setActiveViewId, layersByView } = useEditor();
  const initializedViewsRef = useRef(new Set());
  const layersByViewRef = useRef(layersByView);
  
  useEffect(() => {
    layersByViewRef.current = layersByView;
  }, [layersByView]);

  const handleVariantChange = (itemIndex, variant) => {
    const oldVariant = variantSelections[itemIndex] || {};
    const oldColorCode = oldVariant.color || 'default';
    const newColorCode = variant.color || 'default';

    // Auto-duplicar el diseño del color actual hacia el nuevo color si cambia
    // Esto asegura que el esfuerzo del cliente no se borre al probar otro color.
    if (oldColorCode !== newColorCode) {
      const oldVId = `combo-view-${itemIndex}-${oldColorCode}`;
      const newVId = `combo-view-${itemIndex}-${newColorCode}`;
      const currentLayers = layersByViewRef.current[oldVId];
      
      if (currentLayers) {
        // Clonamos exactamente las capas (incluyendo su customización)
        const clonedLayers = JSON.parse(JSON.stringify(currentLayers));
        setLayersForView(newVId, clonedLayers);
        // Marcamos la nueva vista como inicializada para evitar que useEffect lo sobreescriba con el diseño del Admin
        initializedViewsRef.current.add(newVId);
      }
    }
    const newSelections = {
      ...variantSelections,
      [itemIndex]: variant
    };
    setVariantSelections(newSelections);
    if (onVariantChange) {
      onVariantChange(itemIndex, variant);
    }
  };

  // Sincronizar capas iniciales según el color seleccionado
  useEffect(() => {
    if (!activeView) return;

    const variant = variantSelections[activeItemIndex] || {};
    const colorKey = variant.color || 'default';
    const vId = `combo-view-${activeItemIndex}-${colorKey}`;

    // Configurar viewId activo para el Toolbar
    setActiveViewId(vId);

    // Cargar capas del admin solo una vez por vista/color
    if (!initializedViewsRef.current.has(vId)) {
      const lyrs = activeView.initialLayersByColor?.[colorKey] || activeView.initialLayersByColor?.default || [];
      if (Array.isArray(lyrs)) {
        setLayersForView(vId, [...lyrs]);
        initializedViewsRef.current.add(vId);
      }
    }
  }, [activeItemIndex, activeView, variantSelections, setLayersForView, setActiveViewId]);

  // Notificar cambios de capas al padre si es necesario
  useEffect(() => {
    if (onLayersChange) {
      onLayersChange(layersByView);
    }
  }, [layersByView, onLayersChange]);

  return (
    <div className={styles.comboUserEditor}>
      {/* Selectores de variantes por producto */}
      <div className={styles.variantSelectors}>
        {comboItems.map((item, index) => (
          <ComboVariantSelector
            key={`${item.productId}-${index}`}
            item={item}
            index={index}
            variant={variantSelections[index] || {}}
            onChange={(variant) => handleVariantChange(index, variant)}
            isActive={activeItemIndex === index}
            onActivate={() => setActiveItemIndex(index)}
          />
        ))}
      </div>

      {/* Imagen compuesta unificada usando optimización HTML en lugar de Canvas Rendering pesado */}
      <div className={styles.composedImageSection}>
        <div className={styles.composedImageContainer}>
          <ComboProductImage
            comboProduct={comboProduct}
            variantSelections={variantSelections}
            className={styles.composedImageWrapper}
            isAboveFold={true}
          />
          <div className={styles.activeItemIndicator}>
            Editando: Producto {activeItemIndex + 1}
          </div>
        </div>
      </div>

      {/* Editor del producto activo */}
      {activeProductImage && (
        <div className={styles.editorSection}>
          <div className={styles.editorHeader}>
            <h3 className={styles.editorTitle}>
              Personalizando: {activeProduct?.name || 'Producto'}
            </h3>
          </div>
          <div className={styles.editorLayout}>
            <div className={styles.canvasSection}>
              {activeColorsToRender.map(colorCode => {
                const isActive = (variantSelections[activeItemIndex]?.color || 'default') === colorCode ||
                  (!variantSelections[activeItemIndex]?.color && colorCode === 'default');
                const vId = `combo-view-${activeItemIndex}-${colorCode}`;
                const matchedVar = activeProduct?.variants?.find(v => v.name === colorCode);
                const imgUrlForColor = getCloudinaryOptimized(activeView.imagesByColor?.[colorCode] || matchedVar?.imageUrl || activeProduct?.mainImage || activeView.imagesByColor?.default || activeProduct?.images?.[0] || '');

                return (
                  <div
                    key={vId}
                    style={{
                      display: isActive ? 'block' : 'none',
                      width: '100%'
                    }}
                  >
                    <EditorCanvas
                      productImage={imgUrlForColor}
                      printAreas={activePrintAreas}
                      viewId={vId}
                    />
                  </div>
                );
              })}
              {/* Botón Flotante para Móvil. Global a toda la sección del canvas */}
              <MobileFloatingTools />
            </div>
            <div className={styles.toolbarSection}>
              <Toolbar />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Selector de variantes para un item del combo
 */
const ComboVariantSelector = ({ item, index, variant, onChange, isActive, onActivate }) => {
  const { data: product } = useQuery({
    queryKey: ['product', item.productId],
    queryFn: async () => {
      const { data, error } = await getProduct(item.productId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!item.productId
  });
  const availableSizes = product ? (product.hasVariants ? Array.from(new Set(product.variants.flatMap(v => v.sizes || []))) : (product.mainSizes || [])) : [];
  const availableColors = product && product.hasVariants ? product.variants.map(v => v.name).filter(Boolean) : [];

  // Filtrar por los colores permitidos definidos por el admin
  const allowed = item.variantMapping?.allowedColors;
  const allowedLower = allowed && Array.isArray(allowed) ? allowed.map(c => c.trim().toLowerCase()) : [];
  const filteredColors = allowedLower.length > 0
    ? availableColors.filter(c => allowedLower.includes((c || '').trim().toLowerCase()))
    : availableColors;

  return (
    <div
      className={`${styles.variantSelector} ${isActive ? styles.active : ''}`}
      onClick={onActivate}
    >
      <div className={styles.selectorHeader}>
        <span className={styles.selectorLabel}>Producto {index + 1}</span>
        {product && (
          <span className={styles.productName}>{product.name}</span>
        )}
      </div>

      {availableSizes.length > 0 && (
        <div className={styles.selectorField}>
          <label className={styles.fieldLabel}>Talla:</label>
          <select
            value={variant.size || ''}
            onChange={(e) => onChange({ ...variant, size: e.target.value })}
            className={styles.select}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">Seleccionar</option>
            {availableSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}

      {filteredColors.length > 0 && (
        <div className={styles.selectorField}>
          <label className={styles.fieldLabel}>
            Color: <span className={styles.colorName}>{variant.color || 'Por defecto'}</span>
            {filteredColors.length > 5 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
          </label>
          <DraggableContainer className={styles.swatches} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            {filteredColors.map(color => {
              const isHex = color.startsWith('#');
              const bgStyle = isHex ? { backgroundColor: color } : {};
              return (
                <div
                  key={color}
                  className={`${styles.swatchBtn} ${variant.color === color ? styles.active : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ ...variant, color });
                  }}
                  title={color}
                >
                  <span
                    className={`${styles.swatchCircle} ${color === 'default' ? styles.defaultColor : ''}`}
                    style={bgStyle}
                  />
                </div>
              );
            })}
          </DraggableContainer>
        </div>
      )}
    </div>
  );
};

const ComboUserEditor = (props) => {
  return (
    <EditorProvider>
      <ComboUserEditorContent {...props} />
    </EditorProvider>
  );
};

export default ComboUserEditor;
