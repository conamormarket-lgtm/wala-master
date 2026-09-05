import React from 'react';
import { motion } from 'framer-motion';
import { EASE_SIGNATURE, useReducedMotionSafe } from '../../../theme/motion';
import styles from './BrandLoader.module.css';

/**
 * Pantalla de carga estilizada del sistema — reemplaza los textos sueltos
 * ("Cargando configuración...") y el fondo generico (.landing-page-boot)
 * que existian antes en TiendaPage.jsx, cada uno con su propio look.
 *
 * Mismo isotipo del logo del Header (Header.jsx), en "negativo": el tag
 * queda blanco solido y el trazo de la W en violeta profundo, para que se
 * lea con contraste sobre el degradado de marca de fondo (el logo real
 * hace lo opuesto: tag en degradado violeta, W en blanco, sobre pagina
 * clara).
 *
 * v2: el icono solo, flotando en un degradado plano, se veia perdido y
 * "vacio" en pantalla completa (sin contexto de marca ni de que algo esta
 * pasando). Ahora es un lockup icono + wordmark ("WALA", mismo tratamiento
 * tipografico del logo real: Poppins/Montserrat, mayusculas, tracking
 * ancho) + una barra de progreso indeterminada debajo, sobre un fondo con
 * un par de glows suaves (mismo lenguaje que --gradient-aurora) en vez del
 * degradado liso. El icono ya no rota (se veia tembloroso/juguete); ahora
 * solo respira en escala junto con el halo, un solo gesto coherente.
 *
 * Animacion con framer-motion (ya es dependencia del proyecto — ver
 * theme/motion.js, PremiumProductCard.jsx) en vez de un keyframe CSS
 * suelto: halo + icono respirando en escala + wordmark entrando con fade,
 * misma curva firma (EASE_SIGNATURE) que el resto del sistema de
 * movimiento (la barra de progreso usa easeInOut propio: es un barrido en
 * loop, no una entrada, y la curva firma "expo-out" se ve rara repetida).
 * Respeta prefers-reduced-motion vía useReducedMotionSafe (mismo hook que
 * ya usan las tarjetas de producto): sin movimiento, el icono y el halo
 * quedan quietos y la barra se ve como un trazo estatico a medio llenar.
 *
 * @param {'fill'|'inline'} variant  'fill' = llena el alto de su contenedor
 *   (#main-content-area, que ya via flex ocupa desde el navbar hasta abajo
 *   — ver App.css), 'inline' = alto fijo mas chico para usar suelto dentro
 *   de un layout con su propio chrome alrededor.
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
          {!reducedMotion && (
            <motion.span
              className={styles.halo}
              aria-hidden="true"
              animate={{ scale: [0.85, 1.45], opacity: [0.55, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: EASE_SIGNATURE }}
            />
          )}
          <motion.svg
            viewBox="12 0 94 109"
            className={styles.mark}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            animate={reducedMotion ? undefined : { scale: [1, 1.05, 1] }}
            transition={reducedMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: EASE_SIGNATURE }}
          >
            <path
              d="M 32 42 L 28 88 C 27 92 30 94 34 93 L 85 80 C 89 79 91 76 89 72 L 76 18 C 75 13 68 11 65 14 L 36 34 C 32 37 31 40 32 42 Z"
              fill="#FFFFFF"
            />
            <circle cx="67" cy="23" r="6.5" fill="#4C1D95" />
            <path
              d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38"
              fill="none"
              stroke="#4C1D95"
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </div>

        <motion.span
          className={styles.wordmark}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_SIGNATURE, delay: 0.1 }}
        >
          Walá
        </motion.span>

        <div className={styles.progressTrack} aria-hidden="true">
          {reducedMotion ? (
            <span className={styles.progressStatic} />
          ) : (
            <motion.span
              className={styles.progressBar}
              animate={{ x: ['-120%', '320%'] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandLoader;
