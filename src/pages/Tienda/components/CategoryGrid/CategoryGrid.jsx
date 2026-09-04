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
const idOf = (value) => {
  if (value && typeof value === 'object') return value.id || value.slug || value.name || '';
  return value || '';
};

const CategoryGrid = ({ title, config = {}, items = [], categories = [], products = [], columns = 4 }) => {
  const location = useLocation();

  const dataSource = config.dataSource || 'manual';
  const productCounts = new Map();

  if (dataSource === 'products') {
    (products || []).forEach((product) => {
      if (!product || product.visible === false || product.active === false) return;
      const productCategories = new Set([
        ...(Array.isArray(product.categories) ? product.categories.map(idOf) : []),
        idOf(product.categoryId),
        idOf(product.category),
      ].filter(Boolean));

      productCategories.forEach((categoryId) => {
        productCounts.set(categoryId, (productCounts.get(categoryId) || 0) + 1);
      });
    });
  }

  let valid = dataSource === 'products'
    ? (categories || [])
      .filter((category) => category && category.active !== false && productCounts.has(idOf(category)))
      .map((category) => ({
        categoryId: idOf(category),
        name: category.name || category.title || 'Categoría',
        imageUrl: category.imageUrl || category.image || '',
        order: Number(category.order) || 0,
        productCount: productCounts.get(idOf(category)) || 0,
      }))
    : (items || []).filter((it) => it && it.categoryId);

  if (dataSource === 'products') {
    const sortMode = config.sortMode || 'admin';
    valid.sort((a, b) => {
      if (sortMode === 'products') return b.productCount - a.productCount || a.name.localeCompare(b.name, 'es');
      if (sortMode === 'alphabetical') return a.name.localeCompare(b.name, 'es');
      return a.order - b.order || a.name.localeCompare(b.name, 'es');
    });
    const limit = Math.min(12, Math.max(2, Number(config.limit) || 6));
    valid = valid.slice(0, limit);
  }

  if (valid.length === 0) return null;

  const cols = Math.min(6, Math.max(1, Number(columns) || 4));
  const renderedCols = Math.min(cols, valid.length);

  return (
    <div className={`${styles.wrapper} ${config.cardStyle === 'round' ? styles.roundStyle : ''}`}>
      <TextoSeccion settings={config} prefix="title" as="h2" className={styles.title}>
        {title}
      </TextoSeccion>

      <div className={styles.grid} style={{ '--cols': renderedCols }}>
        {valid.map((it, i) => {
          const img = it.imageUrl ? toThumbnailImageUrl(it.imageUrl) : '';
          const to = `${location.pathname}?categoria=${encodeURIComponent(it.categoryId)}`;
          const tileBackgroundColor = it.backgroundColor || config?.tileBackgroundColor || '';
          const tileStyle = {
            ...(img ? { backgroundImage: `url(${img}), url(${toDirectImageUrl(it.imageUrl)})` } : {}),
            ...(tileBackgroundColor ? { backgroundColor: tileBackgroundColor } : {})
          };
          return (
            <Link
              key={it.categoryId || i}
              to={to}
              className={styles.tile}
              aria-label={it.name || 'Categoría'}
              style={tileBackgroundColor ? { backgroundColor: tileBackgroundColor } : undefined}
            >
              <div
                className={styles.tileImage}
                style={tileStyle}
              >
                {!img && <span className={styles.noImg} aria-hidden="true" />}
                <span className={styles.overlay} />
                <span className={styles.copy}>
                  <span className={styles.name}>{it.name || 'Categoría'}</span>
                  {config.showProductCount && Number(it.productCount) > 0 && (
                    <span className={styles.count}>{it.productCount} productos</span>
                  )}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryGrid;
