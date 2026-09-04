import React from 'react';
import { Link } from 'react-router-dom';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './BannerGrid.module.css';

const brandSlug = (brand) => {
  if (brand?.slug) return String(brand.slug).replace(/^\/+|\/+$/g, '');
  return String(brand?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
};

const initials = (name) => String(name || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word[0])
  .join('')
  .toUpperCase();

/**
 * Mosaico promocional con dos fuentes:
 * - manual: conserva el comportamiento histórico de banners con imagen.
 * - brands: se sincroniza con tienda_brands y enlaza a cada landing de marca.
 */
const BannerGrid = ({ config = {}, items = [], brands = [], columns = 3, gap = '1rem' }) => {
  const automatic = config.dataSource === 'brands';
  const valid = automatic
    ? (brands || [])
      .filter((brand) => brand?.name && brandSlug(brand) && brand.active !== false && brand.visible !== false)
      .map((brand) => ({
        id: brand.id || brandSlug(brand),
        name: brand.name,
        imageUrl: brand.logoUrl || brand.imageUrl || '',
        link: `/${brandSlug(brand)}`,
        alt: `Explorar productos de ${brand.name}`,
        backgroundColor: brand.bgColor || '',
        backgroundImage: brand.bgImage || '',
      }))
    : (items || []).filter((it) => it && it.imageUrl);
  if (valid.length === 0) return null;

  const cols = Math.min(4, Math.max(1, Number(columns) || 3));

  const renderManualImage = (it) => (
    <img
      src={toDirectImageUrl(it.imageUrl)}
      alt={it.alt || 'Banner'}
      className={styles.img}
      loading="lazy"
      decoding="async"
    />
  );

  const renderLink = (item, content, className, key, style) => {
    if (item.link && typeof item.link === 'string' && /^https?:\/\//i.test(item.link)) {
      return <a key={key} href={item.link} target="_blank" rel="noopener noreferrer" className={className} style={style}>{content}</a>;
    }
    if (item.link) return <Link key={key} to={item.link} className={className} style={style}>{content}</Link>;
    return <div key={key} className={className} style={style}>{content}</div>;
  };

  return (
    <div className={styles.section}>
      {(config.title || config.subtitle) && (
        <header className={styles.header}>
          {config.title && <h2 className={styles.title} style={{ color: config.titleColor || undefined }}>{config.title}</h2>}
          {config.subtitle && <p className={styles.subtitle} style={{ color: config.subtitleColor || undefined }}>{config.subtitle}</p>}
        </header>
      )}
      <div className={styles.grid} style={{ '--cols': cols, gap }}>
        {valid.map((item, index) => {
          if (!automatic) {
            return renderLink(item, renderManualImage(item), styles.cell, item.id || index);
          }

          const brandStyle = {
            '--brand-color': item.backgroundColor || '#f4f0ff',
            backgroundImage: item.backgroundImage
              ? `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.82)), url(${toDirectImageUrl(item.backgroundImage)})`
              : undefined,
          };
          const content = (
            <>
              <div className={styles.brandVisual}>
                {item.imageUrl ? (
                  <img src={toDirectImageUrl(item.imageUrl)} alt={item.alt} className={styles.brandLogo} loading="lazy" decoding="async" />
                ) : (
                  <span className={styles.brandFallback} aria-hidden="true">{initials(item.name)}</span>
                )}
              </div>
              {config.showBrandName !== false && (
                <div className={styles.brandFooter}>
                  <span>{item.name}</span>
                  <span className={styles.brandArrow} aria-hidden="true">→</span>
                </div>
              )}
            </>
          );
          return renderLink(
            item,
            content,
            `${styles.brandCell} ${config.brandCardStyle === 'outline' ? styles.brandOutline : ''}`,
            item.id || index,
            brandStyle
          );
        })}
      </div>
    </div>
  );
};

export default BannerGrid;
