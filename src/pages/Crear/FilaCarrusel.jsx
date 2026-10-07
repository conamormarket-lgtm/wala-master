import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './FilaCarrusel.module.css';

/**
 * Fila deslizable de tarjetas (Tus borradores / Tus creaciones), con el mismo
 * aire que los carruseles de productos del builder (FeaturedCarousel): un
 * número fijo de tarjetas enteras por vista, sin barra de scroll y flechas
 * redondas centradas sobre la foto. En el celular se pasa con el dedo.
 *
 * `children` son los <li> de las tarjetas; `className` va en el <ul> (así
 * `.fila > .tarjeta` de quien la usa sigue funcionando).
 */
const FilaCarrusel = ({ children, className = '' }) => {
  const filaRef = useRef(null);
  const [puedeAtras, setPuedeAtras] = useState(false);
  const [puedeAdelante, setPuedeAdelante] = useState(false);
  // Alto al que van las flechas: la mitad de la foto (cuadrada, arriba de la
  // tarjeta), no la mitad de la tarjeta entera.
  const [altoFlecha, setAltoFlecha] = useState(null);
  const cantidad = React.Children.count(children);

  const actualizar = useCallback(() => {
    const el = filaRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // 4px de margen por los redondeos de subpíxeles.
    setPuedeAtras(scrollLeft > 4);
    setPuedeAdelante(scrollLeft + clientWidth < scrollWidth - 4);
    const primera = el.firstElementChild;
    // offsetTop cuenta desde .marco (el ancestro posicionado).
    if (primera) setAltoFlecha(primera.offsetTop + primera.offsetWidth / 2);
  }, []);

  useLayoutEffect(actualizar, [actualizar, cantidad]);

  useEffect(() => {
    const el = filaRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    return () => {
      el.removeEventListener('scroll', actualizar);
      window.removeEventListener('resize', actualizar);
    };
  }, [actualizar]);

  // Avanza una tarjeta (su ancho + el espacio entre tarjetas).
  const mover = (sentido) => {
    const el = filaRef.current;
    const primera = el?.firstElementChild;
    if (!primera) return;
    const espacio = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: sentido * (primera.offsetWidth + espacio), behavior: 'smooth' });
  };

  return (
    <div
      className={styles.marco}
      style={altoFlecha != null ? { '--alto-flecha': `${altoFlecha}px` } : undefined}
    >
      <button
        type="button"
        className={`${styles.flecha} ${styles.atras}`}
        onClick={() => mover(-1)}
        disabled={!puedeAtras}
        aria-label="Anterior"
      >
        <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <ul ref={filaRef} className={`${styles.fila} ${className}`}>
        {children}
      </ul>

      <button
        type="button"
        className={`${styles.flecha} ${styles.adelante}`}
        onClick={() => mover(1)}
        disabled={!puedeAdelante}
        aria-label="Siguiente"
      >
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
};

export default FilaCarrusel;
