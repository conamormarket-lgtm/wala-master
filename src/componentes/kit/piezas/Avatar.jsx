import React from 'react';
import s from './Avatar.module.css';

/** Hasta `letras` iniciales en mayúscula ("Ana Pérez" → "AP"); '' si no hay nombre. */
export const iniciales = (nombre, letras = 2) => String(nombre || '')
  .trim().split(/\s+/).filter(Boolean).slice(0, letras).map((p) => p[0]).join('').toUpperCase();

/**
 * Foto de una persona o sus iniciales en un círculo lila (noche: violeta
 * oscuro). La usan la cabecera, la barra inferior, el menú de la cuenta y
 * los testimonios.
 *  - nombre: de ahí salen las iniciales
 *  - imagen: foto (de Google u otra; se pide sin referrer)
 *  - letras: cuántas iniciales (2 por defecto)
 *  - children: lo que va sin foto ni nombre (p. ej. el ícono de usuario);
 *    sin eso, "?"
 *  - className: tamaño, borde y colores los pone quien la usa
 *
 * Las reglas de aquí no pesan (:where): cualquier clase de quien la usa gana.
 */
export function Avatar({ nombre, imagen, letras = 2, className, children, ...rest }) {
  const texto = iniciales(nombre, letras);
  return (
    <span className={[s.avatar, className].filter(Boolean).join(' ')} aria-hidden="true" {...rest}>
      {imagen ? <img src={imagen} alt="" referrerPolicy="no-referrer" /> : (texto || children || '?')}
    </span>
  );
}
