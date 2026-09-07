import React from 'react';
import { motion } from 'framer-motion';
import { EASE_SIGNATURE, useReducedMotionSafe } from '../../../theme/motion';
import styles from './BrandLoader.module.css';

/**
 * Pantalla de carga estilizada del sistema (isotipo del logo en "negativo"
 * — bolsa blanca + W violeta — sobre el degradado de marca).
 *
 * Animación (framer-motion, misma curva firma EASE_SIGNATURE que el resto
 * del sistema de movimiento):
 *  - Un doble halo que "respira" detrás del icono (uno rápido que pulsa y
 *    se difumina, otro lento y amplio que da profundidad), sincronizado con
 *    la respiración en escala del icono. Un solo gesto calmo y coherente,
 *    nada juguetón — tono ecommerce premium.
 *  - Una barra de progreso indeterminada con brillo suave: comunica "algo
 *    esta pasando" sin fingir un porcentaje real.
 *
 * Los elementos NO tienen animacion de ENTRADA (aparecen ya en su estado
 * final y solo hacen sus loops): asi el relevo desde el splash estatico de
 * index.html — que muestra el MISMO lockup — es invisible, sin un
 * re-"fade-in" del logo que se leeria como un parpadeo. La animacion de
 * SALIDA (cuando termina la carga) vive en BrandLoaderOverlay.jsx.
 *
 * Respeta prefers-reduced-motion (useReducedMotionSafe): sin movimiento,
 * icono y halos quietos y la barra como un trazo estatico a medio llenar.
 *
 * @param {'fill'|'inline'} variant  'fill' = llena el alto de su contenedor,
 *   'inline' = alto fijo mas chico para usar suelto dentro de un layout.
 */
const BREATHE = 2.4; // s — respiración del icono + halos (todo sincronizado)

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
          {!reducedMotion && (
            <>
              {/* Halo amplio y lento: da profundidad detrás del icono. */}
              <motion.span
                className={styles.haloWide}
                aria-hidden="true"
                animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.35, 0.6, 0.35] }}
                transition={{ duration: BREATHE, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Halo que pulsa y se difumina hacia afuera. */}
              <motion.span
                className={styles.halo}
                aria-hidden="true"
                animate={{ scale: [0.85, 1.5], opacity: [0.55, 0] }}
                transition={{ duration: BREATHE, repeat: Infinity, ease: EASE_SIGNATURE }}
              />
            </>
          )}
          <motion.svg
            viewBox="12 0 94 109"
            className={styles.mark}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            animate={reducedMotion ? undefined : { scale: [1, 1.045, 1] }}
            transition={reducedMotion ? undefined : { duration: BREATHE, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path
              d="M 32 42 L 28 88 C 27 92 30 94 34 93 L 85 80 C 89 79 91 76 89 72 L 76 18 C 75 13 68 11 65 14 L 36 34 C 32 37 31 40 32 42 Z"
              fill="#FFFFFF"
            />
            <circle cx="67" cy="23" r="6.5" fill="#4C1D95" />
            {/* La W se escala al 0.8 sobre su propio centro (55,58) para
                dejar aire entre el trazo y el borde blanco de la bolsa. */}
            <path
              d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38"
              fill="none"
              stroke="#4C1D95"
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
