import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { Enlace } from '../Enlace';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import s from './TarjetaCategoria.module.css';

/** Color estable para una categoría sin foto (mismo nombre → mismo color). */
const tonoDe = (texto) => {
  let h = 0;
  for (const c of String(texto || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(h) % 360} 55% 82%)`;
};

/**
 * Una categoría con su foto. La usan la cuadrícula de categorías
 * (category_grid) y la navegación por burbujas (categories_nav).
 *
 *  - forma: 'cuadro' | 'circulo' | 'burbuja'
 *  - nombre, imagen, cuenta (número de productos, opcional)
 *  - url (enlace) u onClick (botón, p. ej. filtrar la misma página)
 *  - activa: resaltada (burbuja elegida)
 *  - todos: la burbuja "Todos" (sello con el degradado del logo)
 *  - acento: color del aro (la foto queda en neutro: nunca se tiñe)
 *  - fondo: color propio del cuadro (tileBackgroundColor del builder)
 *  - giro: grados al pasar el ratón (cuadros y círculos)
 */
export function TarjetaCategoria({ forma = 'cuadro', nombre, imagen, cuenta, url, onClick, activa = false, todos = false, acento, fondo, giro = -2.5, className }) {
  const foto = todos ? <LayoutGrid aria-hidden="true" />
    : imagen ? <img src={toDirectImageUrl(imagen)} alt="" loading="lazy" decoding="async" />
      : <span aria-hidden="true">{String(nombre || '').trim()[0]?.toUpperCase()}</span>;

  if (forma === 'burbuja') {
    const cls = [s.burbuja, activa && s.burbujaActiva, todos && s.burbujaTodos, className].filter(Boolean).join(' ');
    const contenido = (
      <>
        <span className={s.burbujaFoto} style={todos ? undefined : { '--acento': acento, background: imagen ? fondo : tonoDe(nombre) }}>{foto}</span>
        <span className={s.burbujaNombre}>{nombre}</span>
      </>
    );
    return onClick
      ? <button type="button" className={cls} aria-pressed={activa} onClick={onClick}>{contenido}</button>
      : <Enlace to={url} className={cls} aria-current={activa ? 'page' : undefined}>{contenido}</Enlace>;
  }

  return (
    <Enlace
      to={url}
      onClick={onClick}
      className={[s.categoria, forma === 'circulo' && s.circulo, className].filter(Boolean).join(' ')}
      style={{ '--giro': `${giro}deg` }}
    >
      <span className={s.foto} style={{ background: fondo || undefined, '--acento': acento }}>{foto}</span>
      <span className={s.nombre}>{nombre}</span>
      {cuenta != null && <small>{cuenta} productos</small>}
    </Enlace>
  );
}

/** Burbuja vacía mientras cargan las categorías. */
export function TarjetaCategoriaEsqueleto() {
  return <span className={`${s.burbuja} ${s.burbujaEsqueleto}`} aria-hidden="true"><span className={s.burbujaFoto} /></span>;
}
