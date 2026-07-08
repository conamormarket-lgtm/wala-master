import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import { empresa } from '../../../../config/empresa';
import styles from './ConversionFold.module.css';

const Countdown = ({ endTime }) => {
  const [parts, setParts] = useState(null);

  useEffect(() => {
    if (!endTime) return undefined;
    const tick = () => {
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) {
        setParts({ h: '00', m: '00', s: '00', done: true });
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setParts({
        h: String(h).padStart(2, '0'),
        m: String(m).padStart(2, '0'),
        s: String(s).padStart(2, '0'),
        done: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  if (!parts) return null;
  if (parts.done) return <span className={styles.timer}>00:00:00</span>;

  return (
    <span className={styles.timer}>
      {parts.h}
      <span className={styles.timerSep}>:</span>
      {parts.m}
      <span className={styles.timerSep}>:</span>
      {parts.s}
    </span>
  );
};

const renderLink = (url, className, children) => {
  if (!url) return null;
  const isHash = url.startsWith('#');
  const isInternal = url.startsWith('/') && !url.startsWith('//');
  if (isHash) {
    return (
      <a href={url} className={className}>
        {children}
      </a>
    );
  }
  if (isInternal) {
    return (
      <Link to={url} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={url} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

/**
 * Primera impresión estilo Balvi: imagen + título + urgencia + precio + CTAs
 * en una sola pantalla móvil.
 */
const ConversionFold = ({ config = {} }) => {
  const montoPEN = Number(config.montoPEN) || 0;
  const precioOriginal = Number(config.precioOriginal) || 0;
  const pctOff = precioOriginal > montoPEN
    ? Math.round(((precioOriginal - montoPEN) / precioOriginal) * 100)
    : 0;
  const discountLabel = config.discountLabel || (pctOff > 0 ? `${pctOff}% OFF` : '');
  const accent = config.accentColor || '#dc2626';
  const rating = Number(config.rating) || 5;
  const reviewCount = config.reviewCount || '';
  const waNum = (config.whatsappNumber || empresa.whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(config.whatsappMessage || 'Hola, me interesa el producto de la landing');
  const stars = '★'.repeat(Math.min(5, Math.max(0, Math.round(rating)))) + '☆'.repeat(Math.max(0, 5 - Math.round(rating)));

  const rootStyle = {
    '--fold-accent': accent,
    backgroundColor: config.backgroundColor || '#ffffff',
  };

  return (
    <div className={styles.root} style={rootStyle}>
      <div className={styles.inner}>
        {config.imageUrl && (
          <div className={styles.imagePad}>
            <div className={styles.imageWrap}>
              <OptimizedImage
                src={toDirectImageUrl(config.imageUrl)}
                alt={config.imageAlt || config.title || 'Producto'}
                className={styles.image}
                loading="eager"
                fetchPriority="high"
                showSkeleton={false}
              />
              {config.imageCaption && (
                <div className={styles.imageOverlay}>{config.imageCaption}</div>
              )}
            </div>
          </div>
        )}

        <div className={styles.body}>
          {config.title && (
            <h1 className={styles.title}>{config.title}</h1>
          )}
          {config.subtitle && (
            <p className={styles.subtitle}>{config.subtitle}</p>
          )}

          {config.socialProofBadge && (
            <span className={styles.socialBadge}>{config.socialProofBadge}</span>
          )}

          {config.endTime && (
            <div className={styles.countdownRow}>
              <span className={styles.countdownLabel}>
                {config.countdownLabel || '⏳ Oferta termina en'}
              </span>
              <Countdown endTime={config.endTime} />
            </div>
          )}

          {montoPEN > 0 && (
            <div className={styles.priceRow}>
              <span className={styles.priceMain}>S/{montoPEN.toFixed(2)}</span>
              {precioOriginal > montoPEN && (
                <span className={styles.priceCompare}>S/{precioOriginal.toFixed(2)}</span>
              )}
              {discountLabel && (
                <span className={styles.discountBadge}>{discountLabel}</span>
              )}
            </div>
          )}

          {(reviewCount || rating) && (
            <div className={styles.ratingRow}>
              <span className={styles.stars}>{stars}</span>
              {reviewCount && <span>{reviewCount} reseñas</span>}
            </div>
          )}

          {config.ctaPrimaryText && renderLink(
            config.ctaPrimaryLink || '#pagar-ahora',
            styles.ctaPrimary,
            <>
              <span className={styles.ctaPrimaryText}>{config.ctaPrimaryText}</span>
              {config.ctaPrimarySub && (
                <span className={styles.ctaPrimarySub}>{config.ctaPrimarySub}</span>
              )}
            </>,
          )}

          {config.ctaSecondaryText && renderLink(
            config.ctaSecondaryLink || '#pagar-ahora',
            styles.ctaSecondary,
            config.ctaSecondaryText,
          )}

          {config.trustText && (
            <p className={styles.trustLine}>
              <span>🎁</span>
              {config.trustText}
            </p>
          )}
        </div>
      </div>

      {config.showWhatsApp !== false && waNum && (
        <a
          href={`https://wa.me/${waNum}?text=${waMsg}`}
          className={styles.waFloat}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
        >
          💬
        </a>
      )}
    </div>
  );
};

export default ConversionFold;
