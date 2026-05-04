import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '../../../../contexts/CartContext';
import { toThumbnailImageUrl } from '../../../../utils/imageUrl';
import { isComboProduct } from '../../../../utils/comboProductUtils';
import { useProductThumbnailVariant } from '../../../../hooks/useProductThumbnailVariant';
import ComboProductImage from '../ComboProductImage/ComboProductImage';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import styles from './PremiumProductCard.module.css';

const PremiumProductCard = React.memo(({ product, categories = [], isAboveFold = false }) => {
  const { addToCart } = useCart();
  const queryClient = useQueryClient();
  const { thumbnailImageUrl, recordImpression, variantIndex } = useProductThumbnailVariant(product);
  const imageContainerRef = useRef(null);
  const impressionRecorded = useRef(false);

  useEffect(() => {
    if (!product?.id || impressionRecorded.current) return;
    const el = imageContainerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (impressionRecorded.current) return;
        if (entries[0]?.isIntersecting) {
          impressionRecorded.current = true;
          recordImpression();
        }
      },
      { rootMargin: '50px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product?.id, recordImpression]);

  const handleAddToCart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, {}, null, 1);
  }, [addToCart, product]);

  const [isFavorite, setIsFavorite] = useState(false);
  const handleToggleFavorite = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(prev => !prev);
  }, []);

  const handlePrefetch = useCallback(() => {
    queryClient.setQueryData(['product', product.id], product);
  }, [queryClient, product.id, product]);

  const isCombo = isComboProduct(product);
  
  // Determinar la variante principal
  const principalVariant = product?.variants?.find(v => String(v.id) === String(product.defaultVariantId)) || product?.variants?.[0];

  const cardImageUrl =
    thumbnailImageUrl ||
    principalVariant?.imageUrl ||
    product?.mainImage ||
    product?.images?.[0] ||
    '';

  const secondaryImageUrl = product?.images?.[1] || null;

  const fallbackImageUrl = toThumbnailImageUrl(
    principalVariant?.imageUrl ||
    product?.mainImage ||
    product?.images?.[0] ||
    ''
  );

  const mainVariantCrop = principalVariant?.thumbnailCrop?.percentages;

  // New badge detection
  const isNew = (() => {
    if (!product.createdAt) return false;
    const createdDate = new Date(product.createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return createdDate > thirtyDaysAgo;
  })();

  return (
    <Link
      to={`/producto/${product.id}`}
      className={styles.card}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <div className={styles.imageContainer} ref={imageContainerRef}>
        {isCombo ? (
          <ComboProductImage
            comboProduct={product}
            variantSelections={variantIndex >= 0 && product.variants?.[variantIndex]?.comboSelections ? product.variants[variantIndex].comboSelections : {}}
            className={styles.comboImage}
            isAboveFold={isAboveFold}
            isThumbnail={true}
          />
        ) : (
          <>
            <OptimizedImage
              src={toThumbnailImageUrl(cardImageUrl)}
              fallbackSrc={fallbackImageUrl !== toThumbnailImageUrl(cardImageUrl) ? fallbackImageUrl : undefined}
              alt={product.name}
              containerClassName={styles.imageWrapper}
              className={`${styles.primaryImage} ${secondaryImageUrl ? styles.hasSecondary : ''}`}
              objectFit="cover"
              loading={isAboveFold ? "eager" : "lazy"}
              fetchPriority={isAboveFold ? "high" : "auto"}
              fadeInDuration={400}
              showSkeleton={true}
              cropData={mainVariantCrop}
            />
            {secondaryImageUrl && (
              <OptimizedImage
                src={toThumbnailImageUrl(secondaryImageUrl)}
                alt={`${product.name} alternate`}
                containerClassName={`${styles.imageWrapper} ${styles.secondaryImageWrapper}`}
                className={styles.secondaryImage}
                objectFit="cover"
                loading="lazy"
                showSkeleton={false}
              />
            )}
          </>
        )}

        {/* Badges - Nude Project / Gymshark style */}
        <div className={styles.badges}>
          {isNew && <span className={styles.badgeNew}>NEW IN</span>}
          {product.salePrice && <span className={styles.badgeSale}>SALE</span>}
          {!product.inStock && <span className={styles.badgeOut}>SOLD OUT</span>}
        </div>

        {/* Favorite Icon */}
        <button 
          className={`${styles.favoriteBtn} ${isFavorite ? styles.favoriteBtnActive : ''}`}
          onClick={handleToggleFavorite}
          aria-label="Agregar a favoritos"
        >
          <svg viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Quick Add Overlay */}
        <div className={styles.quickAddOverlay}>
          <button 
            className={styles.quickAddBtn}
            onClick={handleAddToCart}
            disabled={!product.inStock}
          >
            <span className={styles.quickAddIcon}>+</span>
            <span className={styles.quickAddText}>Quick Add</span>
          </button>
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{product.name}</h3>
          <div className={styles.priceContainer}>
            {product.salePrice ? (
              <>
                <span className={styles.salePrice}>S/ {product.salePrice.toFixed(2)}</span>
                <span className={styles.originalPrice}>S/ {product.price?.toFixed(2)}</span>
              </>
            ) : (
              <span className={styles.price}>S/ {product.price?.toFixed(2) || '0.00'}</span>
            )}
          </div>
        </div>
        
        {/* Optional: color swatches or subtle description could go here */}
        <div className={styles.subtitle}>
          {categories.length > 0 ? categories[0].name : (product.customizable ? 'Customizable' : 'Essential')}
        </div>
      </div>
    </Link>
  );
});

export default PremiumProductCard;
