import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import s from './Acordeon.module.css';

/**
 * Acordeón de preguntas (FAQ, detalles de producto, políticas).
 * Uno abierto a la vez (o varios con `multiple`). Abre/cierra con una
 * transición de alto real (grid 0fr → 1fr), sin medir en JS.
 *
 *  - items: [{ id, question, answer }]  (mismos campos que el builder)
 *  - abiertoInicial: id o true (el primero).
 */
export default function Acordeon({ items = [], abiertoInicial = false, multiple = false }) {
  const uid = useId();
  const inicial = abiertoInicial === true ? items[0]?.id : abiertoInicial || null;
  const [abiertos, setAbiertos] = useState(() => (inicial ? [inicial] : []));

  const alternar = (id) => setAbiertos((a) => {
    if (a.includes(id)) return a.filter((x) => x !== id);
    return multiple ? [...a, id] : [id];
  });

  return (
    <div className={s.acordeon}>
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
                <span>{it.question}</span>
                <ChevronDown className={s.flecha} aria-hidden="true" />
              </button>
            </h3>
            <div id={`${uid}-r-${i}`} role="region" aria-labelledby={`${uid}-b-${i}`} className={s.cuerpo}>
              <div className={s.interior}>
                <p>{it.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
