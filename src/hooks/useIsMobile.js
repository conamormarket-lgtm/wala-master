import { useState, useEffect } from 'react';

/**
 * Hook para detectar si el usuario está en móvil.
 * @param {number} breakpoint - Ancho máximo en píxeles para considerar "móvil" (por defecto 768px).
 * @returns {Object} { isMobile, isMobileDevice }
 */
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    
    // Llamada inicial por si el tamaño cambió antes de montar el componente
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  // Variable adicional para detectar estrictamente el dispositivo usando el User-Agent
  // Útil si quieres excluir tablets grandes o ventanas de PC reducidas.
  const isMobileDevice = typeof navigator !== 'undefined' 
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    : false;

  return { isMobile, isMobileDevice };
};

export default useIsMobile;
