import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useContador } from './Efectos';
import { EtiquetaColgante } from './Marca';
import s from './Etiquetas.module.css';

/** La moneda de Walá (una sola imagen para todo el kit). */
export const MONEDA = '/assets/monedas/moneda-64.webp';
const miles = (n) => Math.round(n).toLocaleString('es-PE');

const TONO_COLGANTE = { violeta: 'violeta', oscuro: 'noche', exito: 'verde', aviso: 'oro', peligro: 'rojo', neutro: 'suave' };

/**
 * Etiqueta corta de estado o promoción.
 * tono: violeta | oscuro | exito | aviso | peligro | neutro.
 * Las sólidas (descuento, "Nuevo", "Tu diseño") son etiquetas colgantes como
 * la del logo; las suaves, píldoras para estados.
 *  - punto: un punto del color del texto antes (estado "en vivo": "● Disponible hoy").
 *  - sobreFoto: fondo opaco (el tono sobre la superficie) para que se lea
 *    encima de una imagen, también en modo noche.
 */
export function Etiqueta({ tono = 'violeta', icono, solida = false, punto = false, sobreFoto = false, children }) {
  if (solida) {
    return <EtiquetaColgante tono={TONO_COLGANTE[tono] || 'violeta'} tamano="md" icono={icono}>{children}</EtiquetaColgante>;
  }
  return (
    <span className={[s.etiqueta, s[tono], solida && s.solida, sobreFoto && s.sobreFoto].filter(Boolean).join(' ')}>
      {punto && <span className={s.punto} aria-hidden="true" />}
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

/** La moneda sola, del tamaño pedido (px). Decorativa: el número va al lado. */
export function Moneda({ tamano = 16, className }) {
  return <img src={MONEDA} alt="" width={tamano} height={tamano} className={className} />;
}

/**
 * Lo que algo cuesta en monedas. Lleva "CUESTA" escrito: una moneda + número
 * a secas se lee como algo que ganas, no como algo que pagas.
 */
export function CostoMonedas({ monto }) {
  return (
    <span className={s.costo}>
      <span className={s.costoTexto}>Cuesta</span>
      <Moneda />
      <strong>{miles(monto)}</strong>
    </span>
  );
}

/**
 * Lo que el usuario gana (verde, la moneda flota).
 *  - monto: "+N" (por defecto)
 *  - children: en vez de "+N", una frase ("Hasta +4 monedas al acertar")
 *  - icono: en vez de la moneda (p. ej. <IconoWala nombre="regalo" /> de un premio)
 */
export function GananciaMonedas({ monto, children, icono }) {
  return (
    <span className={s.ganancia}>
      {icono || <Moneda />}
      {children ? <span className={s.gananciaTexto}>{children}</span> : <strong>+{miles(monto)}</strong>}
    </span>
  );
}

/**
 * Saldo de monedas (header, cuenta). La moneda gira al pasar el ratón y el
 * número corre al cambiar. Mientras vuelan monedas ganadas
 * (volarMonedasGanadas de utils/animations), el número sube con cada una que
 * aterriza, como la cabecera de la tienda: escucha 'coins-animation-start',
 * 'coin-reached-target' y 'coins-animation-end'.
 */
export const SaldoMonedas = forwardRef(function SaldoMonedas({ saldo, ...rest }, ref) {
  // El saldo de antes de la última subida: si la página ya sumó las monedas
  // (justo antes de hacerlas volar), el contador parte de ahí.
  const historia = useRef({ actual: saldo, previo: saldo, cuando: 0 });
  if (historia.current.actual !== saldo) historia.current = { actual: saldo, previo: historia.current.actual, cuando: Date.now() };
  const [vuelo, setVuelo] = useState(null); // { base, llegado }
  useEffect(() => {
    const empezar = () => setVuelo((v) => {
      if (v) return v;
      const h = historia.current;
      return { base: Date.now() - h.cuando < 1500 ? h.previo : h.actual, llegado: 0 };
    });
    const llegar = (e) => setVuelo((v) => (v ? { ...v, llegado: v.llegado + (Number(e.detail?.amount) || 1) } : v));
    const terminar = () => setVuelo(null);
    window.addEventListener('coins-animation-start', empezar);
    window.addEventListener('coin-reached-target', llegar);
    window.addEventListener('coins-animation-end', terminar);
    return () => {
      window.removeEventListener('coins-animation-start', empezar);
      window.removeEventListener('coin-reached-target', llegar);
      window.removeEventListener('coins-animation-end', terminar);
    };
  }, []);
  const objetivo = vuelo ? Math.min(saldo, vuelo.base + vuelo.llegado) : saldo;
  const mostrado = useContador(objetivo, vuelo ? 0.28 : 0.9);
  return (
    // global-coins-target: adonde vuelan las monedas ganadas (volarMonedasGanadas
    // de utils/animations busca esa clase, como en la cabecera de la tienda).
    <button ref={ref} type="button" className={`${s.saldo} global-coins-target`} aria-label={`Tienes ${saldo} monedas`} {...rest}>
      <span className={s.saldoDestello} aria-hidden="true" />
      <Moneda tamano={20} />
      <span key={vuelo ? vuelo.llegado : 'quieto'} className={[s.saldoNumero, vuelo?.llegado && s.saldoSube].filter(Boolean).join(' ')}>{miles(mostrado)}</span>
    </button>
  );
});

/** Contador sobre un icono (carrito, notificaciones). Rebota cada vez que cambia. */
export function Contador({ valor }) {
  if (!valor) return null;
  return <span key={valor} className={s.contador}>{valor > 99 ? '99+' : valor}</span>;
}
