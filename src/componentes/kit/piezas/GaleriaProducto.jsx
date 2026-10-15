import React, { useRef, useState } from 'react';
import { ZoomIn } from 'lucide-react';
import s from './GaleriaProducto.module.css';

/**
 * La galería de una ficha (una creación, un producto): la foto grande y las
 * miniaturas en columna a la izquierda (debajo en el celular). Con ratón, la
 * foto se acerca donde está el cursor; con el dedo, se desliza para pasar de
 * una a otra. Cada foto lleva su nombre ("Frente", "Espalda") en una píldora.
 *  - imagenes: [{ url, nombre }] · nombre: el del producto (para el alt)
 *  - inicial: la que se ve primero
 */
export function GaleriaProducto({ imagenes = [], nombre = '', inicial = 0 }) {
  const [sel, setSel] = useState(inicial);
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const toqueX = useRef(null);
  const actual = imagenes[Math.min(sel, imagenes.length - 1)];

  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const soltar = (e) => {
    if (toqueX.current === null) return;
    const inicio = toqueX.current;
    toqueX.current = null;
    const fin = e.changedTouches[0]?.clientX;
    if (imagenes.length < 2 || typeof fin !== 'number' || Math.abs(fin - inicio) < 44) return;
    setSel((i) => (fin < inicio ? Math.min(i + 1, imagenes.length - 1) : Math.max(i - 1, 0)));
  };

  return (
    <div className={[s.galeria, imagenes.length > 1 && s.conMiniaturas].filter(Boolean).join(' ')} data-componente="GaleriaProducto">
      {imagenes.length > 1 && (
        <div className={s.miniaturas} role="tablist" aria-label="Fotos">
          {imagenes.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === sel}
              aria-label={img.nombre}
              className={[s.miniatura, i === sel && s.miniaturaActiva].filter(Boolean).join(' ')}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
            >
              <img src={img.url} alt="" loading="lazy" draggable={false} />
              <span>{img.nombre}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={[s.marco, zoom && s.acercado].filter(Boolean).join(' ')}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={mover}
        onTouchStart={(e) => { toqueX.current = e.touches[0]?.clientX ?? null; setZoom(false); }}
        onTouchEnd={soltar}
        onTouchCancel={() => { toqueX.current = null; }}
      >
        {actual && (
          <img
            key={actual.url}
            src={actual.url}
            alt={[nombre, actual.nombre].filter(Boolean).join(' · ')}
            className={s.foto}
            draggable={false}
            style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${pos.x}% ${pos.y}%` } : undefined}
          />
        )}
        {actual?.nombre && <span className={s.lado}>{actual.nombre}</span>}
        {actual && <span className={s.pista} aria-hidden="true"><ZoomIn /> Pasa el cursor para ver de cerca</span>}
        {imagenes.length > 1 && (
          <span className={s.puntos} aria-hidden="true">
            {imagenes.map((img, i) => <i key={`${img.url}-${i}`} className={i === sel ? s.puntoActivo : undefined} />)}
          </span>
        )}
      </div>
    </div>
  );
}
