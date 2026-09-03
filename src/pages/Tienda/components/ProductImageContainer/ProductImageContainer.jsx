import React from 'react';
import { Info, ImageOff } from 'lucide-react';
import styles from './ProductImageContainer.module.css';
import { toDirectImageUrl } from '../../../../utils/imageUrl';

const ProductImageContainer = ({
  imageUrl,
  alt = 'Imagen',
  children,
  isGallery = false,
  style = {},
  emptyMessage = 'Sin imagen',
  cropData = null
}) => {
  const containerClass = isGallery ? styles.galleryContainer : styles.container;
  const isValidUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0 && imageUrl !== 'undefined' && imageUrl !== 'null';
  const displayUrl = isValidUrl ? toDirectImageUrl(imageUrl) : '';

  // Encuadre (crop no destructivo). Mismo cálculo que OptimizedImage: el contenedor
  // es 3/4 y el recorte también, así la portada se muestra sin deformarse.
  const hasValidCrop = cropData && cropData.width > 0 && cropData.height > 0;
  const cropStyle = hasValidCrop ? {
    top: `${-(cropData.y / cropData.height) * 100}%`,
    left: `${-(cropData.x / cropData.width) * 100}%`,
    width: `${(100 / cropData.width) * 100}%`,
    height: `${(100 / cropData.height) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
    objectFit: 'fill',
  } : {};

  return (
    <div className={containerClass} style={style}>
      {/* Indicador de Resolución Ideal */}
      <div className={styles.resolutionBadge}>
        <Info size={14} />
        <span>3:4</span>
        <div className={styles.tooltip}>
          <strong>Resolución Recomendada:</strong><br/>
          Proporción 3:4 (Vertical).<br/>
          Ej: 900x1200px o superior.<br/>
          <span style={{opacity: 0.8, fontSize: '0.7rem'}}>*PNG/SVG sin fondo no tendrán bordes blancos.</span>
        </div>
      </div>

      {/* Imagen Principal (si hay imageUrl) */}
      {displayUrl ? (
        <img src={displayUrl} alt={alt} className={styles.image} style={cropStyle} />
      ) : !children ? (
        /* Estado Vacío (si no hay ni imageUrl ni children) */
        <div className={styles.emptyState}>
          <ImageOff size={48} opacity={0.2} />
          <span>{emptyMessage}</span>
        </div>
      ) : null}

      {/* Children (Ej. Canvas para Mockups o superposiciones) */}
      {children && (
        <div className={styles.contentWrapper}>
          {children}
        </div>
      )}
    </div>
  );
};

export default ProductImageContainer;
