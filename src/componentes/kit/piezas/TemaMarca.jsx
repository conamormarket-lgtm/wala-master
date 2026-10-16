import React from 'react';
import s from './TemaMarca.module.css';

/*
 * El color de una marca en su página, sin dejar de ser Walá: cambia SOLO los
 * acentos (el degradado de los sellos y del "Todos", el trazo bajo los
 * títulos, el aro de la burbuja elegida, los chips activos, la portada). Los
 * botones de compra, la cabecera y Kapi siguen como siempre (usan otros
 * tokens). Cada color trae su versión de noche: un negro (Yoryo) se volvería
 * invisible sobre la noche violeta, así que ahí manda el segundo color.
 */

const hexARgb = (hex) => {
  const h = String(hex || '').replace('#', '').trim();
  const largo = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(largo)) return null;
  return [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16));
};
const rgbAHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
/** Mezcla a con b: t = 0 → a, t = 1 → b. */
const mezclar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const BLANCO = [255, 255, 255];
const NEGRO = [0, 0, 0];
const NOCHE = [20, 18, 28]; // --noche-wala
const luz = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** Lo bastante visible sobre la noche: si no, el segundo color o el mismo aclarado. */
const deNoche = (rgb, segundo) => {
  if (contraste(rgb, NOCHE) >= 3) return rgb;
  if (segundo && contraste(segundo, NOCHE) >= 3) return segundo;
  let c = rgb;
  for (let i = 0; i < 6 && contraste(c, NOCHE) < 3; i += 1) c = mezclar(c, BLANCO, 0.25);
  return c;
};
const degradado = (a, b) => `linear-gradient(135deg, ${rgbAHex(mezclar(a, BLANCO, 0.18))} 0%, ${rgbAHex(a)} 45%, ${rgbAHex(b)} 100%)`;

/**
 * Las variables del tema de una marca ({ color, color2 } en hex). Sin color
 * válido, null (la página queda con el violeta de Walá).
 *  - --degradado-logo: el de los sellos (color claro → color → segundo color
 *    o el mismo oscurecido)
 *  - --tema-acento: aros y chips activos · --tema-sobre: el texto encima
 *  - --tema-trazo: el trazo bajo los títulos · --tema-suave: un fondo tenue
 *    (el segundo color si es claro: el crema de Yoryo) · --tema-tinta: el
 *    oscuro detrás del texto blanco (la portada con foto)
 *  - las mismas con -noche para el modo oscuro
 */
export function temaDeMarca({ color, color2 } = {}) {
  const c1 = hexARgb(color);
  if (!c1) return null;
  const c2 = hexARgb(color2);
  const oscuro = c2 || mezclar(c1, NEGRO, 0.35);
  const n1 = deNoche(c1, c2);
  const n2 = c2 && contraste(c2, NOCHE) >= 3 ? mezclar(c2, NEGRO, 0.2) : mezclar(n1, NEGRO, 0.3);
  const sobre = (rgb) => (contraste(rgb, BLANCO) >= 3 ? '#ffffff' : '#1c1917');
  return {
    '--tema-degradado-dia': degradado(c1, oscuro),
    '--tema-degradado-noche': degradado(n1, n2),
    '--tema-acento-dia': rgbAHex(c1),
    '--tema-acento-noche': rgbAHex(n1),
    '--tema-sobre-dia': sobre(c1),
    '--tema-sobre-noche': sobre(n1),
    '--tema-trazo-dia': rgbAHex(mezclar(c1, BLANCO, 0.35)),
    '--tema-trazo-noche': rgbAHex(mezclar(n1, BLANCO, 0.15)),
    '--tema-suave-dia': rgbAHex(c2 && luz(c2) > 0.6 ? mezclar(c2, BLANCO, 0.35) : mezclar(c1, BLANCO, 0.9)),
    '--tema-suave-noche': rgbAHex(mezclar(n1, NOCHE, 0.84)),
    '--tema-tinta-dia': rgbAHex(mezclar(oscuro, NEGRO, 0.15)),
    '--tema-tinta-noche': rgbAHex(mezclar(n1, NOCHE, 0.7)),
  };
}

/**
 * Envuelve lo que lleva el color de la marca (la portada y las secciones;
 * nunca la cabecera ni el pie).
 *  - identidad: { color, color2 } · children
 */
export function TemaMarca({ identidad, className, children }) {
  const vars = temaDeMarca(identidad);
  if (!vars) return <>{children}</>;
  return (
    <div className={[s.tema, className].filter(Boolean).join(' ')} style={vars} data-componente="TemaMarca">
      {children}
    </div>
  );
}
