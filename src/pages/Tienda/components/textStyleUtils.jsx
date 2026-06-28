import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Utilidades REUTILIZABLES para aplicar en el RENDER el estilo de texto por campo
 * que el editor visual guarda por sección.
 *
 * Para cada campo de texto (title/subtitle/heading/content/description...) el editor
 * persiste, siguiendo el contrato de TextStyleControl:
 *   - `${prefix}Align`     -> 'left' | 'center' | 'right' | '' (sin forzar)
 *   - `${prefix}Underline` -> boolean
 *   - `${prefix}Bg`        -> color de fondo del texto (string, '' = sin fondo)
 *   - `${prefix}Link`      -> URL de destino (string, '' = sin enlace)
 *
 * Y para el botón de sección: `buttonText`, `buttonLink` (+ opcionales
 * `buttonBgColor` / `buttonTextColor`).
 *
 * RETROCOMPATIBLE: si los campos están vacíos/ausentes, el resultado es EXACTAMENTE
 * el de hoy (sin alineación forzada, sin subrayado, sin fondo, sin enlace).
 * Tolerante a `settings` undefined.
 */

/**
 * Detecta si una URL es interna (ruta de la SPA) para usar <Link>,
 * o externa para usar <a target="_blank">.
 * @param {string} url
 * @returns {boolean} true si es ruta interna (empieza con '/')
 */
const esEnlaceInterno = (url) =>
  typeof url === 'string' && url.startsWith('/');

/**
 * Devuelve SOLO el objeto de estilo del SPAN interno (subrayado + fondo)
 * para los componentes que prefieran aplicarlo inline.
 * Si no hay subrayado ni fondo, devuelve {} (no altera el render actual).
 *
 * @param {object} settings Objeto settings de la sección (puede ser undefined)
 * @param {string} prefix   Nombre base del campo (ej: 'title', 'heading')
 * @returns {object} estilo inline para el texto
 */
export const estiloTexto = (settings, prefix) => {
  const s = settings || {};
  const underline = s[`${prefix}Underline`] || false;
  const bg = s[`${prefix}Bg`] || '';

  return {
    ...(underline ? { textDecoration: 'underline' } : {}),
    ...(bg && bg !== 'transparent'
      ? {
          backgroundColor: bg,
          padding: '0.1em 0.35em',
          borderRadius: 4,
          display: 'inline-block'
        }
      : {})
  };
};

/**
 * Envuelve un nodo en el enlace adecuado según la URL:
 *   - interno ('/...')  -> <Link to={url}>
 *   - externo           -> <a href target="_blank" rel="noopener noreferrer">
 * Hereda el color del texto (no pinta de azul) para no romper el diseño.
 * Si no hay URL, devuelve el nodo tal cual.
 *
 * @param {string} url   URL de destino ('' = sin enlace)
 * @param {React.ReactNode} node  Contenido a envolver
 * @returns {React.ReactNode}
 */
const envolverEnEnlace = (url, node) => {
  if (!url) return node;

  // Enlace interno de la SPA
  if (esEnlaceInterno(url)) {
    return (
      <Link to={url} style={{ color: 'inherit', textDecoration: 'inherit' }}>
        {node}
      </Link>
    );
  }

  // Enlace externo
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'inherit', textDecoration: 'inherit' }}
    >
      {node}
    </a>
  );
};

/**
 * Componente que renderiza un campo de texto de sección aplicando su estilo
 * editable (alineación, subrayado, fondo del texto y enlace).
 *
 * Uso típico (sustituye al <h2>/<p>/<div> manual del sub-componente):
 *   <TextoSeccion settings={config} prefix="title" as="h1" style={{ color }}>
 *     {title}
 *   </TextoSeccion>
 *
 * - `as`        -> tag a renderizar (h1/h2/p/div...). Por defecto 'h2'.
 * - `className` -> se pasa tal cual al elemento contenedor.
 * - `style`     -> estilo del contenedor; se fusiona con { textAlign }.
 * - `children`  -> contenido del texto (alternativa: prop `text`).
 *
 * Si no hay contenido (ni children ni text) -> devuelve null (igual que hoy,
 * los sub-componentes no renderizan campos vacíos).
 *
 * @returns {React.ReactElement|null}
 */
export const TextoSeccion = ({
  settings,
  prefix,
  as: Tag = 'h2',
  className,
  style,
  children,
  text,
  ...rest
}) => {
  const contenido = children != null && children !== '' ? children : text;

  // Sin contenido -> no renderiza nada (retrocompatible)
  if (contenido == null || contenido === '') return null;

  const s = settings || {};
  const align = s[`${prefix}Align`] || '';
  const link = s[`${prefix}Link`] || '';

  // Estilo del SPAN interno (subrayado / fondo). Vacío si no hay nada que aplicar.
  const spanStyle = estiloTexto(s, prefix);

  // El span solo necesita estilo cuando hay subrayado o fondo; si no, va "pelado".
  const span = (
    <span style={Object.keys(spanStyle).length ? spanStyle : undefined}>
      {contenido}
    </span>
  );

  return (
    <Tag
      className={className}
      style={{ textAlign: align || undefined, ...style }}
      {...rest}
    >
      {envolverEnEnlace(link, span)}
    </Tag>
  );
};

/**
 * Componente para el botón de la sección.
 * Solo renderiza si existen `settings.buttonText` && `settings.buttonLink`.
 * - Enlace interno ('/...') -> <Link>; externo -> <a target="_blank">.
 * - Respeta `buttonBgColor` / `buttonTextColor` si están definidos.
 * - `className` y `style` permiten que cada sección imponga su propio estilo;
 *   el estilo aquí es solo una base razonable.
 *
 * Si falta texto o enlace -> devuelve null (retrocompatible).
 *
 * @returns {React.ReactElement|null}
 */
export const BotonSeccion = ({ settings, className, style }) => {
  const s = settings || {};
  const texto = s.buttonText || '';
  const url = s.buttonLink || '';

  // Sin texto o sin enlace -> no se renderiza botón
  if (!texto || !url) return null;

  // Estilo base del botón (solo si la sección no pasa su propio className/style)
  const estiloBase = {
    display: 'inline-block',
    padding: '0.75rem 1.5rem',
    borderRadius: 6,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: s.buttonBgColor || '#111111',
    color: s.buttonTextColor || '#ffffff',
    ...style
  };

  // Enlace interno de la SPA
  if (esEnlaceInterno(url)) {
    return (
      <Link to={url} className={className} style={estiloBase}>
        {texto}
      </Link>
    );
  }

  // Enlace externo
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={estiloBase}
    >
      {texto}
    </a>
  );
};

export default TextoSeccion;
