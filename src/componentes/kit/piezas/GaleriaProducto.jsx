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
 *  - imagenes: [{ url, nombre, corto? }] (corto: el de la miniatura, si el
 *    nombre no cabe: "Ella" en vez de "Ella · Melange") · nombre: el del
 *    producto (para el alt)
 *  - inicial: la que se ve primero
 *  - salto: { indice, vez } para ir a otra foto desde fuera (la prenda de un
 *    combo que se recoloreó): cada `vez` nueva, la tira se desliza hasta ella
 */
export function GaleriaProducto({ imagenes = [], nombre = '', inicial = 0, salto }) {
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
  // Otra foto pedida desde fuera (la prenda recoloreada): se desliza hasta ella.
  useEffect(() => { if (salto) ir(salto.indice); }, [salto?.vez]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si cambian las fotos y quedan menos, la elegida pasa a la última.
  useEffect(() => { if (sel > total - 1) setSel(Math.max(total - 1, 0)); }, [sel, total]);

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
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') ir(i); }}
            >
              {/* La foto y su nombre se recortan aquí dentro; el borde va fuera
                  de ese recorte para que al viajar no se vea cortado. */}
              <span className={s.miniaturaFoto}>
                <img src={img.url} alt="" loading="lazy" draggable={false} />
                {(img.corto || img.nombre) && <span className={s.miniaturaNombre}>{img.corto || img.nombre}</span>}
              </span>
              {/* El borde de la elegida viaja de una miniatura a otra. */}
              {i === sel && <motion.i layoutId={`mini-${marca}`} className={s.miniaturaAro} transition={reducir ? { duration: 0 } : RESORTE} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      <div
        className={[s.marco, zoom && s.acercado].filter(Boolean).join(' ')}
        // El zoom es solo con ratón: con el dedo, el toque también dispara
        // eventos de ratón y la foto se acercaba sola al deslizar.
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setZoom(true); }}
        onPointerLeave={() => setZoom(false)}
        onPointerMove={(e) => { if (e.pointerType === 'mouse') mover(e); }}
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') setZoom(false); }}
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
