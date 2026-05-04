import React from 'react';
import { Link } from 'react-router-dom';
import styles from './BrandMarquee.module.css';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';

const BrandMarquee = ({ items = [], speed = 20000 }) => {
  if (!items || items.length === 0) return null;

  // Si hay pocos items, duplicamos el array para asegurar que el efecto infinito de css no se rompa
  const displayItems = items.length < 8 ? [...items, ...items, ...items, ...items] : [...items, ...items];

  // Convertimos milisegundos a segundos para el CSS animation
  const animationDuration = `${speed / 1000}s`;

  return (
    <div className={styles.marqueeContainer}>
      <div 
        className={styles.marqueeTrack}
        style={{ animationDuration }}
      >
        {displayItems.map((item, index) => (
          <div key={index} className={styles.brandItem}>
            {item.link ? (
              <Link to={item.link} className={styles.brandLink}>
                <div className={styles.imageWrapper}>
                  {item.imageUrl ? (
                    <OptimizedImage 
                      src={item.imageUrl} 
                      alt={item.name || 'Marca'} 
                      className={styles.brandImage}
                    />
                  ) : (
                    <div className={styles.placeholderCircle}></div>
                  )}
                </div>
                {item.name && <span className={styles.brandName}>{item.name}</span>}
              </Link>
            ) : (
              <div className={styles.brandLink}>
                <div className={styles.imageWrapper}>
                  {item.imageUrl ? (
                    <OptimizedImage 
                      src={item.imageUrl} 
                      alt={item.name || 'Marca'} 
                      className={styles.brandImage}
                    />
                  ) : (
                    <div className={styles.placeholderCircle}></div>
                  )}
                </div>
                {item.name && <span className={styles.brandName}>{item.name}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrandMarquee;
