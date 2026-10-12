import React, { forwardRef } from 'react';
import { Check } from 'lucide-react';
import { useContador } from './Efectos';
import s from './Etiquetas.module.css';

const MONEDA = '/assets/monedas/moneda-64.webp';
const miles = (n) => Math.round(n).toLocaleString('es-PE');

/**
 * Etiqueta corta de estado o promoción.
 * tono: violeta | oscuro | exito | aviso | peligro | neutro.
 * Las sólidas llevan un destello que pasa cada pocos segundos.
 */
export function Etiqueta({ tono = 'violeta', icono, solida = false, children }) {
  return (
    <span className={[s.etiqueta, s[tono], solida && s.solida].filter(Boolean).join(' ')}>
      {icono}
      {children}
    </span>
  );
}

/** Chip seleccionable (filtros, categorías). Rebota y dibuja el check al activarse. */
export function Chip({ activo = false, onClick, icono, children }) {
  return (
    <button
      type="button"
      className={[s.chip, activo && s.chipActivo].filter(Boolean).join(' ')}
      aria-pressed={activo}
      onClick={onClick}
    >
      {activo ? <Check key="check" className={s.check} aria-hidden="true" /> : icono}
      {children}
    </button>
  );
}

/**
 * Lo que algo cuesta en monedas. Lleva "CUESTA" escrito: una moneda + número
 * a secas se lee como algo que ganas, no como algo que pagas.
 */
export function CostoMonedas({ monto }) {
  return (
    <span className={s.costo}>
      <span className={s.costoTexto}>Cuesta</span>
      <img src={MONEDA} alt="" width="16" height="16" />
      <strong>{miles(monto)}</strong>
    </span>
  );
}

/** Lo que el usuario gana (signo + y verde, la moneda flota). */
export function GananciaMonedas({ monto }) {
  return (
    <span className={s.ganancia}>
      <img src={MONEDA} alt="" width="16" height="16" />
      <strong>+{miles(monto)}</strong>
    </span>
  );
}

/** Saldo de monedas (header, cuenta). La moneda gira al pasar el ratón y el número corre al cambiar. */
export const SaldoMonedas = forwardRef(function SaldoMonedas({ saldo, ...rest }, ref) {
  const mostrado = useContador(saldo, 0.9);
  return (
    <button ref={ref} type="button" className={s.saldo} aria-label={`Tienes ${saldo} monedas`} {...rest}>
      <span className={s.saldoDestello} aria-hidden="true" />
      <img src={MONEDA} alt="" width="20" height="20" />
      <span className={s.saldoNumero}>{miles(mostrado)}</span>
    </button>
  );
});

/** Contador sobre un icono (carrito, notificaciones). Rebota cada vez que cambia. */
export function Contador({ valor }) {
  if (!valor) return null;
  return <span key={valor} className={s.contador}>{valor > 99 ? '99+' : valor}</span>;
}
