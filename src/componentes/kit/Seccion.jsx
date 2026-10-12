import React from 'react';
import Boton from './Boton';
import { EtiquetaColgante, Garabatos } from './Marca';
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
export function BloqueSeccion({ ajustes = {}, ancho = 'contenido', children, className }) {
  const {
    paddingTop, paddingBottom, backgroundColor, backgroundGradient,
    backgroundImageUrl, backgroundBlur, backgroundOverlay, anchorId, fullWidth,
  } = ajustes;
  const color = backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : null;
  const hayFondo = color || backgroundGradient || backgroundImageUrl;
  const completo = fullWidth || ancho === 'completo';

  return (
    <section
      id={anchorId || undefined}
      className={[s.bloque, completo && s.completo, className].filter(Boolean).join(' ')}
      style={{ paddingTop: paddingTop || undefined, paddingBottom: paddingBottom || undefined }}
    >
      {hayFondo && (
        <div className={s.fondo} aria-hidden="true">
          {color && <span style={{ background: color }} />}
          {backgroundGradient && <span style={{ background: backgroundGradient }} />}
          {backgroundImageUrl && (
            <span
              className={s.fondoImagen}
              style={{ backgroundImage: `url("${backgroundImageUrl}")`, filter: backgroundBlur ? `blur(${parseFloat(backgroundBlur) || 0}px)` : undefined }}
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
 *  - titulo, subtitulo, antetitulo
 *  - alinear: 'left' | 'center' (titleAlign del builder)
 *  - accion: { texto, url } enlace "Ver todo" a la derecha (buttonText/buttonLink)
 *  - antetitulo: va en una etiqueta colgante (eyebrow del builder)
 *  - adorno: destellos de marca junto al título
 */
export function TituloSeccion({ titulo, subtitulo, antetitulo, alinear = 'left', accion, nivel = 2, adorno = false }) {
  if (!titulo && !subtitulo) return null;
  const H = `h${nivel}`;
  const centrado = alinear === 'center';
  return (
    <header className={[s.titulo, centrado && s.centrado].filter(Boolean).join(' ')}>
      <div className={s.tituloTextos}>
        {antetitulo && <p className={s.antetitulo}><EtiquetaColgante tono="suave">{antetitulo}</EtiquetaColgante></p>}
        {titulo && (
          <H className={s.h}>
            {titulo}
            {adorno && <Garabatos variante="titulo" />}
          </H>
        )}
        {subtitulo && <p className={s.subtitulo}>{subtitulo}</p>}
      </div>
      {accion?.texto && accion?.url && (
        <Boton to={accion.url} variante="fantasma" tamano="sm" className={s.accion}>{accion.texto}</Boton>
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
  accion: a.buttonText && a.buttonLink ? { texto: a.buttonText, url: a.buttonLink } : undefined,
});
