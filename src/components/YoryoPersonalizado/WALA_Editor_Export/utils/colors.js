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
