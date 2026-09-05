import React from 'react';
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
 * clara). Respeta prefers-reduced-motion (el pulso se congela, no se oculta).
 *
 * @param {'fill'|'inline'} variant  'fill' = pantalla completa (100dvh),
 *   'inline' = ocupa el alto de su contenedor (para usar dentro de un
 *   layout que ya tiene su propio header/chrome alrededor).
 */
const BrandLoader = ({ variant = 'fill' }) => (
  <div
    className={`${styles.loader} ${variant === 'inline' ? styles.inline : styles.fill}`}
    role="status"
    aria-label="Cargando"
  >
    <svg viewBox="10 5 90 95" className={styles.mark} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
    </svg>
  </div>
);

export default BrandLoader;
