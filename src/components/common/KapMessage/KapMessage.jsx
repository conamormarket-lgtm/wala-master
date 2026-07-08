import React, { useState } from 'react';
import { useMascotaImageUrl } from '../../../hooks/useMascotaImageUrl';
import styles from './KapMessage.module.css';

/**
 * Mascota con burbuja de mensaje. Muestra la imagen configurada en Admin > Mascota.
 * Si la primera URL falla (p. ej. CORS con Drive), prueba la URL alternativa.
 */
const KapMessage = ({ message, className = '', bubbleOnly = false }) => {
  const { src, fallbackSrc } = useMascotaImageUrl();
  const [currentSrc, setCurrentSrc] = useState(src);
  const [triedFallback, setTriedFallback] = useState(false);

  // Sincronizar currentSrc cuando cambie la URL del hook
  React.useEffect(() => {
    setCurrentSrc(src);
    setTriedFallback(false);
  }, [src]);

  const showImage = !bubbleOnly && currentSrc;
  const handleError = () => {
    if (fallbackSrc && !triedFallback) {
      setCurrentSrc(fallbackSrc);
      setTriedFallback(true);
    } else {
      setCurrentSrc('');
    }
  };

  return (
    <div
      className={`${styles.wrapper} ${bubbleOnly ? styles.bubbleOnly : ''} ${className}`.trim()}
      role="complementary"
      aria-label="Mensaje de mascota"
      translate="no"
    >
      <div className={styles.imageWrap}>
        {showImage ? (
          <img
            src={currentSrc}
            alt="Mascota"
            className={styles.kapImage}
            onError={handleError}
            decoding="async"
          />
        ) : null}
      </div>
      <div className={styles.bubble}>
        <p className={styles.bubbleText}>{message}</p>
      </div>
    </div>
  );
};

export default KapMessage;
