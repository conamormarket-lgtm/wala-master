import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionSafe } from '../../../theme/motion';
import styles from './BrandLoader.module.css';

/**
 * Pantalla de carga estilizada del sistema (isotipo del logo en "negativo"
 * — bolsa blanca + W violeta — sobre el degradado de marca).
 *
 * Animación (framer-motion). Se mueve UNICAMENTE el icono; el fondo y el
 * resplandor detras quedan estaticos.
 *  - El icono hace un "click" tipo boton en loop: se encoge y baja unos px
 *    (press), rebota con un leve overshoot (el impulso) y vuelve exacto a su
 *    tamaño/posicion. Solo escala + traslada (no deforma ni recolorea).
 *  - Una barra de progreso indeterminada con brillo suave: comunica "algo
 *    esta pasando" sin fingir un porcentaje real.
 *
 * Los elementos NO tienen animacion de ENTRADA (aparecen ya en su estado
 * final): asi el relevo desde el splash estatico de index.html — que muestra
 * el MISMO lockup — es invisible. La animacion de SALIDA (al terminar la
 * carga) vive en BrandLoaderOverlay.jsx.
 *
 * Respeta prefers-reduced-motion (useReducedMotionSafe): sin movimiento,
 * icono quieto y la barra como un trazo estatico a medio llenar.
 *
 * @param {'fill'|'inline'} variant  'fill' = llena el alto de su contenedor,
 *   'inline' = alto fijo mas chico para usar suelto dentro de un layout.
 */
const BrandLoader = ({ variant = 'fill' }) => {
  const reducedMotion = useReducedMotionSafe();

  return (
    <div
      className={`${styles.loader} ${variant === 'inline' ? styles.inline : styles.fill}`}
      role="status"
      aria-label="Cargando"
    >
      <div className={styles.stack}>
        <div className={styles.markWrap}>
          {/* Resplandor ESTATICO detras del icono (dos capas radiales para
              dar profundidad). No se anima: el usuario pidio que se mueva
              UNICAMENTE el icono y el fondo quede quieto. */}
          <span className={styles.haloWide} aria-hidden="true" />
          <span className={styles.halo} aria-hidden="true" />
          {/* El icono hace un gesto de "click" tipo boton de interfaz, en
              loop: se encoge y baja unos px (como si lo presionaran), luego
              rebota con un leve overshoot (el "impulso") y vuelve exacto a su
              tamaño y posicion. Rapido y natural (~0.7s), con una pausa entre
              clicks (repeatDelay). Solo escala + traslada: no deforma el logo
              ni cambia colores. transform-origin al centro para que el
              encogido sea simetrico. */}
          <motion.svg
            viewBox="12 0 94 109"
            className={styles.mark}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ transformOrigin: 'center center' }}
            animate={reducedMotion ? undefined : { scale: [1, 0.93, 1.02, 1], y: [0, 5, -1.5, 0] }}
            transition={reducedMotion ? undefined : {
              duration: 1.1,
              times: [0, 0.28, 0.62, 1],
              ease: ['easeOut', 'easeOut', 'easeInOut'],
              repeat: Infinity,
              repeatDelay: 1.1,
            }}
          >
            <defs>
              {/* Mismo degradado de marca que el logo real del Header
                  (walaGradient: #8B5CF6 -> #5B21B6 en diagonal). Id propio
                  ('walaLoaderGrad') para no colisionar con el id del Header,
                  que puede estar en el DOM a la vez detras del overlay. */}
              <linearGradient id="walaLoaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#5B21B6" />
              </linearGradient>
            </defs>
            <path
              d="M 32 42 L 28 88 C 27 92 30 94 34 93 L 85 80 C 89 79 91 76 89 72 L 76 18 C 75 13 68 11 65 14 L 36 34 C 32 37 31 40 32 42 Z"
              fill="#FFFFFF"
            />
            <circle cx="67" cy="23" r="6.5" fill="#8B5CF6" />
            {/* La W en el degradado de marca (antes un violeta plano oscuro),
                para que combine con el logo real de la tienda. Se escala al
                0.8 sobre su centro (55,58) para dejar aire con el borde
                blanco de la bolsa. */}
            <path
              d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38"
              fill="none"
              stroke="url(#walaLoaderGrad)"
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(55 58) scale(0.8) translate(-55 -58)"
            />
          </motion.svg>
        </div>

        <span className={styles.wordmark}>Walá</span>

        <div className={styles.progressTrack} aria-hidden="true">
          {reducedMotion ? (
            <span className={styles.progressStatic} />
          ) : (
            <motion.span
              className={styles.progressBar}
              animate={{ x: ['-140%', '340%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandLoader;
