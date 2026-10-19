import React from 'react';
import { ArrowRight } from 'lucide-react';
import Boton from './Boton';
import { Enlace } from './Enlace';
import { useTexto } from './Traduccion';
import { EtiquetaColgante, Garabatos, Trazo } from './Marca';
import { urlDeFondo } from '../../components/common/OptimizedImage/OptimizedImage';
import s from './Seccion.module.css';

/**
 * Envoltura de TODA sección del builder: relleno y fondo se aplican aquí una
 * sola vez (antes cada caso del switch de TiendaPage lo repetía, y 6
 * secciones ignoraban el relleno o el fondo).
 *
 * Lee los mismos campos que ya guarda Firestore en `settings`:
 *   paddingTop, paddingBottom, backgroundColor, backgroundGradient,
 *   backgroundImageUrl, backgroundBlur, backgroundOverlay, anchorId, fullWidth
 */
/**
 * Espacio arriba o abajo con un mínimo: el valor del builder manda si es
 * mayor; si es 0 o no hay, queda el mínimo (--seccion-min). Los componentes
 * viejos de la tienda traían su propio margen interno, así que un "0em" del
 * builder nunca dejaba dos secciones pegadas; aquí tampoco.
 *  - pegado: sin mínimo (barra de anuncios, que va justo bajo la cabecera)
 */
function espacio(valor, pegado) {
  const v = String(valor ?? '').trim();
  if (pegado) return v || undefined;
  if (!v || parseFloat(v) === 0) return 'var(--seccion-min)';
  const conUnidad = /^[\d.]+$/.test(v) ? `${v}px` : v;
  return `max(var(--seccion-min), ${conUnidad})`;
}

export function BloqueSeccion({ ajustes = {}, ancho = 'contenido', pegado = false, children, className, id, style }) {
  const {
    paddingTop, paddingBottom, backgroundColor, backgroundGradient,
    backgroundImageUrl, backgroundBlur, backgroundOverlay, anchorId, fullWidth,
  } = ajustes;
  const color = backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : null;
  const hayFondo = color || backgroundGradient || backgroundImageUrl;
  const completo = fullWidth || ancho === 'completo';

  return (
    <section
      id={id || anchorId || undefined}
      data-kit-seccion=""
      className={[s.bloque, completo && s.completo, className].filter(Boolean).join(' ')}
      style={{
        ...style,
        paddingTop: paddingTop != null && paddingTop !== '' ? espacio(paddingTop, pegado) : undefined,
        paddingBottom: paddingBottom != null && paddingBottom !== '' ? espacio(paddingBottom, pegado) : undefined,
      }}
    >
      {hayFondo && (
        <div className={s.fondo} aria-hidden="true">
          {color && <span style={{ background: color }} />}
          {backgroundGradient && <span style={{ background: backgroundGradient }} />}
          {backgroundImageUrl && (
            <span
              className={s.fondoImagen}
              style={{ backgroundImage: `url("${urlDeFondo(backgroundImageUrl)}")`, filter: backgroundBlur ? `blur(${parseFloat(backgroundBlur) || 0}px)` : undefined }}
            />
          )}
          {backgroundOverlay && <span style={{ background: backgroundOverlay }} />}
        </div>
      )}
      <div className={s.contenido}>{children}</div>
    </section>
  );
}

/**
 * Título de sección único (antes ~8 tamaños distintos). Usa los tokens
 * --section-title-size / -weight / -tracking de tokens.css.
 *  - titulo, subtitulo, antetitulo (este va en una etiqueta colgante)
 *  - alinear: 'left' | 'center' | 'right' (titleAlign del builder)
 *  - subrayado: trazo a mano bajo el título (titleUnderline)
 *  - fondo: color detrás del título, como un resaltador (titleBg)
 *  - enlace: el título lleva a una ruta, con flecha (titleLink)
 *  - accion: { texto, url, colorFondo, colorTexto } botón "Ver todo"
 *    (buttonText/buttonLink y, si el editor los fijó, sus colores)
 *  - adorno: destellos de marca junto al título
 */
export function TituloSeccion({ titulo: tituloOriginal, subtitulo: subtituloOriginal, antetitulo: antetituloOriginal, alinear = 'left', subrayado = false, fondo, enlace, accion, nivel = 2, adorno = false }) {
  // Los títulos vienen del builder: pasan por la traducción de la tienda (si hay).
  const titulo = useTexto(tituloOriginal);
  const subtitulo = useTexto(subtituloOriginal);
  const antetitulo = useTexto(antetituloOriginal);
  if (!titulo && !subtitulo) return null;
  const H = `h${nivel}`;
  const centrado = alinear === 'center';
  const derecha = alinear === 'right';
  const texto = (
    <>
      <span className={fondo ? s.resaltado : undefined} style={fondo ? { '--resaltado': fondo } : undefined}>{titulo}</span>
      {enlace && <ArrowRight className={s.flecha} aria-hidden="true" />}
      {subrayado && <Trazo className={s.subrayado} />}
      {adorno && <Garabatos variante="titulo" />}
    </>
  );
  const conColores = accion?.colorFondo || accion?.colorTexto;
  return (
    <header className={[s.titulo, centrado && s.centrado, derecha && s.derecha].filter(Boolean).join(' ')}>
      <div className={s.tituloTextos}>
        {antetitulo && <p className={s.antetitulo}><EtiquetaColgante tono="suave">{antetitulo}</EtiquetaColgante></p>}
        {titulo && (
          <H className={s.h}>
            {enlace ? <Enlace to={enlace} className={s.hEnlace}>{texto}</Enlace> : texto}
          </H>
        )}
        {subtitulo && <p className={s.subtitulo}>{subtitulo}</p>}
      </div>
      {accion?.texto && accion?.url && (
        <Boton
          to={accion.url}
          variante={conColores ? 'primario' : 'fantasma'}
          tamano="sm"
          className={s.accion}
          style={conColores ? { '--b-fondo': accion.colorFondo, '--b-fondo-hover': accion.colorFondo, '--b-texto': accion.colorTexto } : undefined}
        >
          {accion.texto}
        </Boton>
      )}
    </header>
  );
}

/** Lee el título estándar de un `settings` del builder. */
export const tituloDesdeAjustes = (a = {}) => ({
  titulo: a.title,
  subtitulo: a.subtitle,
  antetitulo: a.eyebrow,
  alinear: a.titleAlign || 'left',
  subrayado: Boolean(a.titleUnderline),
  fondo: a.titleBg || undefined,
  enlace: a.titleLink || undefined,
  accion: a.buttonText && a.buttonLink
    ? { texto: a.buttonText, url: a.buttonLink, colorFondo: a.buttonBgColor || undefined, colorTexto: a.buttonTextColor || undefined }
    : undefined,
});
