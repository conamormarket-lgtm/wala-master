import React from 'react';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import { toDirectImageUrl } from '../../../../utils/imageUrl';

const ImageBlock = ({ config, isFirstSection }) => {
  const {
    url = '',
    alt = '',
    link = '',
    maxWidth = '100%',
    alignment = 'center',
    borderRadius = '0px',
    paddingTop = '0rem',
    paddingBottom = '0rem',
    backgroundColor = 'transparent'
  } = config || {};

  if (!url?.trim()) return null;

  const justifyContent = alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center';

  const imgElement = (
    <OptimizedImage
      src={toDirectImageUrl(url)}
      alt={alt}
      style={{ 
        maxWidth, 
        width: '100%', 
        height: 'auto', 
        borderRadius,
        display: 'block'
      }}
      loading={isFirstSection ? "eager" : "lazy"}
      fetchPriority={isFirstSection ? "high" : "auto"}
      showSkeleton={false}
    />
  );

  return (
    <div 
      style={{ 
        backgroundColor, 
        paddingTop, 
        paddingBottom,
        width: '100%',
        display: 'flex',
        justifyContent,
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ maxWidth, width: '100%', display: 'flex', justifyContent }}>
        {link?.trim() ? (
          <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', maxWidth: '100%' }}>
            {imgElement}
          </a>
        ) : (
          imgElement
        )}
      </div>
    </div>
  );
};

export default ImageBlock;
