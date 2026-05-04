import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBrands } from '../../services/brands';
import PedidoCard from '../PedidoCard';
import ImageCarousel from '../ImageCarousel';
import NuevoPedidoButton from '../NuevoPedidoButton';
import Button from '../common/Button';
import styles from './Results.module.css';

const Results = ({ pedidos, onNewSearch, dataSource }) => {
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(null);

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await getBrands();
      return res.data || [];
    },
    staleTime: 1000 * 60 * 60, // Caché de 1 hora
  });

  const brandsMap = useMemo(() => {
    const map = new Map();
    if (brandsData && brandsData.length > 0) {
      brandsData.forEach(b => {
        if (b.name && b.logoUrl) {
          const key = b.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
          map.set(key, b.logoUrl);
        }
      });
    }
    return map;
  }, [brandsData]);

  if (!pedidos || pedidos.length === 0) {
    return null;
  }

  const nombreCliente = pedidos[0].nombreCliente || 'Cliente';
  const numPedidos = pedidos.length;
  const mensajePedidos = numPedidos === 1 
    ? 'Hemos encontrado 1 pedido para ti:' 
    : `Hemos encontrado ${numPedidos} pedidos para ti:`;

  const handleImageClick = (images, index) => {
    setCarouselImages(images);
    setCarouselIndex(index);
  };

  const handleCloseCarousel = () => {
    setCarouselIndex(null);
    setCarouselImages([]);
  };

  const handleNextImage = () => {
    setCarouselIndex((prev) => (prev + 1) % carouselImages.length);
  };

  const handlePreviousImage = () => {
    setCarouselIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1>¡Hola, {nombreCliente}!</h1>
        <p>Esperamos que estés teniendo un excelente día.</p>
      </div>
      <p className={styles.pedidosInfo}>{mensajePedidos}</p>
      {dataSource && (
        <p className={styles.dataSource}>
          {dataSource === 'erp' ? 'Datos desde el sistema central' : 'Datos desde respaldo'}
        </p>
      )}
      <div className={styles.accordionContainer}>
        {pedidos.map((pedido, index) => (
          <PedidoCard
            key={pedido.id || index}
            pedido={pedido}
            onImageClick={handleImageClick}
            brandsMap={brandsMap}
          />
        ))}
      </div>
      <NuevoPedidoButton nombreCliente={nombreCliente} />
      
      {onNewSearch && (
        <div className={styles.newSearchContainer}>
          <Button 
            variant="secondary" 
            onClick={onNewSearch}
            className={styles.newSearchButton}
          >
            Buscar otro pedido
          </Button>
        </div>
      )}
      
      {carouselIndex !== null && (
        <ImageCarousel
          images={carouselImages}
          currentIndex={carouselIndex}
          onClose={handleCloseCarousel}
          onNext={handleNextImage}
          onPrevious={handlePreviousImage}
        />
      )}
    </div>
  );
};

export default Results;
