import React from 'react';
import { TextoSeccion, BotonSeccion } from '../textStyleUtils.jsx';

function renderTitleWithHighlight(title, highlight, color) {
  if (!title || !highlight) return title;
  const idx = title.indexOf(highlight);
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <span style={{ color }}>{highlight}</span>
      {title.slice(idx + highlight.length)}
    </>
  );
}

const HeaderBlock = ({ config }) => {
  const {
    title = 'Nuestra Tienda',
    subtitle = '',
    titleHighlight = '',
    titleHighlightColor = '#e10600',
    backgroundColor = 'transparent',
    // Colores POR DEFECTO referidos a tokens del tema: legibles en claro y en
    // oscuro. Si el admin fija titleColor/subtitleColor, su valor sigue mandando.
    titleColor = 'var(--color-text)',
    subtitleColor = 'var(--color-text-muted)',
    textAlign = 'center',
    compact = false,
    paddingTop,
    paddingBottom,
    titleFontFamily,
    titleFontSize,
    titleFontWeight,
    titleTextTransform,
    subtitleFontFamily,
    subtitleFontSize,
    subtitleFontWeight,
    subtitleTextTransform
  } = config || {};

  const padTop = paddingTop ?? (compact ? '1rem' : '3rem');
  const padBottom = paddingBottom ?? (compact ? '0.75rem' : '2rem');

  if (!title && !subtitle) return null;

  return (
    <div 
      style={{ 
        backgroundColor, 
        paddingTop: padTop, 
        paddingBottom: padBottom,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}
    >
      <div 
        style={{ 
          maxWidth: '1200px', 
          width: '100%',
          padding: compact ? '0 1rem' : '0 1.5rem',
          textAlign,
          boxSizing: 'border-box'
        }}
      >
        {/* Titulo: TextoSeccion aplica align/underline/bg/link del campo `title`.
            Se conservan TODOS los estilos base inline (color, fuente, etc.). */}
        <TextoSeccion
          settings={config}
          prefix="title"
          as="h1"
          style={{
            color: titleColor,
            marginBottom: subtitle ? '0.5rem' : '0',
            fontSize: titleFontSize || (compact ? '1.05rem' : 'clamp(2rem, 5vw, 3rem)'),
            fontWeight: titleFontWeight || (compact ? '800' : '800'),
            fontFamily: titleFontFamily || 'inherit',
            textTransform: titleTextTransform || 'none',
            letterSpacing: '-0.02em',
            lineHeight: '1.2'
          }}
        >
          {renderTitleWithHighlight(title, titleHighlight, titleHighlightColor)}
        </TextoSeccion>
        {/* Subtitulo: TextoSeccion aplica el estilo editable del campo `subtitle`. */}
        <TextoSeccion
          settings={config}
          prefix="subtitle"
          as="p"
          style={{
            color: subtitleColor,
            fontSize: subtitleFontSize || (compact ? '0.78rem' : 'clamp(1rem, 2vw, 1.25rem)'),
            fontWeight: subtitleFontWeight || 'normal',
            fontFamily: subtitleFontFamily || 'inherit',
            textTransform: subtitleTextTransform || 'none',
            lineHeight: '1.5',
            maxWidth: '800px',
            margin: textAlign === 'center' ? '0 auto' : '0'
          }}
        >
          {subtitle}
        </TextoSeccion>
        {/* Boton opcional que el editor puede agregar (buttonText/buttonLink).
            Si no estan definidos, BotonSeccion devuelve null (retrocompatible). */}
        <BotonSeccion settings={config} style={{ marginTop: '1.5rem' }} />
      </div>
    </div>
  );
};

export default HeaderBlock;
