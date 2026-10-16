import React from 'react';
import { ArrowDown } from 'lucide-react';
import Boton from '../Boton';
import { Trazo, Puntos, Destello } from '../Marca';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { iniciales } from './Avatar';
import { FotoProducto } from './FotoProducto';
import s from './PortadaMarca.module.css';

/** Botón blanco sobre un fondo de color (la regla del kit). */
const BOTON_BLANCO = { '--b-fondo': '#fff', '--b-fondo-hover': '#fff', '--b-texto': 'var(--tema-tinta, #4c1d95)', '--b-borde': 'transparent' };

/**
 * La portada de la página de una marca, con su color (va dentro de
 * TemaMarca). Tres estilos, para que cada marca se vea suya sin armar nada:
 *  - 'foto': su foto de portada a todo el ancho, con el color de la marca
 *    detrás del texto;
 *  - 'color': el degradado de la marca con su logo grande en un sticker;
 *  - 'collage': un fondo tenue de la marca y tres de sus productos como
 *    cartas un poco giradas.
 * Siempre: el logo en su sticker, el nombre con su trazo, la frase, "Ver
 * productos" (baja al catálogo) y cuántos productos tiene.
 *  - nombre, logo, frase · estilo · imagen (foto) · fotos (collage)
 *  - cuenta · urlBoton ('#catalogo') · textoBoton
 */
export function PortadaMarca({
  nombre, logo, frase, estilo = 'color', imagen, fotos = [], cuenta, urlBoton = '#catalogo', textoBoton = 'Ver productos',
}) {
  // Sin su foto, la portada de foto cae en la de color (nunca una caja vacía).
  const tipo = estilo === 'foto' && imagen ? 'foto' : estilo === 'collage' && fotos.length ? 'collage' : 'color';
  const sobreColor = tipo !== 'collage';
  const sticker = (grande) => (
    <span className={[s.logo, grande && s.logoGrande].filter(Boolean).join(' ')}>
      {logo ? <img src={toDirectImageUrl(logo)} alt={grande ? '' : `Logo de ${nombre}`} loading="eager" decoding="async" /> : <strong>{iniciales(nombre) || '?'}</strong>}
    </span>
  );
  return (
    <section className={[s.portada, s[`p_${tipo}`]].join(' ')} data-componente="PortadaMarca" aria-label={nombre}>
      {tipo === 'foto' && <img className={s.fondo} src={toDirectImageUrl(imagen)} alt="" loading="eager" decoding="async" />}
      {sobreColor && (
        <span className={s.adornos} aria-hidden="true">
          <Puntos className={s.puntos} />
          <Destello className={s.destello1} />
          <Destello className={s.destello2} />
        </span>
      )}
      <div className={s.texto}>
        {tipo !== 'color' && sticker(false)}
        <h1 className={s.nombre}>
          {nombre}
          <Trazo className={s.trazo} />
        </h1>
        {frase && <p className={s.frase}>{frase}</p>}
        <div className={s.acciones}>
          <Boton
            to={urlBoton}
            tamano="lg"
            variante={sobreColor ? 'contorno' : 'primario'}
            style={sobreColor ? BOTON_BLANCO : undefined}
            iconoFin={<ArrowDown aria-hidden="true" />}
          >
            {textoBoton}
          </Boton>
          {cuenta > 0 && <span className={s.cuenta}>{cuenta === 1 ? '1 producto' : `${cuenta} productos`}</span>}
        </div>
      </div>
      {tipo === 'color' && <div className={s.lado}>{sticker(true)}</div>}
      {tipo === 'collage' && (
        <div className={s.lado} aria-hidden="true">
          <div className={s.collage}>
            {fotos.slice(0, 3).map((f, i) => <FotoProducto key={`${f}-${i}`} className={s.carta} src={f} relleno="8%" style={{ '--i': i }} />)}
          </div>
        </div>
      )}
    </section>
  );
}
