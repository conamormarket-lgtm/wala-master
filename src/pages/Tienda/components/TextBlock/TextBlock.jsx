import React from 'react';
import { TextoSeccion, BotonSeccion } from '../textStyleUtils.jsx';

const TextBlock = ({ config }) => {
  const {
    heading = '',
    content = '',
    backgroundColor = 'transparent',
    // Colores POR DEFECTO referidos a tokens del tema para que en modo noche el
    // texto quede legible automaticamente. Si el admin define textColor/
    // headingColor en el editor, esos valores (truthy) siguen mandando.
    textColor = 'var(--color-text-muted)',
    headingColor = 'var(--color-text)',
    textAlign = 'left',
    paddingTop = '2rem',
    paddingBottom = '2rem',
    maxWidth = '800px',
    headingFontFamily,
    headingFontSize,
    headingFontWeight,
    headingTextTransform,
    contentFontFamily,
    contentFontSize,
    contentFontWeight,
    contentTextTransform
  } = config || {};

  if (!heading && !content) return null;

  return (
    <div 
      style={{ 
        backgroundColor, 
        paddingTop, 
        paddingBottom,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}
    >
      <div 
        style={{ 
          maxWidth, 
          width: '100%',
          padding: '0 1.5rem',
          textAlign,
          boxSizing: 'border-box'
        }}
      >
        {/* Encabezado: TextoSeccion aplica align/underline/bg/link del campo `heading`.
            Se conservan todos los estilos base inline. */}
        <TextoSeccion
          settings={config}
          prefix="heading"
          as="h2"
          style={{
            color: headingColor,
            marginBottom: content ? '1rem' : '0',
            fontSize: headingFontSize || '2rem',
            fontWeight: headingFontWeight || 'bold',
            fontFamily: headingFontFamily || 'inherit',
            textTransform: headingTextTransform || 'none'
          }}
        >
          {heading}
        </TextoSeccion>
        {/* Contenido: TextoSeccion aplica el estilo editable del campo `content`.
            Se mantiene whiteSpace pre-wrap para respetar saltos de linea. */}
        <TextoSeccion
          settings={config}
          prefix="content"
          as="div"
          style={{
            color: textColor,
            fontSize: contentFontSize || '1.1rem',
            fontWeight: contentFontWeight || 'normal',
            fontFamily: contentFontFamily || 'inherit',
            textTransform: contentTextTransform || 'none',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap'
          }}
        >
          {content}
        </TextoSeccion>
        {/* Boton opcional agregado desde el editor (buttonText/buttonLink).
            Sin esos campos, BotonSeccion devuelve null (retrocompatible). */}
        <BotonSeccion settings={config} style={{ marginTop: '1.5rem' }} />
      </div>
    </div>
  );
};

export default TextBlock;
