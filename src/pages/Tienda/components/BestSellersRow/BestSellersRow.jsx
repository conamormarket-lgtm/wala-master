import React from 'react';
import { Link } from 'react-router-dom';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import styles from './BestSellersRow.module.css';

const BestSellersRow = ({ cards = [] }) => {
  if (!cards || cards.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {cards.map((card, index) => (
          <div key={card.id || index} className={styles.card}>
            {card.link ? (
              <Link to={card.link} className={styles.link}>
                <div className={styles.imageWrapper}>
                  {card.imageUrl ? (
                    <OptimizedImage
                      src={card.imageUrl}
                      alt={card.title || 'Destacado'}
                      className={styles.image}
                      showSkeleton={true}
                    />
                  ) : (
                    <div className={styles.placeholder}></div>
                  )}
                </div>
                <div className={styles.content}>
                  {card.title && <h3 className={styles.title}>{card.title}</h3>}
                  {card.subtitle && <p className={styles.subtitle}>{card.subtitle}</p>}
                </div>
              </Link>
            ) : (
              <div className={styles.link}>
                <div className={styles.imageWrapper}>
                  {card.imageUrl ? (
                    <OptimizedImage
                      src={card.imageUrl}
                      alt={card.title || 'Destacado'}
                      className={styles.image}
                      showSkeleton={true}
                    />
                  ) : (
                    <div className={styles.placeholder}></div>
                  )}
                </div>
                <div className={styles.content}>
                  {card.title && <h3 className={styles.title}>{card.title}</h3>}
                  {card.subtitle && <p className={styles.subtitle}>{card.subtitle}</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BestSellersRow;
