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
/* Un solo grosor de contorno (3 en la cuadrícula de 48) para que todos pesen
   igual y se lean limpios a 30 px; los detalles internos van rellenos. */
const T = { stroke: C.tinta, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };
const L = (color, ancho = 3) => ({ stroke: color, strokeWidth: ancho, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' });
/** Brillo: un trazo blanco corto y grueso (en chico se lee como reflejo, no como raya). */
const brillo = { ...L(C.blanco, 3.2), opacity: 0.75 };
/** Flecha de "cambios": arco con contorno y punta rellena. */
const Flecha = ({ arco, punta, color }) => (
  <>
    <path d={arco} {...L(C.tinta, 8.5)} />
    <path d={arco} {...L(color, 4)} />
    <path d={punta} fill={color} stroke={C.tinta} strokeWidth="2.6" strokeLinejoin="round" />
  </>
);

const DIBUJOS = {
  check: (
    <>
      <circle cx="24" cy="24" r="18" fill={C.violeta} {...T} />
      <path d="M15.5 24.5l6 6 11-12" {...L(C.blanco, 5)} />
      <path d="M12.6 17.6a13 13 0 0 1 5-5" {...brillo} />
    </>
  ),
  camion: (
    <>
      <rect x="4.5" y="12.5" width="23" height="20" rx="3.5" fill={C.violeta} {...T} />
      <path d="M27.5 18h7.4a3 3 0 0 1 2.4 1.2l4.5 6a3 3 0 0 1 .6 1.8v5.5H27.5z" fill={C.oro} {...T} />
      <path d="M30.5 21h4l3.3 4.5h-7.3z" fill={C.blanco} />
      <path d="M16 28s-5-2.9-5-6.2a2.6 2.6 0 0 1 5-1.3 2.6 2.6 0 0 1 5 1.3c0 3.3-5 6.2-5 6.2z" fill={C.rosa} />
      <circle cx="12.5" cy="34" r="5" fill={C.tinta} />
      <circle cx="12.5" cy="34" r="1.9" fill={C.lila} />
      <circle cx="34.5" cy="34" r="5" fill={C.tinta} />
      <circle cx="34.5" cy="34" r="1.9" fill={C.lila} />
    </>
  ),
  escudo: (
    <>
      <path d="M24 4.5l15.5 5.2v11.4c0 10.2-6.6 17.4-15.5 21.4-8.9-4-15.5-11.2-15.5-21.4V9.7z" fill={C.violeta} {...T} />
      <path d="M24 9.2l11 3.7v8.2c0 7.5-4.6 12.9-11 16.1z" fill={C.violetaOsc} opacity="0.4" />
      <path d="M16.8 23.2l5 5 9.4-10.2" {...L(C.blanco, 4.6)} />
    </>
  ),
  reloj: (
    <>
      <circle cx="11" cy="11.5" r="4.5" fill={C.oro} {...T} />
      <circle cx="37" cy="11.5" r="4.5" fill={C.oro} {...T} />
      <circle cx="24" cy="26" r="16" fill={C.violeta} {...T} />
      <circle cx="24" cy="26" r="11" fill={C.blanco} />
      <path d="M24 19.5v6.5l5 3" {...L(C.tinta, 3.4)} />
      <circle cx="24" cy="26" r="2.2" fill={C.violeta} />
    </>
  ),
  tarjeta: (
    <>
      <rect x="4.5" y="10.5" width="39" height="27" rx="5" fill={C.violeta} {...T} />
      <rect x="6" y="16.5" width="36" height="5.5" fill={C.tinta} />
      <rect x="10" y="26.5" width="9" height="6.5" rx="1.8" fill={C.oro} stroke={C.tinta} strokeWidth="2.2" />
      <path d="M24.5 29.8h12" {...L(C.lila, 3)} />
    </>
  ),
  cambio: (
    <>
      <Flecha arco="M35.8 21.9A12 12 0 0 0 13.4 18" punta="M18.4 20.9L7.7 17 10.5 27.4z" color={C.violeta} />
      <Flecha arco="M12.2 26.1A12 12 0 0 0 34.6 30" punta="M29.6 27.1L40.3 31 37.5 20.6z" color={C.rosa} />
    </>
  ),
  corazon: (
    <>
      <path d="M24 41S7 31 7 18.5A9.5 9.5 0 0 1 24 13a9.5 9.5 0 0 1 17 5.5C41 31 24 41 24 41z" fill={C.rosa} {...T} />
      <path d="M12.8 18.6a5.2 5.2 0 0 1 4.6-4.4" {...brillo} />
    </>
  ),
  estrella: (
    <>
      <path d="M24 4.5l5.7 11.6 12.8 1.9-9.3 9 2.2 12.7L24 33.7l-11.4 6 2.2-12.7-9.3-9 12.8-1.9z" fill={C.oro} {...T} />
      <circle cx="20.6" cy="23.5" r="1.7" fill={C.tinta} />
      <circle cx="27.4" cy="23.5" r="1.7" fill={C.tinta} />
      <path d="M21.2 28c1.6 1.5 4 1.5 5.6 0" {...L(C.tinta, 2.2)} />
    </>
  ),
  regalo: (
    <>
      <rect x="8.5" y="21.5" width="31" height="19" rx="3" fill={C.violeta} {...T} />
      <rect x="6" y="14.5" width="36" height="8" rx="2.5" fill={C.lila} {...T} />
      <rect x="21.5" y="16" width="5" height="23" fill={C.rosa} />
      <path d="M24 14.5c-2.6-5-9.6-6.2-9.2-1.8.3 2.6 5.2 3.1 9.2 1.8zM24 14.5c2.6-5 9.6-6.2 9.2-1.8-.3 2.6-5.2 3.1-9.2 1.8z" fill={C.rosa} {...T} strokeWidth="2.6" />
    </>
  ),
  chat: (
    <>
      <path d="M9.5 9h29a4.5 4.5 0 0 1 4.5 4.5v16a4.5 4.5 0 0 1-4.5 4.5H23l-9 7v-7H9.5A4.5 4.5 0 0 1 5 29.5v-16A4.5 4.5 0 0 1 9.5 9z" fill={C.violeta} {...T} />
      <circle cx="16" cy="21.5" r="3" fill={C.blanco} />
      <circle cx="24" cy="21.5" r="3" fill={C.blanco} />
      <circle cx="32" cy="21.5" r="3" fill={C.blanco} />
    </>
  ),
  paleta: (
    <>
      <path d="M24 5.5C13 5.5 4.5 13.3 4.5 23S12.3 41.5 22 41.5c3.2 0 4.3-2.1 3.2-4.6-1-2.4.2-4.4 3.2-4.4h5.1c5.8 0 10-3.7 10-9.8C43.5 12.8 35 5.5 24 5.5z" fill={C.lila} {...T} />
      <circle cx="14.8" cy="19" r="3.6" fill={C.violeta} stroke={C.tinta} strokeWidth="2.4" />
      <circle cx="24" cy="13.5" r="3.6" fill={C.rosa} stroke={C.tinta} strokeWidth="2.4" />
      <circle cx="33.2" cy="18.5" r="3.6" fill={C.oro} stroke={C.tinta} strokeWidth="2.4" />
      <circle cx="14.5" cy="29" r="3.6" fill={C.verde} stroke={C.tinta} strokeWidth="2.4" />
    </>
  ),
  polera: (
    <>
      <path d="M17 6.5l-11.5 6.3 4.2 8.4 5.3-2.2V40.5h18V19l5.3 2.2 4.2-8.4L31 6.5c-1.1 3.6-3.6 5.2-7 5.2s-5.9-1.6-7-5.2z" fill={C.violeta} {...T} />
      <path d="M24 31s-5-2.9-5-6.2a2.6 2.6 0 0 1 5-1.3 2.6 2.6 0 0 1 5 1.3c0 3.3-5 6.2-5 6.2z" fill={C.blanco} />
    </>
  ),
  taza: (
    <>
      <path d="M17 10.5c-1.8-1.8 1.8-2.8 0-5M24.5 10.5c-1.8-1.8 1.8-2.8 0-5" {...L(C.violeta, 3)} />
      <path d="M33 19.5h3a5.5 5.5 0 0 1 0 11h-3" {...L(C.tinta, 3.4)} />
      <path d="M8 14h25v19.5a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7z" fill={C.blanco} {...T} />
      <rect x="9.5" y="15.5" width="22" height="5" fill={C.violeta} />
      <path d="M20.5 34s-4.4-2.5-4.4-5.4a2.3 2.3 0 0 1 4.4-1.1 2.3 2.3 0 0 1 4.4 1.1c0 2.9-4.4 5.4-4.4 5.4z" fill={C.rosa} />
    </>
  ),
  foto: (
    <>
      <path d="M8.5 14.5h6.5l3-5h12l3 5h6.5a3.5 3.5 0 0 1 3.5 3.5v18.5a3.5 3.5 0 0 1-3.5 3.5h-31A3.5 3.5 0 0 1 5 36.5V18a3.5 3.5 0 0 1 3.5-3.5z" fill={C.violeta} {...T} />
      <circle cx="24" cy="27" r="8.5" fill={C.lila} {...T} />
      <circle cx="24" cy="27" r="3.8" fill={C.tinta} />
      <circle cx="22.4" cy="25.4" r="1.3" fill={C.blanco} />
    </>
  ),
  mano: (
    <>
      <path d="M13.5 26.5V14a3.2 3.2 0 0 1 6.4 0v9.5V10.8a3.2 3.2 0 0 1 6.4 0v12.7V13a3.2 3.2 0 0 1 6.4 0v12V19a3.2 3.2 0 0 1 6.4 0v9.5c0 7.6-5.6 13-13.4 13-5.4 0-8.8-2.4-11.4-6.6l-3.9-6.4a3.1 3.1 0 0 1 5.3-3.2z" fill={C.oro} {...T} />
      <path d="M26 35s-3.8-2.2-3.8-4.6a1.9 1.9 0 0 1 3.8-.9 1.9 1.9 0 0 1 3.8.9c0 2.4-3.8 4.6-3.8 4.6z" fill={C.rosa} />
    </>
  ),
  ubicacion: (
    <>
      <ellipse cx="24" cy="44" rx="8" ry="2.2" fill={C.tinta} opacity="0.18" />
      <path d="M24 42s-13-12.5-13-23a13 13 0 0 1 26 0c0 10.5-13 23-13 23z" fill={C.violeta} {...T} />
      <circle cx="24" cy="19" r="5.4" fill={C.blanco} stroke={C.tinta} strokeWidth="2.6" />
    </>
  ),
  moneda: (
    <>
      <circle cx="24" cy="24" r="18" fill={C.oro} {...T} />
      <circle cx="24" cy="24" r="12.3" fill="none" stroke={C.oroOsc} strokeWidth="2.4" />
      <circle cx="18.8" cy="20" r="2.5" fill={C.oroOsc} />
      <circle cx="24" cy="17.4" r="2.5" fill={C.oroOsc} />
      <circle cx="29.2" cy="20" r="2.5" fill={C.oroOsc} />
      <ellipse cx="24" cy="27.6" rx="5.4" ry="4.4" fill={C.oroOsc} />
    </>
  ),
  rayo: (
    <>
      <path d="M27.5 3.5L9.5 27.5h12.5L18.5 44.5 38.5 19.5H26z" fill={C.oro} {...T} />
      <path d="M22.8 11.2l-5 7" {...brillo} />
    </>
  ),
  destello: (
    <>
      <path d="M21 4c1.6 10.2 5.2 13.8 15.4 15.4C26.2 21 22.6 24.6 21 34.8 19.4 24.6 15.8 21 5.6 19.4 15.8 17.8 19.4 14.2 21 4z" fill={C.oro} {...T} />
      <path d="M37.5 29c.8 4.2 2.2 5.6 6.4 6.4-4.2.8-5.6 2.2-6.4 6.4-.8-4.2-2.2-5.6-6.4-6.4 4.2-.8 5.6-2.2 6.4-6.4z" fill={C.rosa} {...T} strokeWidth="2.4" />
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
 *  - girar: grados (0 por defecto: girados en tamaño chico se ven dentados)
 */
export function IconoWala({ nombre, tamano = 44, sticker = true, girar = 0, titulo, className }) {
  const clave = iconoDesde(nombre);
  const dibujo = clave ? DIBUJOS[clave] : null;
  const contenido = dibujo ? (
    <svg viewBox="0 0 48 48" className={s.svg} shapeRendering="geometricPrecision" role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
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
