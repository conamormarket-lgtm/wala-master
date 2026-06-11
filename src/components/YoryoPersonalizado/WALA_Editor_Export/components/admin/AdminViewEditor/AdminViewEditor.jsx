import React, { useEffect, useState, useRef, useCallback } from 'react';
import { EditorProvider, useEditor } from '../../../contexts/EditorContext';
import EditorCanvas from '../../editor/EditorCanvas/EditorCanvas';
import Toolbar from '../../editor/Toolbar/Toolbar';
import PrintAreasEditor from '../PrintAreasEditor/PrintAreasEditor';
import styles from './AdminViewEditor.module.css';

const AdminViewEditorContent = ({
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
  const { layersByView, activeViewId, setLayersForView } = useEditor();
  const [mode, setMode] = useState('design');
  const [designEverActivated] = useState(true);
  const [selectedColor, setSelectedColor] = useState(currentColor || 'default');

  // Set of "viewId_color" combos that have been seeded from initialLayers.
  // Once seeded we NEVER overwrite from parent props again.
  const seededRef = useRef(new Set());

  // Number of renders to suppress onLayersChange after a seed operation.
  // We skip the next render cycle after seeding so the first echo back to the
  // parent (which would re-trigger the seed guard) is ignored.
  const suppressNotifyCountRef = useRef(0);

  const switchToMode = (m) => setMode(m);

  // Sync selected color when parent changes it
  useEffect(() => {
    if (currentColor && currentColor !== selectedColor) {
      setSelectedColor(currentColor);
    }
  }, [currentColor]);

  const seededDesignViewsRef = useRef(new Set());

  // Seed the canvas layers ONCE per (activeViewId + color)
  useEffect(() => {
    const colorKey = selectedColor || 'default';
    const seedKey = `${activeViewId}_${colorKey}`;

    if (seededRef.current.has(seedKey)) return;

    // When designOnly (e.g. EditorPage for user customizing), we only EVER seed once per vista (Front, Back, etc.).
    // If the user deletes all layers on Front, switching color should not bring back admin defaults!
    if (designOnly && seededDesignViewsRef.current.has(activeViewId)) {
      seededRef.current.add(seedKey);
      return;
    }

    const rawLayers = initialLayers?.[colorKey] ?? (Array.isArray(initialLayers) ? initialLayers : []);
    const layers = Array.isArray(rawLayers) ? JSON.parse(JSON.stringify(rawLayers)) : [];

    // Suppress the echo back to the parent caused by this initialization
    suppressNotifyCountRef.current += 2; // 2 render cycles: set + effect firing
    setLayersForView(activeViewId, layers);
    seededRef.current.add(seedKey);
    seededDesignViewsRef.current.add(activeViewId);
  }, [selectedColor, activeViewId, initialLayers, setLayersForView, designOnly, layersByView]);

  // Propagate canvas changes UP to parent — but skip the seed echo cycles
  useEffect(() => {
    if (suppressNotifyCountRef.current > 0) {
      suppressNotifyCountRef.current -= 1;
      return;
    }

    const colorKey = selectedColor || 'default';
    const seedKey = `${activeViewId}_${colorKey}`;
    if (!seededRef.current.has(seedKey)) return; // not yet seeded, skip

    const currentLayers = layersByView[activeViewId] ?? [];
    if (onLayersChange) {
      onLayersChange(selectedColor, currentLayers);
    }
  }, [layersByView, activeViewId, selectedColor, onLayersChange]);

  const handleColorChange = useCallback((color) => {
    setSelectedColor(color);
    if (onColorChange) onColorChange(color);
  }, [onColorChange]);

  const colorsToShow = availableColors && availableColors.length > 0
    ? ['default', ...availableColors]
    : ['default'];

  return (
    <div className={noHeader ? styles.designOnlyWrapper : styles.container}>
      {!noHeader && (
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
                  {colorsToShow.map(color => (
                    <option key={color} value={color}>
                      {color === 'default' ? 'Sin color específico' : color}
                    </option>
                  ))}
                </select>

                {onCopyToAllColors && (
                  <button
                    type="button"
                    className={styles.copyToAllBtn}
                    onClick={() => {
                      // Solo copiar las capas de la vista activa y color actual
                      const currentLayers = layersByView[activeViewId] || [];
                      if (window.confirm(`¿Deseas aplicar el diseño actual (${currentLayers.length} capas) a TODAS las demás variaciones de color? (Las capas de cada variación quedarán independientes para que puedas cambiar su tintado después).`)) {
                        seededRef.current.clear();
                        seededRef.current.add(`${activeViewId}_${selectedColor || 'default'}`); // Mantener como seeded el color que copiamos

                        // Enviar las dimensiones del source canvas para permitir escalado proporcional perfecto
                        const sourceDims = window.__FABRIC_CANVAS_DIMS?.[activeViewId] || {};
                        onCopyToAllColors(currentLayers, sourceDims);
                      }
                    }}
                    title="Copiar diseño actual a todas las variaciones"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span className={styles.copyToAllText}>Copiar a todos</span>
                  </button>
                )}
              </div>
            )}
            {productImage && !designOnly && (
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={mode === 'design' ? styles.modeBtnActive : styles.modeBtn}
                  onClick={() => switchToMode('design')}
                  aria-pressed={mode === 'design'}
                >
                  Diseño
                </button>
                <button
                  type="button"
                  className={mode === 'zones' ? styles.modeBtnActive : styles.modeBtn}
                  onClick={() => switchToMode('zones')}
                  aria-pressed={mode === 'zones'}
                >
                  Zonas de impresión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!productImage ? (
        <div className={styles.placeholder}>
          <p>Sube una imagen de la vista para comenzar. En la misma vista podrás definir las zonas de impresión y añadir diseños (texto, imágenes, etc.).</p>
        </div>
      ) : (
        <>
          {designEverActivated && (
            <div
              className={mode === 'design' ? styles.unifiedModePanel : styles.unifiedModePanelHidden}
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
          )}

          <div
            className={mode === 'zones' && !designOnly ? styles.unifiedModePanel : styles.unifiedModePanelHidden}
            aria-hidden={mode !== 'zones' || designOnly}
          >
            <div className={styles.editorLayout}>
              <div className={styles.canvasSection}>
                <PrintAreasEditor
                  imageUrl={productImage}
                  printAreas={printAreas || []}
                  onChange={onPrintAreasChange}
                  controlsTargetId="admin-sidebar"
                />
              </div>
              <div className={styles.toolbarSection} id="admin-sidebar" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * AdminViewEditor
 *
 * The EditorProvider is keyed by viewId so it is NEVER remounted when the
 * parent (AdminProductoForm) re-renders due to unrelated state changes.
 * This means the Fabric.js canvas, layer state, history, etc. all survive
 * parent re-renders without resetting.
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
  const content = (
    <AdminViewEditorContent
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
  );

  if (designOnly) {
    return content;
  }

  return (
    <EditorProvider key={`${productId || 'prod'}-${viewId || 'default-view'}`}>
      {content}
    </EditorProvider>
  );
};

export default AdminViewEditor;
