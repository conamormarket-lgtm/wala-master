import React, { useEffect, useState, useRef, useCallback } from 'react';
import { EditorProvider, useEditor } from '../../../contexts/EditorContext';
import EditorCanvas from '../../editor/EditorCanvas/EditorCanvas';
import Toolbar from '../../editor/Toolbar/Toolbar';
import PrintAreasEditor from '../PrintAreasEditor/PrintAreasEditor';
import styles from './AdminViewEditor.module.css';

/**
 * ==========================================
 * Hook: Sincronización y Semilla de Capas
 * ==========================================
 * Mueve la lógica compleja de refs y effects (que maneja la inicialización
 * de capas de Fabric.js desde los props) a su propio custom hook.
 */
const useEditorSeeding = ({
  activeViewId,
  currentColor,
  initialLayers,
  designOnly,
  onColorChange,
  onLayersChange,
}) => {
  const { layersByView, setLayersForView } = useEditor();
  const [selectedColor, setSelectedColor] = useState(currentColor || 'default');

  const seededRef = useRef(new Set());
  const seededDesignViewsRef = useRef(new Set());
  const lastLayersRef = useRef(null);
  const initialSeedDoneRef = useRef(false);

  // 1. Sincronizar selectedColor si cambia desde afuera
  useEffect(() => {
    if (currentColor && currentColor !== selectedColor) {
      setSelectedColor(currentColor);
    }
  }, [currentColor, selectedColor]);

  // 2. Sembrar (seed) las capas iniciales cuando cambia la vista o el color
  useEffect(() => {
    const colorKey = selectedColor || 'default';
    const seedKey = `${activeViewId}_${colorKey}`;

    if (seededRef.current.has(seedKey)) return;

    if (designOnly && seededDesignViewsRef.current.has(activeViewId)) {
      seededRef.current.add(seedKey);
      return;
    }

    const rawLayers = initialLayers?.[colorKey] ?? (Array.isArray(initialLayers) ? initialLayers : []);
    const layers = Array.isArray(rawLayers) ? JSON.parse(JSON.stringify(rawLayers)) : [];

    setLayersForView(activeViewId, layers);
    seededRef.current.add(seedKey);
    seededDesignViewsRef.current.add(activeViewId);
    lastLayersRef.current = JSON.stringify(layers);
    initialSeedDoneRef.current = true;
  }, [selectedColor, activeViewId, initialLayers, setLayersForView, designOnly]);

  // 3. Detectar cambios en las capas y emitir hacia arriba
  useEffect(() => {
    const colorKey = selectedColor || 'default';
    const seedKey = `${activeViewId}_${colorKey}`;
    if (!seededRef.current.has(seedKey) || !initialSeedDoneRef.current) return;

    const currentLayers = layersByView[activeViewId] ?? [];
    const currentLayersStr = JSON.stringify(currentLayers);

    if (lastLayersRef.current === currentLayersStr) return;

    lastLayersRef.current = currentLayersStr;
    if (onLayersChange) {
      onLayersChange(selectedColor, currentLayers);
    }
  }, [layersByView, activeViewId, selectedColor, onLayersChange]);

  // Cambio manual de color
  const handleColorChange = useCallback(
    (color) => {
      initialSeedDoneRef.current = false;
      setSelectedColor(color);
      if (onColorChange) onColorChange(color);
    },
    [onColorChange]
  );

  return { selectedColor, handleColorChange, seededRef, layersByView };
};

/**
 * ==========================================
 * Componente: Encabezado del Editor (ViewHeader)
 * ==========================================
 * Maneja la selección de colores, copiar diseño a variaciones 
 * y toggles de modos de visualización.
 */
