import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '../../../contexts/EditorContext';
import { useDesignClipboard } from '../../../contexts/DesignClipboardContext';
import styles from './MobileFloatingTools.module.css';

const MobileFloatingTools = () => {
  const {
    handleUndo, handleRedo, canUndo, canRedo,
    selectedLayer, layersByView, activeViewId,
    addLayer
  } = useEditor();

  const { globalClipboard, copyLayers } = useDesignClipboard();
  const [isOpen, setIsOpen] = useState(false);

  const layers = layersByView[activeViewId] || [];
  const hasSelection = !!selectedLayer;
  const canPaste = globalClipboard && globalClipboard.length > 0;

  const onCopy = () => {
    if (!hasSelection) return;
    const layerData = layers.find(l => l.id === selectedLayer);
    if (layerData) {
      copyLayers([layerData]);
      setIsOpen(false);
    }
  };

  const onPaste = () => {
    if (!canPaste) return;
    globalClipboard.forEach(layer => {
      // Un pequeño offset para que no quede exactamente encima
      const newLayer = { ...layer, x: (layer.x || 10) + 15, y: (layer.y || 10) + 15 };
      addLayer(undefined, newLayer);
    });
    setIsOpen(false);
  };

  const onDuplicate = () => {
    if (!hasSelection) return;
    const layerData = layers.find(l => l.id === selectedLayer);
    if (layerData) {
      // Copia superficial ignorando el ID
      const { id, ...rest } = layerData;
      const newLayer = { ...rest, x: (rest.x || 10) + 15, y: (rest.y || 10) + 15 };
      addLayer(undefined, newLayer);
    }
    setIsOpen(false);
  };

  return (
    <div className={styles.container}>
      <button
        className={`${styles.fab} ${isOpen ? styles.fabActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Herramientas"
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        )}
      </button>

      <div className={`${styles.menu} ${isOpen ? styles.open : ''}`}>
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className={styles.toolBtn}
          title="Deshacer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className={styles.toolBtn}
          title="Rehacer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
        </button>

        <div className={styles.divider} />

        <button
          onClick={onCopy}
          disabled={!hasSelection}
          className={styles.toolBtn}
          title="Copiar (Requiere selección)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
        </button>
        <button
          onClick={onPaste}
          disabled={!canPaste}
          className={styles.toolBtn}
          title="Pegar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </button>
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          className={styles.toolBtn}
          title="Duplicar (Requiere selección)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
      </div>
    </div>
  );
};

export default MobileFloatingTools;
