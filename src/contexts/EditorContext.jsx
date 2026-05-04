import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

const EditorContext = createContext();

const DEFAULT_VIEW_ID = 'default';

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor debe usarse dentro de EditorProvider');
  }
  return context;
};

export const EditorProvider = ({ children }) => {
  const [layersByView, setLayersByView] = useState({});
  const [activeViewId, setActiveViewId] = useState(DEFAULT_VIEW_ID);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [canvas, setCanvas] = useState(null);
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState({ size: '', color: '' });
  const [price, setPrice] = useState(0);
  const [activePrintAreaIdByView, setActivePrintAreaIdByView] = useState({});
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 500, height: 600 });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [clipboardLayers, setClipboardLayers] = useState([]);
  const [activeComboItem, setActiveComboItem] = useState(0);
  const [comboVariantSelections, setComboVariantSelections] = useState({});
  const [composedComboImage, setComposedComboImage] = useState(null);
  const layersByViewRef = useRef(layersByView);
  useEffect(() => { layersByViewRef.current = layersByView; }, [layersByView]);

  const layers = useMemo(
    () => (layersByView[activeViewId] ?? []),
    [layersByView, activeViewId]
  );

  const pushToHistory = useCallback((stateBeforeAction) => {
    setUndoStack((prev) => {
      // Keep only the last 10 distinct states
      const next = [...prev, JSON.parse(JSON.stringify(stateBeforeAction))];
      const maxHistory = 10;
      return next.length > maxHistory ? next.slice(-maxHistory) : next;
    });
    setRedoStack([]);
  }, []);

  const addLayer = useCallback((viewIdOrLayer, layerArg) => {
    const isLegacyCall = layerArg === undefined && viewIdOrLayer && typeof viewIdOrLayer === 'object' && viewIdOrLayer.type;
    const vId = isLegacyCall ? activeViewId : (viewIdOrLayer ?? activeViewId);
    const layer = isLegacyCall ? viewIdOrLayer : layerArg;

    pushToHistory(layersByViewRef.current);

    const newId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newLayer = {
      id: newId,
      type: layer.type,
      ...layer,
    };

    setLayersByView((prev) => {
      const current = prev[vId] ?? [];
      return {
        ...prev,
        [vId]: [...current, { ...newLayer, zIndex: current.length }]
      };
    });
    return newId;
  }, [activeViewId, pushToHistory]);

  const updateLayer = useCallback((viewIdOrLayerId, layerIdOrUpdates, updatesArg) => {
    const isLegacyCall = updatesArg === undefined && typeof viewIdOrLayerId === 'string' && layerIdOrUpdates && typeof layerIdOrUpdates === 'object';
    const vId = isLegacyCall ? activeViewId : (viewIdOrLayerId ?? activeViewId);
    const layerId = isLegacyCall ? viewIdOrLayerId : layerIdOrUpdates;
    const updates = isLegacyCall ? layerIdOrUpdates : updatesArg;
    setLayersByView((prev) => ({
      ...prev,
      [vId]: (prev[vId] ?? []).map((layer) =>
        layer.id === layerId ? { ...layer, ...updates } : layer
      )
    }));
  }, [activeViewId]);

  const removeLayer = useCallback((viewIdOrLayerId, layerIdArg) => {
    const isLegacyCall = layerIdArg === undefined;
    const vId = isLegacyCall ? activeViewId : (viewIdOrLayerId ?? activeViewId);
    const layerId = isLegacyCall ? viewIdOrLayerId : layerIdArg;
    pushToHistory(layersByViewRef.current);
    setLayersByView((prev) => ({
      ...prev,
      [vId]: (prev[vId] ?? []).filter((layer) => layer.id !== layerId)
    }));
    setSelectedLayer((current) => (current === layerId ? null : current));
  }, [activeViewId, pushToHistory]);

  const transferLayer = useCallback((layerId, fromViewId, toViewId) => {
    setLayersByView((prev) => {
      const fromList = prev[fromViewId] ?? [];
      const layer = fromList.find((l) => l.id === layerId);
      if (!layer) return prev;

      const newFromList = fromList.filter((l) => l.id !== layerId);
      const toList = prev[toViewId] ?? [];
      const newLayer = { ...layer, zIndex: toList.length };

      return {
        ...prev,
        [fromViewId]: newFromList,
        [toViewId]: [...toList, newLayer]
      };
    });
    setSelectedLayer(null);
  }, []);

  const reorderLayers = useCallback((viewIdOrFromIndex, toIndexOrToIndex, toIndexArg) => {
    const isLegacyCall = toIndexArg === undefined;
    const vId = isLegacyCall ? activeViewId : (viewIdOrFromIndex ?? activeViewId);
    const fromIndex = isLegacyCall ? viewIdOrFromIndex : toIndexOrToIndex;
    const toIndex = isLegacyCall ? toIndexOrToIndex : toIndexArg;
    pushToHistory(layersByViewRef.current);
    setLayersByView((prev) => {
      const list = prev[vId] ?? [];
      const newList = [...list];
      const [moved] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, moved);
      return {
        ...prev,
        [vId]: newList.map((layer, index) => ({ ...layer, zIndex: index }))
      };
    });
  }, [activeViewId, pushToHistory]);

  const setLayersForView = useCallback((viewId, newLayers) => {
    setLayersByView((prev) => ({ ...prev, [viewId]: newLayers ?? [] }));
  }, []);

  const clearLayers = useCallback((viewId) => {
    const vId = viewId ?? activeViewId;
    setLayersByView((prev) => ({ ...prev, [vId]: [] }));
    setSelectedLayer(null);
  }, [activeViewId]);

  // ---- NEW: Undo / Redo / Clear All ----
  const undo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previousState = prevUndo[prevUndo.length - 1];
      setRedoStack((prevRedo) => [...prevRedo, JSON.parse(JSON.stringify(layersByViewRef.current))]);
      setLayersByView(previousState);
      return prevUndo.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const nextState = prevRedo[prevRedo.length - 1];
      setUndoStack((prevUndo) => [...prevUndo, JSON.parse(JSON.stringify(layersByViewRef.current))]);
      setLayersByView(nextState);
      return prevRedo.slice(0, -1);
    });
  }, []);

  const clearAll = useCallback(() => {
    setLayersByView({});
    setUndoStack([]);
    setRedoStack([]);
    setSelectedLayer(null);
  }, []);

  const setLayersByViewFromDesign = useCallback((nextLayersByView) => {
    if (nextLayersByView && typeof nextLayersByView === 'object') {
      setLayersByView(nextLayersByView);
    }
  }, []);

  const calculatePrice = useCallback(() => {
    if (!product) return 0;
    let basePrice = product.basePrice || product.price || 0;
    let customizationPrice = 0;
    Object.values(layersByView).forEach((viewLayers) => {
      (viewLayers || []).forEach((layer) => {
        if (layer.type === 'text') customizationPrice += 5;
        else if (layer.type === 'image' || layer.type === 'shape') customizationPrice += 10;
      });
    });
    const finalPrice = basePrice + customizationPrice;
    setPrice(finalPrice);
    return finalPrice;
  }, [product, layersByView]);

  const activePrintAreaId = useMemo(
    () => activePrintAreaIdByView[activeViewId] || null,
    [activePrintAreaIdByView, activeViewId]
  );

  /** Posición por defecto (x, y en píxeles del canvas) para nuevos elementos: centro de la zona de impresión activa */
  const getDefaultPositionInPrintArea = useCallback(() => {
    const view = product?.customizationViews?.find((v) => v.id === activeViewId) || product?.customizationViews?.[0];
    const areas = view?.printAreas || [];
    const area = activePrintAreaId ? areas.find((a) => a.id === activePrintAreaId) : areas[0];
    const w = canvasDimensions?.width ?? 500;
    const h = canvasDimensions?.height ?? 600;
    if (!area || !w) return { x: 100, y: 100 };
    const left = (w * (area.x || 10)) / 100;
    const top = (h * (area.y || 10)) / 100;
    const zoneW = (w * (area.width || 80)) / 100;
    const zoneH = (h * (area.height || 80)) / 100;
    return { x: Math.round(left + zoneW / 2 - 50), y: Math.round(top + zoneH / 2 - 25) };
  }, [product?.customizationViews, activeViewId, activePrintAreaId, canvasDimensions]);

  const setActivePrintAreaId = useCallback((viewIdOrAreaId, areaIdArg) => {
    const isLegacyCall = areaIdArg === undefined;
    const vId = isLegacyCall ? activeViewId : (viewIdOrAreaId ?? activeViewId);
    const areaId = isLegacyCall ? viewIdOrAreaId : areaIdArg;
    setActivePrintAreaIdByView((prev) => ({
      ...prev,
      [vId]: areaId
    }));
  }, [activeViewId]);

  const clearActivePrintAreaId = useCallback((viewId) => {
    const vId = viewId ?? activeViewId;
    setActivePrintAreaIdByView((prev) => {
      const next = { ...prev };
      delete next[vId];
      return next;
    });
  }, [activeViewId]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const previousState = prev[prev.length - 1];
      setLayersByView(JSON.parse(JSON.stringify(previousState)));
      setRedoStack((redo) => [...redo, JSON.parse(JSON.stringify(layersByViewRef.current))]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const nextState = prev[prev.length - 1];
      setLayersByView(JSON.parse(JSON.stringify(nextState)));
      setUndoStack((undo) => [...undo, JSON.parse(JSON.stringify(layersByViewRef.current))]);
      return prev.slice(0, -1);
    });
  }, []);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const updateComboVariant = useCallback((itemIndex, variant) => {
    setComboVariantSelections((prev) => ({
      ...prev,
      [itemIndex]: variant
    }));
  }, []);

  const regenerateComboImage = useCallback(() => {
    // Esta función se implementará cuando se integre con useComboImageComposer
    // Por ahora, se maneja en ComboUserEditor
  }, []);

  const value = useMemo(() => ({
    layers,
    layersByView,
    setLayersByView,
    setLayersForView,
    setLayersByViewFromDesign,
    activeViewId,
    setActiveViewId,
    selectedLayer,
    setSelectedLayer,
    canvas,
    setCanvas,
    product,
    variant,
    setProduct,
    setVariant,
    price,
    addLayer,
    transferLayer,
    updateLayer,
    removeLayer,
    reorderLayers,
    clearLayers,
    calculatePrice,
    activePrintAreaId,
    setActivePrintAreaId,
    clearActivePrintAreaId,
    activePrintAreaIdByView,
    canvasDimensions,
    setCanvasDimensions,
    getDefaultPositionInPrintArea,
    pushToHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    clipboardLayers,
    setClipboardLayers,
    activeComboItem,
    setActiveComboItem,
    comboVariantSelections,
    updateComboVariant,
    composedComboImage,
    setComposedComboImage,
    regenerateComboImage,
    // expose clearAll for resetting design
    clearAll,
  }), [
    layers,
    layersByView,
    activeViewId,
    selectedLayer,
    canvas,
    product,
    variant,
    price,
    addLayer,
    transferLayer,
    updateLayer,
    removeLayer,
    reorderLayers,
    clearLayers,
    calculatePrice,
    setLayersForView,
    setLayersByViewFromDesign,
    activePrintAreaId,
    setActivePrintAreaId,
    clearActivePrintAreaId,
    activePrintAreaIdByView,
    canvasDimensions,
    getDefaultPositionInPrintArea,
    pushToHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    clipboardLayers,
    setClipboardLayers,
    activeComboItem,
    setActiveComboItem,
    comboVariantSelections,
    updateComboVariant,
    composedComboImage,
    setComposedComboImage,
    regenerateComboImage,
    clearAll
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};
