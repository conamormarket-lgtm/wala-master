import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ZoomIn } from 'lucide-react';
import { RESORTE } from '../Efectos';
import { Texto, useTexto } from '../Traduccion';
import { Traducido } from './TextoResaltado';
import s from './GaleriaProducto.module.css';

/**
 * La galería de una ficha (una creación, un producto): la foto grande y las
 * miniaturas en columna a la izquierda (debajo en el celular). Las fotos van
 * en una tira que se desliza: con el dedo sigue al toque (deslizar nativo) y
 * al elegir una miniatura pasa deslizándose hasta ella. Con ratón, la foto se
 * acerca donde está el cursor. Cada foto lleva su nombre ("Frente",
 * "Espalda") en una píldora.
 *  - imagenes: [{ url, nombre, corto?, srcSet? }] (corto: el de la miniatura,
 *    si el nombre no cabe: "Ella" en vez de "Ella · Melange"; srcSet: copias
 *    de la foto en varios tamaños, para bajar solo la que hace falta) ·
 *    nombre: el del producto (para el alt)
 *  - una imagen también puede llevar: relleno ('6%': aire alrededor, una
 *    prenda en blanco), atenuada (la prenda todavía sin diseño) o juntas:
 *    [{ url, relleno, atenuada }] (varias fotos lado a lado, como "Todo el
 *    combo"; esa no se acerca) o miniatura: [{ url, srcSet? }] (otras fotos,
 *    lado a lado, solo en su miniatura: la imagen "frente y espalda" de una
 *    prenda se ve en grande y su miniatura son la foto de frente y la de
 *    espalda, que a 76 px se entienden mejor)
 *  - inicial: la que se ve primero
 *  - salto: { indice, vez } para ir a otra foto desde fuera (la prenda de un
 *    combo que se recoloreó): cada `vez` nueva, la tira se desliza hasta ella
 * La foto con la que abre se pide primero (fetchPriority alta): es la que
 * más se ve al entrar. Las demás, solo al acercarse.
 */
// El ancho que ocupa la foto grande y una miniatura (para elegir la copia).
export const SIZES_FOTO = '(max-width: 900px) 100vw, 46vw';
const SIZES_MINIATURA = '76px';
// Una de dos fotos lado a lado en una miniatura.
const SIZES_JUNTA = '40px';


export function GaleriaProducto({ imagenes = [], nombre = '', inicial = 0, salto }) {
  const total = imagenes.length;
  const [sel, setSel] = useState(Math.min(inicial, Math.max(total - 1, 0)));
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const tira = useRef(null);
  const minis = useRef(null);
  const quieto = useRef(null);
  const primera = useRef(sel);
  const marca = useId();
  const reducir = useReducedMotion();
  const actual = imagenes[Math.min(sel, total - 1)];
  const acercar = zoom && !actual?.juntas;
  const fotos = useTexto('Fotos');

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
  // Con muchas fotos las miniaturas se desplazan: la elegida queda a la vista
  // (moviendo solo la columna, nunca la página).
  useEffect(() => {
    const caja = minis.current;
    const el = caja?.children[sel];
    if (!caja || !el) return;
    const c = caja.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < c.top) caja.scrollTop += r.top - c.top - 4;
    else if (r.bottom > c.bottom) caja.scrollTop += r.bottom - c.bottom + 4;
    if (r.left < c.left) caja.scrollLeft += r.left - c.left - 4;
    else if (r.right > c.right) caja.scrollLeft += r.right - c.right + 4;
  }, [sel]);

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
        <div ref={minis} className={s.miniaturas} role="tablist" aria-label={fotos}>
          {imagenes.map((img, i) => (
            <Traducido key={`${img.url}-${i}`} texto={img.nombre || `Foto ${i + 1}`}>{(etiqueta) => (
            <button
              type="button"
              role="tab"
              aria-selected={i === sel}
              aria-label={etiqueta}
              className={s.miniatura}
              onClick={() => ir(i)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') ir(i); }}
            >
              {/* La foto y su nombre se recortan aquí dentro; el borde va fuera
                  de ese recorte para que al viajar no se vea cortado. */}
              <span className={s.miniaturaFoto}>
                {img.juntas || img.miniatura
                  ? <Juntas fotos={img.juntas || img.miniatura} />
                  : <img src={img.url} srcSet={img.srcSet} sizes={img.srcSet ? SIZES_MINIATURA : undefined} alt="" loading="lazy" decoding="async" draggable={false} className={img.atenuada ? s.atenuada : undefined} style={conRelleno(img)} />}
                {(img.corto || img.nombre) && <span className={s.miniaturaNombre}><Texto>{img.corto || img.nombre}</Texto></span>}
              </span>
              {/* El borde de la elegida viaja de una miniatura a otra. */}
              {i === sel && <motion.i layoutId={`mini-${marca}`} className={s.miniaturaAro} transition={reducir ? { duration: 0 } : RESORTE} aria-hidden="true" />}
            </button>
            )}</Traducido>
          ))}
        </div>
      )}
      <div
        className={[s.marco, acercar && s.acercado, actual?.juntas && s.sinZoom].filter(Boolean).join(' ')}
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
              {img.juntas ? <Juntas fotos={img.juntas} grande /> : (
              // El nombre del producto llega traducido; el de la foto se traduce aquí.
              <Traducido texto={img.nombre}>{(lado) => (
              <img
                src={img.url}
                srcSet={img.srcSet}
                sizes={img.srcSet ? SIZES_FOTO : undefined}
                alt={[nombre, lado].filter(Boolean).join(' · ')}
                className={[s.foto, img.atenuada && s.atenuada].filter(Boolean).join(' ')}
                draggable={false}
                loading={i === sel ? 'eager' : 'lazy'}
                decoding={i === primera.current ? undefined : 'async'}
                // En minúsculas: React 18 no conoce fetchPriority.
                fetchpriority={i === primera.current ? 'high' : undefined}
                style={acercar && i === sel ? { ...conRelleno(img), transform: 'scale(2.2)', transformOrigin: `${pos.x}% ${pos.y}%` } : conRelleno(img)}
              />
              )}</Traducido>
              )}
            </div>
          ))}
        </div>
        {actual?.nombre && <span key={actual.nombre} className={s.lado}><Texto>{actual.nombre}</Texto></span>}
        {actual && !actual.juntas && <span className={s.pista} aria-hidden="true"><ZoomIn /> <Texto>Pasa el cursor para ver de cerca</Texto></span>}
        {total > 1 && (
          <span className={s.puntos} aria-hidden="true">
            {imagenes.map((img, i) => <i key={`${img.url}-${i}`} className={i === sel ? s.puntoActivo : undefined} />)}
          </span>
        )}
      </div>
    </div>
  );
}

const conRelleno = (img) => (img.relleno ? { boxSizing: 'border-box', padding: img.relleno } : undefined);

/** Varias fotos lado a lado (las prendas de un combo, juntas). */
function Juntas({ fotos, grande = false }) {
  return (
    <span className={[s.juntas, grande && s.juntasGrande].filter(Boolean).join(' ')} style={{ '--n': Math.max(fotos.length, 1) }}>
      {fotos.map((f, k) => (
        <img
          key={`${f.url}-${k}`}
          src={f.url}
          srcSet={f.srcSet}
          sizes={f.srcSet ? (grande ? SIZES_FOTO : SIZES_JUNTA) : undefined}
          alt=""
          loading={grande ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          className={f.atenuada ? s.atenuada : undefined}
          style={conRelleno(f)}
        />
      ))}
    </span>
  );
}
