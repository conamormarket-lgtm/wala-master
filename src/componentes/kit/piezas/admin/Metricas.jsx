import React from 'react';
import { Hueso } from '../../Esqueletos';
import s from './Metricas.module.css';

/*
 * Las cifras de arriba de una página del admin (recepción, pagos y después
 * Resultados, D4). Reemplazan KpiCard / KpiRow: la cifra en letra de marca,
 * su nombre y, si se toca, filtra la lista de abajo.
 */

/**
 * Una cifra.
 *  - nombre · valor (ya con formato: "S/ 1,250.00", "12") · ayuda (una línea debajo)
 *  - tono: violeta | exito | aviso | peligro | cielo | neutro (la rayita de color)
 *  - onClick: si se pasa, es un botón (activo = es el filtro puesto)
 */
export function Cifra({ nombre, valor, ayuda, tono = 'violeta', onClick, activo = false, cargando = false }) {
  const contenido = (
    <>
      <span className={s.nombre}>{nombre}</span>
      {cargando ? <Hueso ancho="60%" alto={26} /> : <strong className={s.valor}>{valor}</strong>}
      {ayuda && <span className={s.ayuda}>{ayuda}</span>}
    </>
  );
  const cls = [s.cifra, s[tono], onClick && s.tocable, activo && s.activa].filter(Boolean).join(' ');
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-pressed={activo} data-componente="Cifra">{contenido}</button>
  ) : (
    <div className={cls} data-componente="Cifra">{contenido}</div>
  );
}

/** La fila de cifras: en columnas parejas; en el celular, de a dos (o deslizando si son muchas). */
export function FilaCifras({ children, etiqueta = 'Resumen' }) {
  return <div className={s.fila} role="group" aria-label={etiqueta} data-componente="FilaCifras">{children}</div>;
}
