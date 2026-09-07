import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionSafe } from '../../../theme/motion';
import styles from './BrandLoader.module.css';

/**
 * Pantalla de carga estilizada del sistema (isotipo del logo en "negativo"
 * — bolsa blanca + W violeta — sobre el degradado de marca).
 *
 * Animación (framer-motion, easeInOut para que todo respire en fase, ida y
 * vuelta suave — sin curvas que reinicien de golpe):
 *  - Un doble halo que "respira" EN SINCRONIA con el icono (mismo ciclo de
 *    2.4s): el resplandor se intensifica cuando el icono crece y se atenua
 *    cuando encoge. El amplio da profundidad; el interno, brillo. Un solo
 *    gesto calmo y coherente, nada juguetón — tono ecommerce premium.
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
              {/* Dos halos que RESPIRAN en sincronia con el icono (mismo
                  ciclo de 2.4s, ida y vuelta suave), no un "ripple" que se
                  expande y reinicia de golpe: el resplandor se intensifica
                  cuando el icono crece y se atenua cuando encoge, un solo
                  gesto coherente. El amplio da profundidad; el interno, brillo. */}
              <motion.span
                className={styles.haloWide}
                aria-hidden="true"
                animate={{ scale: [0.9, 1.12, 0.9], opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: BREATHE, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                className={styles.halo}
                aria-hidden="true"
                animate={{ scale: [0.95, 1.1, 0.95], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: BREATHE, repeat: Infinity, ease: 'easeInOut' }}
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
