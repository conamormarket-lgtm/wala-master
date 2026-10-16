import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ZoomIn } from 'lucide-react';
import { RESORTE } from '../Efectos';
import s from './GaleriaProducto.module.css';

/**
 * La galería de una ficha (una creación, un producto): la foto grande y las
 * miniaturas en columna a la izquierda (debajo en el celular). Las fotos van
 * en una tira que se desliza: con el dedo sigue al toque (deslizar nativo) y
 * al elegir una miniatura pasa deslizándose hasta ella. Con ratón, la foto se
 * acerca donde está el cursor. Cada foto lleva su nombre ("Frente",
 * "Espalda") en una píldora.
 *  - imagenes: [{ url, nombre }] · nombre: el del producto (para el alt)
 *  - inicial: la que se ve primero
 */
export function GaleriaProducto({ imagenes = [], nombre = '', inicial = 0 }) {
  const total = imagenes.length;
  const [sel, setSel] = useState(Math.min(inicial, Math.max(total - 1, 0)));
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const tira = useRef(null);
  const quieto = useRef(null);
  const marca = useId();
  const reducir = useReducedMotion();
  const actual = imagenes[Math.min(sel, total - 1)];

  // Abre en la inicial sin animar.
  useLayoutEffect(() => {
    const el = tira.current;
    if (el) el.scrollLeft = sel * el.clientWidth;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(quieto.current), []);

  const ir = (k) => {
    const n = Math.max(0, Math.min(k, total - 1));
    setSel(n);
    tira.current?.scrollTo({ left: n * tira.current.clientWidth, behavior: reducir ? 'auto' : 'smooth' });
  };
  // Al deslizar con el dedo, la elegida es la que queda a la vista cuando la tira se detiene.
  const alDeslizar = () => {
    clearTimeout(quieto.current);
    quieto.current = setTimeout(() => {
      const el = tira.current;
      if (el) setSel(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    }, 90);
  };
  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className={[s.galeria, total > 1 && s.conMiniaturas].filter(Boolean).join(' ')} data-componente="GaleriaProducto">
      {total > 1 && (
        <div className={s.miniaturas} role="tablist" aria-label="Fotos">
          {imagenes.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === sel}
              aria-label={img.nombre || `Foto ${i + 1}`}
              className={s.miniatura}
              onClick={() => ir(i)}
              onMouseEnter={() => ir(i)}
            >
              <img src={img.url} alt="" loading="lazy" draggable={false} />
              {img.nombre && <span>{img.nombre}</span>}
              {/* El borde de la elegida viaja de una miniatura a otra. */}
              {i === sel && <motion.i layoutId={`mini-${marca}`} className={s.miniaturaAro} transition={reducir ? { duration: 0 } : RESORTE} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      <div
        className={[s.marco, zoom && s.acercado].filter(Boolean).join(' ')}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={mover}
        onTouchStart={() => setZoom(false)}
      >
        <div ref={tira} className={s.tira} onScroll={alDeslizar}>
          {imagenes.map((img, i) => (
            <div key={`${img.url}-${i}`} className={s.lamina} aria-hidden={i !== sel || undefined}>
              <img
                src={img.url}
                alt={[nombre, img.nombre].filter(Boolean).join(' · ')}
                className={s.foto}
                draggable={false}
                loading={i === sel ? 'eager' : 'lazy'}
                style={zoom && i === sel ? { transform: 'scale(2.2)', transformOrigin: `${pos.x}% ${pos.y}%` } : undefined}
              />
            </div>
          ))}
        </div>
        {actual?.nombre && <span key={actual.nombre} className={s.lado}>{actual.nombre}</span>}
        {actual && <span className={s.pista} aria-hidden="true"><ZoomIn /> Pasa el cursor para ver de cerca</span>}
        {total > 1 && (
          <span className={s.puntos} aria-hidden="true">
            {imagenes.map((img, i) => <i key={`${img.url}-${i}`} className={i === sel ? s.puntoActivo : undefined} />)}
          </span>
        )}
      </div>
    </div>
  );
}
