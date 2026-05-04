import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getProduct } from '../../../../services/products';
import { toDirectImageUrl, toThumbnailImageUrl, ensureSingleImageUrl } from '../../../../utils/imageUrl';
import { getThumbnailVariant } from '../../../../utils/productThumbnailVariant';
import { recordThumbnailImpression } from '../../../../utils/productVariantBehavior';
import { useQueryClient } from '@tanstack/react-query';
import OptimizedImage, { useImagePreloader } from '../../../../components/common/OptimizedImage/OptimizedImage';
import ComboProductImageWithDesign, { comboHasDesignLayers } from './ComboProductImageWithDesign';
import styles from './ComboProductImage.module.css';

function getBestImageUrl(product, item, variantSelection = {}) {
  if (!product) return '';
  const displayColor = item?.variantMapping?.color || variantSelection?.color || '';
  const cleanedColor = displayColor ? displayColor.trim().toLowerCase() : '';

  let exactMatchUrl = '';
  let defaultFallbackUrl = '';

  // 1. Obtener la Customization View primero (fuente primaria de coordenadas)
  const view = product.customizationViews?.find((v) => v.id === item?.viewId)
    || product.customizationViews?.[0];

  if (view && view.imagesByColor) {
    const keys = Object.keys(view.imagesByColor);
    let matchedColorKey = null;

    if (cleanedColor) {
      matchedColorKey = keys.find(k => k.trim() === displayColor.trim()) ||
        keys.find(k => k.trim().toLowerCase() === cleanedColor);
    }

    if (matchedColorKey) {
      exactMatchUrl = ensureSingleImageUrl(view.imagesByColor[matchedColorKey]);
    }
    if (!defaultFallbackUrl) {
      defaultFallbackUrl = ensureSingleImageUrl(view.imagesByColor?.default);
    }
  }

  // 2. Si no hay match exacto en la vista, buscar en variants
  if (!exactMatchUrl && Array.isArray(product.variants) && product.variants.length > 0 && cleanedColor) {
    const matchingVariant = product.variants.find((v) => v.name && v.name.trim().toLowerCase() === cleanedColor);
    if (matchingVariant && matchingVariant.imageUrl) {
      exactMatchUrl = ensureSingleImageUrl(matchingVariant.imageUrl);
    }

    if (!defaultFallbackUrl) {
      const principalId = product.defaultVariantId;
      const principalVariant = principalId ? product.variants.find((v) => v.id === principalId) : null;
      defaultFallbackUrl = ensureSingleImageUrl(principalVariant?.imageUrl || product.variants[0]?.imageUrl);
    }
  }

  // Si encontró match exacto, usar ese
  if (exactMatchUrl) return exactMatchUrl;

  // 3. Fallbacks finales si no hay match exacto por color
  return defaultFallbackUrl || ensureSingleImageUrl(product.mainImage || (Array.isArray(product.images) && product.images[0]) || '');
}

/**
 * Muestra la imagen de un producto combo con soporte de diseños pre-configurados.
 * Prioridad:
 * 1. comboPreviewImage (URL subida a Firebase Storage desde admin)
 * 2. Rendering client-side con diseños (ComboProductImageWithDesign)
 * 3. Imágenes raw de los productos del combo lado a lado
 */
