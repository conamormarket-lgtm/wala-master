import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGlobalToast } from '../../../../contexts/ToastContext';
import { useCart } from '../../../../contexts/CartContext';
import { createReferralShare } from '../../../../services/referrals';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import { isComboProduct } from '../../../../utils/comboProductUtils';
import { recordProductClick, recordVariantViewTime } from '../../../../utils/productVariantBehavior';
import { getFallbackHex } from '../../../../utils/colors';
import ComboProductImage from '../ComboProductImage/ComboProductImage';
import Button from '../../../../components/common/Button';
import DraggableContainer from '../../../../components/common/DraggableContainer/DraggableContainer';
import ProductCuestionarioModal from '../ProductCuestionarioModal/ProductCuestionarioModal';
import OptimizedImage, { useImagePreloader } from '../../../../components/common/OptimizedImage/OptimizedImage';
import { useQuery } from '@tanstack/react-query';
import { getBrands } from '../../../../services/brands';
import styles from './ProductDetail.module.css';

const getCategoryDisplay = (product, categoriesList) => {
  const ids = product?.categories ?? (product?.category ? [product.category] : []);
  if (!Array.isArray(ids) || ids.length === 0) return product?.category || '';
  const names = (categoriesList || []).filter((c) => ids.includes(c.id)).map((c) => c.name).filter(Boolean);
  return names.length ? names.join(', ') : product?.category || '';
};

/**
 * ProductGallery — Galería profesional con miniaturas y zoom (Amazon/Nike style)
 * Soporta múltiples imágenes por variante y unificación de capas para Productos Combo.
 */
