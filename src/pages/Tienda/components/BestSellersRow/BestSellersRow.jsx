import React from 'react';
import { Link } from 'react-router-dom';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import { GlassCard } from '../../../../components/ui';
import styles from './BestSellersRow.module.css';

/**
 * Fila / carrusel horizontal de productos.
 * En móvil: swipe nativo (sin Framer Stagger, que puede interferir con el dedo).
 */
const BestSellersRow = ({ cards = [] }) => {
  if (!cards || cards.length === 0) return null;

  const renderBody = (card) => (
    <>
      <div className={styles.imageWrapper}>
        {card.imageUrl ? (
          <OptimizedImage
            src={card.imageUrl}
            alt={card.title || 'Destacado'}
            className={styles.image}
            showSkeleton={true}
            draggable={false}
          />
        ) : (
          <div className={styles.placeholder} />
        )}
      </div>
      <div className={styles.content}>
        {card.title && <h3 className={styles.title}>{card.title}</h3>}
        {card.subtitle && <p className={styles.subtitle}>{card.subtitle}</p>}
      </div>
    </>
  );

  const renderCardLink = (card, body) => {
    const url = card.link || '';
    // Anchors (#pagar-ahora) deben ser <a href>, no React Router Link
    if (url.startsWith('#')) {
      return (
        <a href={url} className={styles.link}>
          {body}
        </a>
      );
    }
    if (url.startsWith('/') && !url.startsWith('//')) {
      return (
        <Link to={url} className={styles.link}>
          {body}
        </Link>
      );
    }
    if (url) {
      return (
        <a href={url} className={styles.link} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      );
    }
    return <div className={styles.link}>{body}</div>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {cards.map((card, index) => (
          <div key={card.id || index} className={styles.card}>
            <GlassCard
              variant="soft"
              padding="sm"
              hover
              animate={false}
              className={styles.glassCard}
              bodyClassName={styles.glassBody}
            >
              {renderCardLink(card, renderBody(card))}
            </GlassCard>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BestSellersRow;
