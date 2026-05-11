import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProduct } from '../../../services/products';
import { toThumbnailImageUrl } from '../../../utils/imageUrl';
import { useProductThumbnailVariant } from '../../../hooks/useProductThumbnailVariant';
import ComboProductImage from '../../Tienda/components/ComboProductImage/ComboProductImage';
import { DomOverlay } from '../../Tienda/components/ComboProductImage/ComboProductImageWithDesign';
import OptimizedImage from '../../../components/common/OptimizedImage/OptimizedImage';
import styles from '../MisCreacionesPage.module.css';

const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  try {
    const date = typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : timestamp.seconds
        ? new Date(timestamp.seconds * 1000)
        : null;
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const MiCreacionCard = ({ design, isPurchased }) => {
  const { data: productResponse, isLoading } = useQuery({
    queryKey: ['product', design.productId],
    queryFn: () => getProduct(design.productId),
    enabled: !!design.productId
  });

  const product = productResponse?.data;
  const isCombo = product?.isComboProduct || product?.comboItems?.length > 0;
  
  // Utilizar la lógica de miniaturas de la tienda
  const { thumbnailImageUrl } = useProductThumbnailVariant(product);
  
  const handlePrefetch = () => {}; // Si deseamos prefetch

  if (isLoading || !product) {
    return (
      <li className={`${styles.cardItem} ${styles.skeletonCard}`}>
        <div className={styles.skeletonThumb} />
        <div className={styles.cardBody}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonDate} />
          <div className={styles.skeletonLink} />
        </div>
      </li>
    );
  }

  // Combinamos la customización guardada en el diseño con el producto original para que ComboProductImage la pre-renderize si es combo
  const effectiveProductForCombo = isCombo ? {
    ...product,
    comboItemCustomization: design.isUserComboDesign && design.comboItemCustomization 
      ? design.comboItemCustomization 
      : product.comboItemCustomization
  } : product;

  // Lógica de imágenes para productos normales
  // Tratamos de obtener la imagen base del diseño, usando miniatura
  const cardImageUrl = thumbnailImageUrl || product?.mainImage || product?.images?.[0] || '';
  
  // Obtenemos las capas guardadas si es producto normal
  let baseLayers = [];
  if (!isCombo) {
    if (design.layersByView && Object.keys(design.layersByView).length > 0) {
      // Tomamos la primera vista por defecto que tenga capas
      baseLayers = Object.values(design.layersByView).find(l => Array.isArray(l) && l.length > 0) || [];
    } else if (design.layers && Array.isArray(design.layers)) {
      baseLayers = design.layers;
    }
  }

  // Precios
  const priceDisplay = typeof product.price === 'number' ? `S/ ${product.price.toFixed(2)}` : '';
  const salePriceDisplay = typeof product.salePrice === 'number' ? `S/ ${product.salePrice.toFixed(2)}` : '';

  return (
    <li className={styles.cardItem}>
      <Link to={`/editor/${design.productId}?designId=${design.id}`} className={styles.thumbWrapper} style={{ display: 'block', position: 'relative', background: '#fff' }}>
        {isCombo ? (
          <div style={{ pointerEvents: 'none' }}>
            <ComboProductImage
              comboProduct={effectiveProductForCombo}
              variantSelections={{}} 
              isThumbnail={true}
              className={styles.comboThumb}
            />
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1', backgroundColor: '#fff' }}>
             {baseLayers.length > 0 ? (
               <DomOverlay baseImageUrl={cardImageUrl} layers={baseLayers} />
             ) : (
               <OptimizedImage
                 src={toThumbnailImageUrl(cardImageUrl)}
                 alt={design.productName || product.name}
                 objectFit="contain"
                 className={styles.plainThumbImg}
                 showSkeleton={false}
               />
             )}
          </div>
        )}
      </Link>
      
      <div className={styles.cardBody}>
        <div className={styles.cardHeaderInfo} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
           <h3 className={styles.cardTitle} style={{ margin: 0 }}>{design.name || 'Sin nombre'}</h3>
           {isPurchased && (
             <span title="Este diseño ya fue comprado" style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
               COMPRADO
             </span>
           )}
        </div>
        
        <div style={{ fontSize: '0.8125rem', color: 'var(--gris-texto-principal)', marginBottom: '0.25rem', fontWeight: 500 }}>
          {product.name}
        </div>
        
        <p className={styles.cardDate}>{formatDate(design.updatedAt || design.createdAt)}</p>
        
        <div style={{ flexGrow: 1 }} />
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               {product.salePrice ? (
                 <>
                   <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--rojo-secundario)' }}>{salePriceDisplay}</span>
                   <span style={{ fontSize: '0.8rem', textDecoration: 'line-through', color: 'var(--gris-texto-secundario)' }}>{priceDisplay}</span>
                 </>
               ) : (
                 <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gris-texto-principal)' }}>{priceDisplay}</span>
               )}
            </div>
            
            <Link
              to={`/editor/${design.productId || 'unknown'}?designId=${design.id}`}
              className={styles.cardLink}
            >
              Seguir editando
            </Link>
        </div>
      </div>
    </li>
  );
};

export default MiCreacionCard;
