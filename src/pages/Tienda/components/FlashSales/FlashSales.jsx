import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductsByCollection } from '../../../../services/products';
import PremiumProductCard from '../PremiumProductCard/PremiumProductCard';
import styles from './FlashSales.module.css';

const Countdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!targetDate) return;

    const calculateTime = () => {
      const difference = new Date(targetDate) - new Date();
      if (difference <= 0) return { h: '00', m: '00', s: '00' };

      const hours = Math.floor((difference / (1000 * 60 * 60)));
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      return {
        h: String(hours).padStart(2, '0'),
        m: String(minutes).padStart(2, '0'),
        s: String(seconds).padStart(2, '0'),
      };
    };

    setTimeLeft(calculateTime());
    const timer = setInterval(() => setTimeLeft(calculateTime()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) return null;
  if (timeLeft.h === '00' && timeLeft.m === '00' && timeLeft.s === '00') {
    return <span className={styles.countdownTimer}>¡Terminó!</span>;
  }

  return (
    <div className={styles.countdownTimer}>
       <span className={styles.timeBlock}>{timeLeft.h}</span>
       <span className={styles.separator}>:</span>
       <span className={styles.timeBlock}>{timeLeft.m}</span>
       <span className={styles.separator}>:</span>
       <span className={styles.timeBlock}>{timeLeft.s}</span>
    </div>
  );
};

const FlashSales = ({ title = "Ofertas Relámpago", collectionName, endTime, categories }) => {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['flash-sales', collectionName],
    queryFn: async () => {
      if (!collectionName) return [];
      const { data, error: err } = await getProductsByCollection(collectionName);
      if (err) throw new Error(err);
      return data;
    },
    enabled: !!collectionName,
    staleTime: 5 * 60 * 1000,
  });

  if (!collectionName) return null;
  const validProducts = products && Array.isArray(products) ? products.filter(p => p.visible !== false) : [];

  if (isLoading) {
    return (
      <div className={styles.flashSalesContainer}>
        <div className={styles.flashSalesHeader}>
           <h2 className={styles.flashSalesTitle}>⚡ {title}</h2>
        </div>
        <div className={styles.loadingText}>Cargando ofertas...</div>
      </div>
    );
  }

  if (error || validProducts.length === 0) return null;

  return (
    <div className={styles.flashSalesContainer}>
      <div className={styles.flashSalesHeader}>
        <h2 className={styles.flashSalesTitle}>⚡ {title}</h2>
        {endTime && <Countdown targetDate={endTime} />}
      </div>
      <div className={styles.flashSalesProducts}>
         {validProducts.slice(0, 4).map((product) => ( // Máximo 4 productos por fila para urgencia
          <PremiumProductCard key={product.id} product={product} categories={categories} />
        ))}
      </div>
    </div>
  );
};

export default React.memo(FlashSales);
