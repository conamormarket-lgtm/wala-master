/**
 * Lista única de fuentes disponibles en el editor de diseño (texto).
 * Incluye fuentes del sistema, Google Fonts y tipografías locales (public/fonts/fonts.css).
 * Las fuentes de Google se cargan en index.html con variaciones (normal, bold, italic).
 * Usar esta constante en TextEditor y EditorCanvas para el selector de "Fuente".
 */
export const EDITOR_FONTS = [
  // Fuentes del sistema (siempre disponibles, con negrita/cursiva nativas)
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Segoe UI',
  'Tahoma',
  'Trebuchet MS',
  'Palatino Linotype',
  'Impact',
  'Comic Sans MS',
  // Google Fonts (cargadas en index.html con variaciones)
  'Roboto',
  'Open Sans',
  'Poppins',
  'Lato',
  'Montserrat',
  'Oswald',
  'Source Sans 3',
  'Playfair Display',
  'Merriweather',
  'Bebas Neue',
  'Raleway',
  'Nunito',
  'Inter',
  'Ubuntu',
  'DM Sans',
  'Quicksand',
  'Rubik',
  'Work Sans',
  'Libre Baskerville',
  'PT Sans',
  'Anton',
  'Barlow',
  'Fira Sans',
  'Kanit',
  'Noto Sans',
  'Pacifico',
  'Dancing Script',
  'Great Vibes',
  'Lobster',
  'Caveat',
  'Permanent Marker',
  'Righteous',
  // Tipografías locales (public/fonts/fonts.css)
  'Waltograph',
  'Waltograph UI',
  'Super Bubble',
  'Varsity',
  'Varsity Regular',
  'Varsity Team Bold',
  'White Beach',
  'Alianza Lima 2023',
  'Club Alianza Lima 2024',
  'Amertha',
  'Bebas Neue Bold',
  'Brush Sci',
  'Bubblegum',
  'Buka Bird',
  'CC Up Up And Away',
  'Deutsch',
  'Gloomy Things',
  'Love Nature',
  'Nature Beauty',
  'Rage',
  'Real Madrid 25-26',
  'Real Madrid 2021',
  'Forte',
];

/** Valores de fontWeight para el editor (Fabric y CSS). */
export const FONT_WEIGHT_NORMAL = 'normal';
export const FONT_WEIGHT_BOLD = 'bold';

/** Valores de fontStyle para el editor. */
export const FONT_STYLE_NORMAL = 'normal';
export const FONT_STYLE_ITALIC = 'italic';
