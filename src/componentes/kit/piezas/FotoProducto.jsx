import React from 'react';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import s from './FotoProducto.module.css';

/**
 * Foto de producto sobre su escenario (--escenario-foto) con multiply: el
 * fondo blanco de la foto no se ve como recuadro. Es la única regla de "fotos
 * con fondo blanco" del kit: miniaturas del carrito, de pedidos, de toasts y
 * notificaciones, de los menús, de "Agregar rápido", las piezas de un combo…
 *
 *  - src, alt (por defecto vacío: casi siempre el nombre va al lado)
 *  - relleno: aire alrededor de la foto ('3px', '6%'…; por defecto ninguno)
 *  - className: tamaño, radio, sombra y forma los pone quien la usa
 *  - respaldo: lo que va si no hay foto (una inicial, un ícono)
 *  - children: lo que va siempre encima de la foto (una etiqueta, un puesto)
 *  - como: etiqueta del contenedor ('span' por defecto)
 *  - loading, decoding: los de la imagen (lazy / async por defecto)
 *  - srcSet, sizes: copias de la foto en varios tamaños (la tienda las tiene),
 *    para bajar solo la que hace falta
 *  - espalda: la otra cara de una prenda; con ratón, se ve al pasar por el
 *    botón o enlace que contiene la foto (como en las tarjetas de creación)
 *
 * Las reglas de aquí no pesan (:where), así que cualquier clase de quien la
 * usa gana sin pelear por especificidad.
 */
export function FotoProducto({ src, srcSet, sizes, alt = '', relleno, className, style, respaldo, children, espalda, como: Etiqueta = 'span', loading = 'lazy', decoding = 'async', ...rest }) {
  const conEspalda = Boolean(src && espalda);
  return (
    <Etiqueta
      className={[s.foto, conEspalda && s.conEspalda, className].filter(Boolean).join(' ')}
      style={relleno ? { '--relleno': relleno, ...style } : style}
      {...rest}
    >
      {children}
      {conEspalda && <img className={s.espalda} src={espalda} alt="" loading="lazy" decoding="async" draggable={false} />}
      {src ? <img {...fuentes(src, srcSet, sizes)} alt={alt} loading={loading} decoding={decoding} draggable={false} /> : respaldo}
    </Etiqueta>
  );
}

// Sin copias propias, las pide a Cloudinary (si la foto es de Storage).
function fuentes(src, srcSet, sizes) {
  return srcSet ? { src, srcSet, sizes } : atributosDeFoto(src, sizes);
}
