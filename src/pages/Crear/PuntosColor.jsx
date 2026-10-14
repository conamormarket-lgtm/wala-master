import React from 'react';
import { fondoColorGuardado } from '../../utils/prendaBase';
import styles from './PuntosColor.module.css';

const clave = (c) => [c.nombre, c.hex, c.hex2, c.patron, c.espejo].join('|');

/**
 * Los colores de las prendas de un combo: un punto por color (uno solo si
 * todas son del mismo color), juntos, con sus nombres al pasar el mouse.
 *
 *   <PuntosColor colores={[{ nombre, hex, hex2?, patron? }, …]} />
 */
const PuntosColor = ({ colores = [] }) => {
  const unicos = [];
  colores.filter((c) => c?.nombre || c?.hex).forEach((c) => {
    if (!unicos.some((u) => clave(u) === clave(c))) unicos.push(c);
  });
  if (!unicos.length) return null;
  return (
    <span className={styles.puntos} title={unicos.map((c) => c.nombre).filter(Boolean).join(' y ')}>
      {unicos.map((c) => (
        <span key={clave(c)} className={styles.punto} style={{ background: fondoColorGuardado(c) }} aria-hidden="true" />
      ))}
    </span>
  );
};

export default PuntosColor;
