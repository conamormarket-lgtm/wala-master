import React, { forwardRef } from 'react';
import { Check, X } from 'lucide-react';
import { useContador } from './Efectos';
import { EtiquetaColgante } from './Marca';
import s from './Etiquetas.module.css';

const MONEDA = '/assets/monedas/moneda-64.webp';
const miles = (n) => Math.round(n).toLocaleString('es-PE');

const TONO_COLGANTE = { violeta: 'violeta', oscuro: 'noche', exito: 'verde', aviso: 'oro', peligro: 'rojo', neutro: 'suave' };

/**
 * Etiqueta corta de estado o promoción.
 * tono: violeta | oscuro | exito | aviso | peligro | neutro.
 * Las sólidas (descuento, "Nuevo", "Tu diseño") son etiquetas colgantes como
 * la del logo; las suaves, píldoras para estados.
 */
export function Etiqueta({ tono = 'violeta', icono, solida = false, children }) {
  if (solida) {
    return <EtiquetaColgante tono={TONO_COLGANTE[tono] || 'violeta'} tamano="md" icono={icono}>{children}</EtiquetaColgante>;
  }
  return (
    <span className={[s.etiqueta, s[tono], solida && s.solida].filter(Boolean).join(' ')}>
      {icono}
      {children}
    </span>
  );
}

/**
 * Chip seleccionable (filtros, categorías). Rebota y dibuja el check al activarse.
 *  - cuenta: número a la derecha (productos de ese filtro)
 *  - tamano: 'md' | 'sm'
 *  - onQuitar: chip de un filtro ya aplicado (violeta suave con ×); al tocarlo se quita
 */
export function Chip({ activo = false, onClick, onQuitar, icono, cuenta, tamano = 'md', children }) {
  if (onQuitar) {
    return (
      <button type="button" className={[s.chip, s.chipQuitar, tamano === 'sm' && s.chipSm].filter(Boolean).join(' ')} onClick={onQuitar}>
        {children}
        <X aria-label="Quitar" />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={[s.chip, activo && s.chipActivo, tamano === 'sm' && s.chipSm, cuenta != null && s.chipConCuenta].filter(Boolean).join(' ')}
      aria-pressed={activo}
      onClick={onClick}
    >
      {activo ? <Check key="check" className={s.check} aria-hidden="true" /> : icono}
      {children}
      {cuenta != null && <small className={s.chipCuenta}>{cuenta}</small>}
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
