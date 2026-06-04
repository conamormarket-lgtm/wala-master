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

      // Función auxiliar para identificar el elemento
      const getElementIdentifier = (target) => {
        if (!target) return 'Desconocido';
        
        // 1. Si tiene ID, es lo más exacto
        if (target.id) return `[${target.tagName}] #${target.id}`;
        
        // 2. Si tiene data-track (ideal para el futuro)
        if (target.getAttribute('data-track')) return `[${target.tagName}] ${target.getAttribute('data-track')}`;
        
        // 3. Buscar si es un botón o enlace con texto
        const text = target.innerText || target.textContent;
        const cleanText = text ? text.trim().substring(0, 30).replace(/\n/g, ' ') : '';
        
        if (cleanText) {
          return `[${target.tagName}] "${cleanText}"`;
        }
        
        // 4. Si no tiene texto pero tiene clases
        if (target.className && typeof target.className === 'string') {
          const mainClass = target.className.split(' ')[0];
          if (mainClass) return `[${target.tagName}] .${mainClass}`;
        }
        
        return `[${target.tagName}]`;
      };

      const elementInfo = getElementIdentifier(e.target);

      // Obtener coordenadas relativas a la ventana gráfica (viewport)
      const eventData = {
        x: e.clientX,
        y: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        path: location.pathname,
        elementInfo: elementInfo,
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

  // Sincronización para el Dashboard (Scroll completo)
  useEffect(() => {
    if (window.self !== window.top) {
      const sendState = () => {
        const height = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight
        );
        window.parent.postMessage({ 
          type: 'WALA_HEATMAP_SYNC', 
          height,
          scrollTop: window.scrollY || document.documentElement.scrollTop 
        }, '*');
      };

      setTimeout(sendState, 500);

      const observer = new ResizeObserver(() => sendState());
      observer.observe(document.body);

      window.addEventListener('scroll', sendState, { passive: true });

      return () => {
        observer.disconnect();
        window.removeEventListener('scroll', sendState);
      };
    }
  }, [location.pathname]);

  return null;
};
