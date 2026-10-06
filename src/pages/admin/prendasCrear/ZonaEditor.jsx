import React, { useEffect, useRef, useState } from 'react';
import { altoZonaFraccion, cargarImagen, tintarImagen } from '../../../utils/prendaBase';
import styles from './AdminPrendasCrear.module.css';

/**
 * Dibuja la zona de impresión sobre la foto de una vista.
 *
 * Se arrastra para moverla y se agranda desde la esquina. Solo se controla el
 * ANCHO: el alto sale de la medida en cm (ver altoZonaFraccion), así el
 * rectángulo siempre tiene la misma proporción que lo que se va a imprimir.
 * La foto se muestra teñida del color elegido para ver cómo queda.
 */
const ZonaEditor = ({ imagen, zona, colorHex, onChange }) => {
  const cajaRef = useRef(null);
  const canvasRef = useRef(null);
  const arrastreRef = useRef(null);
  const [dims, setDims] = useState(null);

  useEffect(() => {
    let vigente = true;
    setDims(null);
    if (!imagen) return undefined;
    cargarImagen(imagen)
      .then((img) => {
        if (!vigente) return;
        const fuente = tintarImagen(img, colorHex || '#FFFFFF');
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = fuente.width;
          canvas.height = fuente.height;
          canvas.getContext('2d').drawImage(fuente, 0, 0);
        }
        setDims({ ancho: img.naturalWidth, alto: img.naturalHeight });
      })
      .catch(() => vigente && setDims({ error: true }));
    return () => { vigente = false; };
  }, [imagen, colorHex]);

  const altoFraccion = dims?.ancho ? altoZonaFraccion(zona, dims.ancho, dims.alto) : 0;

  const empezar = (modo) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastreRef.current = { modo, x0: e.clientX, y0: e.clientY, zona: { ...zona } };
  };

  const mover = (e) => {
    const a = arrastreRef.current;
    const caja = cajaRef.current?.getBoundingClientRect();
    if (!a || !caja) return;
    const dx = (e.clientX - a.x0) / caja.width;
    const dy = (e.clientY - a.y0) / caja.height;
    const proporcion = altoZonaFraccion({ ...a.zona, w: 1 }, dims.ancho, dims.alto);
    if (a.modo === 'mover') {
      const h = a.zona.w * proporcion;
      onChange({
        ...zona,
        x: Math.min(1 - a.zona.w, Math.max(0, a.zona.x + dx)),
        y: Math.min(1 - h, Math.max(0, a.zona.y + dy)),
      });
    } else {
      const maxW = Math.min(1 - a.zona.x, (1 - a.zona.y) / proporcion);
      onChange({ ...zona, w: Math.min(maxW, Math.max(0.05, a.zona.w + dx)) });
    }
  };

  const soltar = () => { arrastreRef.current = null; };

  if (!imagen) {
    return <div className={styles.zonaVacia}>Sube la foto de esta vista para marcar la zona.</div>;
  }

  return (
    <div className={styles.zonaEditor}>
      <div ref={cajaRef} className={styles.zonaCaja} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <canvas ref={canvasRef} className={styles.zonaFoto} aria-label="Foto de la vista" />
        {dims?.error && <p className={styles.zonaError}>No se pudo cargar la foto.</p>}
        {dims?.ancho && (
          <div
            className={styles.zonaRect}
            style={{
              left: `${zona.x * 100}%`,
              top: `${zona.y * 100}%`,
              width: `${zona.w * 100}%`,
              height: `${altoFraccion * 100}%`,
            }}
            onPointerDown={empezar('mover')}
            role="slider"
            aria-label="Zona de impresión: arrastra para moverla"
            aria-valuetext={`${zona.anchoCm} por ${zona.altoCm} centímetros`}
            tabIndex={0}
          >
            <span className={styles.zonaEtiqueta}>{zona.anchoCm} × {zona.altoCm} cm</span>
            <span
              className={styles.zonaAsa}
              onPointerDown={empezar('escalar')}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ZonaEditor;
