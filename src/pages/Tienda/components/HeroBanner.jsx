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
    textPosition = 'center',
    overlayOpacity = 40,
    titleColor = '#ffffff',
    subtitleColor = '#ffffff',
    buttonBgColor = '#ffffff',
    buttonTextColor = '#000000',
    minHeight = '600px'
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
    <div className={styles.heroContainer} style={{ minHeight }}>
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
          textAlign: textAlign,
          background: `linear-gradient(to bottom, rgba(0,0,0,${overlayOpacity/100 * 0.2}) 0%, rgba(0,0,0,${overlayOpacity/100 * 0.7}) 50%, rgba(0,0,0,${overlayOpacity/100}) 100%)`
        }}
      >
        <div className={styles.content}>
          {title && <h1 className={styles.title} style={{ color: titleColor }}>{title}</h1>}
          {subtitle && <p className={styles.subtitle} style={{ color: subtitleColor }}>{subtitle}</p>}
          {buttonText && buttonLink && (
            <Link to={buttonLink}>
              <Button 
                variant="primary" 
                className={styles.actionButton}
                style={{ 
                  backgroundColor: buttonBgColor, 
                  color: buttonTextColor,
                  borderColor: buttonBgColor 
                }}
              >
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
