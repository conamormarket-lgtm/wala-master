const FALLBACK_COLOR_MAP = {
  'blanco': '#ffffff',
  'negro': '#000000',
  'rojo': '#e3000f',
  'azul': '#0055a4',
  'azul marino': '#000080',
  'verde': '#008000',
  'amarillo': '#ffd700',
  'naranja': '#ffa500',
  'rosado': '#ffc0cb',
  'rosa': '#ffc0cb',
  'gris': '#808080',
  'gris jaspe': '#a9a9a9',
  'plomo': '#696969',
  'celeste': '#87ceeb',
  'morado': '#800080',
  'lila': '#c8a2c8',
  'marrón': '#8b4513',
  'marron': '#8b4513',
  'beige': '#f5f5dc',
  'vino': '#722f37',
  'turquesa': '#40e0d0',
  'guinda': '#722f37',
  'melange 3%': '#cccccc',
};

export const getFallbackHex = (colorName) => {
  if (!colorName) return undefined;
  if (/^#[0-9A-Fa-f]{6}$/i.test(colorName)) return colorName;
  const normalized = colorName.toLowerCase().trim();
  return FALLBACK_COLOR_MAP[normalized];
};

/**
 * Color de texto (#fff o #0a0a0a) que mejor contrasta contra un fondo hex.
 *
 * Se usa en insignias/badges que pintan su fondo con un color elegido por el
 * admin (p.ej. brand.bgColor de una marca) mientras el texto queda FIJO en
 * blanco vía CSS. Con un fondo oscuro eso se ve bien, pero con un fondo
 * claro/pastel (como un lila suave) el texto blanco se vuelve casi
 * invisible — y pasa IGUAL en modo claro y en modo oscuro, porque el fondo
 * inline gana por especificidad sobre cualquier color de la hoja de estilos
 * pensado para el tema. Calcula la luminancia relativa (fórmula WCAG) y
 * elige el texto que sí se lee, sin depender de si el admin cargó un tono
 * claro u oscuro.
 */
export const getContrastTextColor = (hexColor) => {
  if (!hexColor || typeof hexColor !== 'string') return '#fff';
  const hex = hexColor.replace('#', '').trim();
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9A-Fa-f]{6}$/.test(full)) return '#fff';
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  // Luminancia relativa (WCAG 2.x): cada canal se linealiza antes de pesarlo.
  const linear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  // Umbral ~0.5 (en vez del 0.179 "puro" de WCAG contra blanco): al comparar
  // texto blanco vs. casi-negro sobre CUALQUIER fondo, 0.5 reparte mejor los
  // tonos medios entre ambas opciones que el punto de corte teórico.
  return luminance > 0.5 ? '#0a0a0a' : '#fff';
};
