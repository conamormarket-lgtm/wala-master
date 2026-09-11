import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import useIsMobile from '../../../../hooks/useIsMobile';
import styles from './HeroCarousel.module.css';
import { T } from '../../../../i18n/useTranslatedText';

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
  // Breakpoint 768px: el mismo que ya usa este componente para elegir
  // mobileImageUrl/altura, así ambos criterios de "es móvil" coinciden.
  const { isMobile } = useIsMobile(768);

  const filteredSlides = slides.filter(s => s?.imageUrl?.trim());
  const autoPlay = config.autoPlay !== false;
  const pauseOnHover = config.pauseOnHover !== false;
  const showArrows = config.showArrows !== false;
  const showDots = config.showDots !== false;

  // En desktop el carrusel sigue siendo el de siempre: slides apilados que
  // cambian con un fundido (opacity), controlados por currentIndex.
  // En móvil, currentIndex también gobierna un carril con scroll nativo
  // (overflow-x + scroll-snap) para que además del fundido por botón/autoplay
  // se pueda deslizar con el dedo — sin que el desktop pierda su forma de
  // usarse: esa rama de renderizado ni se monta ahí.
  const mobileTrackRef = useRef(null);
  const currentIndexRef = useRef(currentIndex);
  const resumeTimerRef = useRef(null);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (currentIndex >= filteredSlides.length) setCurrentIndex(0);
  }, [currentIndex, filteredSlides.length]);

  // Único punto de cambio de slide: actualiza el estado y, en móvil, además
  // desplaza el carril. Así flechas, puntos y autoplay quedan sincronizados
  // con lo que el usuario ve, sea cual sea el gesto que lo disparó.
  const goTo = useCallback((index, opts = {}) => {
    const total = filteredSlides.length;
    if (total === 0) return;
    const next = ((index % total) + total) % total;
    setCurrentIndex(next);
    const el = mobileTrackRef.current;
    if (isMobile && el) {
      const width = el.clientWidth || 1;
      el.scrollTo({ left: next * width, behavior: opts.instant ? 'auto' : 'smooth' });
    }
  }, [filteredSlides.length, isMobile]);

  useEffect(() => {
    if (!autoPlay || isPaused || filteredSlides.length <= 1 || !autoPlaySpeed) return;

    const interval = setInterval(() => {
      goTo(currentIndexRef.current + 1);
    }, autoPlaySpeed);

    return () => clearInterval(interval);
  }, [autoPlay, isPaused, filteredSlides.length, autoPlaySpeed, goTo]);

  // Sincroniza currentIndex cuando el usuario desliza el carril a mano
  // (scroll nativo) — así los puntos y el autoplay siguen el gesto.
  useEffect(() => {
    if (!isMobile) return undefined;
    const el = mobileTrackRef.current;
    if (!el || filteredSlides.length === 0) return undefined;
    let frame = null;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const width = el.clientWidth || 1;
        const total = filteredSlides.length;
        const nearest = Math.min(Math.max(Math.round(el.scrollLeft / width), 0), total - 1);
        setCurrentIndex((prev) => (prev === nearest ? prev : nearest));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isMobile, filteredSlides.length]);

  // Si cambia el ancho de pantalla, el carril se reubica sin animar: en px
  // "pagina * ancho" ya no es el mismo punto si el ancho cambió.
  useEffect(() => {
    if (!isMobile) return undefined;
    const resnap = () => {
      const el = mobileTrackRef.current;
      if (!el) return;
      el.scrollLeft = currentIndexRef.current * (el.clientWidth || 1);
    };
    resnap();
    window.addEventListener('resize', resnap);
    return () => window.removeEventListener('resize', resnap);
  }, [isMobile, filteredSlides.length]);

  useEffect(() => () => window.clearTimeout(resumeTimerRef.current), []);

  const pausarPorToque = useCallback(() => {
    window.clearTimeout(resumeTimerRef.current);
    setIsPaused(true);
  }, []);
  const reanudarPorToque = useCallback(() => {
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setIsPaused(false), 1500);
  }, []);

  if (filteredSlides.length === 0) {
    return (
      <div className={styles.heroContainer}>
         <div className={styles.slideEmpty}>
           <span>Banner Principal</span>
           <small><T>No hay imágenes configuradas.</T></small>
         </div>
      </div>
    );
  }

  const handleNext = () => goTo(currentIndexRef.current + 1);
  const handlePrev = () => goTo(currentIndexRef.current - 1);

  // Contenido de un slide (imagen + overlay de texto/botón), reutilizado
  // tanto por el render de escritorio (fundido) como por el carril móvil
  // (scroll-snap) para que ambos muestren exactamente lo mismo.
  const renderSlideBody = (slide, index, isActive) => {
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
      <>
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
              {slide.title && <h1 style={{ color: slide.titleColor || '#ffffff' }}><T>{slide.title}</T></h1>}
              {slide.subtitle && <p style={{ color: slide.subtitleColor || '#ffffff' }}><T>{slide.subtitle}</T></p>}
              {slide.buttonText && (slide.buttonLink || slide.link) && (
                (slide.buttonLink || slide.link).startsWith('http') ? (
                  <a
                    href={slide.buttonLink || slide.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.slideButton}
                    style={{ backgroundColor: slide.buttonBgColor || '#ffffff', color: slide.buttonTextColor || '#111827' }}
                    tabIndex={isActive ? 0 : -1}
                  ><T>{slide.buttonText}</T></a>
                ) : (
                  <Link
                    to={slide.buttonLink || slide.link}
                    className={styles.slideButton}
                    style={{ backgroundColor: slide.buttonBgColor || '#ffffff', color: slide.buttonTextColor || '#111827' }}
                    tabIndex={isActive ? 0 : -1}
                  ><T>{slide.buttonText}</T></Link>
                )
              )}
            </div>
          </div>
        )}
      </>
    );
  };

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
      {isMobile ? (
        <div
          className={styles.mobileTrack}
          ref={mobileTrackRef}
          onTouchStart={pausarPorToque}
          onTouchEnd={reanudarPorToque}
          onTouchCancel={reanudarPorToque}
        >
          {filteredSlides.map((slide, index) => {
            const isActive = index === currentIndex;
            return (
              <div key={index} className={styles.mobileSlide} aria-hidden={!isActive}>
                {renderSlideBody(slide, index, isActive)}
              </div>
            );
          })}
        </div>
      ) : (
        filteredSlides.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <div key={index} className={`${styles.slide} ${isActive ? styles.slideActive : ''}`} aria-hidden={!isActive}>
              {renderSlideBody(slide, index, isActive)}
            </div>
          );
        })
      )}

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
                  onClick={() => goTo(idx)}
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
