import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/common/Button';
import styles from './HeroBanner.module.css';

const HeroBanner = ({ config }) => {
  const { 
    mediaType = 'image', 
    mediaUrl, 
    thumbnailUrl, 
    title, 
    subtitle, 
    buttonText, 
    buttonLink,
    textAlign = 'center',
    textPosition = 'center'
  } = config;
  
  const videoRef = useRef(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
    }
  }, [mediaType, mediaUrl]);

  const handleVideoCanPlay = () => {
    setIsVideoLoaded(true);
  };

  // Convertir alineación a flexbox
  const alignItemsMap = {
    'left': 'flex-start',
    'center': 'center',
    'right': 'flex-end'
  };

  return (
    <div className={styles.heroContainer}>
      <div className={styles.mediaWrapper}>
        {mediaType === 'video' ? (
          <>
            {/* Mostrar miniatura mientras carga el video */}
            {!isVideoLoaded && thumbnailUrl && (
              <img src={thumbnailUrl} alt="Hero thumbnail" className={styles.mediaThumbnail} />
            )}
            <video
              ref={videoRef}
              src={mediaUrl}
              className={`${styles.mediaElement} ${isVideoLoaded ? styles.loaded : styles.loading}`}
              autoPlay
              muted
              loop
              playsInline
              onCanPlay={handleVideoCanPlay}
            />
          </>
        ) : (
          <img src={mediaUrl} alt={title || 'Hero Banner'} className={styles.mediaElement} />
        )}
      </div>
      
      <div 
        className={styles.overlay} 
        style={{ 
          justifyContent: textPosition, 
          alignItems: alignItemsMap[textAlign] || 'center',
          textAlign: textAlign 
        }}
      >
        <div className={styles.content}>
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {buttonText && buttonLink && (
            <Link to={buttonLink}>
              <Button variant="primary" className={styles.actionButton}>
                {buttonText}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
