import React from 'react';
import { Enlace } from '../Enlace';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import s from './LogoMarca.module.css';

/** Formas que guarda el editor (MarqueeBrandItem): circle | square | star | pentagon. */
const FORMAS = {
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  pentagon: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
};

/**
 * Logo de una marca como sticker con borde blanco y su nombre debajo.
 *  - nombre, imagen, url
 *  - forma: 'square' | 'circle' | 'star' | 'pentagon' (los del editor)
 *  - zoom, posX, posY: encuadre elegido en el editor
 *  - giro: grados
 */
export function LogoMarca({ nombre, imagen, url, alt, forma = 'square', zoom = 1, posX = 50, posY = 50, giro = -4 }) {
  const logo = (
    <span className={s.marca} style={{ '--giro': `${giro}deg` }} title={nombre}>
      <span className={[s.marcaForma, s[`forma_${forma}`]].filter(Boolean).join(' ')} style={FORMAS[forma] ? { clipPath: FORMAS[forma] } : undefined}>
        {imagen ? (
          <img
            src={toDirectImageUrl(imagen)}
            alt={alt || nombre || ''}
            loading="lazy"
            decoding="async"
            style={{ objectPosition: `${posX}% ${posY}%`, transform: Number(zoom) > 1 ? `scale(${zoom})` : undefined }}
          />
        ) : <strong>{String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}</strong>}
      </span>
      {nombre && <small className={s.marcaNombre}>{nombre}</small>}
    </span>
  );
  return url ? <Enlace to={url} className={s.marcaEnlace}>{logo}</Enlace> : logo;
}
