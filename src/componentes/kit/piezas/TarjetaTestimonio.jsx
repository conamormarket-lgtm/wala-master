import React from 'react';
import { BadgeCheck, Star } from 'lucide-react';
import { EtiquetaColgante } from '../Marca';
import { Avatar } from './Avatar';
import { Texto, useTexto } from '../Traduccion';
import s from './TarjetaTestimonio.module.css';

/**
 * Opinión de un cliente (sección de testimonios, ficha de producto…).
 *  - texto, autor, ciudad, tema, puntuacion (1-5), avatar, verificado
 *  - giro: grados (las notas van un poco ladeadas)
 * La opinión y el tema pasan por la traducción (el nombre y la ciudad, tal cual).
 */
export function TarjetaTestimonio({ texto, autor, ciudad, tema, puntuacion = 0, avatar, verificado = false, giro = 0 }) {
  const estrellas = useTexto(`${puntuacion} de 5 estrellas`);
  return (
    <figure className={s.testimonio} style={{ '--giro': `${giro}deg` }}>
      <span className={s.comillas} aria-hidden="true">“</span>
      {tema && <p className={s.tema}><Texto>{tema}</Texto></p>}
      {puntuacion > 0 && (
        <p className={s.estrellas} aria-label={estrellas}>
          {Array.from({ length: 5 }, (_, n) => <Star key={n} className={n < puntuacion ? s.llena : undefined} aria-hidden="true" />)}
        </p>
      )}
      <blockquote>{typeof texto === 'string' ? <Texto>{texto}</Texto> : texto}</blockquote>
      <figcaption>
        <Avatar className={s.avatar} nombre={autor} imagen={avatar} letras={1} />
        <span>
          <strong>{autor}</strong>
          {ciudad && <small>{ciudad}</small>}
        </span>
        {verificado && <span className={s.verificado}><EtiquetaColgante tono="verde" tamano="sm" icono={<BadgeCheck aria-hidden="true" />}><Texto>Verificada</Texto></EtiquetaColgante></span>}
      </figcaption>
    </figure>
  );
}
