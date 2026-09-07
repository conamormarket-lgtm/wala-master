import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductsByCollection } from '../../../../services/products';
import { getCollectionById } from '../../../../services/collections';
import PremiumProductCard from '../PremiumProductCard/PremiumProductCard';
import ProductCardSkeleton from '../../../../components/common/ProductCardSkeleton/ProductCardSkeleton';
import { TextoSeccion, BotonSeccion } from '../textStyleUtils.jsx';
import styles from './CollectionCarousel.module.css';
import { T } from '../../../../i18n/useTranslatedText';

// `config` = settings completos de la sección (estilo de texto del título + botón).
// `brandId` (multimarca, OPCIONAL): si viene, la colección se acota a esa marca.
// Sin brandId = comportamiento global actual (retrocompatible).
const CollectionCarousel = ({ title, config, collectionName, categories, brandId = null }) => {
  const { data: products, isLoading, error } = useQuery({
    // brandId entra en la queryKey para no mezclar la caché global con la de marca.
    queryKey: ['collection-products', collectionName, brandId || null],
    queryFn: async () => {
      if (!collectionName) return [];
      const { data, error: err } = await getProductsByCollection(collectionName, brandId || null);
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
        {/* Skeleton del tamaño real (mismas clases .carouselScrollArea/
            .carouselItem que la fila de productos ya renderizada) en vez del
            texto "Cargando colección..." de una sola línea: antes la sección
            "saltaba" de una línea a una fila completa cuando llegaban los
            datos — ver ProductCardSkeleton para el detalle. */}
        <div className={styles.carouselScrollArea}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.carouselItem}>
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
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
        <div className={styles.errorText}><T>No se pudo cargar la colección</T></div>
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
            <PremiumProductCard product={product} categories={categories} currentBrandId={brandId} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(CollectionCarousel);
