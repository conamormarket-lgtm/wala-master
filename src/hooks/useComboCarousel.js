import { useEffect, useState, useCallback } from 'react';

/**
 * Estado + controles de "carrusel" para la fila de piezas de un conjunto
 * (una tarjeta por sub-producto) que hace scroll-x. No mueve nada por sí
 * solo: solo lee la posición de scroll del elemento referenciado y expone
 * `goTo(i)` para que las flechas/puntos lo naveguen.
 *
 * @param {React.RefObject} scrollRef  ref del contenedor con overflow-x.
 * @param {number} itemCount           cantidad de tarjetas (piezas del combo).
 * @param {boolean} enabled            false en el modo miniatura (no hay nav ahí).
 */
export default function useComboCarousel(scrollRef, itemCount, enabled = true) {
  const [index, setIndex] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    if (!enabled || itemCount <= 1) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    const update = () => {
      const overflow = el.scrollWidth > el.clientWidth + 4;
      setCanScroll(overflow);
      setAtStart(el.scrollLeft <= 4);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
      const step = el.scrollWidth / itemCount;
      if (step > 0) {
        const next = Math.round(el.scrollLeft / step);
        setIndex(Math.max(0, Math.min(itemCount - 1, next)));
      }
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [scrollRef, itemCount, enabled]);

  const goTo = useCallback((i) => {
    const el = scrollRef.current;
    if (!el || itemCount <= 0) return;
    const clamped = Math.max(0, Math.min(itemCount - 1, i));
    const step = el.scrollWidth / itemCount;
    el.scrollTo({ left: step * clamped, behavior: 'smooth' });
  }, [scrollRef, itemCount]);

  return { index, canScroll, atStart, atEnd, goTo };
}
