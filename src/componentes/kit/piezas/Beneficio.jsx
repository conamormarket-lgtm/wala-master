import React from 'react';
import { IconoWala } from '../IconosWala';
import s from './Beneficio.module.css';

/**
 * Ícono de Walá + texto.
 *  - variante: 'pildora' (íconos de confianza) | 'fila' (lista de beneficios, numerada)
 *  - icono: nombre de IconoWala (también acepta emojis o nombres viejos)
 *  - numero: para la fila (01, 02…)
 *  - como: etiqueta HTML (por defecto 'li', van dentro de una lista)
 */
export function Beneficio({ icono, texto, variante = 'pildora', numero, como: Etiqueta = 'li' }) {
  if (variante === 'fila') {
    return (
      <Etiqueta className={s.fila}>
        <IconoWala nombre={icono} tamano={48} />
        <span className={s.texto}>{texto}</span>
        {numero != null && <span className={s.numero} aria-hidden="true">{String(numero).padStart(2, '0')}</span>}
      </Etiqueta>
    );
  }
  return (
    <Etiqueta className={s.pildora}>
      <IconoWala nombre={icono} tamano={46} className={s.icono} />
      <span>{texto}</span>
    </Etiqueta>
  );
}
