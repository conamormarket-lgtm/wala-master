import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGlobalToast } from '../../../../contexts/ToastContext';
import { useCart } from '../../../../contexts/CartContext';
import { createReferralShare } from '../../../../services/referrals';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import { isComboProduct } from '../../../../utils/comboProductUtils';
import { recordProductClick, recordVariantViewTime } from '../../../../utils/productVariantBehavior';
import { getFallbackHex } from '../../../../utils/colors';
import { getBrands } from '../../../../services/brands';
import { useImagePreloader } from '../../../../components/common/OptimizedImage/OptimizedImage';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import ComboProductImage from '../ComboProductImage/ComboProductImage';
import DraggableContainer from '../../../../components/common/DraggableContainer/DraggableContainer';
import ProductCuestionarioModal from '../ProductCuestionarioModal/ProductCuestionarioModal';
import ProductReviews from '../ProductReviews';
import { Truck, RefreshCw, ShieldCheck, Share2 } from 'lucide-react';
import styles from './ProductDetail.module.css';

// ─── helpers ─────────────────────────────────────────────────────────────────
const getCategory = (product, cats) => {
  const ids = product?.categories ?? (product?.category ? [product.category] : []);
  const found = (cats || []).filter(c => ids.includes(c.id)).map(c => c.name).filter(Boolean);
  return found[0] || product?.category || '';
};

const buildImages = (product, variant, isCombo, comboSels, comboProd) => {
  const seen = new Set();
  const list = [];
  const push = (url, extra = {}) => {
    const u = toDirectImageUrl(url);
    if (u && !u.includes('undefined') && !seen.has(u)) { seen.add(u); list.push({ url: u, ...extra }); }
  };

  if (isCombo) {
    push(product?.comboPreviewImage || product?.mainImage || '', { isComboView: true });
    Object.keys(comboProd || {}).forEach(idx => {
      const sub = comboProd[idx];
      const sel = comboSels?.[idx];
      if (!sub) return;
      const cc = sel?.color?.trim().toLowerCase() || '';
      const mv = cc && sub.variants?.find(v => v.name?.trim().toLowerCase() === cc);
      if (mv) {
        (sub.customizationViews || []).forEach(view => {
          const k = Object.keys(view.imagesByColor || {}).find(k => k.trim().toLowerCase() === cc);
          if (k) push(view.imagesByColor[k]);
          if (view.hasBackSide) {
            const bk = Object.keys(view.backSide?.imagesByColor || {}).find(k => k.trim().toLowerCase() === cc);
            if (bk) push(view.backSide.imagesByColor[bk]);
          }
        });
        (mv.galleryImages || []).forEach(u => push(u));
        if (!mv.galleryImages?.length && mv.imageUrl) push(mv.imageUrl);
      } else {
        (sub.images || []).forEach(u => push(u));
        if (sub.mainImage) push(sub.mainImage);
      }
    });
    (product?.images || []).forEach(u => push(u));
  } else {
    const cc = variant?.name?.trim().toLowerCase() || '';
    if (variant) {
      (product?.customizationViews || []).forEach(view => {
        const k = Object.keys(view.imagesByColor || {}).find(k => k.trim().toLowerCase() === cc);
        if (k) push(view.imagesByColor[k]);
        if (view.hasBackSide) {
          const bk = Object.keys(view.backSide?.imagesByColor || {}).find(k => k.trim().toLowerCase() === cc);
          if (bk) push(view.backSide.imagesByColor[bk]);
        }
      });
      if (variant.imageUrl) push(variant.imageUrl);
      if (variant.galleryImages?.length) variant.galleryImages.forEach(u => push(u));
      else if (variant.images?.length) variant.images.forEach(u => push(u));
      else { (product?.images || []).forEach(u => push(u)); }
    } else {
      if (product?.mainImage) push(product.mainImage);
      (product?.images || []).forEach(u => push(u));
    }
  }
  if (!list.length) list.push({ url: 'https://via.placeholder.com/600x750', isComboView: false });
  return list;
};

