/* =========================================================================
   Walá Design System — Barrel del tema
   -------------------------------------------------------------------------
   Punto de entrada JS del sistema de diseño. Re-exporta TODOS los presets de
   movimiento (./motion) y expone la paleta de marca como objetos JS, espejo
   exacto de los tokens CSS de src/theme/tokens.css.

   Este archivo NO importa CSS: solo provee valores JS para consumir en
   contextos que no pueden leer CSS vars cómodamente (recharts, animaciones
   de framer-motion, cálculos en JSX). Para estilos en .module.css usa
   SIEMPRE las CSS vars (var(--chart-1), var(--primary-color), etc.).
   ========================================================================= */

// Presets de movimiento (curva firma, variants, springs, transiciones de página…).
export * from './motion';

/* -------------------------------------------------------------------------
   PALETA DE DATOS (recharts / gráficos)
   Espejo exacto de --chart-1..7 en tokens.css. Úsalo en JSX de gráficos para
   no hardcodear hex sueltos por el código.
   ------------------------------------------------------------------------- */
export const chartColors = [
  '#6D28D9', // --chart-1 (violet-700, primary)
  '#8B5CF6', // --chart-2 (violet-500)
  '#A78BFA', // --chart-3 (violet-400)
  '#C4B5FD', // --chart-4 (violet-300)
  '#10B981', // --chart-5 (verde-éxito)
  '#34D399', // --chart-6 (verde claro)
  '#F59E0B', // --chart-7 (dorado / warning)
];

/* -------------------------------------------------------------------------
   PALETA DE MARCA
   Espejo JS de la escala violeta canónica y los acentos. Para usar en JS
   cuando se necesita el hex directo (gradientes calculados, estados, etc.).
   ------------------------------------------------------------------------- */
export const brand = {
  // Acento principal y su hover (espejo de --primary-color / --primary-hover).
  primary: '#6D28D9',
  primaryHover: '#5B21B6',

  // Extremos del gradiente de marca (walaGradient del logo).
  gradientStart: '#8B5CF6',
  gradientEnd: '#5B21B6',

  // Escala violeta canónica (espejo de --violet-50..900).
  violet: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Acentos de estado.
  success: '#10B981', // --verde-exito
  danger: '#EF4444', // --danger
  gold: '#F59E0B', // --gold-500 / fidelización
};
