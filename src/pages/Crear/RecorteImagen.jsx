import React, { useEffect, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { cargarImagen } from '../../utils/prendaBase';
import { bordesVisibles } from '../../services/crearArchivos';
import styles from './RecorteImagen.module.css';

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const COMPLETA = { x: 0, y: 0, w: 1, h: 1 };
const MINIMO = 0.04;

/**
 * Ventana para recortar una imagen del diseño. El recuadro se mueve
 * arrastrándolo y se ajusta desde sus esquinas; lo de afuera se oscurece.
 * "Quitar bordes transparentes" lo ajusta solo a lo que se ve de la imagen.
 * Devuelve el recorte en píxeles de la imagen.
 */
const RecorteImagen = ({ src, onCancelar, onAplicar }) => {
  const cajaRef = useRef(null);
  const arrastreRef = useRef(null);
  const [img, setImg] = useState(null);
  const [rect, setRect] = useState(COMPLETA);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vigente = true;
    cargarImagen(src).then((i) => vigente && setImg(i)).catch(() => vigente && setAviso('No pudimos abrir la imagen.'));
    return () => { vigente = false; };
  }, [src]);

  const empezar = (modo) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastreRef.current = { modo, x0: e.clientX, y0: e.clientY, rect: { ...rect } };
  };

  const mover = (e) => {
    const a = arrastreRef.current;
    const caja = cajaRef.current?.getBoundingClientRect();
    if (!a || !caja) return;
    const dx = (e.clientX - a.x0) / caja.width;
    const dy = (e.clientY - a.y0) / caja.height;
    const r = a.rect;
    if (a.modo === 'mover') {
      setRect({ ...r, x: limitar(r.x + dx, 0, 1 - r.w), y: limitar(r.y + dy, 0, 1 - r.h) });
      return;
    }
    let { x, y, w, h } = r;
    if (a.modo.includes('o')) { // borde oeste (izquierdo)
      const nx = limitar(r.x + dx, 0, r.x + r.w - MINIMO);
      w = r.w + (r.x - nx); x = nx;
    }
    if (a.modo.includes('e')) w = limitar(r.w + dx, MINIMO, 1 - r.x);
    if (a.modo.includes('n')) {
      const ny = limitar(r.y + dy, 0, r.y + r.h - MINIMO);
      h = r.h + (r.y - ny); y = ny;
    }
    if (a.modo.includes('s')) h = limitar(r.h + dy, MINIMO, 1 - r.y);
    setRect({ x, y, w, h });
  };

  const soltar = () => { arrastreRef.current = null; };

  const quitarBordes = () => {
    if (!img) return;
    const caja = bordesVisibles(img);
    if (!caja) {
      setAviso('Esta imagen no tiene bordes transparentes que quitar.');
      return;
    }
    setAviso('');
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    setRect({ x: caja.x / W, y: caja.y / H, w: caja.w / W, h: caja.h / H });
  };

  const aplicar = () => {
    if (!img) return;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const enPx = { x: rect.x * W, y: rect.y * H, w: rect.w * W, h: rect.h * H };
    const sinCambios = rect.x < 0.002 && rect.y < 0.002 && rect.w > 0.996 && rect.h > 0.996;
    onAplicar(sinCambios ? null : enPx);
  };

  return (
    <div className={styles.fondo} role="dialog" aria-modal="true" aria-labelledby="recorte-titulo" onClick={onCancelar}>
      <div className={styles.ventana} onClick={(e) => e.stopPropagation()}>
        <h2 id="recorte-titulo" className={styles.titulo}>Recortar imagen</h2>
        <p className={styles.ayuda}>Arrastra el recuadro y ajústalo desde sus esquinas. Solo se usará lo que quede adentro.</p>

        <div className={styles.area}>
          {img ? (
            <div ref={cajaRef} className={styles.caja} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
              <img src={src} alt="Imagen a recortar" className={styles.imagen} draggable={false} />
              <div
                className={styles.recuadro}
                style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                onPointerDown={empezar('mover')}
              >
                {['no', 'ne', 'so', 'se'].map((esquina) => (
                  <span key={esquina} className={`${styles.esquina} ${styles[esquina]}`} onPointerDown={empezar(esquina)} aria-hidden="true" />
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.ayuda}>{aviso || 'Cargando imagen…'}</p>
          )}
        </div>

        {img && aviso && <p className={styles.aviso}>{aviso}</p>}

        <div className={styles.acciones}>
          <button type="button" className={styles.secundario} onClick={quitarBordes} disabled={!img}>
            <Scissors size={16} aria-hidden="true" /> Quitar bordes transparentes
          </button>
          <button type="button" className={styles.texto} onClick={() => { setRect(COMPLETA); setAviso(''); }} disabled={!img}>
            Restablecer
          </button>
        </div>
        <div className={styles.acciones}>
          <button type="button" className={styles.secundario} onClick={onCancelar}>Cancelar</button>
          <button type="button" className={styles.principal} onClick={aplicar} disabled={!img}>Aplicar recorte</button>
        </div>
      </div>
    </div>
  );
};

export default RecorteImagen;
