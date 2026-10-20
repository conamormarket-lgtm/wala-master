import React from 'react';
import { Texto, useTexto } from '../Traduccion';
import { TextoResaltado } from './TextoResaltado';
import s from './BarraProgreso.module.css';

/**
 * Barra de progreso con un texto encima. Colores por variables
 * (--bp-texto, --bp-acento, --bp-pista y --bp-relleno, el color de lo
 * avanzado) para seguir al panel que la contiene.
 *  - valor, max
 *  - texto: nodo sobre la barra (usar <strong> para el número)
 *  - minimo: % mínimo visible de la barra
 *  - pasos: en vez de una barra continua, `max` pasos y se encienden `valor`
 *    (días de una racha: se cuentan de un vistazo).
 *  - etiqueta: en vez de `texto`, una fila con la etiqueta a la izquierda y
 *    "valor/max" a la derecha ("Felicidad … 40/100", "Días reclamados … 4/7").
 *  - ariaLabel: nombre de la barra para lectores de pantalla (sin texto visible)
 * La etiqueta y ariaLabel se traducen aquí (llegan en español).
 */
export function BarraProgreso({ valor, max = 100, texto: textoPropio, minimo = 8, pasos = false, etiqueta, ariaLabel }) {
  const nombre = useTexto(ariaLabel);
  const texto = etiqueta
    ? <span className={s.fila}><span><Texto>{etiqueta}</Texto></span><strong>{Number(valor) || 0}/{max}</strong></span>
    : textoPropio;
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
      <span className={s.pista} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={valor} aria-label={nombre}>
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
  return <BarraProgreso valor={n} max={limite} texto={<TextoResaltado resaltar={[n]}>{n <= 5 ? `¡Solo quedan ${n}!` : `Quedan ${n}`}</TextoResaltado>} />;
}
