import React from 'react';
import { useTexto } from '../Traduccion';

/**
 * Un texto traducido con partes destacadas: `resaltar` son los valores (en el
 * orden en que salen: cifras, un nombre) que se marcan dentro del texto ya
 * traducido. Así la frase se traduce entera y lo importante sigue destacado.
 *  - envolver(parte, clave): cómo se marca cada una (por defecto, <strong>)
 */
export function TextoResaltado({ children, resaltar = [], envolver }) {
  const t = useTexto(children);
  if (typeof t !== 'string') return t ?? null;
  const partes = [];
  let resto = t;
  resaltar.map(String).filter(Boolean).forEach((marca, k) => {
    const i = resto.indexOf(marca);
    if (i < 0) return;
    partes.push(resto.slice(0, i), envolver ? envolver(marca, k) : <strong key={k}>{marca}</strong>);
    resto = resto.slice(i + marca.length);
  });
  partes.push(resto);
  return <>{partes}</>;
}
