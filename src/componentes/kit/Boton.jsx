import React from 'react';
import { Loader2 } from 'lucide-react';
import s from './Boton.module.css';

/**
 * Botón de Walá. Violeta liso (sin degradado), 44px de alto táctil mínimo.
 *
 *  - variante: 'primario' | 'secundario' | 'contorno' | 'fantasma' | 'peligro'
 *  - tamano: 'sm' | 'md' | 'lg'
 *  - icono / iconoFin: nodos a izquierda / derecha
 *  - cargando: muestra spinner en lugar del icono y bloquea el clic
 *  - bloque: ocupa todo el ancho
 *  - soloIcono: botón cuadrado; exige aria-label
 */
export default function Boton({
  variante = 'primario',
  tamano = 'md',
  icono,
  iconoFin,
  cargando = false,
  bloque = false,
  soloIcono = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}) {
  const cls = [
    s.boton,
    s[variante],
    s[tamano],
    bloque && s.bloque,
    soloIcono && s.soloIcono,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...rest}
    >
      {cargando ? <Loader2 className={s.spin} aria-hidden="true" /> : icono}
      {children != null && <span className={s.texto}>{children}</span>}
      {!cargando && iconoFin}
    </button>
  );
}
