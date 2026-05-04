import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '../../../contexts/EditorContext';
import { useAuth } from '../../../contexts/AuthContext';
import TextEditor from '../TextEditor';
import ImageUploader from '../ImageUploader';
import ImageProperties from '../ImageProperties';
import ColorPicker from '../ColorPicker';
import ClipartSelector from '../ClipartSelector';
import styles from './Toolbar.module.css';

const SHAPE_OPTIONS = [
  { type: 'rectangle', label: 'Rectángulo', icon: '▭' },
  { type: 'circle', label: 'Círculo', icon: '●' },
  { type: 'triangle', label: 'Triángulo', icon: '△' },
];

const Toolbar = ({ isComboMode = false }) => {
  const { addLayer, updateLayer, transferLayer, getDefaultPositionInPrintArea, selectedLayer, layers, setSelectedLayer, removeLayer, reorderLayers, activePrintAreaId, setActivePrintAreaId, product, activeViewId } = useEditor();
  const { isAdmin } = useAuth();
  const [showShapesAndImagesPanel, setShowShapesAndImagesPanel] = useState(false);

  // Mobile state
  const [mobileTab, setMobileTab] = useState('add');
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  const defaultPos = getDefaultPositionInPrintArea();

  const currentView = product?.customizationViews?.find(v => v.id === activeViewId) ||
    (product?.customizationViews?.[0]) || null;
  const printAreas = currentView?.printAreas || [];
  const hasMultipleZones = printAreas.length > 1;

  const handleAddText = () => {
    addLayer(undefined, {
      type: 'text',
      text: 'Nuevo Texto',
      fontSize: 40,
      color: '#000000',
      fontFamily: 'Waltograph',
      x: defaultPos.x,
      y: defaultPos.y,
    });
  };

  const handleAddShape = (shapeType) => {
    addLayer(undefined, {
      type: 'shape',
      shapeType,
      x: defaultPos.x,
      y: defaultPos.y,
      fill: '#000000',
      ...(shapeType === 'rectangle' && { width: 80, height: 60 }),
      ...(shapeType === 'circle' && { radius: 40 }),
    });
  };

  const selectedLayerData = selectedLayer ? layers.find((l) => l.id === selectedLayer) : null;

  const toggleMobileTab = (tab) => {
    if (mobileTab === tab && isMobilePanelOpen) {
      setIsMobilePanelOpen(false);
    } else {
      setMobileTab(tab);
      setIsMobilePanelOpen(true);
    }
  };

  const renderActiveZoneSelector = () => (
    <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', paddingBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', fontWeight: 600 }}>Zona Activa</h3>
      <select
        value={activePrintAreaId || printAreas[0]?.id || ''}
        onChange={(e) => setActivePrintAreaId(activeViewId, e.target.value)}
        className={styles.zoneSelector}
      >
        {printAreas.map((area, index) => (
          <option key={area.id} value={area.id}>
            Zona {index + 1} {area.shape === 'rectangle' ? '(Rectángulo)' :
              area.shape === 'circle' ? '(Círculo)' :
                area.shape === 'heart' ? '(Corazón)' :
                  area.shape === 'custom' ? '(Personalizada)' : ''}
          </option>
        ))}
      </select>
      <p className={styles.zoneHint} style={{ display: 'none' }}>
        Los nuevos elementos se añadirán a la zona seleccionada
      </p>
    </div>
  );

  return (
    <div className={styles.toolbar}>
      {/* ─────────────────────────────────────────────
          VERSIÓN DESKTOP (sidebar clásico o bloque secuencial)
          ───────────────────────────────────────────── */}
      <div className={`${styles.desktopOnly} ${isComboMode ? styles.forceDesktop : ''}`}>
        {hasMultipleZones && (
          <div className={styles.section}>
            <h3>Zona Activa</h3>
            <select
              value={activePrintAreaId || printAreas[0]?.id || ''}
              onChange={(e) => setActivePrintAreaId(activeViewId, e.target.value)}
              className={styles.zoneSelector}
            >
              {printAreas.map((area, index) => (
                <option key={area.id} value={area.id}>
                  Zona {index + 1} {area.shape === 'rectangle' ? '(Rectángulo)' :
                    area.shape === 'circle' ? '(Círculo)' :
                      area.shape === 'heart' ? '(Corazón)' :
                        area.shape === 'custom' ? '(Personalizada)' : ''}
                </option>
              ))}
            </select>
            <p className={styles.zoneHint}>
              Los nuevos elementos se añadirán a la zona seleccionada
            </p>
          </div>
        )}
        <div className={styles.section}>
          <h3>Herramientas</h3>
          <button type="button" onClick={handleAddText} className={styles.toolButton}>
            Nuevo texto
          </button>
          <ImageUploader
            label="Subir foto"
            productId={product?.id}
            isAdmin={isAdmin}
            onImageSelect={(src) => addLayer(undefined, {
              type: 'image',
              src,
              x: defaultPos.x,
              y: defaultPos.y,
              scaleX: 1,
              scaleY: 1,
            })}
            onUploadComplete={(url, layerId) => updateLayer(undefined, layerId, { src: url })}
          />
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setShowShapesAndImagesPanel((v) => !v)}
          >
            Imagen y formas
          </button>
          {showShapesAndImagesPanel && (
            <div className={styles.shapesAndImagesPanel}>
              <div className={styles.panelSection}>
                <h4 className={styles.subTitle}>Formas</h4>
                <div className={styles.shapeRow}>
                  {SHAPE_OPTIONS.map((s) => (
                    <button
                      key={s.type}
                      type="button"
                      onClick={() => handleAddShape(s.type)}
                      className={styles.toolButton}
                      title={s.label}
                    >
                      {s.icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.panelSection}>
                <h4 className={styles.subTitle}>Imágenes</h4>
                <ClipartSelector />
              </div>
            </div>
          )}
        </div>

        {selectedLayer && selectedLayerData && (
          <div className={styles.section}>
            <h3>Propiedades</h3>
            {selectedLayerData.type === 'text' && (
              <>
                <TextEditor layerId={selectedLayer} />
                <ColorPicker layerId={selectedLayer} />
              </>
            )}
            {selectedLayerData.type === 'image' && (
              <>
                <ImageProperties layerId={selectedLayer} />
              </>
            )}
            {selectedLayerData.type === 'shape' && (
              <ColorPicker layerId={selectedLayer} fillKey="fill" />
            )}
            <button
              type="button"
              className={styles.deleteLayerBtn}
              onClick={() => removeLayer(undefined, selectedLayer)}
            >
              Eliminar capa
            </button>
          </div>
        )}

        <div className={styles.section}>
          <h3>Capas ({layers.length})</h3>
          <div className={styles.layersList}>
            {layers.map((layer, index) => {
              const isFallbackView = activeViewId.startsWith('combo-fallback-');
              let otherViewId = null;
              if (isFallbackView) {
                const parts = activeViewId.split('-');
                if (parts.length >= 4) {
                  const itemIndex = parts[2];
                  const newIndex = itemIndex === '0' ? '1' : '0';
                  otherViewId = ['combo', 'fallback', newIndex, ...parts.slice(3)].join('-');
                }
              }

              return (
                <div
                  key={layer.id}
                  className={`${styles.layerItem} ${selectedLayer === layer.id ? styles.active : ''}`}
                  onClick={() => setSelectedLayer(layer.id)}
                >
                  <div className={styles.layerInfo}>
                    <span className={styles.layerLabel}>
                      {layer.type === 'text' && '📝'}
                      {layer.type === 'image' && '🖼️'}
                      {layer.type === 'shape' && '◆'}
                      {' '}{layer.type} {index + 1}
                    </span>
                  </div>
                  <div className={styles.layerActions} onClick={(e) => e.stopPropagation()}>
                    {otherViewId && (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        title="Pasar al otro producto"
                        onClick={() => transferLayer(layer.id, activeViewId, otherViewId)}
                      >
                        ⇄
                      </button>
                    )}
                    <div className={styles.layerReorder}>
                      <button
                        type="button"
                        className={styles.reorderBtn}
                        title="Subir"
                        disabled={index === 0}
                        onClick={() => reorderLayers(activeViewId, index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.reorderBtn}
                        title="Bajar"
                        disabled={index === layers.length - 1}
                        onClick={() => reorderLayers(activeViewId, index, index + 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          VERSIÓN MOBILE (Bottom Sheet & Tab Bar)
          ───────────────────────────────────────────── */}
      {!isComboMode && createPortal(
        <div className={`${styles.mobileOnly} ${isComboMode ? styles.comboMobileOnly : ''}`}>
          {isMobilePanelOpen && (
            <div className={styles.mobilePanel}>
              {mobileTab === 'add' && (
                <>
                  {hasMultipleZones && renderActiveZoneSelector()}
                  <div className={styles.mobilePanelContent}>
                    <button type="button" onClick={() => { handleAddText(); setIsMobilePanelOpen(false); }} className={styles.mobilePanelBtn}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 28, height: 28 }}>
                        <path d="M4 7V4h16v3M9 20h6M12 4v16" strokeWidth={2} />
                      </svg>
                      Texto
                    </button>
                    <div className={styles.mobilePanelBtn} style={{ padding: 0, justifyContent: 'center', position: 'relative' }}>
                      <ImageUploader
                        label="Subir foto"
                        productId={product?.id}
                        isAdmin={isAdmin}
                        onImageSelect={(src) => {
                          const id = addLayer(undefined, {
                            type: 'image',
                            src,
                            x: defaultPos.x,
                            y: defaultPos.y,
                            scaleX: 1,
                            scaleY: 1,
                          });
                          setIsMobilePanelOpen(false);
                          return id;
                        }}
                        onUploadComplete={(url, layerId) => updateLayer(undefined, layerId, { src: url })}
                      />
                    </div>
                    {SHAPE_OPTIONS.map((s) => (
                      <button key={s.type} type="button" onClick={() => { handleAddShape(s.type); setIsMobilePanelOpen(false); }} className={styles.mobilePanelBtn}>
                        <span style={{ fontSize: '24px' }}>{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {mobileTab === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!selectedLayer && (
                    <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem 0', fontWeight: 500 }}>
                      Selecciona una capa primero para editarla
                    </p>
                  )}
                  {selectedLayer && selectedLayerData && (
                    <>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                        Propiedades de {selectedLayerData.type === 'text' ? 'Texto' : selectedLayerData.type === 'image' ? 'Imagen' : 'Forma'}
                      </h3>
                      {selectedLayerData.type === 'text' && (
                        <>
                          <TextEditor layerId={selectedLayer} />
                          <ColorPicker layerId={selectedLayer} />
                        </>
                      )}
                      {selectedLayerData.type === 'image' && (
                        <ImageProperties layerId={selectedLayer} />
                      )}
                      {selectedLayerData.type === 'shape' && (
                        <ColorPicker layerId={selectedLayer} fillKey="fill" />
                      )}
                      <button
                        type="button"
                        className={styles.deleteLayerBtn}
                        style={{ marginTop: '0.5rem', background: '#fee2e2', color: '#dc2626', border: 'none', fontWeight: 600 }}
                        onClick={() => { removeLayer(undefined, selectedLayer); setIsMobilePanelOpen(false); }}
                      >
                        🗑️ Eliminar capa
                      </button>
                    </>
                  )}
                </div>
              )}

              {mobileTab === 'layers' && (
                <div className={styles.layersList}>
                  {hasMultipleZones && renderActiveZoneSelector()}
                  {layers.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem 0' }}>No hay capas aún.</p>
                  )}
                  {layers.map((layer, index) => {
                    const isFallbackView = activeViewId.startsWith('combo-fallback-');
                    let otherViewId = null;
                    if (isFallbackView) {
                      const parts = activeViewId.split('-');
                      if (parts.length >= 4) {
                        const itemIndex = parts[2];
                        const newIndex = itemIndex === '0' ? '1' : '0';
                        otherViewId = ['combo', 'fallback', newIndex, ...parts.slice(3)].join('-');
                      }
                    }

                    return (
                      <div
                        key={layer.id}
                        className={`${styles.layerItem} ${selectedLayer === layer.id ? styles.active : ''}`}
                        onClick={() => { setSelectedLayer(layer.id); setIsMobilePanelOpen(false); setMobileTab('edit'); }}
                      >
                        <div className={styles.layerInfo}>
                          <span className={styles.layerLabel}>
                            {layer.type === 'text' && '📝'}
                            {layer.type === 'image' && '🖼️'}
                            {layer.type === 'shape' && '◆'}
                            {' '}{layer.type} {index + 1}
                          </span>
                        </div>
                        <div className={styles.layerActions} onClick={(e) => e.stopPropagation()}>
                          {otherViewId && (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => transferLayer(layer.id, activeViewId, otherViewId)}
                            >
                              ⇄
                            </button>
                          )}
                          <div className={styles.layerReorder}>
                            <button
                              type="button"
                              className={styles.reorderBtn}
                              disabled={index === 0}
                              onClick={() => reorderLayers(activeViewId, index, index - 1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={styles.reorderBtn}
                              disabled={index === layers.length - 1}
                              onClick={() => reorderLayers(activeViewId, index, index + 1)}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className={styles.mobileTabBar}>
            <button onClick={() => toggleMobileTab('add')} className={`${styles.mobileTab} ${mobileTab === 'add' && isMobilePanelOpen ? styles.mobileTabActive : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Añadir
            </button>
            <button onClick={() => toggleMobileTab('edit')} className={`${styles.mobileTab} ${mobileTab === 'edit' && isMobilePanelOpen ? styles.mobileTabActive : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Editar
            </button>
            <button onClick={() => toggleMobileTab('layers')} className={`${styles.mobileTab} ${mobileTab === 'layers' && isMobilePanelOpen ? styles.mobileTabActive : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Capas ({layers.length})
            </button>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default Toolbar;
