import React from 'react';
import styles from './AuroraBackground.module.css';

/**
 * AuroraBackground
 * ----------------------------------------------------------------------------
 * Fondo decorativo de marca: orbes violeta difuminados / malla "aurora" que
 * viven DETRÁS del contenido (nunca sobre el vidrio). Pensado para heros,
 * dashboards y la vitrina del design system.
 *
 * Es puramente decorativo: aria-hidden, pointer-events:none y z-index negativo,
 * de modo que nunca intercepta clics ni aparece para lectores de pantalla.
 *
 * Props:
 *  - variant ('violet' | 'subtle' | 'vivid', default 'violet'):
 *      violet  -> malla aurora estándar (--gradient-aurora).
 *      subtle  -> misma malla pero más tenue (menos opacidad).
 *      vivid   -> malla más saturada con chispa magenta (--gradient-aurora-vivid).
 *  - fixed (bool, default false): position fixed (acompaña el scroll) en vez de
 *      absolute (anclado al contenedor relativo más cercano).
 *  - intensity (number 0..1, opcional): multiplica la opacidad global de la
 *      capa de orbes vía style inline (para atenuar/intensificar a discreción).
 *  - className: clases extra (siempre al final, para poder sobrescribir).
 *  - ...rest: passthrough al div raíz.
 *
 * Movimiento: los orbes hacen un "drift" lento e infinito (auroraDrift). En
 * prefers-reduced-motion la malla queda estática (igual de bonita, sin deriva).
 * No usa backdrop-filter, así que no necesita fallback @supports.
 */
const AuroraBackground = React.forwardRef(function AuroraBackground(
  {
    variant = 'violet',
    fixed = false,
    intensity,
    className,
    style,
    ...rest
  },
  ref
) {
  // La intensidad solo se aplica si llega un número válido en [0, 1].
  const tieneIntensidad = typeof intensity === 'number' && !Number.isNaN(intensity);
  const opacidad = tieneIntensidad ? Math.min(1, Math.max(0, intensity)) : undefined;

  // Combinación estándar de clases: base + posición + variante + override.
  const clases = [
    styles.root,
    fixed ? styles.fixed : styles.absolute,
    styles[variant] || styles.violet,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Si hay intensidad, se inyecta como CSS var para que la consuman las capas.
  const estiloRaiz =
    opacidad !== undefined
      ? { ...style, '--aurora-intensity': opacidad }
      : style;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={clases}
      style={estiloRaiz}
      {...rest}
    >
      {/* Capa principal: la malla aurora completa que deriva lentamente. */}
      <div className={`${styles.layer} ${styles.layerBase}`} />
      {/* Capa secundaria: un eco desfasado que da profundidad al movimiento. */}
      <div className={`${styles.layer} ${styles.layerEcho}`} />
    </div>
  );
});

export default AuroraBackground;
