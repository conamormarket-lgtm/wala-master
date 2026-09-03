import React from 'react';
import { Link } from 'react-router-dom';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './BannerGrid.module.css';

/**
 * Mosaico de Banners: 2–4 imágenes promocionales en fila, cada una clickeable
 * (imagen + enlace). Estilo ecommerce (Chronos "NOVEDADES" / "Para Mujeres /
 * Para Hombres"). Se auto-oculta si no hay banners con imagen.
 *
 * @param {Array}  items    [{ imageUrl, link, alt }]
 * @param {number} columns  columnas en escritorio (default 3)
 * @param {string} gap      separación (ej. '1rem')
 */
const BannerGrid = ({ items = [], columns = 3, gap = '1rem' }) => {
  const valid = (items || []).filter((it) => it && it.imageUrl);
  if (valid.length === 0) return null;

  const cols = Math.min(4, Math.max(1, Number(columns) || 3));

  const renderImg = (it, i) => (
    <img
      src={toDirectImageUrl(it.imageUrl)}
      alt={it.alt || 'Banner'}
      className={styles.img}
      loading="lazy"
      decoding="async"
      key={i}
    />
  );

  return (
    <div className={styles.grid} style={{ '--cols': cols, gap }}>
      {valid.map((it, i) => {
        const link = it.link;
        const content = renderImg(it, i);
        if (link && typeof link === 'string' && link.startsWith('http')) {
          return (
            <a key={i} href={link} target="_blank" rel="noopener noreferrer" className={styles.cell}>
              {content}
            </a>
          );
        }
        if (link) {
          return (
            <Link key={i} to={link} className={styles.cell}>
              {content}
            </Link>
          );
        }
        return (
          <div key={i} className={styles.cell}>
            {content}
          </div>
        );
      })}
    </div>
  );
};

export default BannerGrid;
