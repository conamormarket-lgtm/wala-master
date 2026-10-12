import React from 'react';
import s from './IconosWala.module.css';

/*
 * Íconos de Walá: dibujados con el estilo de Kapi (contorno violeta oscuro
 * grueso, colores planos de la marca y un brillo blanco). Reemplazan a los
 * emojis, que cada sistema dibuja distinto, y a los íconos de línea genéricos
 * en beneficios, íconos de confianza y el editor.
 *
 * <IconoWala nombre="camion" />            sticker redondo (por defecto)
 * <IconoWala nombre="regalo" sticker={false} tamano={56} />
 *
 * Nombres: ICONOS_WALA. También acepta los del builder viejo (truck, shield,
 * clock, credit_card, return, heart, star, check) y emojis comunes (🚚, 💬,
 * 🎁…) con iconoDesde().
 */

const C = {
  tinta: '#2e1065',
  violeta: '#8b5cf6',
  violetaOsc: '#6d28d9',
  lila: '#ddd6fe',
  oro: '#fbbf24',
  oroOsc: '#d97706',
  rosa: '#f472b6',
  verde: '#34d399',
  blanco: '#fff',
};
const T = { stroke: C.tinta, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' };
const L = (color, ancho = 2.5) => ({ stroke: color, strokeWidth: ancho, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' });
const brillo = L(C.blanco, 2.6);

/** Destello chiquito que acompaña a algunos íconos. */
const Chispa = ({ x, y, r = 4, color = C.oro }) => (
  <path d={`M${x} ${y - r}c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4z`} fill={color} stroke={C.tinta} strokeWidth="1.2" strokeLinejoin="round" />
);

const DIBUJOS = {
  check: (
    <>
      <circle cx="24" cy="24" r="18" fill={C.violeta} {...T} />
      <path d="M15.5 24.5l6 6 11-12" {...L(C.blanco, 4.5)} />
      <path d="M13 17a12 12 0 0 1 6-5" {...brillo} opacity="0.6" />
    </>
  ),
  camion: (
    <>
      <path d="M1.5 20h4M2.5 25.5h3" {...L(C.tinta, 2.2)} />
      <rect x="7" y="13" width="22" height="20" rx="3" fill={C.violeta} {...T} />
      <path d="M29 19h7.5l5.5 7v7H29z" fill={C.oro} {...T} />
      <path d="M31.5 21.5h4l3.5 4.5h-7.5z" fill={C.blanco} />
      <path d="M18 28.5s-4.2-2.4-4.2-5.1a2.2 2.2 0 0 1 4.2-1 2.2 2.2 0 0 1 4.2 1c0 2.7-4.2 5.1-4.2 5.1z" fill={C.rosa} />
      <path d="M10.5 17h7" {...brillo} />
      <circle cx="14" cy="34" r="4.6" fill={C.tinta} />
      <circle cx="14" cy="34" r="1.6" fill={C.lila} />
      <circle cx="35" cy="34" r="4.6" fill={C.tinta} />
      <circle cx="35" cy="34" r="1.6" fill={C.lila} />
    </>
  ),
  escudo: (
    <>
      <path d="M24 5l15 5v11c0 10-6.5 17-15 21C15.5 38 9 31 9 21V10z" fill={C.violeta} {...T} />
      <path d="M24 9.6l10.6 3.5V21c0 7.4-4.5 12.6-10.6 15.7z" fill={C.violetaOsc} opacity="0.45" />
      <path d="M17 23l5 5 9-10" {...L(C.blanco, 3.8)} />
      <Chispa x={39} y={8} />
    </>
  ),
  reloj: (
    <>
      <path d="M9.5 13.5l5-5M38.5 13.5l-5-5" {...L(C.tinta, 3)} />
      <circle cx="10" cy="11" r="3.4" fill={C.oro} {...T} strokeWidth="2" />
      <circle cx="38" cy="11" r="3.4" fill={C.oro} {...T} strokeWidth="2" />
      <circle cx="24" cy="26" r="16" fill={C.violeta} {...T} />
      <circle cx="24" cy="26" r="11.5" fill={C.blanco} />
      <path d="M24 19v7l5.5 3.5" {...L(C.tinta, 3)} />
      <circle cx="24" cy="26" r="2" fill={C.violeta} />
    </>
  ),
  tarjeta: (
    <>
      <rect x="5" y="11" width="38" height="26" rx="5" fill={C.violeta} {...T} />
      <path d="M6.3 17.5h35.4v5H6.3z" fill={C.tinta} />
      <rect x="10" y="26.5" width="8.5" height="6" rx="1.6" fill={C.oro} stroke={C.tinta} strokeWidth="1.6" />
      <path d="M24 30h13" {...L(C.lila, 2.6)} />
      <Chispa x={41} y={9} color={C.rosa} />
    </>
  ),
  cambio: (
    <>
      <circle cx="24" cy="24" r="18" fill={C.lila} {...T} />
      <path d="M33.5 19.5a10.5 10.5 0 0 0-18-4" {...L(C.violetaOsc, 4)} />
      <path d="M14.5 10.5v5.5H20" {...L(C.violetaOsc, 4)} />
      <path d="M14.5 28.5a10.5 10.5 0 0 0 18 4" {...L(C.rosa, 4)} />
      <path d="M33.5 37.5V32H28" {...L(C.rosa, 4)} />
    </>
  ),
  corazon: (
    <>
      <path d="M24 41S7 31 7 18.5A9.5 9.5 0 0 1 24 13a9.5 9.5 0 0 1 17 5.5C41 31 24 41 24 41z" fill={C.rosa} {...T} />
      <path d="M13 18.5a5 5 0 0 1 5-4" {...brillo} />
      <Chispa x={41} y={9} />
    </>
  ),
  estrella: (
    <>
      <path d="M24 5l5.6 11.4 12.6 1.8-9.1 8.9 2.2 12.5L24 33.7l-11.3 5.9 2.2-12.5-9.1-8.9 12.6-1.8z" fill={C.oro} {...T} />
      <path d="M16.5 20.5l3.5-.5" {...brillo} />
      <circle cx="21" cy="24" r="1.4" fill={C.tinta} />
      <circle cx="27" cy="24" r="1.4" fill={C.tinta} />
      <path d="M21.5 28c1.5 1.4 3.5 1.4 5 0" {...L(C.tinta, 1.8)} />
    </>
  ),
  regalo: (
    <>
      <rect x="8.5" y="20" width="31" height="21" rx="3" fill={C.violeta} {...T} />
      <rect x="6" y="14" width="36" height="8" rx="2.5" fill={C.lila} {...T} />
      <path d="M24 15.3v24.4" {...L(C.rosa, 5)} />
      <path d="M24 14c-3-6-11-7-10-2 1 3 6 3 10 2zM24 14c3-6 11-7 10-2-1 3-6 3-10 2z" fill={C.rosa} {...T} strokeWidth="2.2" />
      <path d="M12 26v6" {...brillo} />
    </>
  ),
  chat: (
    <>
      <path d="M9 9h30a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H23l-9 7v-7H9a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4z" fill={C.violeta} {...T} />
      <circle cx="16" cy="21.5" r="2.7" fill={C.blanco} />
      <circle cx="24" cy="21.5" r="2.7" fill={C.blanco} />
      <circle cx="32" cy="21.5" r="2.7" fill={C.blanco} />
      <path d="M9.5 13.5h5" {...brillo} opacity="0.7" />
    </>
  ),
  paleta: (
    <>
      <path d="M24 6C13 6 5 13.5 5 23s7.5 18 17 18c3 0 4-2 3-4.5s0-4.5 3-4.5h5c5.5 0 10-3.5 10-9.5C43 13 35 6 24 6z" fill={C.lila} {...T} />
      <circle cx="15" cy="19" r="3.4" fill={C.violeta} stroke={C.tinta} strokeWidth="2" />
      <circle cx="24" cy="13.5" r="3.4" fill={C.rosa} stroke={C.tinta} strokeWidth="2" />
      <circle cx="33" cy="18.5" r="3.4" fill={C.oro} stroke={C.tinta} strokeWidth="2" />
      <circle cx="14.5" cy="29" r="3.4" fill={C.verde} stroke={C.tinta} strokeWidth="2" />
    </>
  ),
  polera: (
    <>
      <path d="M17 7l-11 6 4 8 5-2v21h18V19l5 2 4-8-11-6c-1 3.5-3.5 5-7 5s-6-1.5-7-5z" fill={C.violeta} {...T} />
      <path d="M24 30s-4.5-2.6-4.5-5.6a2.4 2.4 0 0 1 4.5-1.1 2.4 2.4 0 0 1 4.5 1.1c0 3-4.5 5.6-4.5 5.6z" fill={C.blanco} />
      <path d="M11.5 14l3-1.6" {...brillo} />
    </>
  ),
  taza: (
    <>
      <path d="M16 9.5c-2-2 2-3 0-5.5M23 9.5c-2-2 2-3 0-5.5" {...L(C.violeta, 2.5)} />
      <path d="M33 19h3.5a5.5 5.5 0 0 1 0 11H33" {...L(C.tinta, 3)} />
      <path d="M8 14h25v20a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7z" fill={C.blanco} {...T} />
      <path d="M8 14h25v6H8z" fill={C.violeta} stroke={C.tinta} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M20.5 34s-4-2.3-4-5a2.2 2.2 0 0 1 4-1 2.2 2.2 0 0 1 4 1c0 2.7-4 5-4 5z" fill={C.rosa} />
    </>
  ),
  ubicacion: (
    <>
      <ellipse cx="24" cy="44" rx="8" ry="2.2" fill={C.tinta} opacity="0.2" />
      <path d="M24 42s-13-12.5-13-23a13 13 0 0 1 26 0c0 10.5-13 23-13 23z" fill={C.violeta} {...T} />
      <circle cx="24" cy="19" r="5.2" fill={C.blanco} stroke={C.tinta} strokeWidth="2.2" />
      <path d="M15.5 14.5a9 9 0 0 1 3.5-4" {...brillo} opacity="0.7" />
    </>
  ),
  moneda: (
    <>
      <circle cx="24" cy="24" r="17.5" fill={C.oro} {...T} />
      <circle cx="24" cy="24" r="12" fill="none" stroke={C.oroOsc} strokeWidth="2" />
      <circle cx="19" cy="20" r="2.4" fill={C.oroOsc} />
      <circle cx="24" cy="17.5" r="2.4" fill={C.oroOsc} />
      <circle cx="29" cy="20" r="2.4" fill={C.oroOsc} />
      <ellipse cx="24" cy="27.5" rx="5.2" ry="4.2" fill={C.oroOsc} />
      <path d="M12.5 17a12.5 12.5 0 0 1 4.5-5" {...brillo} />
    </>
  ),
  rayo: (
    <>
      <path d="M27 4L10 27h12l-3 17 19-24H26z" fill={C.oro} {...T} />
      <path d="M22 11.5l-5 7" {...brillo} />
      <Chispa x={41} y={33} color={C.rosa} />
    </>
  ),
  destello: (
    <>
      <path d="M22 4c1.5 10 5 13.5 15 15-10 1.5-13.5 5-15 15-1.5-10-5-13.5-15-15 10-1.5 13.5-5 15-15z" fill={C.oro} {...T} />
      <path d="M38 30c.7 4 2 5.3 6 6-4 .7-5.3 2-6 6-.7-4-2-5.3-6-6 4-.7 5.3-2 6-6z" fill={C.rosa} {...T} strokeWidth="2" />
    </>
  ),
  foto: (
    <>
      <path d="M8 15h7l3-5h12l3 5h7a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3z" fill={C.violeta} {...T} />
      <circle cx="24" cy="27" r="8.5" fill={C.lila} {...T} />
      <circle cx="24" cy="27" r="4" fill={C.tinta} />
      <circle cx="22.3" cy="25.3" r="1.3" fill={C.blanco} />
      <rect x="35" y="18.5" width="4" height="3" rx="1" fill={C.oro} />
    </>
  ),
  mano: (
    <>
      <path d="M15 24V12a2.8 2.8 0 0 1 5.6 0v9-11.5a2.8 2.8 0 0 1 5.6 0V21v-9a2.8 2.8 0 0 1 5.6 0v11-5a2.8 2.8 0 0 1 5.6 0v9c0 9-5.5 15-14 15-6 0-9-3-12-8l-3.5-6a2.7 2.7 0 0 1 4.6-2.8z" fill={C.oro} {...T} />
      <path d="M24 33s-3.5-2-3.5-4.3a1.9 1.9 0 0 1 3.5-.9 1.9 1.9 0 0 1 3.5.9c0 2.3-3.5 4.3-3.5 4.3z" fill={C.rosa} />
    </>
  ),
};

/** Nombre y etiqueta de cada ícono (para el selector del editor). */
export const ICONOS_WALA = [
  ['check', 'Visto'], ['camion', 'Envío'], ['escudo', 'Seguro'], ['tarjeta', 'Pago'], ['cambio', 'Cambios'],
  ['reloj', 'Rápido'], ['rayo', 'Al toque'], ['corazon', 'Con amor'], ['estrella', 'Calidad'], ['regalo', 'Regalo'],
  ['chat', 'Atención'], ['paleta', 'Tu diseño'], ['polera', 'Prendas'], ['taza', 'Tazas'], ['foto', 'Tu foto'],
  ['mano', 'Hecho a mano'], ['ubicacion', 'Tienda'], ['moneda', 'Monedas'], ['destello', 'Novedad'],
].map(([nombre, etiqueta]) => ({ nombre, etiqueta }));

const ALIAS = {
  truck: 'camion', shield: 'escudo', clock: 'reloj', credit_card: 'tarjeta', return: 'cambio', heart: 'corazon', star: 'estrella',
  '✓': 'check', '✔': 'check', '✔️': 'check', '✅': 'check', '🚚': 'camion', '📦': 'camion', '🛡': 'escudo', '🛡️': 'escudo', '🔒': 'escudo',
  '⏰': 'reloj', '🕐': 'reloj', '⏱': 'reloj', '⏱️': 'reloj', '💳': 'tarjeta', '🔄': 'cambio', '🔁': 'cambio', '❤': 'corazon', '❤️': 'corazon',
  '♥': 'corazon', '💜': 'corazon', '⭐': 'estrella', '🌟': 'estrella', '🎁': 'regalo', '💬': 'chat', '📱': 'chat', '🎨': 'paleta', '👕': 'polera',
  '☕': 'taza', '📷': 'foto', '📸': 'foto', '🙌': 'mano', '✋': 'mano', '📍': 'ubicacion', '🪙': 'moneda', '💰': 'moneda', '⚡': 'rayo', '✨': 'destello',
};

/** Nombre del ícono para un valor guardado (nombre, alias del builder o emoji); null si no hay uno. */
export function iconoDesde(valor) {
  const v = String(valor ?? '').trim();
  if (!v) return 'check';
  if (DIBUJOS[v]) return v;
  return ALIAS[v] || null;
}

/**
 * Ícono de Walá.
 *  - nombre: de ICONOS_WALA (o alias / emoji, se traduce)
 *  - sticker: va sobre un círculo blanco (se lee igual en claro y en noche)
 *  - girar: grados (los stickers van un poco ladeados)
 */
export function IconoWala({ nombre, tamano = 44, sticker = true, girar = -6, titulo, className }) {
  const clave = iconoDesde(nombre);
  const dibujo = clave ? DIBUJOS[clave] : null;
  const contenido = dibujo ? (
    <svg viewBox="0 0 48 48" className={s.svg} role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {dibujo}
    </svg>
  ) : (
    <span className={s.emoji} aria-hidden="true">{nombre}</span>
  );
  return (
    <span
      className={[s.icono, sticker && s.sticker, className].filter(Boolean).join(' ')}
      style={{ '--tam': `${tamano}px`, '--girar': `${girar}deg` }}
    >
      {contenido}
    </span>
  );
}
