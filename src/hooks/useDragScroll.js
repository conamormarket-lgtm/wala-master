import { useEffect } from 'react';

/**
 * Arrastre horizontal con el mouse sobre un elemento que ya hace scroll-x
 * (overflow-x: auto) por CSS. Mismo patrón que
 * `components/common/DraggableContainer`, pero reutilizable sobre un ref
 * que el propio componente ya necesita para otra cosa (p.ej. un
 * IntersectionObserver), sin tener que envolverlo en un div nuevo.
 *
 * En touch/trackpad el scroll nativo ya funciona solo con overflow-x:auto;
 * esto solo añade el "agarrar y arrastrar" para mouse de escritorio.
 */
export default function useDragScroll(ref, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    let isDown = false;
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e) => {
      isDown = true;
      isDragging = false;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };
    const onMouseLeave = () => { isDown = false; };
    const onMouseUp = () => { isDown = false; };
    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5; // velocidad
      if (Math.abs(walk) > 5) isDragging = true;
      el.scrollLeft = scrollLeft - walk;
    };
    // Si hubo arrastre real, se cancela el click que dispararía (p.ej.) un
    // botón de talla/color justo debajo del cursor al soltar.
    const onClick = (e) => {
      if (isDragging) { e.preventDefault(); e.stopPropagation(); }
    };

    const opts = { passive: false };
    el.addEventListener('mousedown', onMouseDown, opts);
    el.addEventListener('mouseleave', onMouseLeave, opts);
    el.addEventListener('mouseup', onMouseUp, opts);
    el.addEventListener('mousemove', onMouseMove, opts);
    el.addEventListener('click', onClick, true);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('click', onClick, true);
    };
  }, [ref, enabled]);
}
