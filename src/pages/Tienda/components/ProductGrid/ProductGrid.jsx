import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PremiumProductCard from '../PremiumProductCard/PremiumProductCard';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './ProductGrid.module.css';

const SKELETON_COUNT = 6;

const SkeletonCard = () => (
  <div className={styles.skeletonCard}>
    <div className={styles.skeletonImage} />
    <div className={styles.skeletonContent}>
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLineShort} />
      <div className={styles.skeletonPrice} />
    </div>
  </div>
);

const ProductGrid = React.memo(({ products, loading, error, emptyMessage, categories, layoutConfig }) => {

  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef(null);

  // Reiniciar la cuenta base cuando los productos o filtros cambian 
  useEffect(() => {
    setVisibleCount(12);
  }, [products]);

  // Observer para "infinite scroll" en RAM
  useEffect(() => {
    if (!products || visibleCount >= products.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 12, products.length));
        }
      },
      { rootMargin: '400px', threshold: 0.1 } // Anticipate scroll
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [visibleCount, products]);

  const visibleProducts = useMemo(() => {
    if (!products) return [];
    return products.slice(0, visibleCount);
  }, [products, visibleCount]);

  const gridStyle = useMemo(() => {
    // Si layoutConfig especifica 'auto', mapearlo a 'auto-fit'
    const desktopCols = layoutConfig?.productGridColumnsDesktop;
    const desktopVal = desktopCols === 'auto' || !desktopCols ? 'auto-fit' : desktopCols;
    
    return {
      '--grid-cols-desktop': desktopVal,
      '--grid-cols-mobile': layoutConfig?.productGridColumnsMobile || 2,
    };
  }, [layoutConfig]);

  if (loading) {
    return (
      <div className={styles.grid} style={gridStyle}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorTitle}>No pudimos cargar los productos</p>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>◇</div>
        <h3 className={styles.emptyTitle}>Próximamente más productos</h3>
        <p className={styles.emptyText}>
          {emptyMessage || 'Estamos preparando novedades. Revisa de nuevo en unos días.'}
        </p>
        <Link to="/" className={styles.emptyLink}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.grid} style={gridStyle}>
        {visibleProducts.map((product, index) => (
          <PremiumProductCard
            key={product.id}
            product={product}
            categories={categories}
            isAboveFold={index < 4}
            showHoverSecondaryMedia={layoutConfig?.showHoverSecondaryMedia ?? true}
          />
        ))}
      </div>
      {/* Elemento oculto para disparar la carga de la siguiente tanda iterativa en memoria */}
      {visibleCount < products.length && (
        <div ref={loadMoreRef} style={{ height: '20px', width: '100%', marginTop: '20px' }} />
      )}
    </>
  );
});

export default ProductGrid;
