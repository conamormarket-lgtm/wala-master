import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Enlace } from '../Enlace';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import { Texto } from '../Traduccion';
import s from './TarjetaColeccion.module.css';

/**
 * Una colección como banner (la sección «Colecciones con foto»): la foto
 * ancha de la colección a todo el cuadro, "Colección" arriba y el nombre en
 * la letra del logo abajo, sobre una sombra, con cuántos productos y una
 * flecha. A propósito distinta de TarjetaCategoria (cuadros y círculos).
 *
 *  - nombre, imagen (la de la colección, ancha; sin ella, el degradado del acento), url
 *  - cuenta: cuántos productos (opcional)
 *  - acento: color del degradado sin foto y del filo de abajo
 *  - fondo: color propio detrás de la foto (tileBackgroundColor del builder)
 */
export function TarjetaColeccion({ nombre, imagen, url, cuenta, acento, fondo, className }) {
  return (
    <Enlace to={url} className={[s.coleccion, className].filter(Boolean).join(' ')} style={{ '--acento': acento, background: fondo || undefined }}>
      {imagen
        ? <img className={s.foto} {...atributosDeFoto(toDirectImageUrl(imagen), '(max-width: 640px) 85vw, 480px')} alt="" loading="lazy" decoding="async" />
        : <span className={s.sinFoto} aria-hidden="true" />}
      <span className={s.sombra} aria-hidden="true" />
      <span className={s.etiqueta}>Colección</span>
      <span className={s.pie}>
        <span className={s.textos}>
          <strong className={s.nombre}><Texto>{nombre}</Texto></strong>
          {cuenta != null && <small className={s.cuenta}>{cuenta === 1 ? '1 producto' : `${cuenta} productos`}</small>}
        </span>
        <span className={s.flecha} aria-hidden="true"><ArrowRight /></span>
      </span>
    </Enlace>
  );
}
