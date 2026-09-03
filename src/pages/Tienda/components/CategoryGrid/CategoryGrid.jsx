import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TextoSeccion } from '../textStyleUtils.jsx';
import { toThumbnailImageUrl, toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './CategoryGrid.module.css';

/**
 * Cuadrícula de Categorías: tiles grandes (imagen + nombre) que enlazan a la
 * categoría vía `?categoria=<id>` en la MISMA página (así filtra el catálogo de
 * esa página, sea global o de marca). Estilo ecommerce (Chronos "¿Qué estás
 * buscando?"). Se auto-oculta si no hay tiles.
 *
 * @param {string} title
 * @param {object} config   settings de la sección (estilo del título)
 * @param {Array}  items    [{ categoryId, name, imageUrl }]
 * @param {number} columns  columnas en escritorio (default 4)
 */
const CategoryGrid = ({ title, config, items = [], columns = 4 }) => {
  const location = useLocation();

  const valid = (items || []).filter((it) => it && it.categoryId);
  if (valid.length === 0) return null;

  const cols = Math.min(6, Math.max(1, Number(columns) || 4));

  return (
    <div className={styles.wrapper}>
      <TextoSeccion settings={config} prefix="title" as="h2" className={styles.title}>
        {title}
      </TextoSeccion>

      <div className={styles.grid} style={{ '--cols': cols }}>
        {valid.map((it, i) => {
          const img = it.imageUrl ? toThumbnailImageUrl(it.imageUrl) : '';
          const to = `${location.pathname}?categoria=${encodeURIComponent(it.categoryId)}`;
          return (
            <Link key={it.categoryId || i} to={to} className={styles.tile} aria-label={it.name || 'Categoría'}>
              <div
                className={styles.tileImage}
                style={img ? { backgroundImage: `url(${img}), url(${toDirectImageUrl(it.imageUrl)})` } : undefined}
              >
                {!img && <span className={styles.noImg} aria-hidden="true" />}
                <span className={styles.overlay} />
                <span className={styles.name}>{it.name || 'Categoría'}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryGrid;