const ProductGallery = ({ product, selectedVariant, isCombo, comboVariantSelections, comboSubProducts = {}, comboElement }) => {
  const images = React.useMemo(() => {
    let result = [];

    if (isCombo) {
      // 1. Portada del Combo
      const comboThumb = product?.comboPreviewImage
        ? toDirectImageUrl(product.comboPreviewImage)
        : product?.mainImage
        ? toDirectImageUrl(product.mainImage)
        : toDirectImageUrl('https://via.placeholder.com/500x500?text=COMBO');
        
      result.push({ isComboView: true, url: comboThumb });

      // 2. Extraer fotos de los submúltiples
      if (comboSubProducts && typeof comboSubProducts === 'object') {
        Object.keys(comboSubProducts).forEach((idx) => {
          const subProduct = comboSubProducts[idx];
          const selection = comboVariantSelections?.[idx];
          if (!subProduct) return;

          const cleanColor = selection?.color ? selection.color.trim().toLowerCase() : '';
          let matchingVariant = null;
          if (cleanColor && Array.isArray(subProduct.variants)) {
            matchingVariant = subProduct.variants.find(v => v.name && v.name.trim().toLowerCase() === cleanColor);
          }

          if (matchingVariant) {
            if (Array.isArray(subProduct.customizationViews)) {
              subProduct.customizationViews.forEach(view => {
                const keys = Object.keys(view.imagesByColor || {});
                const matchedKey = keys.find(k => k.trim().toLowerCase() === cleanColor);
                if (matchedKey && view.imagesByColor[matchedKey]) {
                  result.push({ isComboView: false, url: toDirectImageUrl(view.imagesByColor[matchedKey]) });
                }
                if (view.hasBackSide && view.backSide?.imagesByColor) {
                  const bKeys = Object.keys(view.backSide.imagesByColor);
                  const bMatchedKey = bKeys.find(k => k.trim().toLowerCase() === cleanColor);
                  if (bMatchedKey && view.backSide.imagesByColor[bMatchedKey]) {
                    result.push({ isComboView: false, url: toDirectImageUrl(view.backSide.imagesByColor[bMatchedKey]) });
                  }
                }
              });
            }
            if (matchingVariant.galleryImages && matchingVariant.galleryImages.length > 0) {
              matchingVariant.galleryImages.forEach(img => result.push({ isComboView: false, url: toDirectImageUrl(img) }));
            } else if (matchingVariant.imageUrl) {
              result.push({ isComboView: false, url: toDirectImageUrl(matchingVariant.imageUrl) });
            }
          } else {
            const globals = (subProduct.images || []).map(toDirectImageUrl);
            if (globals.length > 0) {
              globals.forEach(url => result.push({ isComboView: false, url }));
            } else if (subProduct.mainImage) {
              result.push({ isComboView: false, url: toDirectImageUrl(subProduct.mainImage) });
            }
          }
        });
      }
      
      const globalCombos = (product?.images || []).map(toDirectImageUrl);
      globalCombos.forEach(url => result.push({ isComboView: false, url }));
      
    } else {
      let urls = [];
      if (selectedVariant) {
        const cleanColor = selectedVariant.name ? selectedVariant.name.trim().toLowerCase() : '';
        if (Array.isArray(product?.customizationViews)) {
          product.customizationViews.forEach(view => {
            const keys = Object.keys(view.imagesByColor || {});
            const matchedKey = keys.find(k => k.trim().toLowerCase() === cleanColor);
            if (matchedKey && view.imagesByColor[matchedKey]) {
              urls.push(toDirectImageUrl(view.imagesByColor[matchedKey]));
            }
            if (view.hasBackSide && view.backSide?.imagesByColor) {
              const bKeys = Object.keys(view.backSide.imagesByColor);
              const bMatchedKey = bKeys.find(k => k.trim().toLowerCase() === cleanColor);
              if (bMatchedKey && view.backSide.imagesByColor[bMatchedKey]) {
                urls.push(toDirectImageUrl(view.backSide.imagesByColor[bMatchedKey]));
              }
            }
          });
        }
        if (selectedVariant.galleryImages && selectedVariant.galleryImages.length > 0) {
          urls.push(...selectedVariant.galleryImages.map(toDirectImageUrl));
        } else {
          const vImg = selectedVariant.imageUrl ? toDirectImageUrl(selectedVariant.imageUrl) : null;
          const globals = (product?.images || []).map(toDirectImageUrl);
          urls.push(...[vImg, ...globals].filter(Boolean));
        }
      } else {
        const mainImg = product?.mainImage ? toDirectImageUrl(product.mainImage) : null;
        const globals = (product?.images || []).map(toDirectImageUrl);
        urls = [mainImg, ...globals].filter(Boolean);
      }
      urls.forEach(url => result.push({ isComboView: false, url }));
    }
    
    // Quitar duplicados
    const unique = [];
    const seen = new Set();
    result.forEach(item => {
      if (item.url && !item.url.includes('undefined') && !seen.has(item.url)) {
        seen.add(item.url);
        unique.push(item);
      }
    });

    if (unique.length === 0) {
       unique.push({ isComboView: false, url: toDirectImageUrl('https://via.placeholder.com/500x500') });
    }
    return unique;
  }, [product, selectedVariant, isCombo, comboVariantSelections, comboSubProducts]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setActiveIdx(0);
  }, [selectedVariant?.id, selectedVariant?.name, isCombo ? JSON.stringify(comboVariantSelections) : null, images.length]);

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setMousePos({ x, y });
  };

  const activeImage = images[activeIdx] || images[0];
  const isCurrentlyComboView = activeImage.isComboView;

  return (
    <div className={styles.galleryContainer}>
      {images.length > 1 && (
        <div className={styles.thumbnailList}>
          {images.map((img, i) => (
            <button
              key={i}
              className={`${styles.thumbnail} ${activeIdx === i ? styles.thumbnailActive : ''}`}
              onClick={() => setActiveIdx(i)}
              onMouseEnter={() => setActiveIdx(i)}
              aria-label={`Ver imagen ${i + 1}`}
            >
              <img src={img.url} alt={`${product?.name || 'Producto'} miniatura ${i + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div 
        className={`${styles.mainGalleryImage} ${isCurrentlyComboView ? styles.mainGalleryImageCombo : ''}`}
        onMouseEnter={() => !isCurrentlyComboView && setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={(e) => !isCurrentlyComboView && handleMouseMove(e)}
        style={{ cursor: isCurrentlyComboView ? 'default' : 'crosshair' }}
      >
        {isCurrentlyComboView ? (
          <div className={styles.comboWrapperInsideGallery}>
            {comboElement}
          </div>
        ) : (
           <>
            <img 
              src={activeImage.url} 
              alt={product?.name || 'Producto'} 
              className={`${styles.galleryImg} ${isZooming ? styles.galleryImgZoomed : ''}`}
              style={isZooming ? { transformOrigin: `${mousePos.x}% ${mousePos.y}%` } : {}}
              fetchpriority="high"
              loading="eager"
            />
            {!isZooming && <div className={styles.zoomHint}>🔍 Pasa el ratón para zoom</div>}
          </>
        )}
      </div>
    </div>
  );
};

// Removido fake scarcity stats y countdown

const ProductDetail = ({ product, loading, categories = [] }) => {
  const categoryDisplay = getCategoryDisplay(product, categories);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, userProfile } = useAuth();
  const toast = useGlobalToast();
  const [generatingLink, setGeneratingLink] = useState(false);
  const referralCode = userProfile?.referralCode || (user?.uid ? `KS-${user.uid.substring(0, 6).toUpperCase()}` : '');

  const hasVariants = Boolean(product?.hasVariants);
  const variantsList = Array.isArray(product?.variants) ? product.variants : [];

  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const selectedVariant = hasVariants && variantsList[selectedVariantIndex]
    ? variantsList[selectedVariantIndex]
    : null;

  const availableSizes = hasVariants 
    ? (selectedVariant?.sizes || [])
    : (Array.isArray(product?.mainSizes) ? product.mainSizes : []);

  const [selectedSize, setSelectedSize] = useState(availableSizes[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [comboVariantSelections, setComboVariantSelections] = useState({});
  const [comboSubProducts, setComboSubProducts] = useState({});
  const [cuestionarioModalTemplate, setCuestionarioModalTemplate] = useState(null);
  const variantSecondsRef = useRef(0);
  const lastVariantIdRef = useRef(null);

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await getBrands();
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const productBrand = brandsData?.find(b => b.id === product?.brandId);
  const brandBgColor = productBrand?.bgColor;
  const brandBgImage = productBrand?.bgImage;
  const brandBgOpacity = productBrand?.bgOpacity ?? 100;

  const brandBgStyle = (brandBgColor || brandBgImage) ? {
    backgroundColor: brandBgColor || 'transparent',
    backgroundImage: brandBgImage 
      ? `linear-gradient(rgba(0,0,0,${1 - brandBgOpacity/100}), rgba(0,0,0,${1 - brandBgOpacity/100})), url(${brandBgImage})` 
      : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

  // Precargar todas las imágenes relacionadas al producto
  const allProductUrls = React.useMemo(() => {
    if (!product) return [];
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
    extract(product);
    return Array.from(urls);
  }, [product]);

  useImagePreloader(allProductUrls);

  useEffect(() => {
    if (product?.id) recordProductClick(product.id);
  }, [product?.id]);

  useEffect(() => {
    if (!product?.isComboProduct || !Array.isArray(product.comboItems) || product.comboItems.length === 0) return;
    const initial = {};
    product.comboItems.forEach((item, i) => {
      if (item.variantMapping?.color) initial[i] = { color: item.variantMapping.color };
    });
    setComboVariantSelections((prev) => (Object.keys(initial).length > 0 ? { ...initial, ...prev } : prev));
  }, [product?.id, product?.isComboProduct, product?.comboItems]);

  useEffect(() => {
    if (!product?.id || !selectedVariant?.id) return;
    const flush = (variantId, seconds) => {
      if (variantId && seconds > 0) recordVariantViewTime(product.id, variantId, seconds);
    };
    if (lastVariantIdRef.current !== selectedVariant.id) {
      flush(lastVariantIdRef.current, variantSecondsRef.current);
      variantSecondsRef.current = 0;
      lastVariantIdRef.current = selectedVariant.id;
    }
    const interval = setInterval(() => { variantSecondsRef.current += 1; }, 1000);
    return () => {
      clearInterval(interval);
      flush(selectedVariant.id, variantSecondsRef.current);
    };
  }, [product?.id, selectedVariant?.id]);

  useEffect(() => {
    const sizes = hasVariants && selectedVariant?.sizes?.length
      ? selectedVariant.sizes
      : product?.mainSizes || [];
    setSelectedSize(sizes[0] || '');
  }, [hasVariants, selectedVariant, product?.mainSizes]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingInline}>
          <span className={styles.loadingDot} />
          <span>Cargando producto...</span>
        </div>
      </div>
    );
  }

  if (!product) return <div>Producto no encontrado</div>;

  const handleAddToCart = () => {
    const comboData = isCombo ? {
      variantSelections: comboVariantSelections,
      customizations: {},
      // Pasamos los datos completos de los sub-productos ya cargados desde Firestore
      // para que el checkout pueda extraer nombres reales e imágenes base por color
      subProductsData: comboSubProducts,
    } : null;
    addToCart(product, { size: selectedSize, selectedVariant: selectedVariant ?? undefined }, null, quantity, comboData);
  };

  const handleShareProduct = async () => {
    if (!user) {
      toast.error('Inicia sesión para compartir y ganar monedas');
      return;
    }
    setGeneratingLink(true);
    const { id, error } = await createReferralShare(referralCode);
    setGeneratingLink(false);

    if (error) {
      toast.error('Error al generar enlace');
      return;
    }

    const url = `${window.location.origin}/producto/${product.id}?ref=${referralCode}&shareId=${id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('¡Enlace individual copiado! Compártelo y gana monedas.'))
      .catch(() => toast.error('Error copiando al portapapeles'));
  };

  const handlePersonalize = () => {
    const params = new URLSearchParams();
    if (selectedSize) params.set('size', selectedSize);
    if (selectedVariant?.name) params.set('color', selectedVariant.name);
    if (isCombo && Object.keys(comboVariantSelections).length > 0) {
      params.set('comboSelections', JSON.stringify(comboVariantSelections));
    }
    navigate(`/editor/${product.id}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleDescriptionClick = (e) => {
    const customBtn = e.target.closest('a.custom-quill-button');
    if (customBtn) {
      const href = customBtn.getAttribute('href');
      if (href && href.startsWith('cuestionario://')) {
        e.preventDefault();
        const templateId = href.replace('cuestionario://', '');
        setCuestionarioModalTemplate(templateId);
      }
    }
  };

  const displayPrice = product.salePrice || product.price || 0;
  const regularPrice = product.salePrice ? product.price : null;
  const isCombo = isComboProduct(product);

  const discount = product?.salePrice && product?.price
    ? Math.round(((product.price - product.salePrice) / product.price) * 100)
    : 0;

  const renderComboItemSelector = (index, comboItemProduct, position = 'all') => {
    if (!comboItemProduct) return null;

    const currentSelection = comboVariantSelections[index] || {};
    const comboItemConfig = product.comboItems?.[index] || {};
    const allowedColors = comboItemConfig.variantMapping?.allowedColors;
    const allowedLower = allowedColors && Array.isArray(allowedColors) ? allowedColors.map(c => c.trim().toLowerCase()) : [];

    const fullVariantsList = Array.isArray(comboItemProduct.variants) ? comboItemProduct.variants : [];
    const displayVariantsList = allowedLower.length > 0
      ? fullVariantsList.filter(v => allowedLower.includes((v.name || '').trim().toLowerCase()))
      : fullVariantsList;

    const hasColorVariants = comboItemProduct.hasVariants && displayVariantsList.length > 0;
    const selectedVar = hasColorVariants
      ? (displayVariantsList.find(v => v.name === currentSelection.color) || displayVariantsList[0])
      : null;

    // Determine Sizes
    let availableComboSizes = [];
    if (hasColorVariants && selectedVar?.sizes) {
      availableComboSizes = selectedVar.sizes;
    } else if (!hasColorVariants && Array.isArray(comboItemProduct.mainSizes)) {
      availableComboSizes = comboItemProduct.mainSizes;
    } else if (!hasColorVariants && Array.isArray(comboItemProduct.sizes)) {
      availableComboSizes = comboItemProduct.sizes;
    }

    const showColor = hasColorVariants && displayVariantsList.some(v => !!v.name);
    const showSize = availableComboSizes.length > 0;

    // Use current selection or fallback to first available
    const displayColor = currentSelection.color || (showColor ? displayVariantsList[0].name : '');
    const displaySize = currentSelection.size || '';

    const sizeUI = showSize ? (
      <div className={styles.comboItemSelectorsWrapper}>
        <div className={styles.comboSelectGroup}>
          <span className={styles.comboSelectLabel}>
            Talla:
            {availableComboSizes.length > 4 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
          </span>
          <DraggableContainer className={styles.comboVariantOptions} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            {availableComboSizes.map(s => (
              <button
                key={s}
                className={`${styles.comboSizeButton} ${displaySize === s ? styles.comboSizeButtonActive : ''}`}
                onClick={() => {
                  setComboVariantSelections(prev => ({
                    ...prev,
                    [index]: { ...prev[index], size: s }
                  }));
                }}
              >
                {s}
              </button>
            ))}
          </DraggableContainer>
        </div>
      </div>
    ) : null;

    const colorUI = showColor ? (
      <div className={styles.comboItemSelectorsWrapper} style={{ marginBottom: 0 }}>
        <div className={styles.comboSelectGroup}>
          <span className={styles.comboSelectLabel}>
            Color:
            {displayVariantsList.length > 5 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
          </span>
          <DraggableContainer className={styles.comboVariantOptions} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            {displayVariantsList.map(v => {
              const hex = v.colorHex || getFallbackHex(v.name);
              const hasImg = !!v.imageUrl;
              return (
                <button
                  key={v.id || v.name}
                  className={`${styles.variantThumbBtn} ${displayColor === v.name ? styles.variantThumbBtnActive : ''}`}
                  onClick={() => {
                    setComboVariantSelections(prev => ({
                      ...prev,
                      [index]: { ...prev[index], color: v.name }
                    }));
                  }}
                  title={v.name}
                >
                  {hasImg ? (
                    <div className={styles.variantThumbImageWrapper}>
                      <OptimizedImage
                        src={toDirectImageUrl(v.imageUrl)}
                        cropData={v.thumbnailCrop?.percentages}
                        className={styles.variantThumbImage}
                        alt={v.name}
                      />
                    </div>
                  ) : hex ? (
                    <span className={styles.variantThumbColor} style={{ backgroundColor: hex }}></span>
                  ) : (
                    <span className={styles.variantThumbText}>{v.name}</span>
                  )}
                </button>
              );
            })}
          </DraggableContainer>
        </div>
      </div>
    ) : null;

    if (position === 'top') return sizeUI;
    if (position === 'bottom') return colorUI;

    return (
      <>
        {sizeUI}
        {colorUI}
      </>
    );
  };

  return (
    <>
      <div className={`${styles.container} ${isCombo ? styles.containerCombo : ''}`}>
        <div className={styles.imageSection} style={brandBgStyle}>
          <ProductGallery 
            product={product} 
            selectedVariant={selectedVariant}
            isCombo={isCombo}
            comboVariantSelections={comboVariantSelections}
            comboSubProducts={comboSubProducts}
            comboElement={
              isCombo ? (
                <ComboProductImage
                  comboProduct={product}
                  variantSelections={comboVariantSelections}
                  renderSelector={renderComboItemSelector}
                  className={styles.mainComboImage}
                  onProductsFetched={setComboSubProducts}
                />
              ) : null
            }
          />
        </div>

        <div className={styles.infoSection}>
          <div className={styles.productHeader}>
            <h1 className={styles.name}>{product.name}</h1>
            <div className={styles.priceContainer}>
              {regularPrice ? (
                <>
                  <span className={styles.salePrice}>S/ {displayPrice.toFixed(2)}</span>
                  <span className={styles.regularPrice}>S/ {regularPrice.toFixed(2)}</span>
                </>
              ) : (
                <span className={styles.salePrice}>S/ {displayPrice.toFixed(2)}</span>
              )}
            </div>
          </div>



          {hasVariants && variantsList.length > 0 && (
            <div className={styles.variant}>
              <div className={styles.variantLabelRow}>
                <label>Color: <span className={styles.selectedLabelValue}>{selectedVariant?.name}</span></label>
                {variantsList.length > 5 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
              </div>
              <DraggableContainer className={styles.comboVariantOptions} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                {variantsList.map((v, i) => {
                  const hex = v.colorHex || getFallbackHex(v.name);
                  const hasImg = !!v.imageUrl;
                  
                  return (
                    <button
                      key={v.id || i}
                      className={`${styles.variantThumbBtn} ${selectedVariantIndex === i ? styles.variantThumbBtnActive : ''}`}
                      onClick={() => setSelectedVariantIndex(i)}
                      title={v.name}
                    >
                      {hasImg ? (
                        <div className={styles.variantThumbImageWrapper}>
                          <OptimizedImage
                            src={toDirectImageUrl(v.imageUrl)}
                            cropData={v.thumbnailCrop?.percentages}
                            className={styles.variantThumbImage}
                            alt={v.name}
                          />
                        </div>
                      ) : hex ? (
                         <span className={styles.variantThumbColor} style={{ backgroundColor: hex }}></span>
                      ) : (
                         <span className={styles.variantThumbText}>{v.name}</span>
                      )}
                    </button>
                  );
                })}
              </DraggableContainer>
            </div>
          )}

          {availableSizes.length > 0 && (
            <div className={styles.variant}>
              <div className={styles.variantLabelRow}>
                <label>Talla: <span className={styles.selectedLabelValue}>{selectedSize}</span></label>
                {availableSizes.length > 4 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
              </div>
              <DraggableContainer className={styles.comboVariantOptions} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                {availableSizes.map(size => (
                  <button
                    key={size}
                    className={`${styles.premiumSizeButton} ${selectedSize === size ? styles.premiumSizeButtonActive : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </DraggableContainer>
            </div>
          )}

          <div className={styles.quantity}>
            <label>Cantidad:</label>
            <div className={styles.quantityControls}>
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
          </div>

          <div className={`${styles.actions} ${styles.stickyMobileActions}`}>
            {product.customizable && (
              <Button variant="primary" onClick={handlePersonalize} className={`${styles.personalizeBtn} ${styles.animatedPersonalizeBtn}`}>
                Personalizar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className={styles.addBtn}
            >
              {product.inStock ? 'Agregar al Carrito' : 'Agotado'}
            </Button>
          </div>

          {user && (
             <div className={styles.shareContainer}>
               <Button
                 variant="outline"
                 onClick={handleShareProduct}
                 disabled={generatingLink}
                 className={styles.shareBtn}
               >
                 {generatingLink ? (
                   <>
                     <span className={styles.shareIcon}>⏳</span>
                     <span className={styles.shareBtnText}>Generando...</span>
                   </>
                 ) : (
                   <>
                     <span className={styles.shareIcon}>🔗</span>
                     <span className={styles.shareBtnText}>Compartir y Ganar</span>
                   </>
                 )}
               </Button>
             </div>
          )}

          {product.description && (
            <div className={styles.description}>
              <h3>Descripción</h3>
              <div
                className={styles.richTextDescription}
                dangerouslySetInnerHTML={{ __html: product.description }}
                onClick={handleDescriptionClick}
              />
            </div>
          )}

        </div>
      </div>

      <ProductCuestionarioModal
        isOpen={!!cuestionarioModalTemplate}
        onClose={() => setCuestionarioModalTemplate(null)}
        templateId={cuestionarioModalTemplate}
        product={product}
        selectedVariant={selectedVariant}
        selectedSize={selectedSize}
        quantity={quantity}
        comboVariantSelections={comboVariantSelections}
      />
    </>
  );
};

export default ProductDetail;
