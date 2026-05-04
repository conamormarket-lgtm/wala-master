import React, { useEffect } from 'react';
import SafeImage from '../common/SafeImage/SafeImage';
import styles from './ImageCarousel.module.css';

const ImageCarousel = ({ images, currentIndex, onClose, onNext, onPrevious }) => {

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowRight') {
        onNext();
      } else if (event.key === 'ArrowLeft') {
        onPrevious();
      } else if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrevious, onClose]);

  const handleOverlayClick = (event) => {
    if (event.target.id === 'carousel-overlay') {
      onClose();
    }
  };

  if (!images || images.length === 0 || currentIndex === null || currentIndex < 0 || currentIndex >= images.length) {
    return null;
  }

  const rawUrl = images[currentIndex];
  // No necesitamos convertirlo porque SafeImage ya normaliza las urls directas
  // Pero mantenemos toDirectImageUrl si el componente anterior confiaba en ello
  const displayUrl = rawUrl && typeof rawUrl === 'string' ? rawUrl.trim() : '';

  return (
    <div
      id="carousel-overlay"
      className={`${styles.overlay} ${styles.visible}`}
      onClick={handleOverlayClick}
    >
      <button className={`${styles.btn} ${styles.cerrar}`} onClick={onClose}>
        &#10005;
      </button>
      <div className={styles.contenido}>
        <button className={`${styles.btn} ${styles.prev}`} onClick={onPrevious}>
          &#10094;
        </button>
        <SafeImage
          className={styles.imagen}
          src={displayUrl}
          alt="Vista ampliada del diseño"
          isCarousel={true}
        />
        <button className={`${styles.btn} ${styles.next}`} onClick={onNext}>
          &#10095;
        </button>
      </div>
    </div>
  );
};

export default ImageCarousel;
