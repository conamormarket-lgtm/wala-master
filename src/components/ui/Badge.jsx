import React from 'react';
import styles from './Badge.module.css';

/**
 * Badge — Etiqueta de estado de Walá.
 *
 * Sirve para señalar estados, categorías o pequeños indicadores junto a un texto
 * o título. Sobria por defecto (variante "soft"), con acento violeta escaso y
 * solo para datos/estado. El violeta es la marca; el aire es Slate.
 *
 * Props:
 * - tone: 'neutral' | 'violet' | 'success' | 'warning' | 'danger' (default 'neutral')
 * - variant: 'solid' | 'soft' | 'outline' (default 'soft')
 * - size: 'sm' | 'md' (default 'sm')
 * - dot: bool — muestra un puntito de color a la izquierda (estado en vivo)
 * - as: tipo de elemento a renderizar (default 'span')
 * - className: clases extra (siempre al final del join para poder sobrescribir)
 * - ...rest: passthrough (aria-*, onClick, etc.)
 */
const Badge = React.forwardRef(function Badge(
  {
    tone = 'neutral',
    variant = 'soft',
    size = 'sm',
    dot = false,
    as: Component = 'span',
    className,
    children,
    ...rest
  },
  ref,
) {
  // Helper de clases estándar del sistema: base + tone + variant + size + extra.
  const clases = [
    styles.badge,
    styles[tone],
    styles[variant],
    styles[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component ref={ref} className={clases} {...rest}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </Component>
  );
});

export default Badge;
