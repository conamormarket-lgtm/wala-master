import { useState, useEffect, useRef, useCallback } from 'react';

// Tope de seguridad. El evento de cierre de la animación lo lanza un
// setTimeout, así que llega incluso con la pestaña en segundo plano, pero si
// por lo que sea no llegara, un modal bloqueado para siempre es mucho peor que
// uno que se desbloquea solo un poco tarde.
const TOPE_MS = 8000;

/**
 * ¿Se están entregando monedas ahora mismo?
 *
 * Sirve para que un modal que está acreditando un premio no se pueda cerrar a
 * media entrega: entre que el servidor confirma y las monedas terminan de volar
 * al contador hay un par de segundos, y cerrar ahí deja al usuario sin saber si
 * cobró o no.
 *
 * Se apoya en 'coins-animation-end', que dispara utils/animations al terminar
 * el vuelo. Devuelve `entregando` y las dos funciones para marcarlo.
 */
export const useEntregaMonedas = () => {
  const [entregando, setEntregando] = useState(false);
  const temporizador = useRef(null);

  const terminarEntrega = useCallback(() => {
    clearTimeout(temporizador.current);
    setEntregando(false);
  }, []);

  const empezarEntrega = useCallback(() => {
    setEntregando(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEntregando(false), TOPE_MS);
  }, []);

  useEffect(() => {
    window.addEventListener('coins-animation-end', terminarEntrega);
    return () => {
      window.removeEventListener('coins-animation-end', terminarEntrega);
      clearTimeout(temporizador.current);
    };
  }, [terminarEntrega]);

  return { entregando, empezarEntrega, terminarEntrega };
};

export default useEntregaMonedas;
