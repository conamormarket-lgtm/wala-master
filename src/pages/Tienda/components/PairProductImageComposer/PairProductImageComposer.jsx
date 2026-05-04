import React from 'react';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './PairProductImageComposer.module.css';

/**
 * Componente que compone dos imágenes lado a lado pegadas (sin espacio visible)
 * para productos pareja (2 en 1)
 */
const PairProductImageComposer = ({ image1Url, image2Url, gap = 0, alt = 'Producto pareja', className = '' }) => {
  const image1 = toDirectImageUrl(image1Url || '');
  const image2 = toDirectImageUrl(image2Url || '');

  if (!image1 && !image2) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.placeholder}>No hay imágenes disponibles</div>
      </div>
    );
  }

  if (!image1) {
    return (
      <div className={`${styles.container} ${className}`}>
        <img src={image2} alt={alt} className={styles.singleImage} referrerPolicy="no-referrer" />
      </div>
    );
  }

  if (!image2) {
    return (
      <div className={`${styles.container} ${className}`}>
        <img src={image1} alt={alt} className={styles.singleImage} referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} style={{ gap: `${gap}px` }}>
      <img src={image1} alt={`${alt} - Prenda 1`} className={styles.image} referrerPolicy="no-referrer" />
      <img src={image2} alt={`${alt} - Prenda 2`} className={styles.image} referrerPolicy="no-referrer" />
    </div>
  );
};

export default PairProductImageComposer;
