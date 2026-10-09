import React from 'react';

// Moneda de Walá (moneda dorada con huella). Reemplaza al emoji 🪙, que se
// veía distinto en cada sistema (Windows, Android, iPhone) y no era de marca.
// Dos tamaños en WebP con fondo transparente: 64 px (~3 KB) para íconos chicos
// y 160 px (~9 KB) para los grandes; el navegador elige según `size`.
export const MONEDA_SRC = '/assets/monedas/moneda-64.webp';
export const MONEDA_SRC_GRANDE = '/assets/monedas/moneda-160.webp';

/**
 * @param {number|string} [size='1.15em'] Lado del ícono. Número = px; texto =
 *   cualquier medida CSS (por defecto escala con el texto, como el emoji).
 * @param {string} [alt=''] Texto alternativo. Vacío = decorativo (lo normal:
 *   al lado casi siempre va el número o la palabra "monedas").
 */
export default function Moneda({ size = '1.15em', alt = '', className, style }) {
  const lado = typeof size === 'number' ? `${size}px` : size;
  // Para elegir archivo: en px se usa tal cual; en em se asume texto normal.
  const aprox = typeof size === 'number' ? size : 24;
  return (
    <img
      src={aprox > 32 ? MONEDA_SRC_GRANDE : MONEDA_SRC}
      srcSet={`${MONEDA_SRC} 64w, ${MONEDA_SRC_GRANDE} 160w`}
      sizes={`${aprox}px`}
      width={aprox}
      height={aprox}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      decoding="async"
      draggable={false}
      className={className}
      style={{
        width: lado,
        height: lado,
        display: 'inline-block',
        verticalAlign: '-0.2em',
        flexShrink: 0,
        objectFit: 'contain',
        // Separación propia: muchos contenedores son flex y ahí el espacio de
        // texto entre la moneda y el número desaparece (quedaban pegados).
        marginInlineEnd: '0.3em',
        ...style,
      }}
    />
  );
}