const AdminViewEditorHeader = ({
  colorsToShow,
  selectedColor,
  handleColorChange,
  onCopyToAllColors,
  layersByView,
  activeViewId,
  seededRef,
  mode,
  setMode,
  designOnly,
  productImage,
}) => {
  const handleCopyToAll = () => {
    const currentLayers = layersByView[activeViewId] || [];
    if (
      window.confirm(
        `¿Deseas aplicar el diseño actual (${currentLayers.length} capas) a TODAS las demás variaciones de color? (Las capas de cada variación quedarán independientes para que puedas cambiar su tintado después).`
      )
    ) {
      seededRef.current.clear();
      seededRef.current.add(`${activeViewId}_${selectedColor || 'default'}`);
      
      const sourceDims = window.__FABRIC_CANVAS_DIMS?.[activeViewId] || {};
      onCopyToAllColors(currentLayers, sourceDims);
    }
  };

  return (
    <div className={styles.header}>
      <h4 className={styles.title}>Vista previa</h4>
      <div className={styles.headerRight}>
        {colorsToShow.length > 1 && (
          <div className={styles.colorSelector}>
            <label className={styles.colorLabel}>Variación de color:</label>
            <select
              value={selectedColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className={styles.colorSelect}
            >
              {colorsToShow.map((color) => (
                <option key={color} value={color}>
                  {color === 'default' ? 'Sin color específico' : color}
                </option>
              ))}
            </select>

            {onCopyToAllColors && (
              <button
                type="button"
                className={styles.copyToAllBtn}
                onClick={handleCopyToAll}
                title="Copiar diseño actual a todas las variaciones"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span className={styles.copyToAllText}>Copiar a todos</span>
              </button>
            )}
          </div>
        )}

        {(!designOnly || mode === 'zones') && (
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={mode === 'design' ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode('design')}
              aria-pressed={mode === 'design'}
              disabled={!productImage}
              title={!productImage ? 'Sube una imagen para usar el modo Diseño' : ''}
            >
              Diseño
            </button>
            <button
              type="button"
              className={mode === 'zones' ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode('zones')}
              aria-pressed={mode === 'zones'}
            >
              Zonas de impresión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ==========================================
 * Componente: Contenido Principal (Content)
 * ==========================================
 * Orquesta la lógica del hook, el header y la visualización
 * del canvas (ya sea Editor o de Áreas de Impresión).
 */
const AdminViewEditorContent = ({
  viewId,
  printAreas,
  initialLayers,
  currentColor,
  availableColors,
  onColorChange,
  onCopyToAllColors,
  onLayersChange,
  onPrintAreasChange,
  productImage,
  designOnly = false,
  noHeader = false,
}) => {
  const { activeViewId } = useEditor();
  const [mode, setMode] = useState('design');
  const sidebarId = `admin-sidebar-${viewId || activeViewId || 'default'}`;

  const { selectedColor, handleColorChange, seededRef, layersByView } =
    useEditorSeeding({
      activeViewId,
      currentColor,
      initialLayers,
      designOnly,
      onColorChange,
      onLayersChange,
    });

  const colorsToShow =
    availableColors && availableColors.length > 0
      ? ['default', ...availableColors]
      : ['default'];

  return (
    <div className={noHeader ? styles.designOnlyWrapper : styles.container}>
      {!noHeader && (
        <AdminViewEditorHeader
          colorsToShow={colorsToShow}
          selectedColor={selectedColor}
          handleColorChange={handleColorChange}
          onCopyToAllColors={onCopyToAllColors}
          layersByView={layersByView}
          activeViewId={activeViewId}
          seededRef={seededRef}
          mode={mode}
          setMode={setMode}
          designOnly={designOnly}
          productImage={productImage}
        />
      )}

      {!productImage ? (
        <div className={styles.placeholder}>
          <p>
            Sube una imagen de la vista para comenzar. En la misma vista podrás
            definir las zonas de impresión y añadir diseños (texto, imágenes, etc.).
          </p>
        </div>
      ) : (
        <>
          <div
            className={
              mode === 'design'
                ? styles.unifiedModePanel
                : styles.unifiedModePanelHidden
            }
            aria-hidden={mode !== 'design'}
          >
            <div className={styles.editorLayout}>
              <div className={styles.canvasSection}>
                <EditorCanvas
                  productImage={productImage}
                  printAreas={printAreas || []}
                  viewId={activeViewId}
                  initialLayers={initialLayers}
                  onLayersChange={onLayersChange}
                />
              </div>
              <div className={styles.toolbarSection}>
                <Toolbar />
              </div>
            </div>
          </div>

          <div
            className={
              mode === 'zones' && !designOnly
                ? styles.unifiedModePanel
                : styles.unifiedModePanelHidden
            }
            aria-hidden={mode !== 'zones' || designOnly}
          >
            <div className={styles.editorLayout}>
              <div className={styles.canvasSection}>
                <PrintAreasEditor
                  imageUrl={productImage}
                  printAreas={printAreas || []}
                  onChange={onPrintAreasChange}
                  controlsTargetId={sidebarId}
                />
              </div>
              <div className={styles.toolbarSection} id={sidebarId} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * ==========================================
 * Componente Raíz: AdminViewEditor
 * ==========================================
 * Provee el contexto del Editor. Utiliza una key única por producto 
 * para garantizar que el canvas sobreviva a los updates, pero 
 * se resetee al cambiar de vista o de producto.
 */
const AdminViewEditor = ({
  viewId,
  productImage,
  printAreas,
  initialLayersByColor,
  currentColor,
  availableColors,
  onColorChange,
  onCopyToAllColors,
  onLayersChange,
  onPrintAreasChange,
  designOnly = false,
  noHeader = false,
  productId = '',
}) => {
  const providerKey = designOnly
    ? `${productId || 'prod'}-${viewId || 'default-view'}-designonly`
    : `${productId || 'prod'}-${viewId || 'default-view'}`;

  return (
    <EditorProvider key={providerKey}>
      <AdminViewEditorContent
        viewId={viewId}
        productImage={productImage}
        printAreas={printAreas}
        initialLayers={initialLayersByColor}
        currentColor={currentColor}
        availableColors={availableColors}
        onColorChange={onColorChange}
        onCopyToAllColors={onCopyToAllColors}
        onLayersChange={onLayersChange}
        onPrintAreasChange={onPrintAreasChange}
        designOnly={designOnly}
        noHeader={noHeader}
      />
    </EditorProvider>
  );
};

export default AdminViewEditor;
