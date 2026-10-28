/**
 * Grabado láser (prendaBase.tecnica === 'laser'): el diseño se graba en un
 * solo tono, así que se ve y se exporta en escala de grises. Los textos pasan
 * sus colores a gris aquí; las imágenes se convierten al dibujarlas
 * (Crear/renderDiseno.js).
 */

/** Gris de un color #RRGGBB con su luminancia (Rec. 601), o el mismo valor si no es un hex. */
export const grisDe = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const y = Math.round(0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = y.toString(16).padStart(2, '0').toUpperCase();
  return `#${h}${h}${h}`;
};

/** La capa de texto con sus colores (letra, contorno y sombra) en gris. */
export const textoEnGrises = (capa) => ({
  ...capa,
  ...(capa.color && { color: grisDe(capa.color) }),
  ...(capa.contornoColor && { contornoColor: grisDe(capa.contornoColor) }),
  ...(capa.sombraColor && { sombraColor: grisDe(capa.sombraColor) }),
});

/** Pasa a gris los píxeles RGBA (en el lugar) y conserva la transparencia. */
export const pixelesEnGrises = (datos) => {
  for (let i = 0; i < datos.length; i += 4) {
    const y = Math.round(0.299 * datos[i] + 0.587 * datos[i + 1] + 0.114 * datos[i + 2]);
    datos[i] = y;
    datos[i + 1] = y;
    datos[i + 2] = y;
  }
  return datos;
};
