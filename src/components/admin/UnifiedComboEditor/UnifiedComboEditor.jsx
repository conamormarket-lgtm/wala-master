import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getProduct, getThumbnailVariant } from '../../../services/products';
import { toDirectImageUrl, ensureSingleImageUrl } from '../../../utils/imageUrl';
import {
  itemBoundsToPct,
  itemZoneToUnifiedZone,
  unifiedZoneToItemZone,
  getItemIndexForUnifiedZone
} from '../../../utils/comboUnifiedCoords';
import { generateComboPreviewDataUrlWithBounds, composeComboImage, loadImageAsFabricCanvas, captureComboPreviewAsImage } from '../../../utils/comboImageComposer';
import { generateThumbnailWithDesign } from '../../../utils/thumbnailWithDesign';
import { getCloudinaryOptimized } from '../../common/OptimizedImage/OptimizedImage';
import { EditorProvider, useEditor } from '../../../contexts/EditorContext';
import PrintAreasEditor from '../PrintAreasEditor/PrintAreasEditor';
import EditorCanvas from '../../editor/EditorCanvas/EditorCanvas';
import Toolbar from '../../editor/Toolbar/Toolbar';
import MobileFloatingTools from '../../editor/MobileFloatingTools/MobileFloatingTools';
import DraggableContainer from '../../common/DraggableContainer/DraggableContainer';
import { SHAPE_TYPES } from '../../../utils/shapeUtils';
import styles from './UnifiedComboEditor.module.css';

const DEFAULT_VIEW_ID = 'unified-composite';
const FALLBACK_VIEW_PREFIX = 'combo-fallback-';
const getVId = (idx, c, sides) => `${FALLBACK_VIEW_PREFIX}${idx}-${c}${sides?.[idx] === 'back' ? '-back' : ''}`;

const FALLBACK_COLOR_MAP = {
  'blanco': '#ffffff',
  'negro': '#000000',
  'rojo': '#e3000f',
  'azul': '#0055a4',
  'azul marino': '#000080',
  'verde': '#008000',
  'amarillo': '#ffd700',
  'naranja': '#ffa500',
  'rosado': '#ffc0cb',
  'rosa': '#ffc0cb',
  'gris': '#808080',
  'gris jaspe': '#a9a9a9',
  'plomo': '#696969',
  'celeste': '#87ceeb',
  'morado': '#800080',
  'lila': '#c8a2c8',
  'marrón': '#8b4513',
  'marron': '#8b4513',
  'beige': '#f5f5dc',
  'vino': '#722f37',
  'turquesa': '#40e0d0',
};

