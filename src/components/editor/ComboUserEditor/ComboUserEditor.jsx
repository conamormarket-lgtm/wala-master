import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fabric } from 'fabric';
import { getProduct } from '../../../services/products';
import { EditorProvider, useEditor } from '../../../contexts/EditorContext';
import EditorCanvas from '../EditorCanvas/EditorCanvas';
import Toolbar from '../Toolbar/Toolbar';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { getCloudinaryOptimized } from '../../common/OptimizedImage/OptimizedImage';
import ComboProductImage from '../../../pages/Tienda/components/ComboProductImage/ComboProductImage';
import DraggableContainer from '../../common/DraggableContainer/DraggableContainer';
import MobileFloatingTools from '../MobileFloatingTools/MobileFloatingTools';
import Modal from '../../common/Modal/Modal';
import { getFallbackHex } from '../../../utils/colors';
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
  onLayersChange,
  userComboCustomization = null,
  isDesignLoaded = false
}) => {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeSide, setActiveSide] = useState('front');
  const [variantSelections, setVariantSelections] = useState(initialVariantSelections);
  const [showMobileSettingsModal, setShowMobileSettingsModal] = useState(false);
  const [isMobileEditing, setIsMobileEditing] = useState(false);
  const canvasRefs = useRef({});

  // Inicializar variantes desde comboItems
  useEffect(() => {
    if (comboItems.length > 0 && Object.keys(variantSelections).length === 0 && Object.keys(initialVariantSelections).length === 0) {
      const initial = {};
      comboItems.forEach((item, index) => {
        initial[index] = {
          color: item.variantMapping?.color || 'default',
          size: ''
        };
        // Emitir hacia arriba asícrona o directamente para asegurar persistencia futura:
        if (onVariantChange) onVariantChange(index, initial[index]);
      });
      setVariantSelections(initial);
    }
  }, [comboItems, variantSelections, initialVariantSelections, onVariantChange]);

  // Sincronizar variantes iniciales si cambian asíncronamente (ej: cargado desde la Base de Datos)
  useEffect(() => {
    if (Object.keys(initialVariantSelections).length > 0) {
      setVariantSelections((prev) => {
        const isDifferent = JSON.stringify(prev) !== JSON.stringify(initialVariantSelections);
        return isDifferent ? { ...initialVariantSelections } : prev;
      });
    }
  }, [initialVariantSelections, onVariantChange]);

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
      initialLayersByColor: custom.initialLayersByColor && typeof custom.initialLayersByColor === 'object' && Object.keys(custom.initialLayersByColor).length > 0
        ? custom.initialLayersByColor
        : (productView.initialLayersByColor || { default: [] }),
      hasBackSide: !!productView.hasBackSide,
      backSide: productView.hasBackSide ? {
        ...(productView.backSide || {}),
        printAreas: custom.backSide?.printAreas?.length > 0 ? custom.backSide.printAreas : (productView.backSide?.printAreas || []),
        initialLayersByColor: custom.backSide?.initialLayersByColor && Object.keys(custom.backSide.initialLayersByColor).length > 0 ? custom.backSide.initialLayersByColor : (productView.backSide?.initialLayersByColor || { default: [] }),
        imagesByColor: productView.backSide?.imagesByColor || { default: '' }
      } : undefined
    };
  }, [activeProduct, activeItem, activeItemIndex, comboItemCustomization]);

  const currentSideData = useMemo(() => {
    if (!activeView) return null;
    if (activeSide === 'back' && activeView.hasBackSide && activeView.backSide) {
      return {
        id: activeView.backSide.id || `${activeView.id}_back`,
        name: activeView.backSide.name || 'Espalda',
        printAreas: activeView.backSide.printAreas || [],
        initialLayersByColor: activeView.backSide.initialLayersByColor || { default: [] },
        imagesByColor: activeView.backSide.imagesByColor || { default: '' }
      };
    }
    return activeView;
  }, [activeView, activeSide]);

  const activeProductImage = useMemo(() => {
    if (!currentSideData) return '';
    const variant = variantSelections[activeItemIndex] || {};
    const colorKey = variant.color || 'default';
    const matchedVar = activeProduct?.variants?.find(v => v.name === colorKey);
    return currentSideData.imagesByColor?.[colorKey]
      || (activeSide === 'front' ? matchedVar?.imageUrl : null)
      || (activeSide === 'front' ? activeProduct?.mainImage : null)
      || currentSideData.imagesByColor?.default
      || (activeSide === 'front' ? activeProduct?.images?.[0] : null)
      || '';
  }, [currentSideData, activeProduct, variantSelections, activeItemIndex, activeSide]);

  const activePrintAreas = useMemo(() => {
    if (!currentSideData) return [];
    return Array.isArray(currentSideData.printAreas) && currentSideData.printAreas.length > 0
      ? currentSideData.printAreas
      : [];
  }, [currentSideData]);

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
  // Resetear vistas inicializadas cuando cambia el producto combo (navegación entre productos)
  useEffect(() => {
    initializedViewsRef.current = new Set();
  }, [comboProduct?.id]);

  const handleVariantChange = (itemIndex, variant) => {
    const oldVariant = variantSelections[itemIndex] || {};
    const oldColorCode = oldVariant.color || 'default';
    const newColorCode = variant.color || 'default';

    // Auto-duplicar el diseño del color actual hacia el nuevo color si cambia
    // Esto asegura que el esfuerzo del cliente no se borre al probar otro color.
    if (oldColorCode !== newColorCode) {
      const oldVId = `combo-view-${itemIndex}-${oldColorCode}`;
      const newVId = `combo-view-${itemIndex}-${newColorCode}`;
      const currentLayers = layersByView[oldVId];

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

  // Resetea el lado activo al cambiar de producto en el combo
  useEffect(() => {
    setActiveSide('front');
  }, [activeItemIndex]);

  // Precarga (caché invisible) de todas las imágenes principales y de la espalda para transiciones instantáneas
  useEffect(() => {
    if (!activeProduct || !activeProduct.customizationViews) return;

    const urlsToCache = new Set();

    activeProduct.customizationViews.forEach(view => {
      if (view.imagesByColor) {
        Object.values(view.imagesByColor).forEach(img => { if (img) urlsToCache.add(img); });
      }
      if (view.hasBackSide && view.backSide?.imagesByColor) {
        Object.values(view.backSide.imagesByColor).forEach(img => { if (img) urlsToCache.add(img); });
      }
    });

    if (activeProduct.mainImage) urlsToCache.add(activeProduct.mainImage);
    if (activeProduct.images) activeProduct.images.forEach(img => { if (img) urlsToCache.add(img); });
    if (activeProduct.variants) {
      activeProduct.variants.forEach(v => { if (v.imageUrl) urlsToCache.add(v.imageUrl); });
    }

    Array.from(urlsToCache).forEach(url => {
      // Optimización: descargar exactamente la misma resolución que consumirá el EditorCanvas
      const optimizedUrl = getCloudinaryOptimized(url);
      const img = new Image();
      img.src = optimizedUrl;
    });
  }, [activeProduct]);

  // Sincronizar capas iniciales según el color y lado seleccionado
  useEffect(() => {
    if (!currentSideData || !isDesignLoaded) return;

    const variant = variantSelections[activeItemIndex] || {};
    const colorKey = variant.color || 'default';
    const vId = `combo-view-${activeItemIndex}-${colorKey}${activeSide === 'back' ? '-back' : ''}`;

    // Configurar viewId activo para el Toolbar
    setActiveViewId(vId);

    // Cargar capas del admin solo una vez por vista/color/lado
    if (!initializedViewsRef.current.has(vId)) {
      const existingUserLayers = layersByView[vId];
      if (!existingUserLayers || existingUserLayers.length === 0) {
        let loadedLayers = null;
        if (userComboCustomization && userComboCustomization[activeItemIndex]?.layersByView) {
          loadedLayers = userComboCustomization[activeItemIndex].layersByView[vId];
        }

        const lyrs = loadedLayers || currentSideData.initialLayersByColor?.[colorKey] || currentSideData.initialLayersByColor?.default || [];
        if (Array.isArray(lyrs)) {
          setLayersForView(vId, [...lyrs]);
        }
      }
      initializedViewsRef.current.add(vId);
    }
  }, [activeItemIndex, activeSide, currentSideData, activeView, variantSelections, setLayersForView, setActiveViewId, layersByView, isDesignLoaded, userComboCustomization]);

  // Notificar cambios de capas al padre si es necesario
  useEffect(() => {
    if (onLayersChange) {
      onLayersChange(layersByView);
    }
  }, [layersByView, onLayersChange]);

  /* EditorControls ha sido desmantelado para ubicar Talla arriba y Color abajo del Canvas */

  return (
    <div className={styles.comboUserEditor}>

      {/* SISTEMA DE PESTAÑAS FLUIDO UNIFICADO */}
      <div className={styles.unifiedTabsRow}>
        <div className={styles.stepTabsList}>
          {comboItems.map((item, index) => {
            const isActive = activeItemIndex === index;
            return (
              <button
                key={index}
                className={`${styles.stepTab} ${isActive ? styles.stepTabActive : ''}`}
                onClick={() => setActiveItemIndex(index)}
              >
                <div className={styles.stepName}>
                  Producto {index + 1}
                </div>
              </button>
            )
          })}
          {/* Pestaña Global */}
          <button
            className={`${styles.stepTab} ${styles.globalTabBtn} ${activeItemIndex === 'all' ? styles.stepTabActive : ''}`}
            onClick={() => setActiveItemIndex('all')}
            title="Ver Todo"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 18v-3a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3m-3-14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
              <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.editorSection}>
        {/* CONTENEDOR PRINCIPAL */}
        <div className={styles.editingContainer}>
          {activeItemIndex !== 'all' ? (
            /* VISTA INDIVIDUAL (Un solo producto) */
            activeProductImage ? (
              <div className={styles.editorLayout}>

                {/* ZONA CENTRAL: Tallas, Lados, Canvas, Colores */}
                <div className={styles.productCustomizerArea}>
                  {/* 1. y 2. SUPERIOR: Talla y Lados */}
                  {comboItems[activeItemIndex] && (
                    <div className={styles.topControls}>
                      <ComboSizeSelector
                        item={comboItems[activeItemIndex]}
                        index={activeItemIndex}
                        variant={variantSelections[activeItemIndex] || {}}
                        onChange={(variant) => handleVariantChange(activeItemIndex, variant)}
                      />
                      {activeView?.hasBackSide && (
                        <div className={styles.sideToggles}>
                          <button
                            type="button"
                            className={`${styles.sideToggleBtn} ${activeSide === 'front' ? styles.activeState : ''}`}
                            onClick={() => setActiveSide('front')}
                          >
                            Frente
                          </button>
                          <button
                            type="button"
                            className={`${styles.sideToggleBtn} ${activeSide === 'back' ? styles.activeState : ''}`}
                            onClick={() => setActiveSide('back')}
                          >
                            Espalda
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. CANVA SECTION */}
                  <div className={styles.canvasSection}>
                    {activeColorsToRender.map(colorCode => {
                      const isActive = (variantSelections[activeItemIndex]?.color || 'default') === colorCode ||
                        (!variantSelections[activeItemIndex]?.color && colorCode === 'default');
                      const vId = `combo-view-${activeItemIndex}-${colorCode}${activeSide === 'back' ? '-back' : ''}`;

                      let fallbackUrl = (activeSide === 'front' ? (activeProduct?.variants?.find(v => v.name === colorCode)?.imageUrl || activeProduct?.mainImage || activeProduct?.images?.[0]) : null) || '';
                      const baseImg = currentSideData.imagesByColor?.[colorCode] || currentSideData.imagesByColor?.default || fallbackUrl;
                      const imgUrlForColor = getCloudinaryOptimized(baseImg);

                      return (
                        <div
                          key={vId}
                          style={{
                            display: isActive ? 'flex' : 'none',
                            flexDirection: 'column',
                            flex: 1,
                            /* Limitamos su tamaño máximo para forzar a que el Canva (y la imagen) se encojan adentro */
                            width: '100%',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            margin: 'auto',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden'
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
                    <MobileFloatingTools />
                  </div>

                  {/* 4. INFERIOR: Colores y Toolbar en el MISMO DIV exacto */}
                  {comboItems[activeItemIndex] && (
                    <div className={styles.bottomControls} style={{ display: 'flex', flexDirection: 'column' }}>
                      <ComboColorSelector
                        key={`${comboItems[activeItemIndex]?.productId}-${activeItemIndex}-fix`}
                        item={comboItems[activeItemIndex]}
                        index={activeItemIndex}
                        variant={variantSelections[activeItemIndex] || {}}
                        onChange={(variant) => handleVariantChange(activeItemIndex, variant)}
                      />

                      {/* 5. HERRAMIENTAS - Ahora siempre visible y unificado (sin esconderse en Mobile) */}
                      <div className={styles.toolbarSection}>
                        <Toolbar isComboMode={isMobileEditing} />
                      </div>
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '350px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px dashed #d1d5db', marginTop: '1.5rem', textAlign: 'center', padding: '2rem' }}>
                <div>
                  <p style={{ color: '#4b5563', fontSize: '1.125rem', margin: 0, fontWeight: 500 }}>
                    No está diseñado para esta opción.
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Este lado del producto aún no ha sido configurado para personalización.
                  </p>
                </div>
              </div>
            )
          ) : (
            /* VISTA GLOBAL (Todos los productos en grilla) */
            <div className={styles.globalEditionLayout}>
              <div className={styles.globalCanvasesGrid}>
                {comboItems.map((item, idx) => {
                  return (
                    <div key={idx} className={styles.globalCanvasItemWrapper}>
                      <GlobalCanvasItem
                        item={item}
                        index={idx}
                        variantSelections={variantSelections}
                        comboItemCustomization={comboItemCustomization}
                        onChangeVariant={handleVariantChange}
                      />
                    </div>
                  );
                })}
              </div>
              <MobileFloatingTools />
              <div className={styles.toolbarSectionGlobal}>
                <Toolbar isComboMode={isMobileEditing} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Lienzo individual en la vista Global que procesa su propia imagen
 */
const GlobalCanvasItem = ({ item, index, variantSelections, comboItemCustomization, onChangeVariant }) => {
  const [activeSide, setActiveSide] = useState('front');

  const { data: product } = useQuery({
    queryKey: ['product', item.productId],
    queryFn: async () => {
      const { data, error } = await getProduct(item.productId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!item.productId
  });

  const variant = variantSelections[index] || {};
  const activeColor = variant.color || 'default';

  const view = useMemo(() => {
    if (!product) return null;
    const pv = product.customizationViews?.find(v => v.id === item.viewId) || product.customizationViews?.[0];
    if (!pv) return null;
    const custom = comboItemCustomization[index];
    if (!custom) return pv;
    return {
      ...pv,
      printAreas: Array.isArray(custom.printAreas) && custom.printAreas.length > 0 ? custom.printAreas : (pv.printAreas || []),
    };
  }, [product, item, comboItemCustomization, index]);

  const activeImage = useMemo(() => {
    if (!view) return '';
    const currentSideData = activeSide === 'front' ? view : view?.backSide;
    if (!currentSideData) return '';

    const matchedVar = product?.variants?.find(v => v.name === activeColor);
    return currentSideData.imagesByColor?.[activeColor]
      || (activeSide === 'front' ? matchedVar?.imageUrl : null)
      || (activeSide === 'front' ? product?.mainImage : null)
      || currentSideData.imagesByColor?.default
      || (activeSide === 'front' ? product?.images?.[0] : null)
      || '';
  }, [view, product, activeColor, activeSide]);

  const currentPrintAreas = activeSide === 'front' ? view?.printAreas : view?.backSide?.printAreas;

  // Colores activos y filtrados localmente
  const availableColors = product && product.hasVariants ? product.variants.map(v => v.name).filter(Boolean) : [];
  const allowed = item.variantMapping?.allowedColors;
  const allowedLower = allowed && Array.isArray(allowed) ? allowed.map(c => c.trim().toLowerCase()) : [];
  const filteredColors = allowedLower.length > 0 ? availableColors.filter(c => allowedLower.includes((c || '').trim().toLowerCase())) : availableColors;

  if (!view || !activeImage) return <div style={{ flex: 1, backgroundColor: '#f3f4f6' }}>Cargando...</div>;

  const vId = `combo-view-${index}-${activeColor}${activeSide === 'back' ? '-back' : ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* TALLA: SUPERIOR (GLOBAL REUTILIZANDO ESTRUCTURA) */}
      <div className={styles.topControls}>
        <ComboSizeSelector
          item={item}
          index={index}
          variant={variant}
          onChange={(newVar) => onChangeVariant(index, newVar)}
        />
        {view?.hasBackSide && (
          <div className={styles.sideToggles}>
            <button
              type="button"
              className={`${styles.sideToggleBtn} ${activeSide === 'front' ? styles.activeState : ''}`}
              onClick={() => setActiveSide('front')}
            >
              Frente
            </button>
            <button
              type="button"
              className={`${styles.sideToggleBtn} ${activeSide === 'back' ? styles.activeState : ''}`}
              onClick={() => setActiveSide('back')}
            >
              Espalda
            </button>
          </div>
        )}
      </div>

      {/* CANVAS */}
      <div className={`${styles.canvasSection} ${styles.globalDynamicCanvas}`} style={{ margin: 0, borderRadius: 0 }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '95%',
          maxWidth: '95%',
          maxHeight: '95%',
          height: '95%',
          minHeight: '95%',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <EditorCanvas productImage={getCloudinaryOptimized(activeImage)} printAreas={currentPrintAreas || []} viewId={vId} isCompact={true} />
        </div>
      </div>

      {/* COLORES: INFERIOR (GLOBAL REUTILIZANDO COMPONENTE) */}
      <div className={styles.bottomControls}>
        <ComboColorSelector
          key={`global-color-${index}`}
          item={item}
          index={index}
          variant={variant}
          onChange={(newVar) => onChangeVariant(index, newVar)}
        />
      </div>
    </div>
  );
};

/**
 * Componente de Tallas Independiente
 */
const ComboSizeSelector = ({ item, index, variant, onChange, isMini = false }) => {
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
  if (!availableSizes || availableSizes.length === 0) return null;

  return (
    <div className={`${styles.selectorField} ${isMini ? styles.selectorFieldMini : ''}`}>
      {!isMini && (
        <label className={styles.fieldLabel}>
          Talla:
          {availableSizes.length > 5 && (
            <span className={styles.scrollHint}>
              Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </span>
          )}
        </label>
      )}
      <DraggableContainer className={styles.sizeSwatches}>
        {availableSizes.map(size => (
          <div
            key={size}
            className={`${styles.sizeBtn} ${variant.size === size ? styles.activeSize : ''} ${isMini ? styles.sizeBtnMini : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...variant, size });
            }}
          >
            {size}
          </div>
        ))}
      </DraggableContainer>
    </div>
  );
};

/**
 * Selector exclusivo de colores para la vista de un solo producto activo (Tallas extirpadas)
 */
const ComboColorSelector = ({ item, index, variant, onChange }) => {
  const { data: product } = useQuery({
    queryKey: ['product', item.productId],
    queryFn: async () => {
      const { data, error } = await getProduct(item.productId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!item.productId
  });

  const availableColors = product && product.hasVariants ? product.variants.map(v => v.name).filter(Boolean) : [];

  // Filtrar por los colores permitidos definidos por el admin
  const allowed = item.variantMapping?.allowedColors;
  const allowedLower = allowed && Array.isArray(allowed) ? allowed.map(c => c.trim().toLowerCase()) : [];
  const filteredColors = allowedLower.length > 0
    ? availableColors.filter(c => allowedLower.includes((c || '').trim().toLowerCase()))
    : availableColors;

  return (
    <div className={styles.variantSelectorInner} style={{ display: 'flex', justifyContent: 'center', maxWidth: '100%', minWidth: 0 }}>
      {filteredColors.length > 0 && (
        <div className={styles.selectorField} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
          <label className={styles.fieldLabel} style={{ textAlign: 'center', width: '100%' }}>
            Color: <span className={styles.colorName}>{variant.color || 'Por defecto'}</span>
            {filteredColors.length > 5 && <span className={styles.scrollHint} style={{ justifyContent: 'center' }}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
          </label>
          <DraggableContainer className={styles.swatches}>
            {filteredColors.map(color => {
              const variantObj = product?.variants?.find(v => v.name === color);
              const hexColor = variantObj?.colorHex || getFallbackHex(color) || '#cccccc';
              const bgStyle = { backgroundColor: hexColor };
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
