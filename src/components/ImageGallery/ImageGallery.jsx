import React from 'react';
import SafeImage from '../common/SafeImage/SafeImage';
import styles from './ImageGallery.module.css';
import { T } from '../../i18n/useTranslatedText';

const ImageGallery = ({ images, onImageClick }) => {
  const validUrls = (images || [])
    .map((u) => (u != null && typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u.length > 0);

  if (validUrls.length === 0) {
    return <p><T>No hay diseños adjuntos.</T></p>;
  }

  return (
    <div className={styles.grid}>
      {validUrls.map((url, index) => (
        <SafeImage
          key={`${index}-${url.slice(0, 50)}`}
          src={url}
          alt={`Diseño del pedido ${index + 1}`}
          onClick={() => onImageClick(index)}
          className={styles.image}
        />
      ))}
    </div>
  );
};

export default ImageGallery;
