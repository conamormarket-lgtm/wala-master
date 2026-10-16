import React, { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import s from './Acordeon.module.css';

/**
 * Acordeón: preguntas frecuentes, detalles de producto, políticas, grupos
 * de filtros del catálogo. Uno abierto a la vez (o varios con `multiple`).
 * Abre/cierra con una transición de alto real (grid 0fr → 1fr), sin medir en
 * JS; lo cerrado no se puede enfocar (inert).
 *
 *  - items: [{ id, question, answer, extra? }]  (mismos campos que el builder).
 *    `answer` puede ser texto (párrafo) o cualquier contenido (chips, campos…);
 *    `extra` va junto al título (p. ej. cuántos filtros hay elegidos).
 *  - abiertoInicial: id, lista de ids o true (el primero).
 *  - variante: 'tarjetas' (por defecto: cada pregunta en su tarjeta, FAQ) |
 *    'lista' (filas compactas separadas por una línea: filtros, detalles).
 */
export default function Acordeon({ items = [], abiertoInicial = false, multiple = false, variante = 'tarjetas' }) {
  const uid = useId();
  // Sin id, cada item usa p0, p1… (abajo): el primero también.
  const inicial = abiertoInicial === true ? [items[0]?.id ?? 'p0'] : [].concat(abiertoInicial || []);
  const [abiertos, setAbiertos] = useState(() => inicial.filter((x) => x != null));

  const alternar = (id) => setAbiertos((a) => {
    if (a.includes(id)) return a.filter((x) => x !== id);
    return multiple ? [...a, id] : [id];
  });

  return (
    <div className={[s.acordeon, variante === 'lista' && s.lista].filter(Boolean).join(' ')}>
      {items.map((it, i) => {
        const id = it.id ?? `p${i}`;
        const abierto = abiertos.includes(id);
        return (
          <div key={id} className={[s.item, abierto && s.abierto].filter(Boolean).join(' ')}>
            <h3 className={s.cabeza}>
              <button
                type="button"
                id={`${uid}-b-${i}`}
                aria-expanded={abierto}
                aria-controls={`${uid}-r-${i}`}
                onClick={() => alternar(id)}
              >
                <span className={s.pregunta}>{it.question}</span>
                {it.extra}
                <span className={s.signo} aria-hidden="true"><Plus /></span>
              </button>
            </h3>
            <div id={`${uid}-r-${i}`} role="region" aria-labelledby={`${uid}-b-${i}`} className={s.cuerpo} inert={abierto ? undefined : ''}>
              <div className={s.interior}>
                {typeof it.answer === 'string' ? <p>{it.answer}</p> : <div className={s.contenido}>{it.answer}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
