import React from 'react';
import { Enlace } from '../Enlace';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import { iniciales } from './Avatar';
import s from './LogoMarca.module.css';

/** Formas que guarda el editor (MarqueeBrandItem): circle | square | star | pentagon. */
const FORMAS = {
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  pentagon: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
};

/**
 * Logo de una marca.
 *  - variante: 'sticker' (por defecto: sticker con borde blanco y el nombre
 *    debajo, como en "Logos en movimiento") | 'sello' (círculo blanco chico y
 *    girado, sin nombre a la vista: el sello de la marca en la tarjeta de
 *    producto y en el menú de marcas)
 *  - nombre, imagen, url, alt
 *  - forma: 'square' | 'circle' | 'star' | 'pentagon' (los del editor; solo sticker)
 *  - zoom, posX, posY: encuadre elegido en el editor (solo sticker)
 *  - giro: grados (sticker -4, sello -8 si no se pasa)
 *  - className: en el sello, la posición y el tamaño los pone quien lo usa
 */
export function LogoMarca({ variante = 'sticker', nombre, imagen, url, alt, forma = 'square', zoom = 1, posX = 50, posY = 50, giro, className }) {
  if (variante === 'sello') {
    const sello = (
      <span className={[s.sello, className].filter(Boolean).join(' ')} style={giro != null ? { '--giro': `${giro}deg` } : undefined} title={nombre}>
        {imagen
          ? <img {...atributosDeFoto(toDirectImageUrl(imagen), '96px')} alt={alt ?? nombre ?? ''} loading="lazy" decoding="async" />
          : iniciales(nombre, 1) || '?'}
      </span>
    );
    return url ? <Enlace to={url} className={s.marcaEnlace}>{sello}</Enlace> : sello;
  }

  const logo = (
    <span className={[s.marca, className].filter(Boolean).join(' ')} style={{ '--giro': `${giro ?? -4}deg` }} title={nombre}>
      <span className={[s.marcaForma, s[`forma_${forma}`]].filter(Boolean).join(' ')} style={FORMAS[forma] ? { clipPath: FORMAS[forma] } : undefined}>
        {imagen ? (
          <img
            {...atributosDeFoto(toDirectImageUrl(imagen), '160px')}
            alt={alt || nombre || ''}
            loading="lazy"
            decoding="async"
            style={{ objectPosition: `${posX}% ${posY}%`, transform: Number(zoom) > 1 ? `scale(${zoom})` : undefined }}
          />
        ) : <strong>{iniciales(nombre) || '?'}</strong>}
      </span>
      {nombre && <small className={s.marcaNombre}>{nombre}</small>}
    </span>
  );
  return url ? <Enlace to={url} className={s.marcaEnlace}>{logo}</Enlace> : logo;
}
