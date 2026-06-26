// =========================================================================
// Walá Design System — GlassCard
// -------------------------------------------------------------------------
// Tarjeta de vidrio (liquid-glass) generalizada. Supersede a la GlassCard
// del dashboard SIN tocarla: esta vive en src/components/ui y se reutiliza
// en toda la app (vitrina, paneles, modales suaves, etc.).
//
// Tres niveles de intensidad (soft|solid|intense) mapeados a los tokens de
// glass, tres tamaños de padding (sm|md|lg), entrada animada opcional
// (fadeUp via motion presets) y un hover opcional que eleva la superficie y
// sube un grado el halo violeta.
//
// Robustez: el fallback sólido (@supports), el comportamiento táctil y el
// respeto a prefers-reduced-motion viven en GlassCard.module.css.
// =========================================================================

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../theme/motion';
import styles from './GlassCard.module.css';

// Mapa de variantes de intensidad -> clase del módulo.
const VARIANT_CLASS = {
  soft: styles.soft,
  solid: styles.solid,
  intense: styles.intense,
};

// Mapa de padding -> clase del módulo.
const PADDING_CLASS = {
  sm: styles.padSm,
  md: styles.padMd,
  lg: styles.padLg,
};

/**
 * GlassCard — superficie de vidrio reutilizable.
 *
 * @param {string}  [title]          Título del header (se omite el header si no hay title/subtitle/actions).
 * @param {string}  [subtitle]       Subtítulo bajo el título.
 * @param {React.ReactNode} [actions] Nodo alineado a la derecha del header (botones, menús…).
 * @param {React.ReactNode} [children] Contenido del cuerpo.
 * @param {string}  [className]      Clases extra para la raíz (siempre al final, sobrescribe).
 * @param {string}  [bodyClassName]  Clases extra para el cuerpo.
 * @param {boolean} [animate=true]   Aplica la entrada fadeUp (motion).
 * @param {boolean} [hover=false]    Eleva la tarjeta y sube el halo violeta al pasar el cursor.
 * @param {'soft'|'solid'|'intense'} [variant='soft'] Nivel de intensidad del vidrio.
 * @param {'sm'|'md'|'lg'} [padding='md'] Densidad del padding interno.
 * @param {React.ElementType} [as='div'] Etiqueta/componente raíz (polimorfismo).
 */
const GlassCard = forwardRef(function GlassCard(
  {
    title,
    subtitle,
    actions,
    children,
    className,
    bodyClassName,
    animate = true,
    hover = false,
    variant = 'soft',
    padding = 'md',
    as = 'div',
    ...rest
  },
  ref
) {
  // ¿Renderizamos el header? Solo si hay algo que mostrar en él.
  const hasHeader = Boolean(title || subtitle || actions);

  // Clase raíz: base + intensidad + padding + hover + className (al final).
  const rootClassName = [
    styles.card,
    VARIANT_CLASS[variant] || VARIANT_CLASS.soft,
    PADDING_CLASS[padding] || PADDING_CLASS.md,
    hover && styles.hover,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Cuando se anima, la raíz es motion(as); si no, el propio `as`.
  // motion(Componente) memoiza por referencia, así que es seguro construirlo aquí.
  const RootTag = animate ? motion(as) : as;

  // Props de movimiento solo cuando animate está activo.
  const motionProps = animate
    ? {
        variants: fadeUp,
        initial: 'hidden',
        whileInView: 'show',
        viewport: { once: true, amount: 0.2 },
      }
    : {};

  return (
    <RootTag ref={ref} className={rootClassName} {...motionProps} {...rest}>
      {/* Brillo superior del vidrio (decorativo, no interactivo). */}
      <span className={styles.highlight} aria-hidden="true" />

      {hasHeader && (
        <header className={styles.header}>
          <div className={styles.headTexts}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}

      <div className={[styles.body, bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </RootTag>
  );
});

export default GlassCard;