const ComboProductImage = ({
  comboProduct,
  variantSelections = {},
  className = '',
  isAboveFold = false,
  isThumbnail = false,
  renderSelector,
  onProductsFetched
}) => {
  const queryClient = useQueryClient();
  const [itemImageUrls, setItemImageUrls] = useState({});
  const [itemCropData, setItemCropData] = useState({});
  const [itemProducts, setItemProducts] = useState({});
  const [fetchDone, setFetchDone] = useState(false);
  const [designFailed, setDesignFailed] = useState(false);
  const containerRef = useRef(null);
  const comboImpressionRecorded = useRef(false);

  const comboItems = comboProduct?.comboItems || [];
  const comboLayout = comboProduct?.comboLayout || { orientation: 'horizontal', spacing: 20 };

  const savedPreview = comboProduct?.comboPreviewImage;
  const fallbackImage = comboProduct?.images?.[0];

  const isDefaultView = !variantSelections || Object.keys(variantSelections).length === 0;

  const effectiveVariantSelections = useMemo(() => {
    if (!isDefaultView || comboItems.length === 0) return variantSelections;
    return comboItems.reduce((acc, item, i) => {
      const color = item?.variantMapping?.color;
      if (color !== undefined && color !== null && color !== '') acc[i] = { color };
      else acc[i] = {};
      return acc;
    }, {});
  }, [isDefaultView, comboItems, variantSelections]);

  // Precargar todas las imágenes posibles asociadas a los sub-productos (colores, vistas)
  const allSubProductUrls = useMemo(() => {
    const urls = new Set();
    const extract = (obj) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        if (obj.startsWith('http') && (obj.includes('cloudinary') || obj.match(/\.(jpeg|jpg|webp|png|gif)$/i))) {
          urls.add(obj);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(extract);
      } else if (typeof obj === 'object') {
        Object.values(obj).forEach(extract);
      }
    };
    Object.values(itemProducts).forEach(p => extract(p));
    return Array.from(urls);
  }, [itemProducts]);

  useImagePreloader(allSubProductUrls);

  // Intersection observer para registrar impresiones
  useEffect(() => {
    if (comboImpressionRecorded.current || comboItems.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (comboImpressionRecorded.current) return;
        if (entries[0]?.isIntersecting) {
          comboImpressionRecorded.current = true;
          comboItems.forEach((item) => {
            if (item.productId) recordThumbnailImpression(item.productId);
          });
        }
      },
      { rootMargin: '50px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [comboItems]);

  const placeholderUrl = 'https://via.placeholder.com/400x400/eee/999?text=Combo';

  // Cargar imágenes de cada producto del combo según la variante elegida
  useEffect(() => {
    if (comboItems.length === 0) {
      setFetchDone(true);
      return;
    }
    let cancelled = false;

    const run = async () => {
      const results = await Promise.all(
        comboItems.map(async (item, i) => {
          try {
            let product = null;
            let cachedProduct = queryClient.getQueryData(['product', item.productId]);
            if (!cachedProduct) {
              const cachedProducts = queryClient.getQueryData(['products', null, '', 'name']);
              if (Array.isArray(cachedProducts)) {
                cachedProduct = cachedProducts.find(p => p.id === item.productId);
              }
            }
            product = cachedProduct;
            if (!product) {
              const { data } = await getProduct(item.productId);
              product = data;
            }
            if (!product) return null;
            const variantSelection = effectiveVariantSelections[i] || {};
            const imageUrl = getBestImageUrl(product, item, variantSelection);

            // Extract crop data from variant if available
            let cropData = null;
            if (variantSelection.id) {
              const variant = product.variants?.find(v => v.id === variantSelection.id);
              cropData = variant?.thumbnailCrop?.percentages || null;
            } else if (product.variants?.[0]?.thumbnailCrop?.percentages) {
              cropData = product.variants[0].thumbnailCrop.percentages;
            }

            return { index: i, imageUrl, cropData, product };
          } catch (err) {
            console.warn('Combo item image load:', item?.productId, err);
            return null;
          }
        })
      );

      if (cancelled) return;
      const nextUrls = {};
      const nextCrops = {};
      const nextProducts = {};
      results.forEach((r) => {
        if (r && r.imageUrl) {
          nextUrls[r.index] = r.imageUrl;
          if (r.cropData) nextCrops[r.index] = r.cropData;
        }
        if (r && r.product) {
          nextProducts[r.index] = r.product;
        }
      });
      setItemImageUrls(nextUrls);
      setItemCropData(nextCrops);
      setItemProducts(nextProducts);
      setFetchDone(true);
      if (onProductsFetched) {
        onProductsFetched(nextProducts);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [comboItems, effectiveVariantSelections, queryClient]);

  const isHorizontal = comboLayout.orientation !== 'vertical';

  const previewUrl =
    savedPreview &&
      typeof savedPreview === 'string' &&
      savedPreview.trim().length > 0 &&
      !savedPreview.trim().toLowerCase().startsWith('data:')
      ? savedPreview.trim()
      : '';

  // Prioridad 1: previsualización del combo subida (tiene diseños como imagen combinada)
  // Usar la imagen pre-generada de alta prioridad solo para thumbnails (tarjetas, carrito) o cuando
  // no necesitamos renderizar interfaces interactivas por cada producto.
  const isUploadedUrlRaw = previewUrl &&
    previewUrl !== placeholderUrl &&
    !String(previewUrl).includes('placeholder');

  const hasDesignLayers = comboHasDesignLayers(comboProduct?.comboItemCustomization);

  if (isUploadedUrlRaw && (isThumbnail || !renderSelector)) {
    return (
      <div className={className}>
        <div ref={containerRef} className={styles.container}>
          <OptimizedImage
            src={toThumbnailImageUrl(previewUrl)}
            fallbackSrc={toDirectImageUrl(previewUrl)}
            alt={comboProduct?.name || 'Combo'}
            className={styles.image}
            loading={isAboveFold ? "eager" : "lazy"}
            fetchPriority={isAboveFold ? "high" : "auto"}
            showSkeleton={false}
            seamless={true}
            objectFit="contain"
          />
        </div>
      </div>
    );
  }

  // Prioridad 2: Renderizado en cliente (DOM overlay super rápido y a prueba de CORS)
  if (hasDesignLayers && comboItems.length > 0 && !designFailed) {
    return (
      <ComboProductImageWithDesign
        comboProduct={comboProduct}
        className={className}
        isAboveFold={isAboveFold}
        isThumbnail={isThumbnail}
        variantSelections={effectiveVariantSelections}
        renderSelector={renderSelector}
        onError={() => setDesignFailed(true)}
      />
    );
  }

  // Prioridad 3: Imágenes raw de los productos del combo (sin diseño)
  const manualImage = (comboProduct?.hasVariants && comboProduct?.variants?.[0]?.imageUrl) || fallbackImage;

  // Sin items: fallback
  if (comboItems.length === 0) {
    const displayUrl = manualImage || placeholderUrl;
    return (
      <div ref={containerRef} className={`${styles.container} ${className}`}>
        <OptimizedImage
          src={toDirectImageUrl(displayUrl)}
          alt={comboProduct?.name || 'Combo'}
          className={styles.image}
          loading={isAboveFold ? "eager" : "lazy"}
          fetchPriority={isAboveFold ? "high" : "auto"}
          showSkeleton={false}
        />
      </div>
    );
  }

  // Mientras no ha terminado el fetch: placeholder
  if (!fetchDone) {
    return (
      <div
        ref={containerRef}
        className={`${styles.container} ${styles.comboRow} ${className}`}
        style={{
          flexDirection: isHorizontal ? 'row' : 'column',
          gap: `${comboLayout.spacing ?? 20}px`,
          padding: '0.75rem'
        }}
      >
        {comboItems.map((item, index) => (
          <div key={`placeholder-${item.productId}-${index}`} className={styles.comboRowItem}>
            <div className={styles.comboRowPlaceholder} />
          </div>
        ))}
      </div>
    );
  }

  const hasAnyImage = comboItems.some((_, index) => itemImageUrls[index]);

  // Sin imágenes encontradas: fallback
  if (!hasAnyImage) {
    const displayUrl = manualImage || placeholderUrl;
    return (
      <div ref={containerRef} className={`${styles.container} ${className}`}>
        <OptimizedImage
          src={toDirectImageUrl(displayUrl)}
          alt={comboProduct?.name || 'Combo'}
          className={styles.image}
          loading={isAboveFold ? "eager" : "lazy"}
          fetchPriority={isAboveFold ? "high" : "auto"}
          showSkeleton={false}
          seamless={true}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${styles.comboRow} ${className}`}
      style={{
        flexDirection: isHorizontal ? 'row' : 'column',
        gap: `${comboLayout.spacing ?? 20}px`,
        padding: '0.75rem'
      }}
    >

      {comboItems.map((item, index) => {
        const imageUrl = itemImageUrls[index];
        const reactKey = `${item.productId}-${index}`;
        const p = itemProducts[index];
        if (!imageUrl) {
          return (
            <div key={reactKey} className={styles.comboRowItem}>
              <div className={styles.comboRowPlaceholder} style={{ transform: `scale(${item.scale ?? 1})` }} />
            </div>
          );
        }
        return (
          <div key={reactKey} className={styles.comboRowItem}>
            {renderSelector && !isThumbnail && renderSelector(index, p, 'top')}
            <div style={{
              width: '100%',
              position: 'relative'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                transform: `scale(${item.scale ?? 1})`,
                transformOrigin: 'center center'
              }}>
                <OptimizedImage
                  src={toThumbnailImageUrl(imageUrl)}
                  alt={`${comboProduct?.name || 'Combo'} - producto ${index + 1}`}
                  className={styles.comboRowImage}
                  loading={isAboveFold ? "eager" : "lazy"}
                  fetchPriority={isAboveFold ? "high" : "auto"}
                  showSkeleton={false}
                  seamless={true}
                  fadeInDuration={200}
                  cropData={itemCropData[index]}
                />
              </div>
            </div>
            {renderSelector && !isThumbnail && renderSelector(index, p, 'bottom')}
          </div>
        );
      })}
    </div>
  );
};

export default ComboProductImage;
