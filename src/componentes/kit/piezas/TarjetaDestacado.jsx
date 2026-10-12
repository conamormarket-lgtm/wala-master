import React from 'react';
import { Enlace } from '../Enlace';
import { EtiquetaColgante } from '../Marca';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import s from './TarjetaDestacado.module.css';

/**
 * Tarjeta con foto, título y enlace (fila "Lo más vendido", colecciones…).
 *  - titulo, subtitulo, imagen, url
 *  - puesto: número en una etiqueta colgante (#1 en oro)
 *  - acento: color de la línea sobre la foto
 *  - alinearTitulo / alinearSubtitulo: 'left' | 'center' | 'right'
 */
export function TarjetaDestacado({ titulo, subtitulo, imagen, url, puesto, acento, alinearTitulo, alinearSubtitulo }) {
  return (
    <Enlace to={url} className={s.destacado}>
      <span className={s.destacadoFoto} style={{ '--acento': acento }}>
        {puesto != null && <EtiquetaColgante tono={puesto === 1 ? 'oro' : 'violeta'} className={s.destacadoPuesto}>#{puesto}</EtiquetaColgante>}
        {imagen && <img src={toDirectImageUrl(imagen)} alt="" loading="lazy" decoding="async" draggable={false} />}
      </span>
      <span className={s.destacadoTexto}>
        {titulo && <strong style={{ textAlign: alinearTitulo || undefined }}>{titulo}</strong>}
        {subtitulo && <small style={{ textAlign: alinearSubtitulo || undefined }}>{subtitulo}</small>}
      </span>
    </Enlace>
  );
}
