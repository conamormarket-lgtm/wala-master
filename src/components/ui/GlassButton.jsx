import React from 'react';
import { motion } from 'framer-motion';
import styles from './GlassButton.module.css';

/**
 * GlassButton — botón premium del sistema de diseño "Aurora Violeta Serena".
 *
 * Iguala/supera el Button del repo: gradiente de marca, ripple blanco en hover,
 * niveles glass y microinteracciones de framer-motion (tap + hover) que siempre
 * respetan prefers-reduced-motion (vía CSS y motion-reduce del navegador).
 *
 * Props:
 *  - variant: 'primary' | 'ghost' | 'glass' | 'danger' (por defecto 'primary').
 *  - size: 'sm' | 'md' | 'lg' (por defecto 'md').
 *  - loading: si true, muestra un mini-spinner inline PRESERVANDO los children,
 *    fija aria-busy y deshabilita la interacción.
 *  - icon: nodo opcional a la izquierda (startIcon) con gap.
 *  - endIcon: nodo opcional a la derecha.
 *  - fullWidth: ocupa todo el ancho disponible.
 *  - disabled: deshabilita el botón.
 *  - as: 'button' | 'a' | Link (por defecto 'button'). Si es 'button' añade type.
 *  - type: tipo del botón nativo (por defecto 'button' cuando as === 'button').
 *  - className: clases extra (SIEMPRE al final del join para poder sobrescribir).
 *  - ...rest: passthrough (href, onClick, to, etc.).
 */
const GlassButton = React.forwardRef(function GlassButton(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    endIcon,
    fullWidth = false,
    disabled = false,
    as = 'button',
    type,
    className,
    children,
    ...rest
  },
  ref,
) {
  // Helper de clases estándar del sistema: condicionales + className al final.
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.full,
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // motion(as) permite polimorfismo (button | a | Link) preservando las
  // microinteracciones. Para strings nativos motion mantiene un caché interno.
  const MotionComp = React.useMemo(() => motion(as), [as]);

  // Cuando está deshabilitado o cargando no animamos el tap/hover.
  const interactive = !disabled && !loading;
  const isNativeButton = as === 'button';

  // Atributos de estado: el botón nativo usa `disabled`; los demás (a/Link)
  // usan aria-disabled para no romper la navegación accesible.
  const stateProps = isNativeButton
    ? { disabled: disabled || loading }
    : { 'aria-disabled': disabled || loading || undefined };

  return (
    <MotionComp
      ref={ref}
      className={classes}
      type={isNativeButton ? type || 'button' : type}
      aria-busy={loading || undefined}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.97 } : undefined}
      {...stateProps}
      {...rest}
    >
      {/* Capa de ripple/sheen decorativa; el CSS la anima en hover. */}
      <span className={styles.ripple} aria-hidden="true" />

      <span className={styles.content}>
        {loading && (
          // Spinner inline: NO reemplaza a los children, los acompaña.
          <span className={styles.spinner} aria-hidden="true" />
        )}
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        {children != null && <span className={styles.label}>{children}</span>}
        {endIcon && (
          <span className={styles.icon} aria-hidden="true">
            {endIcon}
          </span>
        )}
      </span>
    </MotionComp>
  );
});

export default GlassButton;
