import React from 'react';

const TextBlock = ({ config }) => {
  const {
    heading = '',
    content = '',
    backgroundColor = 'transparent',
    textColor = '#333333',
    headingColor = '#000000',
    textAlign = 'left',
    paddingTop = '2rem',
    paddingBottom = '2rem',
    maxWidth = '800px'
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
        {heading && (
          <h2 style={{ color: headingColor, marginBottom: content ? '1rem' : '0', fontSize: '2rem', fontWeight: 'bold' }}>
            {heading}
          </h2>
        )}
        {content && (
          <div 
            style={{ color: textColor, fontSize: '1.1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}
          >
            {content}
          </div>
        )}
      </div>
    </div>
  );
};

export default TextBlock;
