import React, { Children, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import s from './Carrusel.module.css';

/**
 * Carrusel único del kit (antes había 6: FeaturedCarousel, Testimonials,
 * HeroCarousel, BannerGrid, CollectionCarousel, ConversionFold).
 *
 * Deslizar con el dedo usa el scroll nativo con scroll-snap (fluido en la
 * app). Las flechas avanzan una "página" y se desactivan en los extremos.
 *
 *  - visibles: { escritorio, tablet, movil } elementos a la vista (admite 1.3
 *    para que asome el siguiente en el celular).
 *  - flechas, puntos: mostrar controles.
 *  - autoplay: milisegundos entre pasos (0 = quieto). Se pausa con el ratón
 *    encima, al tocar (1,5 s), con foco de teclado, con la pestaña oculta y
 *    con "reducir movimiento". Al final vuelve al inicio.
 *  - espacio: separación entre elementos (CSS).
 *  - etiqueta: nombre accesible del carrusel.
 *  - variante: 'hero' → flechas y puntos encima de la imagen.
 */
export default function Carrusel({
  children,
  visibles = { escritorio: 4, tablet: 3, movil: 1.3 },
  flechas = true,
  puntos = false,
  autoplay = 0,
  espacio = '1rem',
  etiqueta = 'Carrusel',
  variante,
  className,
}) {
  const pista = useRef(null);
  const [estado, setEstado] = useState({ inicio: true, fin: true, pagina: 0, paginas: 1 });
  const pausa = useRef({ raton: false, foco: false, toque: 0 });
  const elementos = Children.toArray(children);

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const paginas = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    const pagina = max <= 0 ? 0 : Math.round((el.scrollLeft / max) * (paginas - 1));
    setEstado({ inicio: el.scrollLeft <= 2, fin: el.scrollLeft >= max - 2, pagina, paginas });
  }, []);

  useEffect(() => {
    const el = pista.current;
    if (!el) return undefined;
    medir();
    let cuadro = 0;
    const alDesplazar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(medir);
    };
    el.addEventListener('scroll', alDesplazar, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', alDesplazar);
      ro.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [medir, elementos.length]);

  const mover = useCallback((dir) => {
    const el = pista.current;
    if (!el) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const max = el.scrollWidth - el.clientWidth;
    let destino = el.scrollLeft + dir * el.clientWidth;
    if (dir > 0 && el.scrollLeft >= max - 2) destino = 0; // vuelve al inicio
    el.scrollTo({ left: destino, behavior: reducir ? 'auto' : 'smooth' });
  }, []);

  const irA = (p) => {
    const el = pista.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: (max * p) / Math.max(1, estado.paginas - 1), behavior: 'smooth' });
  };

  // Avance automático con todas sus pausas.
  useEffect(() => {
    if (!autoplay) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => {
      const p = pausa.current;
      if (p.raton || p.foco || Date.now() - p.toque < 1500 || document.hidden) return;
      mover(1);
    }, Math.max(2000, autoplay));
    return () => window.clearInterval(id);
  }, [autoplay, mover]);

  const estilo = {
    '--visibles-escritorio': visibles.escritorio ?? 4,
    '--visibles-tablet': visibles.tablet ?? visibles.escritorio ?? 3,
    '--visibles-movil': visibles.movil ?? 1.3,
    '--espacio': espacio,
  };

  return (
    <div
      className={[s.carrusel, variante && s[variante], className].filter(Boolean).join(' ')}
      style={estilo}
      role="region"
      aria-roledescription="carrusel"
      aria-label={etiqueta}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') pausa.current.raton = true; }}
      onPointerLeave={() => { pausa.current.raton = false; }}
      onFocus={() => { pausa.current.foco = true; }}
      onBlur={() => { pausa.current.foco = false; }}
      onTouchStart={() => { pausa.current.toque = Date.now(); }}
      onTouchEnd={() => { pausa.current.toque = Date.now(); }}
    >
      <div className={s.pista} ref={pista}>
        {elementos.map((el, i) => (
          <div key={el.key ?? i} className={s.elemento} role="group" aria-label={`${i + 1} de ${elementos.length}`}>
            {el}
          </div>
        ))}
      </div>

      {flechas && !(estado.inicio && estado.fin) && (
        <>
          <button type="button" className={`${s.flecha} ${s.anterior}`} onClick={() => mover(-1)} disabled={estado.inicio} aria-label="Anterior">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className={`${s.flecha} ${s.siguiente}`} onClick={() => mover(1)} disabled={estado.fin && !autoplay} aria-label="Siguiente">
            <ChevronRight aria-hidden="true" />
          </button>
        </>
      )}

      {puntos && estado.paginas > 1 && (
        <div className={s.puntos}>
          {Array.from({ length: estado.paginas }, (_, i) => (
            <button
              key={i}
              type="button"
              className={[s.punto, i === estado.pagina && s.puntoActivo].filter(Boolean).join(' ')}
              aria-label={`Ir a la página ${i + 1}`}
              aria-current={i === estado.pagina ? 'true' : undefined}
              onClick={() => irA(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
