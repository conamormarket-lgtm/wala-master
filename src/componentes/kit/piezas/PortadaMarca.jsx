import React from 'react';
import { ArrowDown, Package, Tag, LayoutGrid } from 'lucide-react';
import Boton from '../Boton';
import { Trazo, Puntos, Destello } from '../Marca';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import { Texto, useTexto } from '../Traduccion';
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
 * productos" (baja al catálogo) y sus cifras en sellos (productos, en
 * oferta, categorías; las que son 0 no salen).
 *  - nombre, logo, frase · estilo · imagen (foto) · fotos (collage)
 *  - cuenta · ofertas · categorias (números) · urlBoton ('#catalogo') · textoBoton
 *  - alto, altoMovil: su alto mínimo (sin ellos, el de siempre: 400px en
 *    ancho) · completo: de borde a borde, sin esquinas (los tamaños de un clic)
 */
export function PortadaMarca({
  nombre, logo, frase, estilo = 'color', imagen, fotos = [], cuenta, ofertas, categorias, urlBoton = '#catalogo', textoBoton = 'Ver productos',
  alto, altoMovil, completo = false,
}) {
  // Sin su foto, la portada de foto cae en la de color (nunca una caja vacía).
  const tipo = estilo === 'foto' && imagen ? 'foto' : estilo === 'collage' && fotos.length ? 'collage' : 'color';
  const sobreColor = tipo !== 'collage';
  const cifras = [
    cuenta > 0 && { icono: Package, texto: cuenta === 1 ? '1 producto' : `${cuenta} productos` },
    ofertas > 0 && { icono: Tag, texto: ofertas >= cuenta ? 'Todo en oferta' : `${ofertas} en oferta` },
    categorias > 1 && { icono: LayoutGrid, texto: `${categorias} categorías` },
  ].filter(Boolean);
  const altLogo = useTexto(`Logo de ${nombre}`);
  const sticker = (grande) => (
    <span className={[s.logo, grande && s.logoGrande].filter(Boolean).join(' ')}>
      {logo ? <img {...atributosDeFoto(toDirectImageUrl(logo), '200px')} alt={grande ? '' : altLogo} loading="eager" decoding="async" /> : <strong>{iniciales(nombre) || '?'}</strong>}
    </span>
  );
  return (
    <section
      className={[s.portada, s[`p_${tipo}`], completo && s.completa].filter(Boolean).join(' ')}
      style={{ ...(alto ? { '--portada-alto': alto } : {}), ...(altoMovil ? { '--portada-alto-movil': altoMovil } : {}) }}
      data-componente="PortadaMarca"
      aria-label={nombre}
    >
      {tipo === 'foto' && <img className={s.fondo} {...atributosDeFoto(toDirectImageUrl(imagen), '100vw')} alt="" loading="eager" decoding="async" />}
      <span className={s.adornos} aria-hidden="true">
        <Puntos className={s.puntos} />
        <Destello className={s.destello1} />
        <Destello className={s.destello2} />
      </span>
      <div className={s.texto}>
        {tipo !== 'color' && sticker(false)}
        <h1 className={s.nombre}>
          {nombre}
          <Trazo className={s.trazo} />
        </h1>
        {frase && <p className={s.frase}><Texto>{frase}</Texto></p>}
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
        </div>
        {cifras.length > 0 && (
          <ul className={s.cifras}>
            {cifras.map(({ icono: Icono, texto }) => (
              <li key={texto} className={s.cifra}><Icono aria-hidden="true" /><Texto>{texto}</Texto></li>
            ))}
          </ul>
        )}
      </div>
      {tipo === 'color' && <div className={s.lado}>{sticker(true)}</div>}
      {tipo === 'collage' && (
        <div className={s.lado} aria-hidden="true">
          <span className={s.disco} />
          <div className={s.collage}>
            {fotos.slice(0, 3).map((f, i) => <FotoProducto key={`${f}-${i}`} className={s.carta} src={f} relleno="8%" style={{ '--i': i }} />)}
          </div>
        </div>
      )}
    </section>
  );
}
