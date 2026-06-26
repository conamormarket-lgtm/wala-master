import React from 'react';
import { motion } from 'framer-motion';
import styles from './GlassCard.module.css';

/**
 * Contenedor "liquid glass" reutilizable.
 * Props:
 *  - title: titulo opcional renderizado en el encabezado.
 *  - actions: nodo opcional alineado a la derecha del encabezado.
 *  - className: clases extra para el contenedor.
 *  - bodyClassName: clases extra para el cuerpo.
 *  - animate: si true, usa variants de framer-motion (entrada escalonada desde el padre).
 *  - hover: si true, aplica un sutil scale en hover.
 *  - as: elemento contenedor (por defecto motion.section).
 */
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function GlassCard({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
  animate = true,
  hover = false,
  ...rest
}) {
  const Comp = animate ? motion.section : 'section';
  const motionProps = animate
    ? {
        variants: cardVariants,
        whileHover: hover ? { scale: 1.02 } : undefined,
      }
    : {};

  return (
    <Comp className={`${styles.card} ${className}`} {...motionProps} {...rest}>
      <span className={styles.highlight} aria-hidden="true" />
      {(title || actions) && (
        <header className={styles.header}>
          <div className={styles.headTexts}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={`${styles.body} ${bodyClassName}`}>{children}</div>
    </Comp>
  );
}
