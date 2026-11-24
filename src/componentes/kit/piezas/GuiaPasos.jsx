import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import Boton from '../Boton';
import { Sello } from '../Marca';
import { Texto, useTexto } from '../Traduccion';
import s from './GuiaPasos.module.css';

/*
 * Un recorrido guiado (2026-11-11): resalta una parte de la pantalla y la
 * explica en una tarjeta con la letra y los sellos de Walá, paso a paso.
 * Reemplaza a driver.js en el recorrido de Walito (se veía con otro estilo).
 */

const MARGEN = 12;
const RESALTE = 8;

/** Dónde va la tarjeta: debajo del elemento si cabe; si no, encima. */
function ubicar(rect, tarjeta) {
  const ancho = Math.min(340, window.innerWidth - MARGEN * 2);
  const alto = tarjeta?.offsetHeight || 190;
  if (!rect) return { top: (window.innerHeight - alto) / 2, left: (window.innerWidth - ancho) / 2, ancho, lado: 'centro' };
  const abajo = rect.bottom + RESALTE + MARGEN;
  const cabeAbajo = abajo + alto <= window.innerHeight - MARGEN;
  const top = cabeAbajo ? abajo : Math.max(MARGEN, rect.top - RESALTE - MARGEN - alto);
  const centro = rect.left + rect.width / 2 - ancho / 2;
  const left = Math.min(Math.max(MARGEN, centro), window.innerWidth - ancho - MARGEN);
  return { top, left, ancho, lado: cabeAbajo ? 'abajo' : 'arriba' };
}

/**
 * El recorrido.
 *  - abierta · pasos: [{ selector, titulo, texto }] (selector: el elemento a
 *    resaltar; si no está, la tarjeta va al centro)
 *  - onTerminar(completo): al terminar (true) o al saltarlo con la X o Esc (false)
 *  - etiquetaFin: el último botón ("¡Entendido!")
 */
export function GuiaPasos({ abierta, pasos = [], onTerminar, etiquetaFin = '¡Entendido!' }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  const tarjetaRef = useRef(null);
  const t = { saltar: useTexto('Saltar el recorrido'), nombre: useTexto('Recorrido') };
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;

  useEffect(() => { if (abierta) setI(0); }, [abierta]);

  // Medir el elemento del paso (y seguirlo si la ventana se mueve o cambia de tamaño).
  const medir = useCallback(() => {
    const el = paso?.selector ? document.querySelector(paso.selector) : null;
    const r = el ? el.getBoundingClientRect() : null;
    setRect(r && r.width ? r : null);
  }, [paso]);
  useLayoutEffect(() => {
    if (!abierta || !paso) return undefined;
    const el = paso.selector ? document.querySelector(paso.selector) : null;
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    medir();
    const id = window.setTimeout(medir, 350);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierta, paso, medir]);
  useLayoutEffect(() => {
    if (abierta) setPos(ubicar(rect, tarjetaRef.current));
  }, [abierta, rect, i]);

  // El foco a la tarjeta; Esc lo salta.
  useEffect(() => {
    if (!abierta) return undefined;
    tarjetaRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onTerminar?.(false); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [abierta, i, onTerminar]);

  if (!abierta || !paso || typeof document === 'undefined') return null;
  const siguiente = () => (ultimo ? onTerminar?.(true) : setI((n) => n + 1));

  return createPortal(
    <div className={s.capa} data-componente="GuiaPasos">
      {rect ? (
        <div
          className={s.resalte}
          style={{ top: rect.top - RESALTE, left: rect.left - RESALTE, width: rect.width + RESALTE * 2, height: rect.height + RESALTE * 2 }}
          aria-hidden="true"
        />
      ) : <div className={s.velo} aria-hidden="true" />}
      <div
        ref={tarjetaRef}
        key={i}
        className={[s.tarjeta, pos && s[`lado_${pos.lado}`]].filter(Boolean).join(' ')}
        style={pos ? { top: pos.top, left: pos.left, width: pos.ancho } : { visibility: 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-label={t.nombre}
        tabIndex={-1}
      >
        <header className={s.cabeza}>
          <Sello tamano={30} girar={i % 2 ? 6 : -8}><b className={s.numero}>{i + 1}</b></Sello>
          <strong className={s.titulo}><Texto>{paso.titulo}</Texto></strong>
          <button type="button" className={s.saltar} onClick={() => onTerminar?.(false)} aria-label={t.saltar}>
            <X aria-hidden="true" />
          </button>
        </header>
        <p className={s.texto}><Texto>{paso.texto}</Texto></p>
        <footer className={s.pie}>
          <span className={s.puntos} aria-label={`${i + 1} de ${pasos.length}`}>
            {pasos.map((p, k) => <span key={p.titulo} className={[s.punto, k === i && s.puntoActual].filter(Boolean).join(' ')} />)}
          </span>
          <span className={s.botones}>
            {i > 0 && <Boton tamano="sm" variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={() => setI((n) => n - 1)}><Texto>Atrás</Texto></Boton>}
            <Boton tamano="sm" iconoFin={ultimo ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />} onClick={siguiente}>
              <Texto>{ultimo ? etiquetaFin : 'Siguiente'}</Texto>
            </Boton>
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
