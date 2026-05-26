import React, { useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import styles from './MobileCategorySubheader.module.css';

const MobileCategorySubheader = ({ categories = [] }) => {
  const [searchParams] = useSearchParams();
  const activeCategoryId = searchParams.get('categoria');
  const scrollRef = useRef(null);
  const activeItemRef = useRef(null);

  // Solo se muestra en aplicación nativa móvil
  const isNativeApp = Capacitor.isNativePlatform();

  // Scroll al elemento activo al cargar
  useEffect(() => {
    if (activeItemRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const item = activeItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      
      // Si el elemento está fuera del área visible, hacemos scroll hacia él
      if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) {
        container.scrollTo({
          left: item.offsetLeft - (container.offsetWidth / 2) + (item.offsetWidth / 2),
          behavior: 'smooth'
        });
      }
    }
  }, [activeCategoryId]);

  if (!isNativeApp || !categories || categories.length === 0) {
    return null;
  }

  // Añadir la opción de "Todo" al inicio
  const allCategories = [
    { id: 'all', name: 'Todo', isAll: true },
    ...categories
  ];

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea} ref={scrollRef}>
        {allCategories.map((category) => {
          const isActive = category.isAll 
            ? !activeCategoryId 
            : activeCategoryId === category.id;
            
          const linkTo = category.isAll 
            ? '/tienda' 
            : `/tienda?categoria=${category.id}`;

          return (
            <Link 
              key={category.id} 
              to={linkTo}
              ref={isActive ? activeItemRef : null}
              className={`${styles.tabItem} ${isActive ? styles.active : ''}`}
              preventScrollReset={true}
            >
              <span className={styles.tabText}>
                {category.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MobileCategorySubheader;
