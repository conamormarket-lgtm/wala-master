import React from 'react';
import { Sello } from '../Marca';
import { Texto, useTexto } from '../Traduccion';
import s from './PasosSellos.module.css';

/**
 * Unos pocos pasos en fila, cada uno con su ícono en un sello y unidos por
 * una costura punteada (en el celular, uno debajo del otro). Explica "qué
 * pasa ahora": el libro de reclamaciones (PasosAtencion), la invitación.
 *  - pasos: [{ icono (nodo de lucide), titulo, texto }]
 *  - etiqueta: nombre de la lista para lectores ("Lo que sigue")
 */
export function PasosSellos({ pasos = [], etiqueta = 'Pasos', className }) {
  const nombre = useTexto(etiqueta);
  return (
    <ol className={[s.pasos, className].filter(Boolean).join(' ')} aria-label={nombre} data-componente="PasosSellos">
      {pasos.map((p, k) => (
        <li key={p.titulo} className={s.paso}>
          <Sello tamano={40} girar={k % 2 ? 6 : -8}>{p.icono}</Sello>
          <span className={s.textos}>
            <strong><Texto>{p.titulo}</Texto></strong>
            {p.texto && <span><Texto>{p.texto}</Texto></span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
