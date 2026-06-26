// =========================================================================
// GlassPanel — Superficie glass simple, sin header
// -------------------------------------------------------------------------
// Contenedor estructural translucido, mas ligero que GlassCard: no trae
// titulo, icono ni acciones; solo envuelve secciones con el cristal de marca.
// El movimiento NO vive aqui (es un contenedor); si se desea revelado, se
// envuelve con <Reveal> u otro preset de '../../theme/motion'.
//
// Reutiliza los mismos niveles glass que GlassCard (soft / solid / intense)
// y los tokens de src/theme/tokens.css. forwardRef + default export.
// =========================================================================

import React from 'react';
import styles from './GlassPanel.module.css';

/**
 * Superficie glass simple para envolver secciones.
 *
 * @param {React.ReactNode} children            Contenido directo del panel.
 * @param {'soft'|'solid'|'intense'} [variant]  Nivel de cristal. Default 'soft'.
 * @param {'none'|'sm'|'md'|'lg'} [padding]      Relleno interno. Default 'md'.
 * @param {string} [className]                   Clases extra (siempre al final del join).
 * @param {React.ElementType} [as]               Elemento/componente raiz. Default 'div'.
 */
const GlassPanel = React.forwardRef(function GlassPanel(
  {
    children,
    variant = 'soft',
    padding = 'md',
    className,
    as: Component = 'div',
    ...rest
  },
  ref
) {
  // Mapa de variantes -> clase de nivel glass.
  const variantClass = styles[variant] || styles.soft;
  // Mapa de padding -> clase .pad*. ('md' -> .padMd, etc.)
  const paddingClass =
    styles[`pad${padding.charAt(0).toUpperCase()}${padding.slice(1)}`] ||
    styles.padMd;

  const classes = [styles.panel, variantClass, paddingClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component ref={ref} className={classes} {...rest}>
      {/* Brillo superior del vidrio (puramente decorativo). */}
      <span className={styles.highlight} aria-hidden="true" />
      {children}
    </Component>
  );
});

export default GlassPanel;