const getFallbackHex = (colorName) => {
  if (!colorName) return undefined;
  if (/^#[0-9A-Fa-f]{6}$/i.test(colorName)) return colorName;
  const normalized = colorName.toLowerCase().trim();
  return FALLBACK_COLOR_MAP[normalized];
};

const UnifiedComboEditorContent = ({
  composedImageUrl,
  composedImageUrlBack,
  itemImages,
  itemBounds,
  totalWidth,
  totalHeight,
  comboItems,
  comboLayout,
  comboItemCustomization,
  onComboItemCustomizationChange,
  itemImagesByColor,
  itemSizes,
  canEditZones = true,
  onCaptureDefaultThumbnail,
  onColorChange,
  onSizeChange,
  triggerCaptureRef,
  itemColorsHex,
  itemViews
}) => {
  const [mode, setMode] = useState('design');
  const [showZonesDesign, setShowZonesDesign] = useState(true);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [mobileLayoutMode, setMobileLayoutMode] = useState('joined');
  const [enableZoomToEdit, setEnableZoomToEdit] = useState(false);
  const activeSides = React.useMemo(() => {
    const obj = {};
    (comboItems || []).forEach((_, i) => {
      obj[i] = mode === 'design-back' ? 'back' : 'front';
    });
    return obj;
  }, [mode, comboItems]);
  const [activeColors, setActiveColors] = useState(() => {
    const initial = {};
    (comboItems || []).forEach((item, i) => {
      const userColor = comboItemCustomization?.[i]?.variant?.color;
      initial[i] = userColor || item.variantMapping?.color || 'default';
    });
    return initial;
  });
  const [activeSizes, setActiveSizes] = useState(() => {
    const initial = {};
    (comboItems || []).forEach((item, i) => {
      const userSize = comboItemCustomization?.[i]?.variant?.size;
      initial[i] = userSize || itemSizes?.[i]?.[0] || '';
    });
    return initial;
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const { setLayersForView, setActiveViewId, layersByView, clearLayers } = useEditor();
  const initializedViewsRef = useRef(new Set());
  const wrapRef = useRef(null);

  // Ref para tener acceso a layersByView en callbacks sin disparar re-renders innecesarios
  const layersByViewRef = useRef(layersByView);
  useEffect(() => {
    layersByViewRef.current = layersByView;
  }, [layersByView]);
  // Inicializar colores activos basados en el mapping de variantes existente
  const hasInitializedVariantsRef = useRef(false);

  useEffect(() => {
    if (hasInitializedVariantsRef.current) return;
    if (!comboItemCustomization || comboItemCustomization.length === 0) return;

    let hasActualData = false;
    const initialColors = {};
    const initialSizes = {};

    (comboItems || []).forEach((item, i) => {
      const userColor = comboItemCustomization[i]?.variant?.color;
      const userSize = comboItemCustomization[i]?.variant?.size;
      
      if (userColor && userColor !== 'default') hasActualData = true;
      if (userSize) hasActualData = true;

      if (userColor) initialColors[i] = userColor;
      if (userSize) initialSizes[i] = userSize;
    });

    if (hasActualData) {
      setActiveColors(prev => ({ ...prev, ...initialColors }));
      setActiveSizes(prev => ({ ...prev, ...initialSizes }));
      hasInitializedVariantsRef.current = true;
    }
  }, [comboItems, comboItemCustomization, itemSizes]);

  useEffect(() => {
    const currentColor = activeColors[activeItemIndex] || 'default';
    const viewId = getVId(activeItemIndex, currentColor, activeSides);
    setActiveViewId(viewId);
  }, [activeItemIndex, activeColors, setActiveViewId]);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      const UNIFORM_SIZE = 600;
      const getImageUrlForItem = async (item, index) => {
        const colorsMap = itemImagesByColor?.[index] || { default: '' };
        const colorKeys = Object.keys(colorsMap);
        const defaultValidColor = colorKeys.includes('default') ? 'default' : (colorKeys[0] || 'default');
        const currentColor = activeColors[index] || defaultValidColor;

        
        const viewObj = itemViews?.[index];
        let rawBaseUrl = '';
        if (activeSides[index] === 'back') {
          const backColors = viewObj?.backSide?.imagesByColor || {};
          rawBaseUrl = backColors[currentColor] || backColors.default || Object.values(backColors)[0] || '';
        }
        if (!rawBaseUrl) {
          rawBaseUrl = colorsMap[currentColor] || itemImages[index] || '';
        }
        let baseImageUrl = getCloudinaryOptimized(rawBaseUrl);


        const vId = getVId(index, currentColor, activeSides);
        const cust = (comboItemCustomization || [])[index] || {};
        const layers = layersByView[vId] || (activeSides[index] === 'back' ? cust.backSide?.initialLayersByColor?.[currentColor] : cust.initialLayersByColor?.[currentColor]) || [];

        const singleDataUrl = await generateThumbnailWithDesign(baseImageUrl, layers, {
          maxWidth: 600
        });
        return { imageUrl: singleDataUrl, scale: item.scale || 1 };
      };

      const { dataUrl } = await generateComboPreviewDataUrlWithBounds(comboItems, comboLayout, getImageUrlForItem);
      if (onCaptureDefaultThumbnail && dataUrl) {
        onCaptureDefaultThumbnail(dataUrl);
      }
      return dataUrl;
    } catch (err) {
      console.error('Error capturing composite image', err);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    if (triggerCaptureRef) {
      triggerCaptureRef.current = handleCapture;
    }
  });

  const handleActiveColorChange = (index, colorCode) => {
    const oldColorCode = activeColors[index] || 'default';
    
    // Auto-duplicar el diseño del color actual hacia el nuevo color si cambia
    // Esto asegura que el esfuerzo del cliente no se borre al probar otro color.
    if (oldColorCode !== colorCode && !canEditZones) {
      const oldVId = getVId(index, oldColorCode, activeSides);
      const newVId = getVId(index, colorCode, activeSides);
      const currentLayers = layersByViewRef.current[oldVId];
      
      if (currentLayers) {
        // Clonamos exactamente las capas para que no se pierda la personalización
        const clonedLayers = JSON.parse(JSON.stringify(currentLayers));
        setLayersForView(newVId, clonedLayers);
        initializedViewsRef.current.add(newVId);
      }
    }

    setActiveColors(prev => ({ ...prev, [index]: colorCode }));
    if (onColorChange) {
      onColorChange(index, colorCode);
    }
  };

  const handleActiveSizeChange = (index, sizeCode) => {
    setActiveSizes(prev => ({ ...prev, [index]: sizeCode }));
    if (onSizeChange) {
      onSizeChange(index, sizeCode);
    }
  };

  // Sincronizar capas iniciales por producto (solo una vez por vista)
  useEffect(() => {
    comboItems.forEach((_, i) => {
      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        
        const cust = (comboItemCustomization || [])[i];
        const vIdFront = `${FALLBACK_VIEW_PREFIX}${i}-${color}`;
        const vIdBack = `${FALLBACK_VIEW_PREFIX}${i}-${color}-back`;
        const viewObj = itemViews?.[i];

        const unifyIds = (layersArr) => {
            if (!Array.isArray(layersArr)) return [];
            return layersArr.map(l => ({
                ...l,
                id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
            }));
        };

        if (!initializedViewsRef.current.has(vIdFront)) {
          let lyrsFront = (cust?.initialLayersByColor?.[color]);
          if ((!lyrsFront || lyrsFront.length === 0) && cust?.initialLayersByColor?.['default']) {
            lyrsFront = [...cust.initialLayersByColor['default']];
          }
          if (!lyrsFront || lyrsFront.length === 0) {
            lyrsFront = unifyIds(viewObj?.initialLayersByColor?.[color] || viewObj?.initialLayersByColor?.['default'] || []);
          }

          if (Array.isArray(lyrsFront) && lyrsFront.length > 0) {
            setLayersForView(vIdFront, [...lyrsFront]);
          }
          initializedViewsRef.current.add(vIdFront);
        }

        if (!initializedViewsRef.current.has(vIdBack)) {
          let lyrsBack = (cust?.backSide?.initialLayersByColor?.[color]);
          if ((!lyrsBack || lyrsBack.length === 0) && cust?.backSide?.initialLayersByColor?.['default']) {
            lyrsBack = [...cust.backSide.initialLayersByColor['default']];
          }
          if (!lyrsBack || lyrsBack.length === 0) {
            lyrsBack = unifyIds(viewObj?.backSide?.initialLayersByColor?.[color] || viewObj?.backSide?.initialLayersByColor?.['default'] || []);
          }

          if (Array.isArray(lyrsBack) && lyrsBack.length > 0) {
            setLayersForView(vIdBack, [...lyrsBack]);
          }
          initializedViewsRef.current.add(vIdBack);
        }

        return; // Prevent the rest of the old loop body from breaking state

      });
    });
  }, [setLayersForView, comboItems, comboItemCustomization, itemImagesByColor, itemViews]);

  // Sincronización automática de capas al estado del padre
  useEffect(() => {
    if (!onComboItemCustomizationChange) return;
    if (initializedViewsRef.current.size === 0) return;

    const next = comboItems.map((item, i) => {
      const cust = (comboItemCustomization || [])[i] || {};
            const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
      const newBackLayers = { ...(cust.backSide?.initialLayersByColor || {}) };

      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const frontId = `${FALLBACK_VIEW_PREFIX}${i}-${color}`;
        const backId = `${FALLBACK_VIEW_PREFIX}${i}-${color}-back`;
        newInitialLayers[color] = layersByView[frontId] || newInitialLayers[color] || [];
        if (layersByView[backId] || newBackLayers[color]) {
            newBackLayers[color] = layersByView[backId] || newBackLayers[color] || [];
        }
      });

      return {
        ...cust,
        productId: item.productId,
        viewId: item.viewId,
        initialLayersByColor: newInitialLayers,
        backSide: {
          ...(cust.backSide || {}),
          initialLayersByColor: newBackLayers
        }
      };
    });

    const currentJson = JSON.stringify(next.map(n => ({ front: n.initialLayersByColor, back: n.backSide?.initialLayersByColor })));
    const prevJson = JSON.stringify((comboItemCustomization || []).map(c => ({ front: c.initialLayersByColor || {}, back: c.backSide?.initialLayersByColor || {} })));

    if (currentJson !== prevJson) {
      onComboItemCustomizationChange(next);
    }
  }, [layersByView, comboItems, onComboItemCustomizationChange, comboItemCustomization, itemImagesByColor]);

  useEffect(() => {
    if (mode === 'design' || mode === 'design-back') {
      const colorsMap = itemImagesByColor?.[activeItemIndex] || { default: '' };
      const colorKeys = Object.keys(colorsMap);

      const allowed = comboItems[activeItemIndex]?.variantMapping?.allowedColors;
      const filteredKeys = allowed && Array.isArray(allowed)
        ? colorKeys.filter(k => allowed.includes(k) || k === 'default')
        : colorKeys;

      const defaultValidColor = filteredKeys.includes('default') ? 'default' : (filteredKeys[0] || 'default');
      const currentColor = activeColors[activeItemIndex] || defaultValidColor;
      setActiveViewId(getVId(activeItemIndex, currentColor, activeSides));
    } else {
      setActiveViewId(DEFAULT_VIEW_ID);
    }
  }, [mode, activeItemIndex, activeColors, setActiveViewId, itemImagesByColor, comboItems]);

  const boundsPct = useMemo(
    () => itemBoundsToPct(totalWidth, totalHeight, itemBounds),
    [totalWidth, totalHeight, itemBounds]
  );

  const unifiedPrintAreas = useMemo(() => {
    const list = [];
    const cust = comboItemCustomization || [];
    comboItems.forEach((_, index) => {
      const custom = cust[index] || {};
      const isBackZones = mode === 'zones-back';
      const sourceAreas = isBackZones ? custom?.backSide?.printAreas : custom.printAreas;
      const printAreas = Array.isArray(sourceAreas) ? sourceAreas : [];
      printAreas.forEach((zone) => {
        const unified = itemZoneToUnifiedZone(
          { ...zone, id: zone.id || `zone_${index}_${list.length}` },
          index,
          boundsPct
        );
        list.push(unified);
      });
    });
    return list;
  }, [comboItems, comboItemCustomization, boundsPct, mode]);

  const handleSaveAll = useCallback((silent = false) => {
    if (!onComboItemCustomizationChange) return;

    const next = comboItems.map((item, i) => {
      const cust = (comboItemCustomization || [])[i] || {};
      
      const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
      const newBackLayers = { ...(cust.backSide?.initialLayersByColor || {}) };

      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const frontId = `${FALLBACK_VIEW_PREFIX}${i}-${color}`;
        const backId = `${FALLBACK_VIEW_PREFIX}${i}-${color}-back`;
        newInitialLayers[color] = layersByViewRef.current[frontId] || newInitialLayers[color] || [];
        if (layersByViewRef.current[backId] || newBackLayers[color]) {
            newBackLayers[color] = layersByViewRef.current[backId] || newBackLayers[color] || [];
        }
      });


      return {
        productId: item.productId,
        viewId: item.viewId,
        printAreas: cust.printAreas || [],
        initialLayersByColor: newInitialLayers,
        backSide: {
          ...(cust.backSide || {}),
          initialLayersByColor: newBackLayers
        }
      };
    });

    onComboItemCustomizationChange(next);
    if (!silent) alert('Cambios guardados correctamente.');
  }, [onComboItemCustomizationChange, comboItems, comboItemCustomization, itemImagesByColor]);


  const handleCopyLayersToAllColors = useCallback((index, sourceColorKey) => {
    const vIdSource = getVId(index, sourceColorKey, activeSides);
    const sourceLayers = layersByViewRef.current[vIdSource] || [];

    if (!window.confirm(`¿Deseas aplicar el diseño actual (${sourceLayers.length} capas) a TODAS las demás variaciones de color de este producto? (Las capas de cada variación quedarán independientes).`)) {
      return;
    }

    const next = [...(comboItemCustomization || [])];
    const cust = { ...(next[index] || {}) };
    const newInitialLayers = { ...(cust.initialLayersByColor || {}) };

    // Asignar en context (Fabric canvas multi-view)
    const colorsMap = itemImagesByColor?.[index] || { default: '' };
    Object.keys(colorsMap).forEach(col => {
      // Si es el color actual no modificamos IDs para no romper su canvas actual
      if (col === sourceColorKey) {
        const clonedLyrs = JSON.parse(JSON.stringify(sourceLayers));
        newInitialLayers[col] = clonedLyrs;
        return;
      }

      const vIdDest = getVId(index, col, activeSides);
      const sourceDims = window.__FABRIC_CANVAS_DIMS?.[vIdSource] || {};
      const clonedLyrsWithNewIds = sourceLayers.map(l => ({
        ...JSON.parse(JSON.stringify(l)),
        id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        baseW: l.baseW || sourceDims.width || undefined,
        baseH: l.baseH || sourceDims.height || undefined
      }));
      setLayersForView(vIdDest, clonedLyrsWithNewIds);
      newInitialLayers[col] = clonedLyrsWithNewIds;
    });

    // Guardar en customización del padre
    next[index] = { ...cust, initialLayersByColor: newInitialLayers };
    if (onComboItemCustomizationChange) {
      onComboItemCustomizationChange(next);
    }
    alert('✅ Diseño copiado a todas las variaciones del Producto ' + (index + 1));
  }, [comboItemCustomization, itemImagesByColor, onComboItemCustomizationChange, setLayersForView]);

  const handleZonesChange = useCallback(
    (newUnifiedZones) => {
      if (!onComboItemCustomizationChange) return;
      const byItem = comboItems.map(() => ({ printAreas: [] }));

      (newUnifiedZones || []).forEach((uz) => {
        // Siempre recalcular el index basado en la posición actual para permitir arrastrar entre ítems
        const idx = getItemIndexForUnifiedZone(uz, boundsPct);
        if (idx < 0 || idx >= byItem.length) return;
        const itemZone = unifiedZoneToItemZone({ ...uz }, idx, boundsPct);
        byItem[idx].printAreas.push(itemZone);
      });

      const next = comboItems.map((item, i) => {
        const cust = (comboItemCustomization || [])[i] || {};
        
      const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
      const newBackLayers = { ...(cust.backSide?.initialLayersByColor || {}) };

      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const frontId = `${FALLBACK_VIEW_PREFIX}${i}-${color}`;
        const backId = `${FALLBACK_VIEW_PREFIX}${i}-${color}-back`;
        newInitialLayers[color] = layersByViewRef.current[frontId] || newInitialLayers[color] || [];
        if (layersByViewRef.current[backId] || newBackLayers[color]) {
            newBackLayers[color] = layersByViewRef.current[backId] || newBackLayers[color] || [];
        }
      });


        const isBackZones = mode === 'zones-back';
        return {
          ...cust,
          productId: item.productId,
          viewId: item.viewId,
          printAreas: isBackZones ? (cust.printAreas || []) : byItem[i].printAreas,
          initialLayersByColor: newInitialLayers,
          backSide: {
            ...cust.backSide,
            printAreas: isBackZones ? byItem[i].printAreas : (cust.backSide?.printAreas || []),
            initialLayersByColor: newBackLayers
          }
        };
      });
      onComboItemCustomizationChange(next);
    },
    [onComboItemCustomizationChange, comboItems, boundsPct, comboItemCustomization, itemImagesByColor, mode]
  );

  return (
    <div className={styles.container}>
      {canEditZones && (
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.titleArea}>
              <h4 className={styles.title}>Editor de Combo</h4>
              <span className={styles.subtitle}>Configura zonas compartidas y diseños individuales</span>
            </div>
            <div className={styles.headerActions}>
              {(mode === 'design' || mode === 'design-back') && (
                <div className={styles.designStatus}>
                  <span className={styles.statusDot}></span>
                  Modo diseño activo
                </div>
              )}
              {mode === 'design' && canEditZones && (
                <label className={styles.zoneToggle}>
                  <input
                    type="checkbox"
                    checked={showZonesDesign}
                    onChange={() => setShowZonesDesign(!showZonesDesign)}
                  />
                  <span>Zonas</span>
                </label>
              )}
              {canEditZones && (
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={() => handleSaveAll(false)}
                  title="Guardar todos los diseños y zonas actuales"
                >
                  Aplicar Cambios
                </button>
              )}
            </div>
          </div>
          <div className={styles.modeToggle} style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            
            <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
               <div style={{ background: '#f5f5f5', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #ccc', color: '#333' }}>🎨 Diseños</div>
               <button
                  type="button"
                  className={mode === 'design' ? styles.modeBtnActive : styles.modeBtn}
                  onClick={() => setMode('design')}
                  style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px' }}
                >
                  Frente
               </button>
               {itemViews?.some(v => v?.hasBackSide) && (
                 <button
                    type="button"
                    className={mode === 'design-back' ? styles.modeBtnActive : styles.modeBtn}
                    onClick={() => setMode('design-back')}
                    style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px', borderLeft: '1px solid #ccc' }}
                  >
                    Espalda
                 </button>
               )}
            </div>

            {canEditZones && (
              <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
                 <div style={{ background: '#f5f5f5', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #ccc', color: '#333' }}>🔳 Zonas Unificadas</div>
                 <button
                    type="button"
                    className={mode === 'zones' ? styles.modeBtnActive : styles.modeBtn}
                    onClick={() => setMode('zones')}
                    style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px' }}
                  >
                    Frente
                 </button>
                 {itemViews?.some(v => v?.hasBackSide) && (
                   <button
                      type="button"
                      className={mode === 'zones-back' ? styles.modeBtnActive : styles.modeBtn}
                      onClick={() => setMode('zones-back')}
                      style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px', borderLeft: '1px solid #ccc' }}
                    >
                      Espalda
                   </button>
                 )}
              </div>
            )}

            {(mode === 'design' || mode === 'design-back') && (
              <button
                type="button"
                className={styles.modeBtn}
                style={{ marginLeft: 'auto', backgroundColor: '#e2f0d9', borderColor: '#7fbf5d', padding: '8px 16px' }}
                onClick={handleCapture}
                disabled={isCapturing}
              >
                {isCapturing ? 'Capturando...' : '📸 Fijar miniatura'}
              </button>
            )}
          </div>
        </div>
      )}


      <div className={(mode === 'design' || mode === 'design-back') ? styles.unifiedModePanel : styles.unifiedModePanelHidden}>
        
        {/* Pestañas de navegación para modo móvil */}
        {!canEditZones && (comboItems?.length > 1) && (
          <div className={styles.mobileComboTabs}>
            {comboItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className={`${styles.mobileComboTab} ${mobileLayoutMode === 'single' && activeItemIndex === idx ? styles.mobileComboTabActive : ''}`}
                onClick={() => {
                  setMobileLayoutMode('single');
                  setActiveItemIndex(idx);
                }}
              >
                Producto {idx + 1}
              </button>
            ))}
            <button
               type="button"
               className={`${styles.mobileComboTabIcon} ${mobileLayoutMode === 'joined' ? styles.mobileComboTabActive : ''}`}
               onClick={() => setMobileLayoutMode('joined')}
               title="Ver Juntos"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
          </div>
        )}

        <div className={styles.editorLayout}>
          <div className={styles.canvasSectionUnified}>
            <div
              ref={wrapRef}
              className={`${styles.unifiedSideBySide} ${mobileLayoutMode === 'joined' ? styles.unifiedSideBySideModeJoined : styles.unifiedSideBySideModeSingle}`}
              style={{
                flexDirection: comboLayout.orientation === 'vertical' ? 'column' : 'row',
                gap: `${comboLayout.spacing ?? 0}px`
              }}
            >
              {(itemImages || []).map((imgUrl, index) => {
                const colorsMap = itemImagesByColor?.[index] || { default: '' };
                const colorKeys = Object.keys(colorsMap);

                const allowed = comboItems[index]?.variantMapping?.allowedColors;
                let filteredColorKeys = colorKeys;
                if (allowed && Array.isArray(allowed)) {
                   const allowedLower = allowed.map(c => typeof c === 'string' ? c.trim().toLowerCase() : c);
                   filteredColorKeys = colorKeys.filter(k => 
                      k === 'default' || allowedLower.includes(k.trim().toLowerCase())
                   );
                }

                if (filteredColorKeys.length > 1 && filteredColorKeys.includes('default')) {
                  filteredColorKeys = filteredColorKeys.filter(c => c !== 'default');
                }
                if (filteredColorKeys.length === 0) {
                  filteredColorKeys = ['default'];
                }

                let currentColor = activeColors[index] || 'default';
                if (!filteredColorKeys.includes(currentColor)) {
                  console.log(`Fallback inside render for item ${index}: currentColor ${currentColor} not in`, filteredColorKeys);
                  currentColor = filteredColorKeys[0] || 'default';
                }

                const viewId = getVId(index, currentColor, activeSides);
                const cust = (comboItemCustomization || [])[index] || {};

                const hasMultipleColors = filteredColorKeys.length > 1;
                const viewObj = itemViews?.[index];
                
                let rawImgUrl = '';
                if (activeSides[index] === 'back') {
                  const backColors = viewObj?.backSide?.imagesByColor || {};
                  rawImgUrl = backColors[currentColor] || backColors.default || Object.values(backColors)[0] || '';
                }
                if (!rawImgUrl) {
                  rawImgUrl = colorsMap[currentColor] || imgUrl || '';
                }
                
                const activeImgUrl = getCloudinaryOptimized(rawImgUrl);
                const currentItemSizes = itemSizes?.[index] || [];
                const currentSize = activeSizes[index] || currentItemSizes[0] || '';
                const hasSizes = currentItemSizes.length > 0;

                return (
                  <div
                    key={`combo-item-${index}`}
                    className={`${styles.unifiedSideBySideItem} ${(!isCapturing && activeItemIndex === index) ? styles.unifiedSideBySideItemActive : ''}`}
                    onClick={() => {
                      setActiveItemIndex(index);
                      if (enableZoomToEdit) {
                        setMobileLayoutMode('single');
                      }
                    }}
                  >
                    {!isCapturing && hasSizes && (
                      <div className={styles.mobileSizesWrap} data-html2canvas-ignore="true">
                        <span className={styles.mobileSizesLabel}>
                          TALLA:
                          {currentItemSizes.length > 5 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
                        </span>
                        <DraggableContainer className={styles.mobileSizesList} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          {currentItemSizes.map(s => (
                            <button
                              key={s}
                              type="button"
                              className={`${styles.mobileSizePill} ${currentSize === s ? styles.mobileSizePillActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActiveSizeChange(index, s);
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </DraggableContainer>
                      </div>
                    )}
                    {!isCapturing && (
                      <div className={styles.itemHeader} data-html2canvas-ignore="true">
                        <div className={styles.itemTitleWrap}>
                          {mobileLayoutMode === 'single' && (
                            <button
                              type="button"
                              className={styles.navArrow}
                              disabled={index === 0}
                              onClick={(e) => { e.stopPropagation(); setActiveItemIndex(index - 1); }}
                              title="Producto anterior"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                          )}
                          <div className={styles.itemTitle}>Producto {index + 1}</div>
                          {mobileLayoutMode === 'single' && (
                            <button
                              type="button"
                              className={styles.navArrow}
                              disabled={index === itemImages.length - 1}
                              onClick={(e) => { e.stopPropagation(); setActiveItemIndex(index + 1); }}
                              title="Producto siguiente"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className={styles.unifiedSideBySideItemInner}>
                      <div className={styles.unifiedDesignCanvasWrap}>
                        <EditorCanvas
                          productImage={activeImgUrl}
                          printAreas={activeSides[index] === 'back' ? (cust.backSide?.printAreas || []) : (cust.printAreas || [])}
                          viewId={viewId}
                          showZones={showZonesDesign}
                        />
                      </div>
                    </div>
                    {hasMultipleColors && !isCapturing && (
                      <div className={styles.mobileDropdownWrap} data-html2canvas-ignore="true">
                        {filteredColorKeys.length > 5 && (
                          <div className={styles.mobileSizesLabel} style={{ marginTop: '0.5rem' }}>
                            COLOR <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>
                          </div>
                        )}
                        <DraggableContainer className={styles.colorList} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          {filteredColorKeys.map(c => {
                            const hex = itemColorsHex?.[index]?.[c] || getFallbackHex(c) || '#cccccc';
                            const isDefault = c === 'default';
                            return (
                              <button
                                key={c}
                                type="button"
                                className={`${styles.colorBtnWrapper} ${currentColor === c ? styles.active : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleActiveColorChange(index, c);
                                }}
                                title={isDefault ? 'Por defecto' : c.toUpperCase()}
                              >
                                <span 
                                  className={`${styles.colorBtn} ${isDefault ? styles.defaultColor : ''}`} 
                                  style={!isDefault ? { backgroundColor: hex } : {}} 
                                />
                              </button>
                            );
                          })}
                        </DraggableContainer>
                        {canEditZones && hasMultipleColors && (
                          <button
                            type="button"
                            className={styles.copyToAllBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLayersToAllColors(index, currentColor);
                            }}
                            title="Copiar diseño actual a todas las demás variaciones de color"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copiar a todos
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Botón Flotante para Móvil. Global a toda la sección del canvas */}
            {!canEditZones && <MobileFloatingTools />}
          </div>
          <div className={styles.toolbarSection}>
            <Toolbar />
          </div>
        </div>
      </div>

      <div className={(mode === 'zones' || mode === 'zones-back') && canEditZones ? styles.unifiedModePanel : styles.unifiedModePanelHidden}>
        <div className={styles.editorLayout}>
          <div className={styles.canvasSectionUnified}>
            <div className={styles.composedEditorWrap}>
              <div className={styles.unifiedDesignCanvasWrap}>
                <PrintAreasEditor
                  imageUrl={getCloudinaryOptimized(mode === 'zones-back' && composedImageUrlBack ? composedImageUrlBack : composedImageUrl)}
                  printAreas={unifiedPrintAreas}
                  onChange={handleZonesChange}
                  controlsTargetId="combo-sidebar"
                />
              </div>
            </div>
          </div>
          <div className={styles.toolbarSection} id="combo-sidebar" />
        </div>
      </div>
    </div >
  );
};

const UnifiedComboEditorFallbackContent = ({
  fallbackUrls,
  comboLayout,
  comboItems,
  comboItemCustomization,
  onComboItemCustomizationChange,
  itemImagesByColor,
  itemSizes,
  canEditZones = true,
  triggerCaptureRef,
  onColorChange,
  onSizeChange,
  onCaptureDefaultThumbnail,
  itemColorsHex,
  itemViews
}) => {
  const [mode, setMode] = useState('design');
  const [showZonesDesign, setShowZonesDesign] = useState(true);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [mobileLayoutMode, setMobileLayoutMode] = useState('single');
  const [enableZoomToEdit, setEnableZoomToEdit] = useState(true);
  const activeSides = React.useMemo(() => {
    const obj = {};
    (comboItems || []).forEach((_, i) => {
      obj[i] = mode === 'design-back' ? 'back' : 'front';
    });
    return obj;
  }, [mode, comboItems]);
  const [activeColors, setActiveColors] = useState(() => {
    const initial = {};
    (comboItems || []).forEach((item, i) => {
      initial[i] = item.variantMapping?.color || 'default';
    });
    return initial;
  });
  const [activeSizes, setActiveSizes] = useState(() => {
    const initial = {};
    (comboItems || []).forEach((item, i) => {
      initial[i] = itemSizes?.[i]?.[0] || '';
    });
    return initial;
  });

  useEffect(() => {
    const initial = {};
    (comboItems || []).forEach((item, i) => {
      const color = item.variantMapping?.color || 'default';
      initial[i] = color;
    });
    console.log('UnifiedComboEditorFallbackContent useEffect activeColors update:', initial, 'from comboItems:', comboItems);
    setActiveColors(initial);
  }, [comboItems]);

  const handleActiveSizeChange = (index, sizeCode) => {
    setActiveSizes(prev => ({ ...prev, [index]: sizeCode }));
    if (onSizeChange) {
      onSizeChange(index, sizeCode);
    }
  };
  const [isCapturing, setIsCapturing] = useState(false);
  const { setLayersForView, setActiveViewId, layersByView, clearLayers } = useEditor();
  const initializedViewsRef = useRef(new Set());
  const wrapRef = useRef(null);

  const layersByViewRef = useRef(layersByView);
  useEffect(() => { layersByViewRef.current = layersByView; }, [layersByView]);

  const handleActiveColorChange = (index, colorCode) => {
    const oldColorCode = activeColors[index] || 'default';

    // Auto-duplicar el diseño del color actual hacia el nuevo color si cambia
    // Esto asegura que el esfuerzo del cliente no se borre al probar otro color.
    if (oldColorCode !== colorCode && !canEditZones) {
      const oldVId = getVId(index, oldColorCode, activeSides);
      const newVId = getVId(index, colorCode, activeSides);
      const currentLayers = layersByViewRef.current[oldVId];

      if (currentLayers) {
        // Clonamos exactamente las capas para que no se pierda la personalización
        const clonedLayers = JSON.parse(JSON.stringify(currentLayers));
        setLayersForView(newVId, clonedLayers);
        initializedViewsRef.current.add(newVId);
      }
    }

    setActiveColors(prev => ({ ...prev, [index]: colorCode }));
    if (onColorChange) {
      onColorChange(index, colorCode);
    }
  };

  useEffect(() => {
    const currentColor = activeColors[activeItemIndex] || 'default';
    const viewId = getVId(activeItemIndex, currentColor, activeSides);
    setActiveViewId(viewId);
  }, [activeItemIndex, activeColors, setActiveViewId]);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      // Generación por Canvas (Fabric.js) para obtener una réplica exacta de los diseños, sin distorsión de zoom ni CSS
      const canvases = [];
      for (let i = 0; i < comboItems.length; i++) {
        const item = comboItems[i];
        const colorsMap = itemImagesByColor?.[i] || { default: '' };
        const colorKeys = Object.keys(colorsMap);
        const defaultValidColor = colorKeys.includes('default') ? 'default' : (colorKeys[0] || 'default');
        const currentColor = activeColors[i] || defaultValidColor;

        const viewObj = itemViews?.[i];
        let rawBaseUrl = '';
        if (activeSides[i] === 'back') {
          const backColors = viewObj?.backSide?.imagesByColor || {};
          rawBaseUrl = backColors[currentColor] || backColors.default || Object.values(backColors)[0] || '';
        }
        if (!rawBaseUrl) {
          rawBaseUrl = colorsMap[currentColor] || fallbackUrls[i] || '';
        }
        const baseImageUrl = rawBaseUrl;
        const cust = (comboItemCustomization || [])[i] || {};
        const viewId = getVId(i, currentColor, activeSides);
        const layers = layersByView[viewId] || cust.initialLayersByColor?.[currentColor] || [];

        // Generar la imagen para este producto individual con su diseño
        const singleDataUrl = await generateThumbnailWithDesign(baseImageUrl, layers, { maxWidth: 600 });

        // Cargar esa imagen en un canvas para composición lateral
        const itemScale = item?.scale || 1;
        const { canvas } = await loadImageAsFabricCanvas(singleDataUrl, itemScale);
        canvases.push({ canvas, scale: itemScale });
      }

      const finalDataUrl = await composeComboImage(canvases, comboLayout);
      if (onCaptureDefaultThumbnail && finalDataUrl) {
        onCaptureDefaultThumbnail(finalDataUrl);
      }
      return finalDataUrl;
    } catch (err) {
      console.error('Error capturing composite combo natively', err);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    if (triggerCaptureRef) {
      triggerCaptureRef.current = handleCapture;
    }
  });

  useEffect(() => {
    comboItems.forEach((_, i) => {
      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const vId = getVId(i, color, activeSides);
        if (initializedViewsRef.current.has(vId)) return;

        const cust = (comboItemCustomization || [])[i];
        const lyrs = (cust?.initialLayersByColor?.[color]) || [];
        if (Array.isArray(lyrs) && lyrs.length > 0) {
          setLayersForView(vId, [...lyrs]);
          initializedViewsRef.current.add(vId);
        } else if (cust) {
          initializedViewsRef.current.add(vId);
        }
      });
    });
  }, [setLayersForView, comboItems, comboItemCustomization, itemImagesByColor]);

  // Auto-sync para Fallback
  useEffect(() => {
    if (!onComboItemCustomizationChange) return;
    if (initializedViewsRef.current.size === 0) return;

    const next = comboItems.map((item, i) => {
      const cust = (comboItemCustomization || [])[i] || {};
            const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
      const newBackLayers = { ...(cust.backSide?.initialLayersByColor || {}) };

      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const frontId = `${FALLBACK_VIEW_PREFIX}${i}-${color}`;
        const backId = `${FALLBACK_VIEW_PREFIX}${i}-${color}-back`;
        newInitialLayers[color] = layersByView[frontId] || newInitialLayers[color] || [];
        if (layersByView[backId] || newBackLayers[color]) {
            newBackLayers[color] = layersByView[backId] || newBackLayers[color] || [];
        }
      });

      return {
        ...cust,
        productId: item.productId,
        viewId: item.viewId,
        initialLayersByColor: newInitialLayers,
        backSide: {
          ...(cust.backSide || {}),
          initialLayersByColor: newBackLayers
        }
      };
    });

    const currentJson = JSON.stringify(next.map(n => ({ front: n.initialLayersByColor, back: n.backSide?.initialLayersByColor })));
    const prevJson = JSON.stringify((comboItemCustomization || []).map(c => ({ front: c.initialLayersByColor || {}, back: c.backSide?.initialLayersByColor || {} })));

    if (currentJson !== prevJson) {
      onComboItemCustomizationChange(next);
    }
  }, [layersByView, comboItems, onComboItemCustomizationChange, comboItemCustomization, itemImagesByColor]);

  useEffect(() => {
    if (mode === 'design' || mode === 'design-back') {
      const colorsMap = itemImagesByColor?.[activeItemIndex] || { default: '' };
      const colorKeys = Object.keys(colorsMap);

      const allowed = comboItems[activeItemIndex]?.variantMapping?.allowedColors;
      let filteredKeys = colorKeys;
      if (allowed && Array.isArray(allowed)) {
         const allowedLower = allowed.map(c => typeof c === 'string' ? c.trim().toLowerCase() : c);
         filteredKeys = colorKeys.filter(k => 
            k === 'default' || allowedLower.includes(k.trim().toLowerCase())
         );
      }

      const defaultValidColor = filteredKeys.includes('default') ? 'default' : (filteredKeys[0] || 'default');
      const currentColor = activeColors[activeItemIndex] || defaultValidColor;
      setActiveViewId(getVId(activeItemIndex, currentColor, activeSides));
    } else {
      setActiveViewId(DEFAULT_VIEW_ID);
    }
  }, [mode, activeItemIndex, activeColors, setActiveViewId, itemImagesByColor, comboItems]);

  const handleCopyLayersToAllColors = useCallback((index, sourceColorKey) => {
    const vIdSource = getVId(index, sourceColorKey, activeSides);
    const sourceLayers = layersByViewRef.current[vIdSource] || [];

    if (!window.confirm(`¿Deseas aplicar el diseño actual (${sourceLayers.length} capas) a TODAS las demás variaciones de color de este producto? (Las capas de cada variación quedarán independientes).`)) {
      return;
    }

    const next = [...(comboItemCustomization || [])];
    const cust = { ...(next[index] || {}) };
    const newInitialLayers = { ...(cust.initialLayersByColor || {}) };

    // Asignar en context (Fabric canvas multi-view)
    const colorsMap = itemImagesByColor?.[index] || { default: '' };
    Object.keys(colorsMap).forEach(col => {
      // Si es el color actual no modificamos IDs para no romper su canvas actual
      if (col === sourceColorKey) {
        const clonedLyrs = JSON.parse(JSON.stringify(sourceLayers));
        newInitialLayers[col] = clonedLyrs;
        return;
      }

      const vIdDest = getVId(index, col, activeSides);
      const sourceDims = window.__FABRIC_CANVAS_DIMS?.[vIdSource] || {};
      const clonedLyrsWithNewIds = sourceLayers.map(l => ({
        ...JSON.parse(JSON.stringify(l)),
        id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        baseW: l.baseW || sourceDims.width || undefined,
        baseH: l.baseH || sourceDims.height || undefined
      }));
      setLayersForView(vIdDest, clonedLyrsWithNewIds);
      newInitialLayers[col] = clonedLyrsWithNewIds;
    });

    // Guardar en customización del padre
    next[index] = { ...cust, initialLayersByColor: newInitialLayers };
    if (onComboItemCustomizationChange) {
      onComboItemCustomizationChange(next);
    }
    alert('✅ Diseño copiado a todas las variaciones del Producto ' + (index + 1));
  }, [comboItemCustomization, itemImagesByColor, onComboItemCustomizationChange, setLayersForView]);

  const handleSaveAll = useCallback(() => {
    if (!onComboItemCustomizationChange) return;

    const next = comboItems.map((item, i) => {
      const cust = (comboItemCustomization || [])[i] || {};
      
      const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
      const newBackLayers = { ...(cust.backSide?.initialLayersByColor || {}) };

      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const frontId = `${FALLBACK_VIEW_PREFIX}${i}-${color}`;
        const backId = `${FALLBACK_VIEW_PREFIX}${i}-${color}-back`;
        newInitialLayers[color] = layersByViewRef.current[frontId] || newInitialLayers[color] || [];
        if (layersByViewRef.current[backId] || newBackLayers[color]) {
            newBackLayers[color] = layersByViewRef.current[backId] || newBackLayers[color] || [];
        }
      });


      return {
        productId: item.productId,
        viewId: item.viewId,
        printAreas: cust.printAreas || [],
        initialLayersByColor: newInitialLayers,
        backSide: {
          ...(cust.backSide || {}),
          initialLayersByColor: newBackLayers
        }
      };
    });

    onComboItemCustomizationChange(next);
    alert('Diseños guardados correctamente.');
  }, [onComboItemCustomizationChange, comboItems, comboItemCustomization, itemImagesByColor]);

  const updateItemZones = useCallback(
    (itemIndex, newPrintAreas) => {
      if (!onComboItemCustomizationChange) return;
      const next = comboItems.map((item, i) => {
        const cust = (comboItemCustomization || [])[i] || {};
        const isBackZones = activeSides[itemIndex] === 'back';
        return {
          ...cust,
          productId: item.productId,
          viewId: item.viewId,
          printAreas: (i === itemIndex && !isBackZones) ? newPrintAreas : (cust.printAreas || []),
          initialLayersByColor: cust.initialLayersByColor || { default: [] },
          backSide: {
            ...(cust.backSide || {}),
            printAreas: (i === itemIndex && isBackZones) ? newPrintAreas : (cust.backSide?.printAreas || [])
          }
        };
      });
      onComboItemCustomizationChange(next);
    },
    [onComboItemCustomizationChange, comboItems, comboItemCustomization, activeSides]
  );
  const handleClearAllDesigns = () => {
    if (!window.confirm('¿Seguro que deseas eliminar TODOS los diseños pre-cargados de este combo para todos los colores?')) return;

    // 1. Limpiar EditorContext global/local
    Object.keys(layersByView).forEach(vId => {
      if (clearLayers) clearLayers(vId);
    });

    // 2. Sobreescribir el estado del combo con capas vacías
    const next = comboItems.map((item, i) => {
      const cust = (comboItemCustomization || [])[i] || {};
      return {
        ...cust,
        productId: item.productId,
        viewId: item.viewId,
        initialLayersByColor: {}
      };
    });

    if (onComboItemCustomizationChange) {
      onComboItemCustomizationChange(next);
    }

    // 3. Forzar vaciado explícito del comboPreviewImage
    if (typeof onCaptureDefaultThumbnail === 'function') {
      onCaptureDefaultThumbnail(null);
    }
  };

  return (
    <div className={styles.container}>
      {canEditZones && (
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.titleArea}>
              <h4 className={styles.title}>Editor de Combo (Modo Fallback)</h4>
              <span className={styles.subtitle}>Las imágenes se editan de forma independiente</span>
            </div>
            <div className={styles.headerActions}>
              {mode === 'design' && canEditZones && (
                <label className={styles.zoneToggle}>
                  <input
                    type="checkbox"
                    checked={showZonesDesign}
                    onChange={() => setShowZonesDesign(!showZonesDesign)}
                  />
                  <span>Ver zonas</span>
                </label>
              )}
              {canEditZones && (
                <>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    style={{ backgroundColor: '#dc3545', marginRight: '8px' }}
                    onClick={handleClearAllDesigns}
                  >
                    Forzar Limpieza de Diseños
                  </button>
                  <button type="button" className={styles.saveBtn} onClick={handleSaveAll}>Guardar Cambios</button>
                </>
              )}
            </div>
          </div>
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={mode === 'design' ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode('design')}
            >
              Diseño por Lienzo
            </button>
            {itemViews?.some(v => v?.hasBackSide) && (
              <button
                type="button"
                className={mode === 'design-back' ? styles.modeBtnActive : styles.modeBtn}
                onClick={() => setMode('design-back')}
                style={{ backgroundColor: mode === 'design-back' ? '#2196F3' : '#e3f2fd', color: mode === 'design-back' ? '#fff' : '#1976D2', borderColor: '#2196F3' }}
              >
                Diseño Espalda
              </button>
            )}
            {canEditZones && (
              <button
                type="button"
                className={mode === 'zones' ? styles.modeBtnActive : styles.modeBtn}
                onClick={() => setMode('zones')}
              >
                Configurar Zonas
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'design' && canEditZones && (
        <div className={styles.mobileLayoutToggle}>
          <label className={styles.zoomToggleLabel}>
            <input
              type="checkbox"
              className={styles.zoomToggleCheckbox}
              checked={enableZoomToEdit}
              onChange={(e) => {
                const checked = e.target.checked;
                setEnableZoomToEdit(checked);
                setMobileLayoutMode(checked ? 'single' : 'joined');
              }}
            />
            <span>Ampliar producto al editar</span>
          </label>
        </div>
      )}

      <div className={(mode === 'design' || mode === 'design-back') ? styles.unifiedModePanel : styles.unifiedModePanelHidden}>
        {/* Pestañas de navegación para modo móvil */}
        {!canEditZones && (comboItems?.length > 1) && (
          <div className={styles.mobileComboTabs}>
            {comboItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className={`${styles.mobileComboTab} ${mobileLayoutMode === 'single' && activeItemIndex === idx ? styles.mobileComboTabActive : ''}`}
                onClick={() => {
                  setMobileLayoutMode('single');
                  setActiveItemIndex(idx);
                }}
              >
                Producto {idx + 1}
              </button>
            ))}
            <button
               type="button"
               className={`${styles.mobileComboTabIcon} ${mobileLayoutMode === 'joined' ? styles.mobileComboTabActive : ''}`}
               onClick={() => setMobileLayoutMode('joined')}
               title="Ver Juntos"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
          </div>
        )}
        <div className={styles.editorLayout}>
          <div className={styles.canvasSectionUnified}>
            <div ref={wrapRef} className={`${styles.unifiedSideBySide} ${mobileLayoutMode === 'joined' ? styles.unifiedSideBySideModeJoined : styles.unifiedSideBySideModeSingle}`} style={{ flexDirection: comboLayout.orientation === 'vertical' ? 'column' : 'row' }}>
              {(fallbackUrls || []).map((imgUrl, index) => {
                const colorsMap = itemImagesByColor?.[index] || { default: '' };
                const colorKeys = Object.keys(colorsMap);

                const allowed = comboItems[index]?.variantMapping?.allowedColors;
                let filteredColorKeys = colorKeys;
                if (allowed && Array.isArray(allowed)) {
                   const allowedLower = allowed.map(c => typeof c === 'string' ? c.trim().toLowerCase() : c);
                   filteredColorKeys = colorKeys.filter(k => 
                      k === 'default' || allowedLower.includes(k.trim().toLowerCase())
                   );
                }

                if (filteredColorKeys.length > 1 && filteredColorKeys.includes('default')) {
                  filteredColorKeys = filteredColorKeys.filter(c => c !== 'default');
                }
                if (filteredColorKeys.length === 0) {
                  filteredColorKeys = ['default'];
                }

                let currentColor = activeColors[index] || 'default';
                if (!filteredColorKeys.includes(currentColor)) {
                  currentColor = filteredColorKeys[0] || 'default';
                }

                const viewId = getVId(index, currentColor, activeSides);
                const cust = (comboItemCustomization || [])[index] || {};

                const hasMultipleColors = filteredColorKeys.length > 1;
                const viewObj = itemViews?.[index];
                let rawImgUrl = '';
                if (activeSides[index] === 'back') {
                  const backColors = viewObj?.backSide?.imagesByColor || {};
                  rawImgUrl = backColors[currentColor] || backColors.default || Object.values(backColors)[0] || '';
                }
                if (!rawImgUrl) {
                  rawImgUrl = colorsMap[currentColor] || imgUrl || '';
                }
                const activeImgUrl = getCloudinaryOptimized(rawImgUrl);
                const currentItemSizes = itemSizes?.[index] || [];
                const currentSize = activeSizes[index] || currentItemSizes[0] || '';
                const hasSizes = currentItemSizes.length > 0;

                return (
                  <div
                    key={`combo-item-${index}`}
                    className={`${styles.unifiedSideBySideItem} ${(!isCapturing && activeItemIndex === index) ? styles.unifiedSideBySideItemActive : ''}`}
                    onClick={() => {
                      setActiveItemIndex(index);
                      if (enableZoomToEdit) {
                        setMobileLayoutMode('single');
                      }
                    }}
                  >
                    {!isCapturing && hasSizes && (
                      <div className={styles.mobileSizesWrap} data-html2canvas-ignore="true">
                        <span className={styles.mobileSizesLabel}>
                          TALLA:
                          {currentItemSizes.length > 5 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
                        </span>
                        <DraggableContainer className={styles.mobileSizesList} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          {currentItemSizes.map(s => (
                            <button
                              key={s}
                              type="button"
                              className={`${styles.mobileSizePill} ${currentSize === s ? styles.mobileSizePillActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActiveSizeChange(index, s);
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </DraggableContainer>
                      </div>
                    )}
                    {!isCapturing && (
                      <div className={styles.itemHeader} data-html2canvas-ignore="true">
                        <div className={styles.itemTitleWrap}>
                          {mobileLayoutMode === 'single' && (
                            <button
                              type="button"
                              className={styles.navArrow}
                              disabled={index === 0}
                              onClick={(e) => { e.stopPropagation(); setActiveItemIndex(index - 1); }}
                              title="Producto anterior"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                          )}
                          <div className={styles.itemTitle}>Producto {index + 1}</div>
                          {mobileLayoutMode === 'single' && (
                            <button
                              type="button"
                              className={styles.navArrow}
                              disabled={index === fallbackUrls.length - 1}
                              onClick={(e) => { e.stopPropagation(); setActiveItemIndex(index + 1); }}
                              title="Producto siguiente"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className={styles.unifiedSideBySideItemInner}>
                      <div className={styles.unifiedDesignCanvasWrap}>
                        <EditorCanvas
                          productImage={activeImgUrl}
                          printAreas={activeSides[index] === 'back' ? (cust.backSide?.printAreas || []) : (cust.printAreas || [])}
                          viewId={viewId}
                          showZones={showZonesDesign}
                        />
                      </div>
                    </div>
                    {hasMultipleColors && !isCapturing && (
                      <div className={styles.mobileDropdownWrap} data-html2canvas-ignore="true">
                        {filteredColorKeys.length > 5 && (
                          <div className={styles.mobileSizesLabel} style={{ marginTop: '0.5rem' }}>
                            COLOR <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>
                          </div>
                        )}
                        <DraggableContainer className={styles.colorList} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          {filteredColorKeys.map(c => {
                            const hex = itemColorsHex?.[index]?.[c] || getFallbackHex(c) || '#cccccc';
                            const isDefault = c === 'default';
                            return (
                              <button
                                key={c}
                                type="button"
                                className={`${styles.colorBtnWrapper} ${currentColor === c ? styles.active : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleActiveColorChange(index, c);
                                }}
                                title={isDefault ? 'Por defecto' : c.toUpperCase()}
                              >
                                <span 
                                  className={`${styles.colorBtn} ${isDefault ? styles.defaultColor : ''}`} 
                                  style={!isDefault ? { backgroundColor: hex } : {}} 
                                />
                              </button>
                            );
                          })}
                        </DraggableContainer>
                        {canEditZones && hasMultipleColors && (
                          <button
                            type="button"
                            className={styles.copyToAllBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLayersToAllColors(index, currentColor);
                            }}
                            title="Copiar diseño actual a todas las demás variaciones de color"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copiar a todos
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
              }
            </div>
            {/* Botón Flotante para Móvil. Global a toda la sección del canvas */}
            {!canEditZones && <MobileFloatingTools />}
          </div>
          <div className={styles.toolbarSection}>
            <Toolbar />
          </div>
        </div>
      </div>

      <div className={(mode === 'zones' || mode === 'zones-back') && canEditZones ? styles.unifiedModePanel : styles.unifiedModePanelHidden}>
        <div className={styles.editorLayout}>
          <div className={styles.canvasSectionUnified}>
            <div
              className={styles.unifiedSideBySide}
              style={{
                flexDirection: comboLayout.orientation === 'vertical' ? 'column' : 'row',
                gap: `${comboLayout.spacing ?? 0}px`
              }}
            >
              {(fallbackUrls || []).map((url, index) => {
                const cust = (comboItemCustomization || [])[index] || {};
                
                // Mapear la imagen igual que en modo 'design' para evitar fallos donde se muestra la imagen general en lugar del color activo
                const colorsMap = itemImagesByColor?.[index] || { default: '' };
                const colorKeys = Object.keys(colorsMap);
                const allowed = comboItems[index]?.variantMapping?.allowedColors;
                let filteredColorKeys = colorKeys;
                if (allowed && Array.isArray(allowed)) {
                   const allowedLower = allowed.map(c => typeof c === 'string' ? c.trim().toLowerCase() : c);
                   filteredColorKeys = colorKeys.filter(k => 
                      k === 'default' || allowedLower.includes(k.trim().toLowerCase())
                   );
                }

                if (filteredColorKeys.length > 1 && filteredColorKeys.includes('default')) {
                  filteredColorKeys = filteredColorKeys.filter(c => c !== 'default');
                }
                if (filteredColorKeys.length === 0) {
                  filteredColorKeys = ['default'];
                }

                let currentColor = activeColors[index] || 'default';
                if (!filteredColorKeys.includes(currentColor)) {
                  currentColor = filteredColorKeys[0] || 'default';
                }

                const activeImgUrl = getCloudinaryOptimized(colorsMap[currentColor] || url);

                return (
                  <div
                    key={`z-${index}`}
                    className={`${styles.unifiedSideBySideItem} ${activeItemIndex === index ? styles.unifiedSideBySideItemActive : ''}`}
                    onClick={() => setActiveItemIndex(index)}
                  >
                    <div className={styles.itemTitle}>Producto {index + 1}</div>
                    <div className={styles.unifiedSideBySideItemInner}>
                      <div className={styles.unifiedDesignCanvasWrap}>
                        <PrintAreasEditor
                          imageUrl={activeImgUrl}
                          printAreas={cust.printAreas || []}
                          onChange={(zones) => updateItemZones(index, zones)}
                          controlsTargetId="combo-fallback-sidebar"
                          hideControls={activeItemIndex !== index}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.toolbarSection} id="combo-fallback-sidebar" />
        </div>
      </div>
    </div >
  );
};

const UnifiedComboEditor = (props) => {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({ composed: null, composedBack: null, itemImages: [], itemImagesByColor: [], itemSizes: [], itemColorsHex: [] });
  const prevKeyRef = useRef('');

  useEffect(() => {
    // Identificador único para los ítems del combo y su disposición
    const currentKey = JSON.stringify({
      items: props.comboItems.map(it => ({ p: it.productId, v: it.viewId })),
      layout: props.comboLayout
    });

    // Si la estructura base no ha cambiado, no forzamos recarga y evitamos remount
    if (currentKey === prevKeyRef.current && state.itemImages.length > 0) {
      setLoading(false);
      return;
    }

    prevKeyRef.current = currentKey;
    let cancelled = false;

    const load = async () => {
      // Solo mostramos "loading" si no tenemos imágenes previas para evitar flickering
      if (state.itemImages.length === 0) setLoading(true);

      try {
        const resolvedImages = [];
        const resolvedItemImagesByColor = [];
        const resolvedItemSizes = [];
        const resolvedItemColorsHex = [];
        const resolvedItemViews = [];
        
        const productCache = {};
        const getProductMemo = async (id) => {
          if (!productCache[id]) productCache[id] = await getProduct(id);
          return productCache[id];
        };

        const getUrlBack = async (item, index) => {
          const { data } = await getProductMemo(item.productId);
          const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];
          const colorImgObj = view?.backSide?.imagesByColor || {};
          
          let previewUrlBack = '';
          if (colorImgObj) {
            const color = item.variantMapping?.color || 'default';
            previewUrlBack = colorImgObj[color] || colorImgObj.default || Object.values(colorImgObj)[0] || '';
            previewUrlBack = typeof previewUrlBack === 'string' ? ensureSingleImageUrl(previewUrlBack) : '';
            previewUrlBack = previewUrlBack ? toDirectImageUrl(previewUrlBack) : '';
          }
          if (!previewUrlBack) {
              const frontImgObj = view?.imagesByColor || {};
              const color = item.variantMapping?.color || 'default';
              const productVariants = Array.isArray(data?.variants) ? data.variants : [];
              const variant = productVariants.find(v => v.name === color) || {};
              let fRaw = variant.imageUrl || frontImgObj[color] || frontImgObj.default || data?.mainImage || (Array.isArray(data?.images) ? data?.images[0] : '');
              fRaw = typeof fRaw === 'string' ? ensureSingleImageUrl(fRaw) : '';
              previewUrlBack = fRaw ? toDirectImageUrl(fRaw) : 'https://placehold.co/600x600?text=Sin+Imagen';
          }
          return { imageUrl: previewUrlBack, scale: item.scale || 1 };
        };

        const getUrl = async (item, index) => {
          const { data } = await getProductMemo(item.productId);
          const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];
          resolvedItemViews[index] = view;

          // Determine Sizes
          let availableComboSizes = [];
          if (Array.isArray(data?.sizes) && data.sizes.length > 0) {
            availableComboSizes = data.sizes;
          } else if (data?.name && data.name.toLowerCase().includes('polera')) {
            availableComboSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
          }
          resolvedItemSizes[index] = availableComboSizes;

          const colorImgObj = view?.imagesByColor || {};
          const convertedColorObj = {};

          // 1. Obtener todas las variantes de color reales del producto
          const productVariants = Array.isArray(data?.variants) ? data.variants : [];

          if (productVariants.length > 0) {
            const hexMap = {};
            productVariants.forEach(variant => {
              if (variant.colorHex) hexMap[variant.name] = variant.colorHex;

              // Buscar imagen en: imagen de la variante (FUENTE DE VERDAD) -> color específico de la vista -> imagen principal del producto -> default viejo
              const raw = variant.imageUrl || colorImgObj[variant.name] || data.mainImage || colorImgObj.default;
              const url = ensureSingleImageUrl(raw);
              convertedColorObj[variant.name] = url ? toDirectImageUrl(url) : '';
            });
            resolvedItemColorsHex[index] = hexMap;
          }

          // 2. Incluir también colores que existan en imagesByColor pero no en variantes (retrocompatibilidad)
          if (productVariants.length === 0) {
            Object.keys(colorImgObj).forEach(c => {
              if (!convertedColorObj[c]) {
                if (c === 'default' || c.startsWith('http')) return; // ignora fallos de base de datos
                const raw = colorImgObj[c];
                const url = ensureSingleImageUrl(raw);
                convertedColorObj[c] = url ? toDirectImageUrl(url) : '';
              }
            });
          }

          // 3. Garantizar que exista una imagen para cada color, heredando de la principal si es necesario
          const rawFallback = ensureSingleImageUrl(colorImgObj.default) || ensureSingleImageUrl(data?.mainImage) || (Array.isArray(data?.images) ? ensureSingleImageUrl(data?.images[0]) : '');
          const mainFallback = rawFallback ? toDirectImageUrl(rawFallback) : 'https://placehold.co/600x600?text=Sin+Imagen';

          Object.keys(convertedColorObj).forEach(c => {
            if (!convertedColorObj[c] || typeof convertedColorObj[c] !== 'string') convertedColorObj[c] = mainFallback;
          });

          // Asegurar que 'default' tenga imagen
          if (!convertedColorObj.default || typeof convertedColorObj.default !== 'string') {
            convertedColorObj.default = mainFallback;
          }

          resolvedItemImagesByColor[index] = convertedColorObj;

          const color = item.variantMapping?.color || 'default';
          // Prioridad de la imagen para el preview compuesto: color del mapping -> default -> primera disponible
          const previewUrl = (convertedColorObj[color] && typeof convertedColorObj[color] === 'string')
            ? convertedColorObj[color]
            : (convertedColorObj.default && typeof convertedColorObj.default === 'string')
              ? convertedColorObj.default
              : (Object.values(convertedColorObj).find(v => typeof v === 'string' && v) || '');
          resolvedImages[index] = previewUrl || mainFallback;

          return { imageUrl: previewUrl, scale: item.scale || 1 };
        };

        const res = await generateComboPreviewDataUrlWithBounds(props.comboItems, props.comboLayout, getUrl);
        let resBack = null;
        try {
          resBack = await generateComboPreviewDataUrlWithBounds(props.comboItems, props.comboLayout, getUrlBack);
        } catch (backErr) {
          console.warn('Ignored error while generating back composed image:', backErr);
        }
        if (!cancelled) {
          setState({ composed: res, composedBack: resBack, itemImages: resolvedImages, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex, itemViews: resolvedItemViews });
        }
      } catch (err) {
        setState(prev => ({ ...prev, _debugError: err ? err.toString() : 'Unknown error' }));
        console.warn('UnifiedComboEditor: could not generate composed image', err);
        console.warn('UnifiedComboEditor: could not generate composed image', err);
        const urls = [];
        const resolvedItemImagesByColor = [];
        const resolvedItemSizes = [];
        const resolvedItemColorsHex = [];
        const resolvedItemViews = [];
        for (let i = 0; i < props.comboItems.length; i++) {
          const item = props.comboItems[i];
          const { data } = await getProduct(item.productId);
          const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];
          resolvedItemViews[i] = view;

          // Determine Sizes fallback
          let availableComboSizes = [];
          if (Array.isArray(data?.sizes) && data.sizes.length > 0) {
            availableComboSizes = data.sizes;
          } else if (data?.name && data.name.toLowerCase().includes('polera')) {
            availableComboSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
          }
          resolvedItemSizes[i] = availableComboSizes;

          const colorImgObj = view?.imagesByColor || {};
          const convertedColorObj = {};
          const productVariants = Array.isArray(data?.variants) ? data.variants : [];

          if (productVariants.length > 0) {
            const hexMap = {};
            productVariants.forEach(variant => {
              if (variant.colorHex) hexMap[variant.name] = variant.colorHex;

              const raw = variant.imageUrl || colorImgObj[variant.name] || data.mainImage || colorImgObj.default;
              const url = ensureSingleImageUrl(raw);
              convertedColorObj[variant.name] = url ? toDirectImageUrl(url) : '';
            });
            resolvedItemColorsHex[i] = hexMap;
          }
          if (productVariants.length === 0) {
            Object.keys(colorImgObj).forEach(c => {
              if (!convertedColorObj[c]) {
                if (c === 'default' || c.startsWith('http')) return;
                const url = ensureSingleImageUrl(colorImgObj[c]);
                convertedColorObj[c] = url ? toDirectImageUrl(url) : '';
              }
            });
          }

          const rawFallbackCatch = ensureSingleImageUrl(colorImgObj.default) || ensureSingleImageUrl(data?.mainImage) || ensureSingleImageUrl(data?.images?.[0]);
          const mainFallback = rawFallbackCatch ? toDirectImageUrl(rawFallbackCatch) : 'https://placehold.co/600x600?text=Sin+Imagen';
          Object.keys(convertedColorObj).forEach(c => {
            if (!convertedColorObj[c]) convertedColorObj[c] = mainFallback;
          });
          if (!convertedColorObj.default) convertedColorObj.default = mainFallback;

          resolvedItemImagesByColor[i] = convertedColorObj;

          const color = item.variantMapping?.color || 'default';
          urls.push((convertedColorObj[color] && typeof convertedColorObj[color] === 'string')
            ? convertedColorObj[color]
            : (convertedColorObj.default && typeof convertedColorObj.default === 'string')
              ? convertedColorObj.default
              : (Object.values(convertedColorObj).find(v => typeof v === 'string' && v) || mainFallback));
        }
        if (!cancelled) setState({ composed: null, itemImages: urls, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex, itemViews: resolvedItemViews });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [props.comboItems, props.comboLayout]);

  const canEditZones = props.canEditZones !== false;
  const content = loading ? (
    <div className={styles.loading}>Cargando editor unificado...</div>
  ) : state.composed ? (
    <UnifiedComboEditorContent
      {...props}
      composedImageUrl={state.composed.dataUrl}
      composedImageUrlBack={state.composedBack?.dataUrl}
      itemBounds={state.composed.itemBounds}
      totalWidth={state.composed.totalWidth}
      totalHeight={state.composed.totalHeight}
      itemImages={state.itemImages}
      itemImagesByColor={state.itemImagesByColor}
      itemSizes={state.itemSizes}
      itemColorsHex={state.itemColorsHex}
      itemViews={state.itemViews}
      onCaptureDefaultThumbnail={props.onCaptureDefaultThumbnail}
      onColorChange={props.onColorChange}
      triggerCaptureRef={props.triggerCaptureRef}
    />
  ) : (
    <UnifiedComboEditorFallbackContent
      {...props}
      _debugError={state._debugError}
      fallbackUrls={state.itemImages}
      itemImagesByColor={state.itemImagesByColor}
      itemSizes={state.itemSizes}
      itemColorsHex={state.itemColorsHex}
      itemViews={state.itemViews}
    />
  );

  return (
    <EditorProvider>
      {content}
    </EditorProvider>
  );
};

export default UnifiedComboEditor;
