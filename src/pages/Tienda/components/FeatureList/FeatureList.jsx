import React from 'react';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './FeatureList.module.css';
import { T } from '../../../../i18n/useTranslatedText';

const FeatureList = ({ config = {} }) => {
  const items = Array.isArray(config.items) ? config.items : [];
  if (items.length === 0 && !config.title) return null;

  return (
    <div
      className={styles.root}
      style={{ backgroundColor: config.backgroundColor || 'transparent' }}
    >
      {(config.title || config.subtitle) && (
        <div className={styles.header}>
          {config.title && <h2 className={styles.title}><T>{config.title}</T></h2>}
          {config.subtitle && <p className={styles.subtitle}><T>{config.subtitle}</T></p>}
        </div>
      )}

      {config.imageUrl && (
        <OptimizedImage
          src={toDirectImageUrl(config.imageUrl)}
          alt={config.imageAlt || ''}
          className={styles.image}
          loading="lazy"
          showSkeleton={false}
        />
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item, idx) => (
            <li key={idx} className={styles.item}>
              {item.icon && <span className={styles.icon}>{item.icon}</span>}
              <span><T>{item.text}</T></span>
            </li>
          ))}
        </ul>
      )}

      {config.quote && (
        <blockquote className={styles.quote}>
          <T>{config.quote}</T>
          {config.quoteAuthor && (
            <span className={styles.quoteAuthor}>— {config.quoteAuthor}</span>
          )}
        </blockquote>
      )}
    </div>
  );
};

export default FeatureList;
