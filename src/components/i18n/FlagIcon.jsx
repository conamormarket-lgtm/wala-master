import React from 'react';

// =========================================================================
// FlagIcon — banderas SVG inline (NO emoji).
// Los emoji de bandera (🇪🇸/🇺🇸/🇧🇷) NO se renderizan en Windows (Chrome los
// muestra como las letras "ES/US/BR"), por eso usamos SVG dibujado a mano.
// Sin assets externos. Solo 3 idiomas soportados:
//   es → España, en → Estados Unidos, pt → Brasil (portugués de Brasil).
// =========================================================================
const FLAGS = {
  // España: franja roja arriba/abajo y banda amarilla central.
  es: (
    <>
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </>
  ),
  // Estados Unidos: 13 franjas + cantón azul con estrellas (simplificadas).
  en: (
    <>
      <rect width="30" height="20" fill="#FFFFFF" />
      {[...Array(13)].map((_, i) =>
        i % 2 === 0 ? (
          <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
        ) : null
      )}
      <rect width="12" height={(20 / 13) * 7} fill="#3C3B6E" />
      {[...Array(4)].map((_, r) =>
        [...Array(5)].map((_, c) => (
          <circle key={`${r}-${c}`} cx={1.4 + c * 2.3} cy={1.4 + r * 2.6} r="0.5" fill="#FFFFFF" />
        ))
      )}
    </>
  ),
  // Brasil: campo verde, rombo amarillo y disco azul.
  pt: (
    <>
      <rect width="30" height="20" fill="#009C3B" />
      <polygon points="15,2 28,10 15,18 2,10" fill="#FFDF00" />
      <circle cx="15" cy="10" r="4.2" fill="#002776" />
    </>
  ),
};

/**
 * @param {{ code: 'es'|'en'|'pt', size?: number, className?: string }} props
 */
export default function FlagIcon({ code, size = 20, className }) {
  const flag = FLAGS[code];
  if (!flag) return null;
  return (
    <svg
      viewBox="0 0 30 20"
      width={size}
      height={(size * 20) / 30}
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-block', borderRadius: 2, verticalAlign: 'middle' }}
    >
      {flag}
    </svg>
  );
}
