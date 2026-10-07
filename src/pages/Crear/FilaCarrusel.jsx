import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './FilaCarrusel.module.css';

/**
 * Fila deslizable de tarjetas (Tus borradores / Tus creaciones), con el mismo
 * aire que los carruseles de productos del builder (FeaturedCarousel): un
 * número fijo de tarjetas enteras por vista, sin barra de scroll y flechas
 * redondas centradas sobre la foto. En el celular se pasa con el dedo; en
 * escritorio también se puede agarrar y arrastrar con el mouse.
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

  // Ancho de un paso: una tarjeta más el espacio entre tarjetas.
  const paso = () => {
    const el = filaRef.current;
    const primera = el?.firstElementChild;
    if (!primera) return 0;
    return primera.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
  };

  // Avanza una tarjeta.
  const mover = (sentido) => {
    filaRef.current?.scrollBy({ left: sentido * paso(), behavior: 'smooth' });
  };

  // Arrastrar con el mouse (en touch el scroll nativo ya lo hace). Mientras
  // se arrastra se apagan el imán a cada tarjeta y el scroll suave (si no,
  // pelean con el movimiento); al soltar queda en la tarjeta más cercana.
  // Si hubo arrastre, el clic de soltar no abre la tarjeta.
  useEffect(() => {
    const el = filaRef.current;
    if (!el) return undefined;
    let abajo = false;
    let arrastrando = false;
    let inicioX = 0;
    let inicioScroll = 0;

    const alBajar = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      abajo = true;
      arrastrando = false;
      inicioX = e.clientX;
      inicioScroll = el.scrollLeft;
    };
    const alMover = (e) => {
      if (!abajo) return;
      const dx = e.clientX - inicioX;
      if (!arrastrando && Math.abs(dx) < 6) return;
      if (!arrastrando) {
        arrastrando = true;
        el.classList.add(styles.arrastrando);
      }
      el.scrollLeft = inicioScroll - dx;
    };
    const alSoltar = () => {
      if (!abajo) return;
      abajo = false;
      if (!arrastrando) return;
      // A la tarjeta más cercana. El imán vuelve recién cuando termina ese
      // movimiento: si vuelve antes, lo corta a mitad de camino.
      const relleno = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
      const destinos = [...el.children].map((li) => li.offsetLeft - relleno);
      const destino = destinos.reduce((a, b) => (Math.abs(b - el.scrollLeft) < Math.abs(a - el.scrollLeft) ? b : a), 0);
      const reactivar = () => el.classList.remove(styles.arrastrando);
      el.addEventListener('scrollend', reactivar, { once: true });
      setTimeout(reactivar, 700);
      el.scrollTo({ left: destino, behavior: 'smooth' });
      // El clic llega justo después de soltar: se descarta y se libera.
      setTimeout(() => { arrastrando = false; }, 0);
    };
    const alClic = (e) => {
      if (arrastrando) { e.preventDefault(); e.stopPropagation(); }
    };
    // Sin esto el navegador arrastra la foto o el enlace en vez de la fila.
    const sinArrastreNativo = (e) => e.preventDefault();

    el.addEventListener('pointerdown', alBajar);
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
    el.addEventListener('click', alClic, true);
    el.addEventListener('dragstart', sinArrastreNativo);
    return () => {
      el.removeEventListener('pointerdown', alBajar);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
      el.removeEventListener('click', alClic, true);
      el.removeEventListener('dragstart', sinArrastreNativo);
    };
  }, []);

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
