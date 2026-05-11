import React from 'react';

const HeaderBlock = ({ config }) => {
  const {
    title = 'Nuestra Tienda',
    subtitle = '',
    backgroundColor = 'transparent',
    titleColor = '#000000',
    subtitleColor = '#666666',
    textAlign = 'center',
    paddingTop = '3rem',
    paddingBottom = '2rem',
    titleFontFamily,
    titleFontSize,
    titleFontWeight,
    titleTextTransform,
    subtitleFontFamily,
    subtitleFontSize,
    subtitleFontWeight,
    subtitleTextTransform
  } = config || {};

  if (!title && !subtitle) return null;

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
          maxWidth: '1200px', 
          width: '100%',
          padding: '0 1.5rem',
          textAlign,
          boxSizing: 'border-box'
        }}
      >
        {title && (
          <h1 style={{ 
            color: titleColor, 
            marginBottom: subtitle ? '0.5rem' : '0', 
            fontSize: titleFontSize || 'clamp(2rem, 5vw, 3rem)', 
            fontWeight: titleFontWeight || '800',
            fontFamily: titleFontFamily || 'inherit',
            textTransform: titleTextTransform || 'none',
            letterSpacing: '-0.02em',
            lineHeight: '1.2'
          }}>
            {title}
          </h1>
        )}
        {subtitle && (
          <p style={{ 
            color: subtitleColor, 
            fontSize: subtitleFontSize || 'clamp(1rem, 2vw, 1.25rem)', 
            fontWeight: subtitleFontWeight || 'normal',
            fontFamily: subtitleFontFamily || 'inherit',
            textTransform: subtitleTextTransform || 'none',
            lineHeight: '1.5',
            maxWidth: '800px',
            margin: textAlign === 'center' ? '0 auto' : '0'
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default HeaderBlock;
