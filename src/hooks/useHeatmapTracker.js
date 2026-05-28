import { useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useLocation } from 'react-router-dom';

/**
 * Hook para recolectar clics de mapa de calor y enviarlos a Firestore
 * @param {boolean} enabled - Si el tracking está activo
 * @param {number} batchSize - Cuántos clics agrupar antes de enviar
 */
export const useHeatmapTracker = (enabled = true, batchSize = 5) => {
  const location = useLocation();
  const clickBuffer = useRef([]);

  useEffect(() => {
    if (!enabled) return;

    const flushBuffer = async () => {
      if (clickBuffer.current.length === 0) return;
      if (!db) return;

      const eventsToSend = [...clickBuffer.current];
      clickBuffer.current = [];

      try {
        await addDoc(collection(db, 'heatmap_events'), {
          events: eventsToSend,
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        console.error('Error enviando datos de heatmap:', error);
      }
    };

    const handleClick = (e) => {
      // Ignorar clics si no tenemos base de datos configurada
      if (!db) return;

      // Obtener coordenadas relativas a la ventana gráfica (viewport)
      // También podríamos usar pageX/pageY para relativas al documento completo
      const eventData = {
        x: e.clientX,
        y: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        path: location.pathname,
        time: new Date().toISOString()
      };

      clickBuffer.current.push(eventData);

      // Si alcanzamos el tamaño del lote, enviamos a Firebase
      if (clickBuffer.current.length >= batchSize) {
        flushBuffer();
      }
    };

    document.addEventListener('click', handleClick);

    // Al desmontar o cambiar de página, enviamos los clics pendientes
    return () => {
      document.removeEventListener('click', handleClick);
      flushBuffer();
    };
  }, [enabled, location.pathname, batchSize]);

  return null;
};