// ─── Gallery ─────────────────────────────────────────────────────────────────
const Gallery = ({ images, activeIdx, setActiveIdx, showCombo, comboEl }) => {
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const active = images[activeIdx] || images[0];

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className={styles.gallery}>
      {images.length > 1 && (
        <div className={styles.thumbStrip}>
          {images.map((img, i) => (
            <button
              key={i}
              className={`${styles.thumb} ${activeIdx === i ? styles.thumbActive : ''}`}
              onClick={() => setActiveIdx(i)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div
        className={`${styles.mainFrame} ${showCombo ? styles.mainFrameCombo : ''}`}
        onMouseEnter={() => !showCombo && setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMove}
      >
        {showCombo ? (
          <div className={styles.comboWrap}>{comboEl}</div>
        ) : (
          <img
            src={active.url}
            alt="Producto"
            className={styles.mainImg}
            style={zoom ? { transform: 'scale(2.4)', transformOrigin: `${pos.x}% ${pos.y}%` } : {}}
            fetchpriority="high"
            loading="eager"
          />
        )}
        {!zoom && !showCombo && <span className={styles.zoomHint}>🔍 Hover para zoom</span>}
      </div>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className={styles.skeleton}>
    <div className={styles.skeletonGallery} />
    <div className={styles.skeletonInfo}>
      {[40, 85, 30, 100, 100].map((w, i) => (
        <div key={i} className={styles.skeletonLine} style={{ width: `${w}%` }} />
      ))}
    </div>
  </div>
);

// ─── ProductDetail ────────────────────────────────────────────────────────────
const ProductDetail = ({ product, loading, categories = [] }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, userProfile } = useAuth();
  const toast = useGlobalToast();

  const [variantIdx, setVariantIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [qty, setQty] = useState(1);
  const [comboSels, setComboSels] = useState({});
  const [comboProd, setComboProd] = useState({});
  const [imgIdx, setImgIdx] = useState(0);
  const [cuestionario, setCuestionario] = useState(null);
  const [sharing, setSharing] = useState(false);

  const secsRef = useRef(0);
  const lastVariantRef = useRef(null);

  const isCombo = isComboProduct(product);
  const hasVariants = Boolean(product?.hasVariants);
  const variants = hasVariants ? (Array.isArray(product?.variants) ? product.variants : []) : [];
  const selectedVariant = hasVariants && variants[variantIdx] ? variants[variantIdx] : null;
  const sizes = hasVariants ? (selectedVariant?.sizes || []) : (product?.mainSizes || []);
  const category = getCategory(product, categories);
  const displayPrice = product?.salePrice || product?.price || 0;
  const originalPrice = product?.salePrice ? product?.price : null;
  const discount = originalPrice ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100) : 0;
  const referralCode = userProfile?.referralCode || (user?.uid ? `KS-${user.uid.substring(0, 6).toUpperCase()}` : '');

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data,
    staleTime: 300_000,
  });
  const brand = brands?.find(b => b.id === product?.brandId);

  const images = React.useMemo(
    () => product ? buildImages(product, selectedVariant, isCombo, comboSels, comboProd) : [],
    [product, selectedVariant, isCombo, comboSels, comboProd]
  );

  const allUrls = React.useMemo(() => {
    if (!product) return [];
    const s = new Set();
    const walk = v => {
      if (!v) return;
      if (typeof v === 'string' && v.startsWith('http')) s.add(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(product);
    return [...s];
  }, [product]);

  useImagePreloader(allUrls);

  useEffect(() => { setImgIdx(0); }, [selectedVariant?.id, selectedVariant?.name]);
  useEffect(() => { if (product?.id) recordProductClick(product.id); }, [product?.id]);

  useEffect(() => {
    if (!product?.id || !selectedVariant?.id) return;
    const flush = (id, s) => { if (id && s > 0) recordVariantViewTime(product.id, id, s); };
    if (lastVariantRef.current !== selectedVariant.id) {
      flush(lastVariantRef.current, secsRef.current);
      secsRef.current = 0;
      lastVariantRef.current = selectedVariant.id;
    }
    const iv = setInterval(() => secsRef.current++, 1000);
    return () => { clearInterval(iv); flush(selectedVariant.id, secsRef.current); };
  }, [product?.id, selectedVariant?.id]);

  useEffect(() => {
    if (!isCombo || !product?.comboItems?.length) return;
    const init = {};
    product.comboItems.forEach((item, i) => { if (item.variantMapping?.color) init[i] = { color: item.variantMapping.color }; });
    if (Object.keys(init).length) setComboSels(prev => ({ ...init, ...prev }));
  }, [product?.id, isCombo]);

  useEffect(() => { setSelectedSize(sizes[0] || ''); }, [selectedVariant?.id, JSON.stringify(sizes)]);

  // ── Handlers
  const handleAddToCart = () => {
    addToCart(
      product,
      { size: selectedSize, selectedVariant: selectedVariant ?? undefined },
      null,
      qty,
      isCombo ? { variantSelections: comboSels, customizations: {}, subProductsData: comboProd } : null
    );
    toast.success('¡Agregado al carrito!');
  };

  const handlePersonalize = () => {
    const p = new URLSearchParams();
    if (selectedSize) p.set('size', selectedSize);
    if (selectedVariant?.name) p.set('color', selectedVariant.name);
    if (isCombo && Object.keys(comboSels).length) p.set('comboSelections', JSON.stringify(comboSels));
    navigate(`/editor/${product.id}${p.toString() ? `?${p}` : ''}`);
  };

  const handleShare = async () => {
    if (!user) { toast.error('Inicia sesión para compartir y ganar monedas'); return; }
    setSharing(true);
    const { id, error } = await createReferralShare(referralCode);
    setSharing(false);
    if (error) { toast.error('Error al generar enlace'); return; }
    const url = `${window.location.origin}/producto/${product.id}?ref=${referralCode}&shareId=${id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('¡Enlace copiado! Compártelo y gana monedas.'))
      .catch(() => toast.error('Error al copiar'));
  };

  const handleDescClick = e => {
    const btn = e.target.closest('a.custom-quill-button');
    if (btn?.getAttribute('href')?.startsWith('cuestionario://')) {
      e.preventDefault();
      setCuestionario(btn.getAttribute('href').replace('cuestionario://', ''));
    }
  };

  // ── Combo selector renderer
  const renderComboSelector = (index, sub, position = 'all') => {
    if (!sub) return null;
    const sel = comboSels[index] || {};
    const cfg = product.comboItems?.[index] || {};
    const allowed = cfg.variantMapping?.allowedColors?.map(c => c.trim().toLowerCase()) || [];
    const allVars = Array.isArray(sub.variants) ? sub.variants : [];
    const vars = allowed.length ? allVars.filter(v => allowed.includes(v.name?.trim().toLowerCase())) : allVars;
    const hasColors = sub.hasVariants && vars.length > 0;
    const selVar = hasColors ? (vars.find(v => v.name === sel.color) || vars[0]) : null;
    const cSizes = hasColors ? (selVar?.sizes || []) : (sub.mainSizes || sub.sizes || []);

    const sizeUI = cSizes.length > 0 && (
      <div className={styles.selectorGroup}>
        <span className={styles.selectorLabel}>Talla</span>
        <DraggableContainer className={styles.pillRow}>
          {cSizes.map(s => (
            <button key={s} className={`${styles.sizePill} ${sel.size === s ? styles.sizePillActive : ''}`}
              onClick={() => setComboSels(p => ({ ...p, [index]: { ...p[index], size: s } }))}>
              {s}
            </button>
          ))}
        </DraggableContainer>
      </div>
    );

    const colorUI = hasColors && (
      <div className={styles.selectorGroup}>
        <span className={styles.selectorLabel}>Color: <em>{sel.color || vars[0]?.name}</em></span>
        <DraggableContainer className={styles.swatchRow}>
          {vars.map(v => {
            const hex = v.colorHex || getFallbackHex(v.name);
            return (
              <button key={v.id || v.name}
                className={`${styles.swatch} ${sel.color === v.name ? styles.swatchActive : ''}`}
                onClick={() => setComboSels(p => ({ ...p, [index]: { ...p[index], color: v.name } }))}
                title={v.name}>
                {v.imageUrl
                  ? <OptimizedImage src={toDirectImageUrl(v.imageUrl)} cropData={v.thumbnailCrop?.percentages} alt={v.name} className={styles.swatchImg} />
                  : <span className={styles.swatchColor} style={{ background: hex }} />}
              </button>
            );
          })}
        </DraggableContainer>
      </div>
    );

    if (position === 'top') return sizeUI;
    if (position === 'bottom') return colorUI;
    return <>{sizeUI}{colorUI}</>;
  };

  // ── Render
  if (loading) return <Skeleton />;
  if (!product) return <div className={styles.notFound}>Producto no encontrado.</div>;

  const activeImage = images[imgIdx] || images[0];
  const showCombo = isCombo && Boolean(activeImage?.isComboView);

  return (
    <>
      <div className={`${styles.pdp} ${isCombo ? styles.pdpCombo : ''}`}>

        {/* ── Gallery ── */}
        <div className={styles.galleryCol}>
          <Gallery
            images={images}
            activeIdx={imgIdx}
            setActiveIdx={setImgIdx}
            showCombo={showCombo}
            comboEl={
              isCombo ? (
                <ComboProductImage
                  comboProduct={product}
                  variantSelections={comboSels}
                  renderSelector={renderComboSelector}
                  onProductsFetched={setComboProd}
                />
              ) : null
            }
          />
        </div>

        {/* ── Info ── */}
        <div className={styles.infoCol}>

          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <a href="/">Inicio</a>
            <span>/</span>
            {category && <><a href="/">{category}</a><span>/</span></>}
            <span>{product.name}</span>
          </nav>

          {/* Title + share */}
          <div className={styles.titleRow}>
            <h1 className={styles.pdpTitle}>{product.name}</h1>
            {user && (
              <button className={styles.shareIconBtn} onClick={handleShare} disabled={sharing} title="Compartir y ganar monedas">
                <Share2 size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>

          {/* Brand */}
          {brand?.name && (
            <span className={styles.brandBadge} style={brand.bgColor ? { background: brand.bgColor } : {}}>
              {brand.name}
            </span>
          )}

          {/* Price */}
          <div className={styles.priceRow}>
            <span className={styles.price}>S/ {displayPrice.toFixed(2)}</span>
            {originalPrice && (
              <>
                <span className={styles.priceOriginal}>S/ {originalPrice.toFixed(2)}</span>
                <span className={styles.discountBadge}>−{discount}%</span>
              </>
            )}
          </div>

          <hr className={styles.divider} />

          {/* Color selector */}
          {hasVariants && variants.length > 0 && (
            <div className={styles.selectorGroup}>
              <span className={styles.selectorLabel}>Color: <em>{selectedVariant?.name}</em></span>
              <DraggableContainer className={styles.swatchRow}>
                {variants.map((v, i) => {
                  const hex = v.colorHex || getFallbackHex(v.name);
                  return (
                    <button key={v.id || i}
                      className={`${styles.swatch} ${variantIdx === i ? styles.swatchActive : ''}`}
                      onClick={() => setVariantIdx(i)} title={v.name}>
                      {v.imageUrl
                        ? <OptimizedImage src={toDirectImageUrl(v.imageUrl)} cropData={v.thumbnailCrop?.percentages} alt={v.name} className={styles.swatchImg} />
                        : <span className={styles.swatchColor} style={{ background: hex }} />}
                    </button>
                  );
                })}
              </DraggableContainer>
            </div>
          )}

          {/* Size selector */}
          {sizes.length > 0 && (
            <div className={styles.selectorGroup}>
              <span className={styles.selectorLabel}>Talla: <em>{selectedSize}</em></span>
              <DraggableContainer className={styles.pillRow}>
                {sizes.map(s => (
                  <button key={s}
                    className={`${styles.sizePill} ${selectedSize === s ? styles.sizePillActive : ''}`}
                    onClick={() => setSelectedSize(s)}>
                    {s}
                  </button>
                ))}
              </DraggableContainer>
            </div>
          )}

          {/* Quantity */}
          <div className={styles.qtyRow}>
            <span className={styles.selectorLabel}>Cantidad</span>
            <div className={styles.qtyControl}>
              <button className={styles.qtyBtn} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className={styles.qtyValue}>{qty}</span>
              <button className={styles.qtyBtn} onClick={() => setQty(q => q + 1)}>+</button>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className={styles.ctaStack}>
            {product.inStock ? (
              <button className={styles.btnPrimary} onClick={handleAddToCart}>
                Agregar al carrito
              </button>
            ) : (
              <button className={styles.btnPrimary} disabled>Agotado</button>
            )}
            {product.customizable && (
              <button className={styles.btnOutline} onClick={handlePersonalize}>
                Personalizar
              </button>
            )}
          </div>

          {/* Trust badges */}
          <div className={styles.trustRow}>
            <div className={styles.trustItem}><Truck size={14} /><span>Envío a todo el país</span></div>
            <div className={styles.trustItem}><RefreshCw size={14} /><span>Cambios y devoluciones</span></div>
            <div className={styles.trustItem}><ShieldCheck size={14} /><span>Pago seguro</span></div>
          </div>

          {/* Description */}
          {product.description && (
            <details className={styles.accordion} open>
              <summary className={styles.accordionSummary}>Descripción</summary>
              <div
                className={styles.richText}
                dangerouslySetInnerHTML={{ __html: product.description }}
                onClick={handleDescClick}
              />
            </details>
          )}

          {/* Reviews */}
          <ProductReviews productId={product.id} />

        </div>
      </div>

      <ProductCuestionarioModal
        isOpen={!!cuestionario}
        onClose={() => setCuestionario(null)}
        templateId={cuestionario}
        product={product}
        selectedVariant={selectedVariant}
        selectedSize={selectedSize}
        quantity={qty}
        comboVariantSelections={comboSels}
      />
    </>
  );
};

export default ProductDetail;
