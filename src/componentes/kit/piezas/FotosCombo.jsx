import React from 'react';
import { FotoProducto } from './FotoProducto';
import s from './Creaciones.module.css';

/** Las mismas prendas de Crear, también para un producto sin portada. */
export function FotosCombo({ imagenes = [], imagenesEspalda = [], verEspalda = false, respaldo, className, vertical = false }) {
  return (
    <div className={[s.foto, s.fotoCombo, vertical && s.fotoComboVertical, className].filter(Boolean).join(' ')} data-componente="FotosCombo">
      <div className={s.prendas} style={{ '--n': imagenes.length }}>
        {imagenes.map((src, i) => (
          <FotoProducto
            key={`${i}-${src}`}
            className={[s.prenda, src && imagenesEspalda[i] && s.conEspalda, src && imagenesEspalda[i] && verEspalda && s.verEspalda].filter(Boolean).join(' ')}
            src={src || undefined}
            relleno="6%"
            style={{ '--i': i }}
            respaldo={respaldo}
          >
            {src && imagenesEspalda[i] && <img className={s.espalda} src={imagenesEspalda[i]} alt="" loading="lazy" draggable={false} />}
          </FotoProducto>
        ))}
      </div>
    </div>
  );
}
