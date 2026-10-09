import React, { useEffect, useRef, useState } from 'react';
import { altoZonaFraccion, cargarImagen, normalizarZona, tintarImagen } from '../../../utils/prendaBase';
import styles from './PersonalizacionPrenda.module.css';

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Dibuja las zonas de impresión de una vista sobre su foto (solo admin).
 *
 * Se elige una tocándola y se arrastra para moverla. Se estira desde el borde
 * derecho (ancho), el de abajo (alto) o la esquina (ambos); el alto se guarda
 * como proporción del ancho. El giro se ajusta en el formulario. La foto se
 * muestra teñida del color elegido para ver cómo queda.
 *
 * Con la medida de referencia (línea naranja: dos extremos arrastrables y lo
 * que mide en la prenda real) se conoce la escala de la foto: cada zona
 * muestra su ancho y alto en cm y se puede pintar una cuadrícula de 5 cm.
 *
 * Con `soloMover` las zonas solo se mueven (sin asas para estirarlas): para
 * ubicarlas en la foto de los bicolores sin cambiar su tamaño.
 */
const ZonaEditor = ({
  imagen, zonas, seleccionada, colorHex, onSeleccionar, onChange,
  referencia, onReferencia, cuadricula, onDims, soloMover = false,
}) => {
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

  // El tamaño de la foto se guarda en la vista: con él y la referencia se
  // calcula la escala fuera de aquí (estudio, archivo de impresión).
  useEffect(() => {
    if (dims?.ancho) onDims?.(dims);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims?.ancho, dims?.alto]);

  // Píxeles de la foto por cm de la prenda real (0 si no hay escala).
  const pxCm = (() => {
    if (!dims?.ancho || !referencia || !(Number(referencia.cm) > 0)) return 0;
    const largo = Math.hypot((referencia.x2 - referencia.x1) * dims.ancho, (referencia.y2 - referencia.y1) * dims.alto);
    return largo > 0 ? largo / Number(referencia.cm) : 0;
  })();

  const medida = (z) => {
    if (!pxCm) return null;
    const ancho = (z.w * dims.ancho) / pxCm;
    return `${ancho.toFixed(1)} × ${(ancho * z.proporcion).toFixed(1)} cm`;
  };

  const empezar = (i, modo) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (i !== null) onSeleccionar(i);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastreRef.current = {
      i,
      modo,
      x0: e.clientX,
      y0: e.clientY,
      zona: i !== null ? { ...zonas[i], ...normalizarZona(zonas[i], i), nombre: zonas[i].nombre } : null,
      referencia: referencia ? { ...referencia } : null,
    };
  };

  const mover = (e) => {
    const a = arrastreRef.current;
    const caja = cajaRef.current?.getBoundingClientRect();
    if (!a || !caja || !dims?.ancho) return;
    const dxPx = e.clientX - a.x0;
    const dyPx = e.clientY - a.y0;

    if (a.modo === 'ref1' || a.modo === 'ref2') {
      const r = a.referencia;
      const n = a.modo === 'ref1' ? '1' : '2';
      // Con Shift la línea queda perfectamente horizontal o vertical.
      let x = limitar(r[`x${n}`] + dxPx / caja.width, 0, 1);
      let y = limitar(r[`y${n}`] + dyPx / caja.height, 0, 1);
      if (e.shiftKey) {
        const otro = n === '1' ? '2' : '1';
        if (Math.abs(x - r[`x${otro}`]) * caja.width > Math.abs(y - r[`y${otro}`]) * caja.height) y = r[`y${otro}`];
        else x = r[`x${otro}`];
      }
      onReferencia({ ...r, [`x${n}`]: x, [`y${n}`]: y });
      return;
    }

    const z = a.zona;
    if (a.modo === 'mover') {
      onChange(a.i, {
        ...z,
        x: limitar(z.x + dxPx / caja.width, -0.2, 1),
        y: limitar(z.y + dyPx / caja.height, -0.2, 1),
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

  // Cuadrícula de 5 cm en la escala de la foto.
  const celda = pxCm && cuadricula
    ? { ancho: ((5 * pxCm) / dims.ancho) * 100, alto: ((5 * pxCm) / dims.alto) * 100 }
    : null;

  return (
    <div className={styles.zonaEditor}>
      <div ref={cajaRef} className={styles.zonaCaja} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <canvas ref={canvasRef} className={styles.zonaFoto} aria-label="Foto de la vista" />
        {dims?.error && <p className={styles.zonaError}>No se pudo cargar la foto.</p>}

        {celda && (
          <div
            className={styles.cuadricula}
            style={{ backgroundSize: `${celda.ancho}% ${celda.alto}%` }}
            aria-hidden="true"
          />
        )}

        {dims?.ancho && zonas.map((zonaCruda, i) => {
          const z = normalizarZona(zonaCruda, i);
          const activa = i === seleccionada;
          const cm = medida(z);
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
              aria-label={`Zona ${z.nombre}${cm ? `, ${cm}` : ''}`}
              tabIndex={0}
            >
              <span className={styles.zonaEtiqueta}>{z.nombre}</span>
              {cm && activa && <span className={styles.zonaMedida}>{cm}</span>}
              {activa && !soloMover && (
                <>
                  <span className={`${styles.asaBorde} ${styles.asaDerecha}`} onPointerDown={empezar(i, 'ancho')} aria-hidden="true" />
                  <span className={`${styles.asaBorde} ${styles.asaAbajo}`} onPointerDown={empezar(i, 'alto')} aria-hidden="true" />
                  <span className={styles.zonaAsa} onPointerDown={empezar(i, 'ambos')} aria-hidden="true" />
                </>
              )}
            </div>
          );
        })}

        {dims?.ancho && referencia && (
          <>
            <svg className={styles.reglaLinea} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line
                x1={referencia.x1 * 100}
                y1={referencia.y1 * 100}
                x2={referencia.x2 * 100}
                y2={referencia.y2 * 100}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span
              className={styles.reglaEtiqueta}
              style={{ left: `${((referencia.x1 + referencia.x2) / 2) * 100}%`, top: `${((referencia.y1 + referencia.y2) / 2) * 100}%` }}
            >
              {Number(referencia.cm) > 0 ? `${referencia.cm} cm` : '¿cuánto mide?'}
            </span>
            {[1, 2].map((n) => (
              <span
                key={n}
                className={styles.reglaPunto}
                style={{ left: `${referencia[`x${n}`] * 100}%`, top: `${referencia[`y${n}`] * 100}%` }}
                onPointerDown={empezar(null, `ref${n}`)}
                role="slider"
                aria-label={`Extremo ${n} de la medida de referencia`}
                aria-valuetext={`${Math.round(referencia[`x${n}`] * 100)}%, ${Math.round(referencia[`y${n}`] * 100)}%`}
                tabIndex={0}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default ZonaEditor;
