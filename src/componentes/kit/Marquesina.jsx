import React, { Children, useEffect, useRef, useState } from 'react';
import { useTexto } from './Traduccion';
import s from './Marquesina.module.css';

/**
 * Cinta que se desplaza sin fin (logos de marcas, barra de anuncios,
 * burbujas de categorías). Antes había 3 copias con distintas unidades de
 * velocidad; aquí `segundos` es lo que tarda en pasar todo el contenido.
 *
 * Repite el contenido lo justo para llenar el ancho (lo mide), se pausa con
 * el ratón encima o con foco, y con "reducir movimiento" queda como una fila
 * que se desliza a mano.
 */
export default function Marquesina({ children, segundos = 30, espacio = '2.5rem', etiqueta, invertir = false, className }) {
  const caja = useRef(null);
  const grupo = useRef(null);
  const [copias, setCopias] = useState(2);
  const elementos = Children.toArray(children);
  const nombre = useTexto(etiqueta);

  useEffect(() => {
    const medir = () => {
      const anchoCaja = caja.current?.clientWidth || 0;
      const anchoGrupo = grupo.current?.scrollWidth || 1;
      // Cada "mitad" del recorrido debe cubrir la pantalla.
      setCopias(Math.max(2, Math.ceil(anchoCaja / anchoGrupo) + 1));
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (caja.current) ro.observe(caja.current);
    return () => ro.disconnect();
  }, [elementos.length]);

  // Si "segundos" llega en milisegundos (config vieja del builder: 20000), se corrige.
  const duracion = segundos > 200 ? segundos / 1000 : segundos;

  const fila = (n) => (
    <div className={s.grupo} ref={n === 0 ? grupo : undefined} aria-hidden={n > 0 || undefined}>
      {elementos.map((el, i) => <div key={i} className={s.item}>{el}</div>)}
    </div>
  );

  return (
    <div
      ref={caja}
      className={[s.marquesina, invertir && s.invertir, className].filter(Boolean).join(' ')}
      style={{ '--duracion': `${duracion}s`, '--espacio': espacio, '--copias': copias }}
      role="region"
      aria-label={nombre}
    >
      <div className={s.cinta}>
        {Array.from({ length: copias }, (_, n) => <React.Fragment key={n}>{fila(n)}</React.Fragment>)}
      </div>
    </div>
  );
}
