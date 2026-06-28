import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TextoSeccion } from './textStyleUtils.jsx';
import { AuroraBackground, GlassButton, Reveal } from '../../../components/ui';
import { trackBannerClick } from '../../../services/analytics/tracker';
import { useAuth } from '../../../contexts/AuthContext';
import styles from './HeroBanner.module.css';

const HeroBanner = ({ config }) => {
  const { user } = useAuth();
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
    minHeight = '600px',
    titleFontFamily,
    titleFontSize,
    titleFontWeight,
    titleTextTransform,
    subtitleFontFamily,
    subtitleFontSize,
    subtitleFontWeight,
    subtitleTextTransform
  } = config || {};
  
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

  const handleBannerClick = () => {
    trackBannerClick(config.id || title || 'hero_banner', user).catch(console.error);
  };

  // Convertir alineación a flexbox
  const alignItemsMap = {
    'left': 'flex-start',
    'center': 'center',
    'right': 'flex-end'
  };

  return (
    <div className={styles.heroContainer} style={{ minHeight }}>
      {/* Capa de atmósfera de marca: vive DETRÁS del media y del overlay, así que
          es puramente decorativa y no altera el contraste del texto (el overlay
          oscuro queda siempre por encima). variant 'subtle' = aurora muy tenue. */}
      <AuroraBackground variant="subtle" className={styles.aurora} intensity={0.5} />

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
        <Reveal className={styles.content}>
          {/* Titulo: TextoSeccion aplica align/underline/bg/link del campo `title`.
              Se conserva la clase CSS del modulo y todos los estilos inline base. */}
          <TextoSeccion
            settings={config}
            prefix="title"
            as="h1"
            className={styles.title}
            style={{
              color: titleColor,
              fontFamily: titleFontFamily || 'inherit',
              fontSize: titleFontSize || undefined,
              fontWeight: titleFontWeight || undefined,
              textTransform: titleTextTransform || 'none'
            }}
          >
            {title}
          </TextoSeccion>
          {/* Subtitulo: TextoSeccion aplica el estilo editable del campo `subtitle`. */}
          <TextoSeccion
            settings={config}
            prefix="subtitle"
            as="p"
            className={styles.subtitle}
            style={{
              color: subtitleColor,
              fontFamily: subtitleFontFamily || 'inherit',
              fontSize: subtitleFontSize || undefined,
              fontWeight: subtitleFontWeight || undefined,
              textTransform: subtitleTextTransform || 'none'
            }}
          >
            {subtitle}
          </TextoSeccion>
          {buttonText && buttonLink && (
            <Link to={buttonLink} onClick={handleBannerClick}>
              <GlassButton
                variant="glass"
                className={styles.actionButton}
                style={{
                  backgroundColor: buttonBgColor,
                  color: buttonTextColor,
                  borderColor: buttonBgColor
                }}
              >
                {buttonText}
              </GlassButton>
            </Link>
          )}
        </Reveal>
      </div>
    </div>
  );
};

export default HeroBanner;
