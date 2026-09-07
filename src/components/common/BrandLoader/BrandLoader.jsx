import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionSafe } from '../../../theme/motion';
import styles from './BrandLoader.module.css';

/**
 * Transicion compartida por el icono y los dos halos: ciclo continuo, sin
 * pausa, con la misma curva y duracion para que la luz respire EXACTAMENTE al
 * compas del icono. Debe coincidir con los @keyframes del splash estatico de
 * index.html (appLoadingBreathe / appLoadingHalo*) para que el relevo sea
 * invisible.
 */
const BREATHE_TRANSITION = {
  duration: 3.2,
  ease: 'easeInOut',
  repeat: Infinity,
};

/**
 * Pantalla de carga estilizada del sistema (isotipo del logo en "negativo"
 * — bolsa blanca + W violeta — sobre el degradado de marca).
 *
 * Animación (framer-motion). El icono respira y la luz respira CON el.
 *  - El icono flota en un ciclo continuo y calmado (~3.2s, ease-in-out, sin
 *    pausa): sube unos px y escala apenas al 1.05, luego vuelve. Solo escala
 *    + traslada (no deforma ni recolorea). Reemplaza al viejo "click" seco por
 *    algo mas premium/relajado.
 *  - Los dos halos detras del icono pulsan EN SINCRONIA con esa respiracion
 *    (mismo 3.2s / mismo ease): mas brillo y algo mas grandes justo cuando el
 *    icono llega arriba, de modo que la luz "acompaña" el gesto en vez de
 *    quedarse quieta. Tenue a proposito para que se lea como luz que respira y
 *    no como destellos.
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
          {/* Resplandor detras del icono (dos capas radiales para dar
              profundidad). Ahora PULSAN en sincronia con la respiracion del
              icono (mismo BREATHE_TRANSITION): mas brillo y algo mas grandes
              cuando el icono llega arriba. Tenue a proposito: es luz que
              respira, no destellos. transform-origin al centro (default) para
              que el crecido sea simetrico. */}
          <motion.span
            className={styles.haloWide}
            aria-hidden="true"
            animate={reducedMotion ? undefined : { opacity: [0.7, 1, 0.7], scale: [1, 1.1, 1] }}
            transition={reducedMotion ? undefined : BREATHE_TRANSITION}
          />
          <motion.span
            className={styles.halo}
            aria-hidden="true"
            animate={reducedMotion ? undefined : { opacity: [0.8, 1, 0.8], scale: [1, 1.12, 1] }}
            transition={reducedMotion ? undefined : BREATHE_TRANSITION}
          />
          {/* El icono respira: ciclo continuo y calmado (~3.2s) en el que sube
              unos px y escala apenas al 1.05, luego vuelve. Solo escala +
              traslada: no deforma el logo ni cambia colores. transform-origin
              al centro para que la escala sea simetrica. */}
          <motion.svg
            viewBox="12 0 94 109"
            className={styles.mark}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ transformOrigin: 'center center' }}
            animate={reducedMotion ? undefined : { scale: [1, 1.05, 1], y: [0, -6, 0] }}
            transition={reducedMotion ? undefined : BREATHE_TRANSITION}
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
