import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HojaInferior } from '../Feedback';
import { Texto, useTexto } from '../Traduccion';
import s from './MenuContextual.module.css';

const enEscritorio = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px) and (pointer: fine)').matches;

/**
 * El menú del clic derecho (o del toque largo): en escritorio, una lista
 * flotante donde se hizo clic (si no entra, se abre hacia el otro lado); las
 * flechas la recorren, Esc o un clic afuera la cierran, y también al
 * desplazar la página. En el celular, una hoja inferior con las mismas
 * opciones (sin los atajos de teclado).
 *  - abierto · x, y: el punto (px de la ventana) · onCerrar · titulo (la hoja)
 *  - items: [{ id, etiqueta, Icono, atajo, peligro, deshabilitado, accion }]
 *    o 'separador'
 */
export function MenuContextual({ abierto, x = 0, y = 0, items = [], onCerrar, titulo = 'Opciones' }) {
  const tituloTraducido = useTexto(titulo);
  const [escritorio, setEscritorio] = useState(enEscritorio);
  useEffect(() => { if (abierto) setEscritorio(enEscritorio()); }, [abierto]);

  const elegir = (item) => {
    onCerrar?.();
    item.accion?.();
  };

  if (!escritorio) {
    return (
      <HojaInferior abierta={abierto} onCerrar={onCerrar} titulo={tituloTraducido}>
        <div className={s.lista} role="menu">
          {items.map((item, i) => (item === 'separador' ? (
            <div key={`sep-${i}`} className={s.separador} role="separator" />
          ) : (
            <button key={item.id} type="button" role="menuitem" className={[s.opcion, s.opcionGrande, item.peligro && s.peligro].filter(Boolean).join(' ')} disabled={item.deshabilitado} onClick={() => elegir(item)}>
              {item.Icono && <item.Icono aria-hidden="true" />}
              <span className={s.etiqueta}><Texto>{item.etiqueta}</Texto></span>
            </button>
          )))}
        </div>
      </HojaInferior>
    );
  }
  if (!abierto) return null;
  return createPortal(<MenuFlotante x={x} y={y} items={items} onElegir={elegir} onCerrar={onCerrar} />, document.body);
}

function MenuFlotante({ x, y, items, onElegir, onCerrar }) {
  const menu = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return undefined;
    const { width, height } = el.getBoundingClientRect();
    const margen = 8;
    setPos({
      left: x + width + margen > window.innerWidth ? Math.max(margen, x - width) : x,
      top: y + height + margen > window.innerHeight ? Math.max(margen, y - height) : y,
    });
    // Después del clic que lo abrió, el foco en la primera opción.
    const cuadro = requestAnimationFrame(() => el.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(cuadro);
  }, [x, y]);

  useEffect(() => {
    // El clic que lo abre puede enfocar lo tocado y desplazar la página un
    // poco: ese desplazamiento no lo cierra (solo los de después).
    const abiertoEn = performance.now();
    const fuera = (e) => { if (!menu.current?.contains(e.target)) onCerrar?.(); };
    const cerrar = (e) => {
      if (e?.type === 'scroll' && (performance.now() - abiertoEn < 300 || menu.current?.contains(e.target))) return;
      onCerrar?.();
    };
    const conEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCerrar?.(); } };
    window.addEventListener('keydown', conEsc, true);
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    window.addEventListener('blur', cerrar);
    return () => {
      window.removeEventListener('keydown', conEsc, true);
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('blur', cerrar);
    };
  }, [onCerrar]);

  const alTeclear = (e) => {
    e.stopPropagation(); // que las flechas no muevan lo elegido en la página
    const botones = [...menu.current.querySelectorAll('button:not(:disabled)')];
    const i = botones.indexOf(document.activeElement);
    if (e.key === 'Tab') { e.preventDefault(); onCerrar?.(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); botones[(i + 1) % botones.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); botones[(i - 1 + botones.length) % botones.length]?.focus(); }
  };

  return (
    <div ref={menu} className={s.menu} style={{ left: pos.left, top: pos.top }} role="menu" onKeyDown={alTeclear} onContextMenu={(e) => e.preventDefault()} data-componente="MenuContextual">
      {items.map((item, i) => (item === 'separador' ? (
        <div key={`sep-${i}`} className={s.separador} role="separator" />
      ) : (
        <button key={item.id} type="button" role="menuitem" className={[s.opcion, item.peligro && s.peligro].filter(Boolean).join(' ')} disabled={item.deshabilitado} onClick={() => onElegir(item)}>
          {item.Icono && <item.Icono aria-hidden="true" />}
          <span className={s.etiqueta}><Texto>{item.etiqueta}</Texto></span>
          {item.atajo && <kbd className={s.atajo}>{item.atajo}</kbd>}
        </button>
      )))}
    </div>
  );
}
