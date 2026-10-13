import React from 'react';
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
 *
 * Las reglas de aquí no pesan (:where), así que cualquier clase de quien la
 * usa gana sin pelear por especificidad.
 */
export function FotoProducto({ src, alt = '', relleno, className, style, respaldo, children, como: Etiqueta = 'span', loading = 'lazy', decoding = 'async', ...rest }) {
  return (
    <Etiqueta
      className={[s.foto, className].filter(Boolean).join(' ')}
      style={relleno ? { '--relleno': relleno, ...style } : style}
      {...rest}
    >
      {children}
      {src ? <img src={src} alt={alt} loading={loading} decoding={decoding} draggable={false} /> : respaldo}
    </Etiqueta>
  );
}
