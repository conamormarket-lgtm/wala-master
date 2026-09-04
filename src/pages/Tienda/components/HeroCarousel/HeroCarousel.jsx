import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './HeroCarousel.module.css';

const hexToRgba = (color, opacity) => {
  if (!color || color === 'transparent') return 'transparent';
  const normalized = color.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    const value = Number.parseInt(normalized, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
  }
  return color;
};

const HeroCarousel = ({ slides = [], autoPlaySpeed = 5000, config = {} }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const filteredSlides = slides.filter(s => s?.imageUrl?.trim());
  const autoPlay = config.autoPlay !== false;
  const pauseOnHover = config.pauseOnHover !== false;
  const showArrows = config.showArrows !== false;
  const showDots = config.showDots !== false;

  useEffect(() => {
    if (currentIndex >= filteredSlides.length) setCurrentIndex(0);
  }, [currentIndex, filteredSlides.length]);

  useEffect(() => {
    if (!autoPlay || isPaused || filteredSlides.length <= 1 || !autoPlaySpeed) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredSlides.length);
    }, autoPlaySpeed);

    return () => clearInterval(interval);
  }, [autoPlay, isPaused, filteredSlides.length, autoPlaySpeed]);

  if (filteredSlides.length === 0) {
    return (
      <div className={styles.heroContainer}>
         <div className={styles.slideEmpty}>
           <span>Banner Principal</span>
           <small>No hay imágenes configuradas.</small>
         </div>
      </div>
    );
  }

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % filteredSlides.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev === 0 ? filteredSlides.length - 1 : prev - 1));

  return (
    <div
      className={styles.heroContainer}
      role="region"
      aria-label="Carrusel principal"
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        '--hero-height-desktop': config.heightDesktop || '450px',
        '--hero-height-mobile': config.heightMobile || '350px',
        '--hero-radius': config.borderRadius ?? '16px',
      }}
    >
      {filteredSlides.map((slide, index) => {
        const isActive = index === currentIndex;
        const hasContent = Boolean(slide.title || slide.subtitle || slide.buttonText);
        const imagePosition = slide.imagePosition || 'center center';
        
        const imageEl = (
          <picture className={styles.slideMedia}>
            {slide.mobileImageUrl?.trim() && (
              <source media="(max-width: 768px)" srcSet={toDirectImageUrl(slide.mobileImageUrl)} />
            )}
            <img
              src={toDirectImageUrl(slide.imageUrl)}
              alt={slide.alt || `Banner ${index + 1}`}
              className={styles.slideImage}
              style={{ objectPosition: imagePosition }}
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
            />
          </picture>
        );

        return (
          <div key={index} className={`${styles.slide} ${isActive ? styles.slideActive : ''}`} aria-hidden={!isActive}>
             {slide.link ? (
                slide.link.startsWith('http') ? (
                  <a href={slide.link} target="_blank" rel="noopener noreferrer" className={styles.slideLink} tabIndex={isActive ? 0 : -1}>
                    {imageEl}
                  </a>
                ) : (
                  <Link to={slide.link} className={styles.slideLink} tabIndex={isActive ? 0 : -1}>
                    {imageEl}
                  </Link>
                )
             ) : (
               imageEl
             )}

             {hasContent && (
               <div
                 className={styles.slideOverlay}
                 style={{
                   justifyContent: slide.contentPosition === 'right' ? 'flex-end' : slide.contentPosition === 'center' ? 'center' : 'flex-start',
                   alignItems: slide.verticalPosition === 'top' ? 'flex-start' : slide.verticalPosition === 'bottom' ? 'flex-end' : 'center',
                   textAlign: slide.contentPosition || 'left',
                   background: hexToRgba(slide.overlayColor || '#111827', (slide.overlayOpacity ?? 20) / 100),
                 }}
               >
                 <div className={styles.slideContent}>
                   {slide.title && <h1 style={{ color: slide.titleColor || '#ffffff' }}>{slide.title}</h1>}
                   {slide.subtitle && <p style={{ color: slide.subtitleColor || '#ffffff' }}>{slide.subtitle}</p>}
                   {slide.buttonText && (slide.buttonLink || slide.link) && (
                     (slide.buttonLink || slide.link).startsWith('http') ? (
                       <a
                         href={slide.buttonLink || slide.link}
                         target="_blank"
                         rel="noopener noreferrer"
                         className={styles.slideButton}
                         style={{ backgroundColor: slide.buttonBgColor || '#ffffff', color: slide.buttonTextColor || '#111827' }}
                         tabIndex={isActive ? 0 : -1}
                       >{slide.buttonText}</a>
                     ) : (
                       <Link
                         to={slide.buttonLink || slide.link}
                         className={styles.slideButton}
                         style={{ backgroundColor: slide.buttonBgColor || '#ffffff', color: slide.buttonTextColor || '#111827' }}
                         tabIndex={isActive ? 0 : -1}
                       >{slide.buttonText}</Link>
                     )
                   )}
                 </div>
               </div>
             )}
          </div>
        );
      })}

      {filteredSlides.length > 1 && (
        <>
          {showArrows && (
            <>
              <button className={`${styles.navButton} ${styles.prevButton}`} onClick={handlePrev} aria-label="Banner anterior">&lsaquo;</button>
              <button className={`${styles.navButton} ${styles.nextButton}`} onClick={handleNext} aria-label="Banner siguiente">&rsaquo;</button>
            </>
          )}
          
          {showDots && (
            <div className={styles.dots}>
              {filteredSlides.map((_, idx) => (
                <button
                  key={idx}
                  className={`${styles.dot} ${idx === currentIndex ? styles.dotActive : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Ir a banner ${idx + 1}`}
                  aria-current={idx === currentIndex ? 'true' : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HeroCarousel;
