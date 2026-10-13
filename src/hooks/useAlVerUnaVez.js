import { useEffect, useState } from 'react';

const menosMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * true la primera vez que el elemento se ve en pantalla (y ya no vuelve a
 * false). Para animar algo UNA vez al llegar a él, también en el celular,
 * donde no hay hover: las prendas de un combo se mueven al aparecer.
 * Sin animación si el sistema pide menos movimiento.
 */
export const useAlVerUnaVez = (ref) => {
  const [visto, setVisto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visto || menosMovimiento() || typeof IntersectionObserver === 'undefined') return undefined;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas[0]?.isIntersecting) {
        setVisto(true);
        observador.disconnect();
      }
    }, { threshold: 0.5 });
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref, visto]);

  return visto;
};

export default useAlVerUnaVez;
