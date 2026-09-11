// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getBrands } from '../../../../services/brands';
import { useCart } from '../../../../contexts/CartContext';
import { useWishlist } from '../../../../contexts/WishlistContext';
import { useGlobalToast } from '../../../../contexts/ToastContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { T } from '../../../../i18n/useTranslatedText';
import { toThumbnailImageUrl } from '../../../../utils/imageUrl';
import { isComboProduct } from '../../../../utils/comboProductUtils';
import { useProductThumbnailVariant } from '../../../../hooks/useProductThumbnailVariant';
import ComboProductImage from '../ComboProductImage/ComboProductImage';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import { Badge } from '../../../../components/ui';
import { fadeUp, neutralVariants, useReducedMotionSafe } from '../../../../theme/motion';
import styles from './PremiumProductCard.module.css';

// Raíz animada de la tarjeta: el <Link> sigue siendo el elemento raíz (no se
// envuelve en ningún div que rompa el grid del catálogo); solo lo dotamos de
// motion para la entrada al viewport. Se crea UNA vez a nivel de módulo para no
// recrear el componente animado en cada render (framer-motion lo penaliza).
const MotionLink = motion(Link);

const hexToRgba = (hex, alpha) => {
  const cleanHex = hex ? hex.replace('#', '') : 'ffffff';
  const r = parseInt(cleanHex.length === 3 ? cleanHex.charAt(0).repeat(2) : cleanHex.substring(0, 2), 16) || 255;
  const g = parseInt(cleanHex.length === 3 ? cleanHex.charAt(1).repeat(2) : cleanHex.substring(2, 4), 16) || 255;
  const b = parseInt(cleanHex.length === 3 ? cleanHex.charAt(2).repeat(2) : cleanHex.substring(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const PremiumProductCard = React.memo(({ product, categories = [], isAboveFold = false, currentBrandId = null }) => {
  const { addToCart } = useCart();
  const queryClient = useQueryClient();
  const { thumbnailImageUrl, recordImpression, variantIndex } = useProductThumbnailVariant(product);
  const imageContainerRef = useRef(null);
  const impressionRecorded = useRef(false);
  // Mobile: qué foto se ve dentro de la tarjeta (false = principal, true =
  // secundaria). En desktop el swap sigue siendo puramente CSS por :hover.
  // En touch NO existe ese hover, y un swipe manual sobre la imagen (lo que
  // había antes) terminaba peleando con el tap-para-entrar-a-la-ficha —
  // llegó a bloquear la tarjeta entera—. Se cambia a que la propia tarjeta
  // alterne sola mientras está en pantalla (ver el efecto de abajo): nadie
  // tiene que gesticular nada, y el tap normal queda completamente libre.
  const [showSecondaryImage, setShowSecondaryImage] = useState(false);
  const [isCardInView, setIsCardInView] = useState(false);

  const { isFavorite, toggleFavorite } = useWishlist();
  const { addToast } = useGlobalToast();
  const { t } = useLanguage();

  // Respeta prefers-reduced-motion: con menos movimiento, entrada de solo opacity.
  const reducido = useReducedMotionSafe();
  const variantsEntrada = reducido ? neutralVariants : fadeUp;

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await getBrands();
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const productBrand = brandsData?.find(b => b.id === product.brandId);
  // Insignia con el logo de la marca del producto: solo tiene sentido en
  // listados MIXTOS (home, "Ofertas para ti", etc.) donde conviven productos
  // de varias marcas de Walá. Dentro de la propia página de esa marca
  // (currentBrandId) es redundante — ya es obvio en qué marca estás — así
  // que ahí se omite aunque el producto tenga logo.
  const showBrandBadge = !currentBrandId && !!productBrand?.logoUrl;
  const brandBgColor = productBrand?.bgColor;
  const brandBgImage = productBrand?.bgImage;
  const brandBgOpacity = productBrand?.bgOpacity ?? 100;

  const brandBgStyle = (brandBgColor || brandBgImage) ? {
    backgroundColor: brandBgColor || 'transparent',
    backgroundImage: brandBgImage 
      ? `linear-gradient(${hexToRgba(brandBgColor, 1 - brandBgOpacity/100)}, ${hexToRgba(brandBgColor, 1 - brandBgOpacity/100)}), url(${brandBgImage})` 
      : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

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

  // ¿Hay algo que el cliente TENGA que elegir antes de comprar?
  // El botón rápido llamaba a addToCart(product, {}, ...) con la variante vacía,
  // así que metía la línea al carrito SIN color y SIN talla: el pedido salía sin
  // saber qué despachar. Cuando hay colores, tallas o piezas de combo, el botón
  // deja de añadir a ciegas y abre la ficha, que es donde se eligen.
  const necesitaElegir = Boolean(
    (product?.hasVariants && product?.variants?.length > 0) ||
    product?.mainSizes?.length > 0 ||
    (isComboProduct(product) && product?.comboItems?.length > 0)
  );

  const handleAddToCart = useCallback((e) => {
    // Sin preventDefault el clic sube al <Link> raíz de la tarjeta y navega a la
    // ficha del producto; no hace falta useNavigate.
    if (necesitaElegir) return;
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, {}, null, 1);
  }, [addToCart, product, necesitaElegir]);

  const isFav = isFavorite(product.id);
  
  const handleToggleFavorite = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await toggleFavorite(product);
    if (result && result.error) {
      addToast(result.error, 'error');
    } else if (result && result.success) {
      addToast(isFav ? 'Eliminado de tu lista de deseos' : 'Agregado a tu lista de deseos', 'success');
    }
  }, [product, toggleFavorite, addToast, isFav]);

  const handlePrefetch = useCallback(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    queryClient.setQueryData(['product', product.id], product);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, product.id, product]);

  // Mantener presionada la tarjeta (long-press) dispara el menu contextual
  // nativo del navegador -"Abrir en pestaña nueva"/"Guardar imagen"- porque
  // es un link con una foto adentro. En Chrome con emulacion tactil (y en
  // Android real) ese gesto deja el tap-to-click "colgado": el navegador
  // entra en modo "esto es un long-press, no un tap" y el click que
  // normalmente navegaria nunca llega a dispararse, dejando la tarjeta -y a
  // veces el resto de la fila- sin responder a nada que no sea scroll hasta
  // refrescar. Se suprime el menu contextual en toda la tarjeta para que un
  // long-press no tenga nada que abrir.
  const handleContextMenu = useCallback((e) => { e.preventDefault(); }, []);

  const isCombo = isComboProduct(product);
  // Piezas a mostrar en el hover-reveal del combo (ver overlay más abajo).
  // Se cortan a 3 + "+N" en vez de listarlas todas para que quepan sin
  // amontonarse en una tarjeta de catálogo (mucho más chica que la ficha).
  const comboAllItems = isCombo ? (product?.comboItems || []) : [];
  const comboPreviewItems = comboAllItems.slice(0, 3);
  const comboExtraCount = Math.max(0, comboAllItems.length - comboPreviewItems.length);

  // Determinar la variante principal
  const principalVariant = product?.variants?.find(v => String(v.id) === String(product.defaultVariantId)) || product?.variants?.[0];

  const cardImageUrl =
    thumbnailImageUrl ||
    principalVariant?.imageUrl ||
    product?.mainImage ||
    product?.images?.[0] ||
    '';

  const secondaryImageUrl = principalVariant?.images?.[0] || principalVariant?.galleryImages?.[0] || product?.images?.[1] || null;
  // Encuadre propio de la imagen de hover (si el admin lo definió para esa foto).
  const secondaryCrop = secondaryImageUrl ? principalVariant?.imagesCrops?.[secondaryImageUrl]?.percentages : undefined;
  // En desktop el swap a la segunda foto lo dispara el :hover del mouse. En
  // touch no hay hover, así que sin esto la segunda foto nunca se veía en
  // mobile.
  const hasImageSwap = !isCombo && !!secondaryImageUrl;

  // Detecta cuándo la tarjeta está realmente en pantalla, para alternar las
  // fotos solo mientras el usuario la puede ver (y no gastar timers de
  // decenas de tarjetas fuera de vista a la vez).
  useEffect(() => {
    if (!hasImageSwap) return undefined;
    const el = imageContainerRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => setIsCardInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasImageSwap]);

  // La tarjeta alterna sola entre la foto principal y la secundaria mientras
  // está visible — sin gestos que el usuario tenga que descubrir ni que
  // puedan pelear con el tap-para-entrar-a-la-ficha (un swipe manual acá
  // llegó a bloquear la tarjeta entera). Respeta "menos movimiento".
  useEffect(() => {
    if (!hasImageSwap || !isCardInView || reducido) {
      setShowSecondaryImage(false);
      return undefined;
    }
    const id = setInterval(() => setShowSecondaryImage((v) => !v), 2200);
    return () => clearInterval(id);
  }, [hasImageSwap, isCardInView, reducido]);

  const fallbackImageUrl = toThumbnailImageUrl(
    principalVariant?.imageUrl ||
    product?.mainImage ||
    product?.images?.[0] ||
    ''
  );

  const getProductStats = (id) => {
    const defaultStats = { sold: 100, rating: '4.8', reviews: 45 };
    if (!id) return defaultStats;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    const sold = 50 + (absHash % 2000); 
    const ratingRaw = 4.5 + ((absHash % 5) / 10);
    const rating = ratingRaw.toFixed(1);
    const reviews = 5 + (absHash % 300);
    return { sold, rating, reviews };
  };

  // eslint-disable-next-line no-unused-vars
  const stats = getProductStats(product?.id);

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
    <MotionLink
      to={`/producto/${product.id}`}
      className={styles.card}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      onContextMenu={handleContextMenu}
      variants={variantsEntrada}
      initial={reducido ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
    >
      <div
        className={`${styles.imageContainer} ${showSecondaryImage ? styles.showSecondary : ''}`}
        ref={imageContainerRef}
        style={brandBgStyle}
      >
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
                cropData={secondaryCrop}
              />
            )}
          </>
        )}

        {/* Puntitos que marcan cuál de las dos fotos se ve mientras alternan
            solas (ver el efecto de arriba). Solo en dispositivos sin hover
            real: en desktop la pista de que hay una 2da foto ya es el propio
            hover. */}
        {hasImageSwap && (
          <div className={styles.imageDots} aria-hidden="true">
            <span className={`${styles.imageDot} ${!showSecondaryImage ? styles.imageDotActive : ''}`} />
            <span className={`${styles.imageDot} ${showSecondaryImage ? styles.imageDotActive : ''}`} />
          </div>
        )}

        {/* Combo: antes el hover no hacía nada distinto a un producto suelto
            -sin "dinamismo"-. Ahora, al pasar el mouse, se revela qué trae
            el conjunto (miniatura + nombre de cada pieza), usando datos que
            YA vienen en product.comboItems (sin fetch extra por tarjeta). */}
        {isCombo && comboPreviewItems.length > 0 && (
          <div className={styles.comboRevealOverlay}>
            <span className={styles.comboRevealLabel}>{t('card.incluye', 'Incluye')}</span>
            <div className={styles.comboRevealItems}>
              {comboPreviewItems.map((item, i) => (
                <div key={item.productId || i} className={styles.comboRevealItem}>
                  <span className={styles.comboRevealThumb}>
                    {item.imageUrl
                      ? <img src={toThumbnailImageUrl(item.imageUrl)} alt="" loading="lazy" />
                      : <span className={styles.comboRevealThumbFallback}>{(item.name || '?').charAt(0)}</span>}
                  </span>
                  <span className={styles.comboRevealName}><T>{item.name}</T></span>
                </div>
              ))}
              {comboExtraCount > 0 && (
                <div className={styles.comboRevealItem}>
                  <span className={`${styles.comboRevealThumb} ${styles.comboRevealMore}`}>+{comboExtraCount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Badges - Nude Project / Gymshark style */}
        <div className={styles.badges}>
          {(typeof product.inStock === 'number' && product.inStock > 0) && (
            <span className={styles.badgeSold}>{product.inStock} {t('card.disponibles', 'disponibles')}</span>
          )}
          {isNew && <span className={styles.badgeNew}>{t('card.nuevo', 'NUEVO')}</span>}
          {product.salePrice && (
            <Badge tone="danger" variant="solid" size="sm">{t('card.oferta', 'OFERTA')}</Badge>
          )}
          {!product.inStock && <span className={styles.badgeOut}>{t('card.agotado', 'Agotado')}</span>}
        </div>

        {/* Insignia de marca: solo en listados mixtos (ver showBrandBadge) */}
        {showBrandBadge && (
          <span className={styles.brandBadge} title={productBrand.name}>
            <img src={productBrand.logoUrl} alt={productBrand.name || ''} loading="lazy" />
          </span>
        )}

        {/* Favorite Icon */}
        <button
          className={`${styles.favoriteBtn} ${isFav ? styles.favoriteBtnActive : ''}`}
          onClick={handleToggleFavorite}
          aria-label={t('card.favorito', 'Agregar a favoritos')}
        >
          <svg viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
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
            {!necesitaElegir && <span className={styles.quickAddIcon}>+</span>}
            <span className={styles.quickAddText}>
              {necesitaElegir
                ? t('cta.chooseOptions', 'Elegir color y talla')
                : t('cta.addToCart', 'Al carrito')}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.titleRow}>
          {/* Nombre dinámico (BD): se traduce con <T> manteniendo español como fallback. */}
          <h3 className={styles.title}><T>{product.name}</T></h3>
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
        {/* Categoría dinámica (BD) -> <T>; fallbacks estáticos -> t(). */}
        <div className={styles.subtitle}>
          {categories.length > 0
            ? <T>{categories[0].name}</T>
            : (product.customizable ? t('card.personalizable', 'Personalizable') : t('card.essential', 'Esencial'))}
        </div>
      </div>
    </MotionLink>
  );
});

export default PremiumProductCard;
