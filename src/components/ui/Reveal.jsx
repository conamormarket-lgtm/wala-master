/* =========================================================================
   Walá Design System — Reveal / Stagger / StaggerItem
   -------------------------------------------------------------------------
   Wrappers de aparición al hacer scroll. Construidos SOBRE los presets de
   movimiento del tema (fadeUp / containerStagger / itemUp): nunca redeclaran
   la curva firma ni los variants localmente. Una sola pasada (whileInView con
   viewport once) — la entrada de contenido no es un loop.

   Accesibilidad: si el usuario pide menos movimiento, los tres componentes
   degradan a aparición inmediata sin desplazamiento (variants neutros de solo
   opacity) y se montan ya revelados, para que el contenido nunca quede oculto
   esperando un scroll que no dispara animación.

   API común: todos aceptan `as` (polimorfismo del elemento animado),
   `className` (siempre al final, sobrescribible), `children` y `...rest`
   passthrough; reenvían `ref` con React.forwardRef.
   ========================================================================= */

import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, containerStagger, itemUp, neutralVariants, useReducedMotionSafe } from '../../theme/motion';

/* Cache de componentes motion(as) por etiqueta/elemento, para no recrear el
   componente animado en cada render (framer-motion lo penaliza si cambia). */
const motionCache = new Map();

function getMotionComponent(as) {
  // motion.div es el caso por defecto y el más común: atajo directo.
  if (as == null || as === 'div') return motion.div;
  if (!motionCache.has(as)) {
    // motion(as) acepta tanto strings ('section', 'li'…) como componentes.
    motionCache.set(as, motion(as));
  }
  return motionCache.get(as);
}

/* -------------------------------------------------------------------------
   <Reveal> (default export)
   Funde y desliza 24px hacia arriba al entrar en el viewport. Una sola vez.
   props: as ('div'), delay (segundos, 0), className, children, ...rest.
   ------------------------------------------------------------------------- */
const Reveal = React.forwardRef(function Reveal(
  { as = 'div', delay = 0, className, children, ...rest },
  ref,
) {
  const reducido = useReducedMotionSafe();
  const Componente = getMotionComponent(as);

  // Con menos movimiento: variants de solo opacity y arranque ya revelado.
  const variants = reducido ? neutralVariants : fadeUp;

  return (
    <Componente
      ref={ref}
      variants={variants}
      initial={reducido ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      // El delay se aplica encima de la transición propia del variant.
      transition={reducido ? undefined : { delay }}
      className={className}
      {...rest}
    >
      {children}
    </Componente>
  );
});

/* -------------------------------------------------------------------------
   <Stagger> (named export)
   Contenedor que revela a sus hijos en cascada al entrar en viewport. Combinar
   con <StaggerItem> (o cualquier hijo con variants hidden/show). Una sola vez.
   props: as ('div'), className, children, ...rest.
   ------------------------------------------------------------------------- */
const Stagger = React.forwardRef(function Stagger(
  { as = 'div', className, children, ...rest },
  ref,
) {
  const reducido = useReducedMotionSafe();
  const Componente = getMotionComponent(as);

  // Sin movimiento no orquestamos cascada: aparición inmediata y plana.
  const variants = reducido ? neutralVariants : containerStagger;

  return (
    <Componente
      ref={ref}
      variants={variants}
      initial={reducido ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      className={className}
      {...rest}
    >
      {children}
    </Componente>
  );
});

/* -------------------------------------------------------------------------
   <StaggerItem> (named export)
   Hijo de <Stagger>: el contenedor controla cuándo se revela cada item, así que
   NO declara initial/whileInView propios (heredan el estado del padre). Aporta
   solo sus variants (itemUp). Una sola vez, vía el contenedor.
   props: as ('div'), className, children, ...rest.
   ------------------------------------------------------------------------- */
const StaggerItem = React.forwardRef(function StaggerItem(
  { as = 'div', className, children, ...rest },
  ref,
) {
  const reducido = useReducedMotionSafe();
  const Componente = getMotionComponent(as);

  const variants = reducido ? neutralVariants : itemUp;

  return (
    <Componente ref={ref} variants={variants} className={className} {...rest}>
      {children}
    </Componente>
  );
});

export { Stagger, StaggerItem };
export default Reveal;
