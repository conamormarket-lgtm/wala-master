import { useEffect } from 'react';

// Ventanas abiertas a la vez (una puede abrir otra): el scroll se devuelve
// recién cuando se cierra la última.
let abiertas = 0;
let previo = null;

/**
 * Congela el scroll de la página mientras `activo` (modales, cajones…).
 *
 * Se bloquea en <html>, no en <body>: con `html { overflow-x: clip }`
 * (styles/globals.css) el overflow del body ya no pasa a la ventana, así
 * que `body.style.overflow = 'hidden'` dejaba la página moviéndose detrás.
 */
export const useBloquearScroll = (activo = true) => {
  useEffect(() => {
    if (!activo) return undefined;
    if (abiertas === 0) {
      const html = document.documentElement;
      // Sin la barra de scroll el contenido se correría a la derecha.
      const barra = window.innerWidth - html.clientWidth;
      previo = { overflow: html.style.overflow, padding: document.body.style.paddingRight };
      html.style.overflow = 'hidden';
      if (barra > 0) document.body.style.paddingRight = `${barra}px`;
    }
    abiertas += 1;
    return () => {
      abiertas -= 1;
      if (abiertas === 0 && previo) {
        document.documentElement.style.overflow = previo.overflow;
        document.body.style.paddingRight = previo.padding;
        previo = null;
      }
    };
  }, [activo]);
};

export default useBloquearScroll;
