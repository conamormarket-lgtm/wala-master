import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HojaInferior } from './Feedback';
import s from './PanelFlotante.module.css';

/** ¿Pantalla de celular? (lo mismo que decide la hoja inferior). */
export const enCelular = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 719px)').matches;

/**
 * Lo que se abre desde un campo (lista de opciones, calendario): en
 * escritorio, un panel pegado al campo (debajo, o arriba si no entra); en el
 * celular, una hoja inferior con su título. Se dibuja en <body>, así no lo
 * recorta una hoja o una tarjeta con overflow.
 *  - abierto · onCerrar · ancla: ref del campo
 *  - titulo: el de la hoja (y nombre del panel para lectores)
 *  - ancho: 'campo' (el del campo) o px mínimos (calendario)
 *  - pie: botones al final (solo en la hoja; en el panel van dentro)
 */
export function PanelFlotante({ abierto, onCerrar, ancla, titulo, ancho = 'campo', alto = 320, pie, children }) {
  const [celular, setCelular] = useState(false);
  const panel = useRef(null);
  const [pos, setPos] = useState(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  // El modo se decide al abrir (no cambia mientras está abierto).
  useLayoutEffect(() => { if (abierto) setCelular(enCelular()); }, [abierto]);

  // Posición pegada al campo; se recalcula al hacer scroll o cambiar el tamaño.
  useLayoutEffect(() => {
    if (!abierto || celular) return undefined;
    const ubicar = () => {
      const r = ancla.current?.getBoundingClientRect();
      if (!r) return;
      const w = ancho === 'campo' ? r.width : Math.max(r.width, ancho);
      const abajo = window.innerHeight - r.bottom - 12;
      const arriba = r.top - 12;
      const haciaArriba = abajo < Math.min(alto, 240) && arriba > abajo;
      const izquierda = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      setPos({
        left: izquierda,
        width: w,
        maxHeight: Math.min(alto, haciaArriba ? arriba : abajo),
        ...(haciaArriba ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
        origen: haciaArriba ? 'bottom' : 'top',
      });
    };
    ubicar();
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
    };
  }, [abierto, celular, ancla, ancho, alto]);

  // Tocar fuera cierra el panel (no la hoja: ella tiene su velo).
  useEffect(() => {
    if (!abierto || celular) return undefined;
    const fuera = (e) => {
      if (panel.current?.contains(e.target) || ancla.current?.contains(e.target)) return;
      cerrarRef.current?.();
    };
    document.addEventListener('pointerdown', fuera, true);
    return () => document.removeEventListener('pointerdown', fuera, true);
  }, [abierto, celular, ancla]);

  if (celular) {
    return <HojaInferior abierta={abierto} onCerrar={onCerrar} titulo={titulo} pie={pie}>{children}</HojaInferior>;
  }
  if (!abierto || !pos || typeof document === 'undefined') return null;
  const { origen, ...estilo } = pos;
  return createPortal(
    <div
      ref={panel}
      className={`${s.panel} ${origen === 'bottom' ? s.arriba : ''}`}
      style={estilo}
      role="dialog"
      aria-label={titulo}
    >
      {children}
      {pie && <div className={s.pie}>{pie}</div>}
    </div>,
    document.body,
  );
}
