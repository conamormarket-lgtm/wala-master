import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Pencil, Plus } from 'lucide-react';
import { esquemaDe } from './esquemas';
import s from './Editor.module.css';

/**
 * Envuelve una sección de la página mientras se edita (reemplaza a
 * EditableSection). Con ratón: el contorno y la barra aparecen al pasar por
 * encima. Con el dedo: el primer toque la elige (y muestra su barra); los
 * siguientes llegan a la sección para probarla (enlaces, carruseles…).
 *
 *  - activa: es la que está abierta en el panel
 *  - resaltada: se está pasando por su fila en el panel
 *  - vacia: la sección no dibuja nada (le falta contenido). Si no se pasa,
 *    se detecta sola: sin texto ni imágenes adentro.
 *  - onEditar(id), onMover(id, ±1), onDuplicar(id)
 *  - nombre / icono: para lo que no es una sección del builder (el menú de
 *    la cabecera, el de cuenta…); si no, los del esquema de su tipo
 */
export function SeccionEditable({ id, tipo, nombre, icono, activa, resaltada, vacia, primera, ultima, onEditar, onMover, onDuplicar, children }) {
  const caja = useRef(null);
  const contenido = useRef(null);
  const [sinContenido, setSinContenido] = useState(false);
  const base = esquemaDe(tipo);
  const esquema = { ...base, nombre: nombre || base.nombre, icono: icono || base.icono };

  // Una sección recién creada (p. ej. preguntas sin preguntas) no dibuja nada:
  // se muestra un aviso para que no quede un hueco que no se puede tocar.
  useLayoutEffect(() => {
    const el = contenido.current;
    const v = !!el && !el.textContent.trim() && !el.querySelector('img, video, iframe, svg, input');
    if (v !== sinContenido) setSinContenido(v);
  });
  const Icono = esquema.icono;

  // Al abrirla desde el panel, que se vea en la página.
  useEffect(() => {
    if (!activa || !caja.current) return;
    const r = caja.current.getBoundingClientRect();
    if (r.bottom < 80 || r.top > window.innerHeight - 80) {
      const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      caja.current.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
    }
  }, [activa]);

  return (
    <div
      ref={caja}
      className={[s.editable, activa && s.editableActiva, resaltada && s.editableResaltada].filter(Boolean).join(' ')}
      // Sin abrir, un clic la elige en vez de seguir sus enlaces (el aviso de
      // salir sin publicar del editor lo mira).
      data-seccion-editable={activa ? 'abierta' : 'cerrada'}
      onClickCapture={(e) => {
        if (activa || e.target.closest(`.${s.barra}`)) return;
        e.preventDefault();
        e.stopPropagation();
        onEditar?.(id);
      }}
    >
      <div className={s.barra} role="toolbar" aria-label={`Sección: ${esquema.nombre}`}>
        <button type="button" className={s.barraNombre} onClick={() => onEditar?.(id)}>
          <Icono aria-hidden="true" /> {esquema.nombre} <Pencil className={s.barraLapiz} aria-hidden="true" />
        </button>
        {onMover && <button type="button" onClick={() => onMover(id, -1)} disabled={primera} aria-label="Subir"><ArrowUp aria-hidden="true" /></button>}
        {onMover && <button type="button" onClick={() => onMover(id, 1)} disabled={ultima} aria-label="Bajar"><ArrowDown aria-hidden="true" /></button>}
        {onDuplicar && <button type="button" onClick={() => onDuplicar(id)} aria-label="Duplicar"><Copy aria-hidden="true" /></button>}
      </div>
      {(vacia || sinContenido) && (
        <div className={s.editableVacia}>
          <strong>{esquema.nombre}</strong>
          <span>Aún no tiene contenido. Tócala para configurarla.</span>
        </div>
      )}
      {!vacia && <div ref={contenido}>{children}</div>}
    </div>
  );
}

/** Línea con "+" entre secciones para insertar una nueva en ese lugar. */
export function InsertarAqui({ indice, onInsertar, activo }) {
  return (
    <div className={[s.insertar, activo && s.insertarActivo].filter(Boolean).join(' ')}>
      <button type="button" onClick={() => onInsertar(indice)} aria-label={`Añadir una sección en el lugar ${indice + 1}`}>
        <Plus aria-hidden="true" /> <span>Añadir sección</span>
      </button>
    </div>
  );
}
