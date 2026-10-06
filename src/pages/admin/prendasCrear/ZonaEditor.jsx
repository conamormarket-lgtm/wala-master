import React, { useEffect, useRef, useState } from 'react';
import { altoZonaFraccion, cargarImagen, normalizarZona, tintarImagen } from '../../../utils/prendaBase';
import styles from './PersonalizacionPrenda.module.css';

/**
 * Dibuja las zonas de impresión de una vista sobre su foto.
 *
 * Se elige una tocándola y se arrastra para moverla. Se estira desde el borde
 * derecho (ancho), el de abajo (alto) o la esquina (ambos); el alto se guarda
 * como proporción del ancho. El giro se ajusta en el formulario. La foto se
 * muestra teñida del color elegido para ver cómo queda.
 */
const ZonaEditor = ({ imagen, zonas, seleccionada, colorHex, onSeleccionar, onChange }) => {
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

  const empezar = (i, modo) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSeleccionar(i);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastreRef.current = { i, modo, x0: e.clientX, y0: e.clientY, zona: { ...zonas[i], ...normalizarZona(zonas[i], i), nombre: zonas[i].nombre } };
  };

  const mover = (e) => {
    const a = arrastreRef.current;
    const caja = cajaRef.current?.getBoundingClientRect();
    if (!a || !caja || !dims?.ancho) return;
    const dxPx = e.clientX - a.x0;
    const dyPx = e.clientY - a.y0;
    const z = a.zona;
    if (a.modo === 'mover') {
      onChange(a.i, {
        ...z,
        x: Math.min(1, Math.max(-0.2, z.x + dxPx / caja.width)),
        y: Math.min(1, Math.max(-0.2, z.y + dyPx / caja.height)),
      });
    } else {
      // El arrastre se mide sobre los ejes de la zona (que puede estar girada).
      const giro = (z.angulo * Math.PI) / 180;
      const alAncho = dxPx * Math.cos(giro) + dyPx * Math.sin(giro);
      const alAlto = -dxPx * Math.sin(giro) + dyPx * Math.cos(giro);
      const anchoPx = z.w * caja.width;
      const altoPx = anchoPx * z.proporcion;
      const nuevoAncho = a.modo === 'alto' ? anchoPx : Math.max(12, anchoPx + alAncho);
      const nuevoAlto = a.modo === 'ancho' ? altoPx : Math.max(12, altoPx + alAlto);
      onChange(a.i, {
        ...z,
        w: Math.min(1, nuevoAncho / caja.width),
        proporcion: nuevoAlto / nuevoAncho,
      });
    }
  };

  const soltar = () => { arrastreRef.current = null; };

  if (!imagen) {
    return <div className={styles.zonaVacia}>Sube la foto de esta vista para marcar sus zonas.</div>;
  }

  return (
    <div className={styles.zonaEditor}>
      <div ref={cajaRef} className={styles.zonaCaja} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <canvas ref={canvasRef} className={styles.zonaFoto} aria-label="Foto de la vista" />
        {dims?.error && <p className={styles.zonaError}>No se pudo cargar la foto.</p>}
        {dims?.ancho && zonas.map((zonaCruda, i) => {
          const z = normalizarZona(zonaCruda, i);
          const activa = i === seleccionada;
          return (
            <div
              key={z.id}
              className={`${styles.zonaRect} ${activa ? styles.zonaRectActiva : ''}`}
              style={{
                left: `${z.x * 100}%`,
                top: `${z.y * 100}%`,
                width: `${z.w * 100}%`,
                height: `${altoZonaFraccion(z, dims.ancho, dims.alto) * 100}%`,
                transform: `rotate(${z.angulo || 0}deg)`,
              }}
              onPointerDown={empezar(i, 'mover')}
              role="button"
              aria-pressed={activa}
              aria-label={`Zona ${z.nombre}`}
              tabIndex={0}
            >
              <span className={styles.zonaEtiqueta}>{z.nombre}</span>
              {activa && (
                <>
                  <span className={`${styles.asaBorde} ${styles.asaDerecha}`} onPointerDown={empezar(i, 'ancho')} aria-hidden="true" />
                  <span className={`${styles.asaBorde} ${styles.asaAbajo}`} onPointerDown={empezar(i, 'alto')} aria-hidden="true" />
                  <span className={styles.zonaAsa} onPointerDown={empezar(i, 'ambos')} aria-hidden="true" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ZonaEditor;
