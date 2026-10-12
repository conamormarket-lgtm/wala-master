import React from 'react';
import { Check } from 'lucide-react';
import s from './Etiquetas.module.css';

const MONEDA = '/assets/monedas/moneda-64.webp';

/** Etiqueta corta de estado o promoción. tono: violeta | oscuro | exito | aviso | peligro | neutro */
export function Etiqueta({ tono = 'violeta', icono, solida = false, children }) {
  return (
    <span className={[s.etiqueta, s[tono], solida && s.solida].filter(Boolean).join(' ')}>
      {icono}
      {children}
    </span>
  );
}

/** Chip seleccionable (filtros, categorías). */
export function Chip({ activo = false, onClick, icono, children }) {
  return (
    <button
      type="button"
      className={[s.chip, activo && s.chipActivo].filter(Boolean).join(' ')}
      aria-pressed={activo}
      onClick={onClick}
    >
      {activo ? <Check aria-hidden="true" /> : icono}
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
      <strong>{monto.toLocaleString('es-PE')}</strong>
    </span>
  );
}

/** Lo que el usuario gana (signo + y verde). */
export function GananciaMonedas({ monto }) {
  return (
    <span className={s.ganancia}>
      <img src={MONEDA} alt="" width="16" height="16" />
      <strong>+{monto.toLocaleString('es-PE')}</strong>
    </span>
  );
}

/** Saldo de monedas del usuario (header, cuenta). */
export function SaldoMonedas({ saldo, onClick }) {
  return (
    <button type="button" className={s.saldo} onClick={onClick} aria-label={`Tienes ${saldo} monedas`}>
      <img src={MONEDA} alt="" width="20" height="20" />
      <span>{saldo.toLocaleString('es-PE')}</span>
    </button>
  );
}

/** Contador sobre un icono (carrito, notificaciones). */
export function Contador({ valor }) {
  if (!valor) return null;
  return <span className={s.contador}>{valor > 99 ? '99+' : valor}</span>;
}
