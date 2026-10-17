import React, { useEffect, useRef } from 'react';

const MARGEN = 200;

// Mount consumers near the viewport, preserving their state when scrolling back.
export default function DeferredSection({ active, observe, onVisible, children, section }) {
  const ref = useRef(null);
  useEffect(() => {
    if (active || !observe) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      onVisible(section.id);
      return undefined;
    }
    let listo = false;
    let cuadro = 0;
    const activar = () => {
      if (listo) return;
      listo = true;
      onVisible(section.id);
    };
    const observer = new IntersectionObserver((entries) => {
      // Also activate passed sections after a hash link or a large scroll jump.
      if (entries.some((entry) => entry.isIntersecting || entry.boundingClientRect.bottom <= 0)) activar();
    }, { rootMargin: `${MARGEN}px 0px` });
    observer.observe(ref.current);
    // El observer solo avisa cuando cambia el cruce: un salto de "debajo del
    // visor" a "encima" (arrastrar la barra, tecla Fin) no lo cruza y la cadena
    // de secciones se cortaba. Solo la primera sección sin activar escucha esto.
    const revisar = () => {
      cuadro = 0;
      const caja = ref.current?.getBoundingClientRect();
      if (caja && caja.top < window.innerHeight + MARGEN) activar();
    };
    const alMover = () => { if (!cuadro) cuadro = requestAnimationFrame(revisar); };
    window.addEventListener('scroll', alMover, { passive: true, capture: true });
    window.addEventListener('resize', alMover, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', alMover, { capture: true });
      window.removeEventListener('resize', alMover);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [active, observe, onVisible, section.id]);

  return (
    <div ref={ref} data-storefront-section={section.id} style={{ display: active ? 'contents' : 'block' }}>
      {active ? children : (
        <div aria-hidden="true" style={{ minHeight: section.type === 'header' ? 140 : 360 }} />
      )}
    </div>
  );
}
