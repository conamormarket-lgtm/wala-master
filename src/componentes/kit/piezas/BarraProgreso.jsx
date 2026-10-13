import React from 'react';
import s from './BarraProgreso.module.css';

/**
 * Barra de progreso con un texto encima. Colores por variables
 * (--bp-texto, --bp-acento, --bp-pista) para seguir al panel que la contiene.
 *  - valor, max
 *  - texto: nodo sobre la barra (usar <strong> para el número)
 *  - minimo: % mínimo visible de la barra
 *  - pasos: en vez de una barra continua, `max` pasos y se encienden `valor`
 *    (días de una racha: se cuentan de un vistazo). El texto va a los lados.
 */
export function BarraProgreso({ valor, max = 100, texto, minimo = 8, pasos = false }) {
  if (pasos) {
    const n = Math.max(0, Math.min(max, Number(valor) || 0));
    return (
      <div className={`${s.barra} ${s.conPasos}`}>
        {texto && <span className={s.texto}>{texto}</span>}
        <span className={s.pasos} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={n}>
          {Array.from({ length: max }, (_, i) => <span key={i} className={i < n ? s.pasoOn : undefined} />)}
        </span>
      </div>
    );
  }
  const pct = Math.max(minimo, Math.min(100, (Number(valor) / max) * 100));
  return (
    <div className={s.barra}>
      {texto && <span className={s.texto}>{texto}</span>}
      <span className={s.pista} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={valor}>
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/** Espacio vacío del mismo alto (para que una fila de tarjetas quede pareja). */
export function BarraProgresoVacia() {
  return <div className={s.barra} aria-hidden="true" />;
}

/** "Quedan N" cuando el stock es bajo (≤ limite); si no, reserva el lugar. */
export function StockBajo({ stock, limite = 20 }) {
  const n = Number(stock);
  if (!Number.isFinite(n) || n <= 0 || n > limite) return <BarraProgresoVacia />;
  return <BarraProgreso valor={n} max={limite} texto={n <= 5 ? <>¡Solo quedan <strong>{n}</strong>!</> : <>Quedan <strong>{n}</strong></>} />;
}
