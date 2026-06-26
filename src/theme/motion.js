/* =========================================================================
   Walá Design System — Movimiento (presets framer-motion)
   -------------------------------------------------------------------------
   Fuente de verdad JS de la curva firma y los variants reutilizables. Espejo
   de las variables de movimiento en src/theme/tokens.css (--ease-signature,
   --dur-rapida|media|lenta). Importa SIEMPRE desde aqui (o desde el barrel
   '../../theme'); NUNCA redeclares el array de easing ni los variants en cada
   componente. Modulo .js puro: sin JSX, exports nombrados.
   ========================================================================= */

import { useEffect, useState } from 'react';

/* -------------------------------------------------------------------------
   CURVAS DE EASING
   La curva firma (expo-out): arranca rapido y asienta con calma. Es la misma
   que vive en --transicion-suave / --ease-signature. Unica fuente JS.
   ------------------------------------------------------------------------- */
export const EASE_SIGNATURE = [0.16, 1, 0.3, 1];

/* Entrada larga (sheen de revelado, drift de aurora, entradas de hero). */
export const EASE_ENTRANCE = [0.22, 1, 0.36, 1];

/* -------------------------------------------------------------------------
   DURACIONES (en segundos, formato framer-motion). Espejo de los tokens CSS
   --dur-rapida (180ms), --dur-media (320ms), --dur-lenta (500ms).
   ------------------------------------------------------------------------- */
export const DUR = {
  rapida: 0.18, // hover, toggles, feedback tactil
  media: 0.32, // transiciones de estado
  lenta: 0.5, // entradas de contenido
};

/* -------------------------------------------------------------------------
   VARIANTS BASE
   Pensados para el par hidden/show (con whileInView o animate controlado por
   el contenedor). El contenedor usa containerStagger y los hijos itemUp.
   ------------------------------------------------------------------------- */

/* Aparece deslizandose 24px hacia arriba mientras se funde. Entrada estandar. */
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.lenta, ease: EASE_SIGNATURE },
  },
};

/* Funde puro, sin desplazamiento. Para cuando el transform estorba. */
export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.4, ease: EASE_SIGNATURE },
  },
};

/* Crece desde 0.94 mientras aparece. Para tarjetas, popovers, badges. */
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.media, ease: EASE_SIGNATURE },
  },
};

/* Item de una lista escalonada. Es el mismo gesto que fadeUp (y: 24 -> 0). */
export const itemUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.lenta, ease: EASE_SIGNATURE },
  },
};

/* Contenedor que revela a sus hijos en cascada. Combinar con itemUp/fadeUp. */
export const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/* -------------------------------------------------------------------------
   SPRINGS
   Muelle suave, sin rebote perceptible. Para drags, toggles y numeros vivos.
   ------------------------------------------------------------------------- */
export const springSoft = { type: 'spring', stiffness: 300, damping: 24 };

/* -------------------------------------------------------------------------
   TRANSICION DE PAGINA (rutas con AnimatePresence)
   Fade PURO de opacidad, sin transform: el transform en el contenedor de ruta
   rompe position: fixed/sticky de los hijos (header/footer/modales). Bug
   documentado; no lo reintroduzcas anadiendo x/y/scale aqui.
   ------------------------------------------------------------------------- */
export const pageTransition = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: DUR.media, ease: EASE_SIGNATURE },
  },
  exit: {
    opacity: 0,
    transition: { duration: DUR.rapida },
  },
};

/* -------------------------------------------------------------------------
   FACTORIES (variants a medida sin redeclarar la curva)
   ------------------------------------------------------------------------- */

/* fadeUp parametrizable. `distance` es alias de `y` (compatibilidad de copy). */
export function fadeUpCustom({ y = 24, duration = DUR.lenta, distance } = {}) {
  const desplazamiento = distance != null ? distance : y;
  return {
    hidden: { opacity: 0, y: desplazamiento },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration, ease: EASE_SIGNATURE },
    },
  };
}

/* Contenedor de stagger parametrizable (ritmo de la cascada). */
export function staggerContainer({ stagger = 0.08, delayChildren = 0.05 } = {}) {
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/* -------------------------------------------------------------------------
   ACCESIBILIDAD: prefiere-menos-movimiento
   ------------------------------------------------------------------------- */

/* Lectura puntual (fuera de React). Seguro en SSR / Capacitor. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* Hook reactivo: escucha cambios de la preferencia en vivo. Devuelve boolean.
   Usalo para elegir variants neutros (solo opacity) cuando sea true. */
export function useReducedMotionSafe() {
  const [reducido, setReducido] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const alCambiar = (evento) => setReducido(evento.matches);

    // addEventListener moderno con fallback a addListener (Safari/iOS antiguos).
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', alCambiar);
      return () => mql.removeEventListener('change', alCambiar);
    }
    mql.addListener(alCambiar);
    return () => mql.removeListener(alCambiar);
  }, []);

  return reducido;
}

/* Variants neutros (solo opacity, sin y/scale) para usar cuando el usuario
   pide menos movimiento. Mismo contrato hidden/show que los variants normales. */
export const neutralVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.rapida } },
};
