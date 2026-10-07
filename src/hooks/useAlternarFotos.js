import { useEffect, useState } from 'react';

const sinHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;
const menosMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Tarjeta con dos fotos (frente y espalda): en escritorio la segunda se ve
 * al pasar el mouse (CSS :hover). En el celular no hay hover, así que la
 * tarjeta alterna sola entre las dos mientras está en pantalla, como las
 * tarjetas de producto de la tienda (PremiumProductCard). Devuelve true
 * cuando toca mostrar la segunda.
 *
 * `ref` es un elemento de la tarjeta (para saber si se ve) y `activo`,
 * si de verdad hay segunda foto.
 */
export const useAlternarFotos = (ref, activo) => {
  const [segunda, setSegunda] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!activo || !el || !sinHover() || typeof IntersectionObserver === 'undefined') return undefined;
    const observador = new IntersectionObserver(
      (entradas) => setVisible(entradas[0]?.isIntersecting ?? false),
      { threshold: 0.5 }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref, activo]);

  useEffect(() => {
    if (!activo || !visible || menosMovimiento()) {
      setSegunda(false);
      return undefined;
    }
    const id = setInterval(() => setSegunda((v) => !v), 2200);
    return () => clearInterval(id);
  }, [activo, visible]);

  return segunda;
};

export default useAlternarFotos;
