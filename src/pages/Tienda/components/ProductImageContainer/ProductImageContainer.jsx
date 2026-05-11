import React from 'react';
import { Info, ImageOff } from 'lucide-react';
import styles from './ProductImageContainer.module.css';

const ProductImageContainer = ({ 
  imageUrl, 
  alt = 'Imagen', 
  children, 
  isGallery = false, 
  style = {},
  emptyMessage = 'Sin imagen'
}) => {
  const containerClass = isGallery ? styles.galleryContainer : styles.container;

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
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className={styles.image} />
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
