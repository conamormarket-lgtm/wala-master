import { useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useLocation } from 'react-router-dom';

/**
 * Hook para recolectar clics de mapa de calor y enviarlos a Firestore
 * @param {boolean} enabled - Si el tracking está activo
 * @param {number} batchSize - Cuántos clics agrupar antes de enviar
 */
// Si la app corre dentro de un iframe (preview del mapa de calor en el dashboard)
// NO registramos clics: evita doble-conteo y escrituras innecesarias en Firestore.
// (El efecto de sincronización de scroll de más abajo SÍ debe seguir activo dentro
// del iframe, ya que es justo lo que alimenta la preview del dashboard.)
const IN_IFRAME = (typeof window !== 'undefined') && window.self !== window.top;

export const useHeatmapTracker = (enabled = true, batchSize = 5) => {
  const location = useLocation();
  const clickBuffer = useRef([]);

  useEffect(() => {
    if (!enabled) return;
    if (IN_IFRAME) return;

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

      // Función auxiliar: limpia y recorta un texto para que sea legible
      const cleanLabel = (raw, max = 40) => {
        if (!raw) return '';
        return String(raw).replace(/\s+/g, ' ').trim().substring(0, max);
      };

      // Función auxiliar: identifica el elemento de forma LEGIBLE para humanos.
      // Sube por el DOM buscando el ancestro accionable (<a>/<button>/[role])
      // y prioriza texto visible, aria-label/title/alt y data-track sobre
      // etiquetas genéricas como 'svg'/'path'.
      const getElementIdentifier = (target) => {
        if (!target || !target.tagName) return 'Desconocido';

        // Si el clic cayó sobre un icono (svg/path/img sin texto), buscamos el
        // ancestro accionable más cercano para describir la ACCIÓN real.
        const actionable =
          (target.closest && target.closest('a, button, [role="button"], [data-track], [aria-label]')) || target;

        const el = actionable || target;
        const tag = el.tagName || target.tagName;

        // 1. data-track explícito (lo más fiable para el futuro)
        const dataTrack = el.getAttribute && el.getAttribute('data-track');
        if (dataTrack) return `[${tag}] ${cleanLabel(dataTrack)}`;

        // 2. Texto visible del elemento accionable o de su entorno cercano
        const directText = cleanLabel(el.innerText || el.textContent);
        if (directText) return `[${tag}] "${directText}"`;

        // 3. Atributos accesibles: aria-label / title / alt (en el elemento o hijo img)
        const aria =
          (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) ||
          (target.getAttribute && (target.getAttribute('aria-label') || target.getAttribute('title') || target.getAttribute('alt')));
        const imgAlt = el.querySelector && el.querySelector('img[alt]')?.getAttribute('alt');
        const label = cleanLabel(aria || imgAlt);
        if (label) return `[${tag}] ${label}`;

        // 4. ID como referencia técnica
        if (el.id) return `[${tag}] #${el.id}`;

        // 5. Clase principal (evitando volcar utilidades sin sentido)
        const cls = el.className;
        if (cls && typeof cls === 'string') {
          const mainClass = cls.split(' ').filter(Boolean)[0];
          if (mainClass) return `[${tag}] .${mainClass}`;
        }

        // 6. Último recurso: nunca dejar solo 'svg'/'path' si hay algo mejor arriba
        const upperText = cleanLabel(target.closest && target.closest('a, button, li, [class]')?.innerText);
        if (upperText) return `[${tag}] "${upperText}"`;

        return `[${tag}]`;
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
