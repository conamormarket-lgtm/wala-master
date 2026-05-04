import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import styles from './HeroCarousel.module.css';

const HeroCarousel = ({ slides = [], autoPlaySpeed = 5000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const filteredSlides = slides.filter(s => s?.imageUrl?.trim());

  useEffect(() => {
    if (filteredSlides.length <= 1 || !autoPlaySpeed) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredSlides.length);
    }, autoPlaySpeed);

    return () => clearInterval(interval);
  }, [filteredSlides.length, autoPlaySpeed]);

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
    <div className={styles.heroContainer}>
      {filteredSlides.map((slide, index) => {
        const isActive = index === currentIndex;
        
        const imageEl = (
           <OptimizedImage
            src={toDirectImageUrl(slide.imageUrl)}
            alt={slide.alt || `Slide ${index + 1}`}
            className={styles.slideImage}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            showSkeleton={false}
          />
        );

        return (
          <div key={index} className={`${styles.slide} ${isActive ? styles.slideActive : ''}`}>
             {slide.link ? (
                slide.link.startsWith('http') ? (
                  <a href={slide.link} target="_blank" rel="noopener noreferrer" className={styles.slideLink}>
                    {imageEl}
                  </a>
                ) : (
                  <Link to={slide.link} className={styles.slideLink}>
                    {imageEl}
                  </Link>
                )
             ) : (
               imageEl
             )}
          </div>
        );
      })}

      {filteredSlides.length > 1 && (
        <>
          <button className={`${styles.navButton} ${styles.prevButton}`} onClick={handlePrev} aria-label="Anterior">&lsaquo;</button>
          <button className={`${styles.navButton} ${styles.nextButton}`} onClick={handleNext} aria-label="Siguiente">&rsaquo;</button>
          
          <div className={styles.dots}>
            {filteredSlides.map((_, idx) => (
              <button
                key={idx}
                className={`${styles.dot} ${idx === currentIndex ? styles.dotActive : ''}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Ir a banner ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default HeroCarousel;
