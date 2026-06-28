import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductsByCollection } from '../../../../services/products';
import { getCollectionById } from '../../../../services/collections';
import PremiumProductCard from '../PremiumProductCard/PremiumProductCard';
import { TextoSeccion, BotonSeccion } from '../textStyleUtils.jsx';
import styles from './CollectionCarousel.module.css';

// `config` = settings completos de la sección (estilo de texto del título + botón).
const CollectionCarousel = ({ title, config, collectionName, categories }) => {
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
        {/* displayTitle puede venir calculado (nombre de la colección); se pasa
            por `text` para conservar esa lógica. TextoSeccion = null si vacío. */}
        <TextoSeccion
          settings={config}
          prefix="title"
          as="h2"
          className={styles.carouselTitle}
          text={displayTitle}
        />
        <div className={styles.loadingText}>Cargando colección...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.carouselContainer}>
        <TextoSeccion
          settings={config}
          prefix="title"
          as="h2"
          className={styles.carouselTitle}
          text={displayTitle}
        />
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
        {/* Título con estilo editable; se conserva la clase CSS actual. */}
        <TextoSeccion
          settings={config}
          prefix="title"
          as="h2"
          className={styles.carouselTitle}
          text={displayTitle}
        />
        {/* Botón opcional debajo del título (buttonText/buttonLink). */}
        <BotonSeccion settings={config} style={{ marginTop: '0.75rem' }} />
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
