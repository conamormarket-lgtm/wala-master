import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '../../../../contexts/CartContext';
import { toDirectImageUrl, toThumbnailImageUrl } from '../../../../utils/imageUrl'; // Force recompile
import { isComboProduct } from '../../../../utils/comboProductUtils';
import { useProductThumbnailVariant } from '../../../../hooks/useProductThumbnailVariant';
import ComboProductImage from '../ComboProductImage/ComboProductImage';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import Button from '../../../../components/common/Button';
import styles from './ProductCard.module.css';

const getCategoryDisplay = (product, categoriesList) => {
  const ids = product.categories ?? (product.category ? [product.category] : []);
  if (!Array.isArray(ids) || ids.length === 0) return product.category || '';
  const names = (categoriesList || [])
    .filter((c) => ids.includes(c.id))
    .map((c) => c.name)
    .filter(Boolean);
  return names.length ? names.join(', ') : product.category || '';
};

const ProductCard = React.memo(({ product, categories = [], isAboveFold = false, showHoverSecondaryMedia = true }) => {
  const { addToCart } = useCart();
  const queryClient = useQueryClient();
  const categoryDisplay = getCategoryDisplay(product, categories);
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

  const handlePersonalize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/editor/${product.id}`;
  }, [product.id]);

  const [isFavorite, setIsFavorite] = useState(false);
  const handleToggleFavorite = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(prev => !prev);
    // TODO: En el futuro esto llamará al Context global de Favoritos
  }, []);

  const handlePrefetch = useCallback(() => {
    queryClient.setQueryData(['product', product.id], product);
  }, [queryClient, product.id, product]);

  const calculateDiscount = (regular, sale) => {
    if (!regular || !sale || regular <= sale) return 0;
    return Math.round(((regular - sale) / regular) * 100);
  };

  const getProductStats = (id) => {
    const defaultStats = { sold: 100, rating: '4.8', reviews: 45 };
    if (!id) return defaultStats;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    const sold = 50 + (absHash % 2000); // 50 to 2050
    const ratingRaw = 4.5 + ((absHash % 5) / 10); // 4.5 to 4.9
    const rating = ratingRaw.toFixed(1);
    const reviews = 5 + (absHash % 300);
    return { sold, rating, reviews };
  };

  const isCombo = isComboProduct(product);
  const stats = getProductStats(product.id);
  const discount = product.salePrice ? calculateDiscount(product.price, product.salePrice) : 0;

  // Determinar la variante principal
  const principalVariant = product?.variants?.find(v => String(v.id) === String(product.defaultVariantId)) || product?.variants?.[0];

  // URL de la thumbnail principal (puede ser thumbnailWithDesignUrl de Firestore)
  const cardImageUrl =
    thumbnailImageUrl ||
    principalVariant?.imageUrl ||
    product?.mainImage ||
    product?.images?.[0] ||
    '';

  const secondaryImageUrl = product?.images?.[1] || null;

  // Fallback: imagen real de la variante principal (por si la thumbnail falla o está desactualizada)
  const fallbackImageUrl = toThumbnailImageUrl(
    principalVariant?.imageUrl ||
    product?.mainImage ||
    product?.images?.[0] ||
    ''
  );

  // Extraer el crop de la variante principal si existe
  const mainVariantCrop = principalVariant?.thumbnailCrop?.percentages;

  const isFirebase = cardImageUrl && cardImageUrl.includes('firebasestorage.googleapis.com');

  return (
    <Link
      to={`/producto/${product.id}`}
      className={styles.card}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <div className={`${styles.imageContainer} ${isCombo ? styles.isCombo : styles.isNormal}`} ref={imageContainerRef}>
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
              containerClassName={styles.image}
              className={`${styles.productImg} ${showHoverSecondaryMedia && secondaryImageUrl ? styles.primaryImgHover : ''}`}
              objectFit="cover"
              loading={isAboveFold ? "eager" : "lazy"}
              fetchPriority={isAboveFold ? "high" : "auto"}
              fadeInDuration={400}
              showSkeleton={true}
              cropData={mainVariantCrop}
            />
            {showHoverSecondaryMedia && secondaryImageUrl && (
              <OptimizedImage
                src={toThumbnailImageUrl(secondaryImageUrl)}
                alt={`${product.name} alternate`}
                containerClassName={`${styles.image} ${styles.secondaryImageContainer}`}
                className={styles.secondaryImg}
                objectFit="cover"
                loading="lazy"
                showSkeleton={false}
              />
            )}
          </>
        )}

        {/* Urgent/Discount Badges like Temu/Shein */}
        <div className={styles.badgesTopLeft}>
          {product.customizable && !isCombo && <div className={styles.customBadge}>Personalizable</div>}
          {discount > 0 && <div className={styles.discountBadge}>-{discount}%</div>}
        </div>
        <div className={styles.badgesTopRight}>
          {isCombo && <div className={styles.comboBadge}>Combo</div>}
        </div>

        <button 
          className={`${styles.favoriteBtn} ${isFavorite ? styles.favoriteBtnActive : ''}`}
          onClick={handleToggleFavorite}
          aria-label="Agregar a favoritos"
          title="Agregar a favoritos"
        >
          <svg viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {!product.inStock && (
          <div className={styles.outOfStock}>Agotado</div>
        )}
      </div>

      <div className={styles.content}>
        <h3 className={styles.name}>{product.name}</h3>

        <div className={styles.socialProof}>
          <div className={styles.rating}>
            <span className={styles.star}>★</span>
            <span className={styles.ratingNum}>{stats.rating}</span>
            <span className={styles.reviewsCount}>({stats.reviews})</span>
          </div>
          <span className={styles.soldCount}>+{stats.sold} vendidos</span>
        </div>

        <div className={styles.priceRow}>
          <div className={styles.priceBlock}>
            {product.salePrice ? (
              <>
                <span className={styles.salePrice}>S/ {product.salePrice.toFixed(2)}</span>
                <span className={styles.regularPrice}>S/ {product.price?.toFixed(2) || '0.00'}</span>
              </>
            ) : (
              <span className={styles.salePrice}>S/ {product.price?.toFixed(2) || '0.00'}</span>
            )}
          </div>

          <button
            className={`${styles.cartQuickBtn} ${product.salePrice ? styles.cartQuickBtnPulse : ''}`}
            onClick={handleAddToCart}
            disabled={!product.inStock}
            aria-label="Agregar al carrito"
            title="Agregar al carrito"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </button>
        </div>

        {/* Temu-style Delivery Tag */}
        <div className={styles.deliveryTag}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--verde-exito)" style={{ marginRight: '4px' }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          Envío Rápido y Seguro
        </div>
      </div>
    </Link>
  );
});

export default ProductCard;
