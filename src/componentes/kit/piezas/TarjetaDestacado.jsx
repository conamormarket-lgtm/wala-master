import React from 'react';
import { Enlace } from '../Enlace';
import { EtiquetaColgante } from '../Marca';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { FotoProducto } from './FotoProducto';
import { Texto } from '../Traduccion';
import s from './TarjetaDestacado.module.css';

/**
 * Tarjeta con foto, título y enlace (fila "Lo más vendido", colecciones…).
 *  - titulo, subtitulo, imagen, url
 *  - puesto: número en una etiqueta colgante (#1 en oro)
 *  - acento: color de la línea sobre la foto
 *  - alinearTitulo / alinearSubtitulo: 'left' | 'center' | 'right'
 * Título y subtítulo pasan por la traducción de la tienda.
 */
export function TarjetaDestacado({ titulo, subtitulo, imagen, url, puesto, acento, alinearTitulo, alinearSubtitulo }) {
  return (
    <Enlace to={url} className={s.destacado}>
      <FotoProducto className={s.destacadoFoto} style={{ '--acento': acento }} src={imagen && toDirectImageUrl(imagen)}>
        {puesto != null && <EtiquetaColgante tono={puesto === 1 ? 'oro' : 'violeta'} className={s.destacadoPuesto}>#{puesto}</EtiquetaColgante>}
      </FotoProducto>
      <span className={s.destacadoTexto}>
        {titulo && <strong style={{ textAlign: alinearTitulo || undefined }}><Texto>{titulo}</Texto></strong>}
        {subtitulo && <small style={{ textAlign: alinearSubtitulo || undefined }}><Texto>{subtitulo}</Texto></small>}
      </span>
    </Enlace>
  );
}
