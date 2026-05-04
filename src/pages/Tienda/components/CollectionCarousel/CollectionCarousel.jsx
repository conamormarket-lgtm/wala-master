import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductsByCollection } from '../../../../services/products';
import { getCollectionById } from '../../../../services/collections';
import PremiumProductCard from '../PremiumProductCard/PremiumProductCard';
import styles from './CollectionCarousel.module.css';

const CollectionCarousel = ({ title, collectionName, categories }) => {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['collection-products', collectionName],
    queryFn: async () => {
      if (!collectionName) return [];
      const { data, error: err } = await getProductsByCollection(collectionName);
      if (err) throw new Error(err);
      return data;
    },
    enabled: !!collectionName,
    staleTime: 5 * 60 * 1000,
  });

  const { data: collectionDoc } = useQuery({
    queryKey: ['collection-details', collectionName],
    queryFn: async () => {
      if (!collectionName) return null;
      const { data, error: err } = await getCollectionById(collectionName);
      if (err && err !== 'Documento no encontrado') throw new Error(err);
      return data;
    },
    enabled: !!collectionName && (!title || title === 'Nuestra Colección'),
    staleTime: 60 * 60 * 1000,
  });

  if (!collectionName) return null;

  const validProducts = products && Array.isArray(products) ? products.filter(p => p.visible !== false) : [];
  
  const displayTitle = (title === 'Nuestra Colección' ? '' : title) || collectionDoc?.name;

  if (isLoading) {
    return (
      <div className={styles.carouselContainer}>
        {displayTitle && <h2 className={styles.carouselTitle}>{displayTitle}</h2>}
        <div className={styles.loadingText}>Cargando colección...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.carouselContainer}>
        {displayTitle && <h2 className={styles.carouselTitle}>{displayTitle}</h2>}
        <div className={styles.errorText}>No se pudo cargar la colección</div>
      </div>
    );
  }

  if (validProducts.length === 0) {
    return null;
  }

  return (
    <div className={styles.carouselContainer}>
      <div className={styles.carouselHeader}>
        {displayTitle && <h2 className={styles.carouselTitle}>{displayTitle}</h2>}
      </div>
      <div className={styles.carouselScrollArea}>
        {validProducts.map((product) => (
          <div key={product.id} className={styles.carouselItem}>
            <PremiumProductCard product={product} categories={categories} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(CollectionCarousel);
