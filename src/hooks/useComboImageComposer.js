import { useState, useEffect, useCallback, useRef } from 'react';
import { composeComboImage } from '../utils/comboImageComposer';

/**
 * Hook para generar imagen compuesta de combo en tiempo real
 * @param {Array} comboItems - Items del combo
 * @param {Object} comboLayout - Configuración de layout
 * @param {Object} canvasRefs - Objeto con referencias a los canvases { [itemIndex]: Fabric.Canvas }
 * @returns {Object} { composedImage: string | null, isGenerating: boolean, regenerate: function }
 */
export const useComboImageComposer = (comboItems, comboLayout, canvasRefs = {}) => {
  const [composedImage, setComposedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const debounceTimerRef = useRef(null);

  const regenerate = useCallback(async () => {
    if (isGenerating) return;

    // Obtener instancias de canvas válidas
    const canvasInstances = comboItems
      .map((item, index) => {
        const canvas = canvasRefs[index];
        if (!canvas) return null;
        return {
          canvas,
          scale: item.scale || 1
        };
      })
      .filter(Boolean);

    if (canvasInstances.length === 0) {
      setComposedImage(null);
      return;
    }

    setIsGenerating(true);
    try {
      const dataUrl = await composeComboImage(canvasInstances, comboLayout);
      setComposedImage(dataUrl);
    } catch (error) {
      console.error('Error al generar imagen compuesta:', error);
      setComposedImage(null);
    } finally {
      setIsGenerating(false);
    }
  }, [comboItems, comboLayout, canvasRefs, isGenerating]);

  // Regenerar automáticamente cuando cambian los items o layout (con debounce)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      regenerate();
    }, 500); // Debounce de 500ms

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [comboItems, comboLayout, regenerate]);

  return {
    composedImage,
    isGenerating,
    regenerate
  };
};
