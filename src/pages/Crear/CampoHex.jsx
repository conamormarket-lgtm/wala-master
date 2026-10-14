import React, { useEffect, useState } from 'react';
import styles from './CampoHex.module.css';

/** "#abc" o "abc123" → "#AABBCC"; null si no es un color hexadecimal. */
export const normalizarHex = (texto) => {
  const limpio = String(texto || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(limpio)) return `#${limpio.split('').map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(limpio)) return `#${limpio}`.toUpperCase();
  return null;
};

/**
 * Color escrito en hexadecimal (#FF6B6B), junto a las muestras: el selector
 * del sistema muestra RGB y no deja pegar un código. Se aplica al escribir un
 * código completo; si queda a medias, al salir vuelve al color actual.
 */
const CampoHex = ({ valor, onChange, etiqueta = 'Color en hexadecimal' }) => {
  const [texto, setTexto] = useState(String(valor || '').toUpperCase());
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (!editando) setTexto(String(valor || '').toUpperCase()); }, [valor, editando]);

  return (
    <input
      type="text"
      className={styles.campo}
      value={texto}
      maxLength={7}
      spellCheck={false}
      autoComplete="off"
      aria-label={etiqueta}
      title={etiqueta}
      placeholder="#000000"
      onFocus={(e) => { setEditando(true); e.target.select(); }}
      onChange={(e) => {
        setTexto(e.target.value);
        const hex = normalizarHex(e.target.value);
        // Solo con 6 cifras mientras se escribe (con 3 aún podría seguir).
        if (hex && e.target.value.replace('#', '').length === 6) onChange(hex);
      }}
      onBlur={() => {
        setEditando(false);
        const hex = normalizarHex(texto);
        if (hex && hex !== String(valor || '').toUpperCase()) onChange(hex);
        else setTexto(String(valor || '').toUpperCase());
      }}
      onKeyDown={(e) => {
        e.stopPropagation(); // que no dispare los atajos del estudio
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
};

export default CampoHex;
