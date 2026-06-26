import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useInView } from 'framer-motion';
import { useReducedMotionSafe } from '../../theme/motion';

/**
 * AnimatedNumber — contador animado reutilizable de Walá.
 *
 * Extraido del contador interno de KpiCard para poder usarlo en cualquier
 * superficie (KPIs, monedas de fidelizacion, totales, etc.) sin acoplarlo
 * al dashboard. Al entrar en viewport, anima desde 0 hasta `value` con un
 * muelle suave (sin rebote) y, cuando termina, deja el numero quieto.
 *
 * Respeta la accesibilidad: si el usuario pidio menos movimiento
 * (prefers-reduced-motion), muestra el valor final de inmediato sin animar.
 *
 * Props:
 *  - value:    numero objetivo a mostrar.
 *  - format:   funcion opcional (value -> string) para dar formato; por
 *              defecto redondea y aplica separadores de miles locales.
 *  - duration: duracion del muelle en segundos (por defecto 1.1).
 *  - className: clases extra (van al final para poder sobrescribir).
 *  - ...rest:  cualquier otra prop se pasa al <span>.
 */

// Formato por defecto: entero con separadores de miles segun el locale.
const formatoPorDefecto = (valor) => Math.round(valor).toLocaleString();

function AnimatedNumber({
  value = 0,
  format = formatoPorDefecto,
  duration = 1.1,
  className,
  ...rest
}) {
  const ref = useRef(null);
  // El contador solo dispara una vez, cuando entra en pantalla.
  const enVista = useInView(ref, { once: true, margin: '-40px' });

  // Si el usuario pidio menos movimiento, no animamos nunca (reactivo y SSR-safe).
  const sinMovimiento = useReducedMotionSafe();

  // Valor crudo del muelle + version "asentada" para renderizar texto.
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });

  // Texto inicial: si no hay movimiento, ya mostramos el valor final.
  const [display, setDisplay] = useState(() => format(sinMovimiento ? value : 0));

  // Dispara la animacion (o el salto directo) cuando entra en viewport o cambia value.
  useEffect(() => {
    if (sinMovimiento) {
      // Sin animacion: el numero final, ya.
      setDisplay(format(value));
      return;
    }
    if (enVista) {
      motionValue.set(value);
    }
  }, [enVista, value, sinMovimiento, motionValue, format]);

  // Suscribe el muelle -> estado de texto formateado.
  useEffect(() => {
    if (sinMovimiento) return undefined;
    const desuscribir = spring.on('change', (latest) => {
      setDisplay(format(latest));
    });
    return desuscribir;
  }, [spring, format, sinMovimiento]);

  return (
    <motion.span ref={ref} className={className} {...rest}>
      {display}
    </motion.span>
  );
}

export default AnimatedNumber;
