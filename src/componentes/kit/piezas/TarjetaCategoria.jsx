import React from 'react';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { Enlace } from '../Enlace';
import { EtiquetaColgante } from '../Marca';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import { FotoProducto } from './FotoProducto';
import { Hueso } from '../Esqueletos';
import { Texto } from '../Traduccion';
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
 *  - acento: color del aro del círculo y la burbuja (la foto nunca se tiñe)
 *  - fondo: color propio del cuadro (tileBackgroundColor del builder)
 *  - giro: grados al pasar el ratón (cuadros y círculos)
 *  - detalle: una línea de texto bajo el nombre del cuadro (p. ej. el tipo de
 *    un nicho: "Personalizados")
 */
export function TarjetaCategoria({ forma = 'cuadro', nombre, imagen, cuenta, url, onClick, activa = false, todos = false, acento, fondo, giro = -2.5, detalle, className }) {
  const foto = todos ? <LayoutGrid aria-hidden="true" />
    : imagen ? <img {...atributosDeFoto(toDirectImageUrl(imagen), '320px')} alt="" loading="lazy" decoding="async" />
      : <span aria-hidden="true">{String(nombre || '').trim()[0]?.toUpperCase()}</span>;

  if (forma === 'burbuja') {
    const cls = [s.burbuja, activa && s.burbujaActiva, todos && s.burbujaTodos, className].filter(Boolean).join(' ');
    const contenido = (
      <>
        <FotoProducto
          className={s.burbujaFoto}
          style={todos ? undefined : { '--acento': acento, background: imagen ? fondo : tonoDe(nombre) }}
          src={!todos && imagen ? toDirectImageUrl(imagen) : undefined}
          sizes="160px"
          respaldo={foto}
        />
        <span className={s.burbujaNombre}><Texto>{nombre}</Texto></span>
      </>
    );
    return onClick
      ? <button type="button" className={cls} aria-pressed={activa} onClick={onClick}>{contenido}</button>
      : <Enlace to={url} className={cls} aria-current={activa ? 'page' : undefined}>{contenido}</Enlace>;
  }

  // Cuadro: la cantidad cuelga del cuadro en una etiqueta (como el precio de
  // una prenda) y el nombre va abajo con una flecha.
  if (forma === 'cuadro') {
    return (
      <Enlace to={url} onClick={onClick} className={[s.cuadro, className].filter(Boolean).join(' ')} style={{ '--giro': `${giro}deg` }}>
        <span className={s.cuadroFoto} style={{ background: fondo || undefined }}>
          <span className={s.cuadroRecorte}>{foto}</span>
          {cuenta != null && (
            <span className={s.cuadroCuenta}>
              <EtiquetaColgante tono="blanco" tamano="sm">{cuenta === 1 ? '1 producto' : `${cuenta} productos`}</EtiquetaColgante>
            </span>
          )}
        </span>
        <span className={s.cuadroNombre}>
          <span><Texto>{nombre}</Texto>{detalle && <small className={s.cuadroDetalle}>{detalle}</small>}</span>
          <ArrowRight aria-hidden="true" />
        </span>
      </Enlace>
    );
  }

  return (
    <Enlace
      to={url}
      onClick={onClick}
      className={[s.categoria, s.circulo, className].filter(Boolean).join(' ')}
      style={{ '--giro': `${giro}deg` }}
    >
      <span className={s.foto} style={{ background: fondo || undefined, '--acento': acento }}>{foto}</span>
      <span className={s.nombre}><Texto>{nombre}</Texto></span>
      {cuenta != null && <small>{cuenta === 1 ? '1 producto' : `${cuenta} productos`}</small>}
    </Enlace>
  );
}

/** Burbuja vacía mientras cargan las categorías. */
export function TarjetaCategoriaEsqueleto() {
  return (
    <span className={s.burbuja} aria-hidden="true">
      <Hueso forma="circulo" ancho={64} alto={64} />
      <Hueso alto={10} ancho={56} />
    </span>
  );
}
