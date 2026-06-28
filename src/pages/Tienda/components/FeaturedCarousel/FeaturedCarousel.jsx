import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PremiumProductCard from '../PremiumProductCard/PremiumProductCard';
import styles from './FeaturedCarousel.module.css';

/**
 * Carrusel de Destacados (Slider horizontal reutilizable).
 *
 * A diferencia de CollectionCarousel, este componente NO hace su propia query:
 * recibe los productos ya cargados por prop. Así puede añadirse a CUALQUIER
 * página del editor visual reutilizando la data que la página ya tenga.
 *
 * Navegación: scroll-snap horizontal (swipe en móvil) + flechas en desktop.
 *
 * @param {object}   props
 * @param {string}   props.title           Título de la sección
 * @param {Array}    props.products        Productos a mostrar (ya cargados)
 * @param {Array}    props.categories      Categorías (se pasan a PremiumProductCard)
 * @param {number}   props.visibleItems    Nº de tarjetas visibles en desktop (default 5)
 * @param {boolean}  props.autoPlay        Activar avance automático
 * @param {number}   props.autoPlaySpeed   Velocidad del autoplay en ms (default 5000)
 */
const FeaturedCarousel = ({
  title,
  products,
  categories = [],
  visibleItems = 5,
  autoPlay = false,
  autoPlaySpeed = 5000,
}) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Solo productos visibles (igual que CollectionCarousel)
  const validProducts =
    products && Array.isArray(products)
      ? products.filter((p) => p.visible !== false)
      : [];

  // Actualiza el estado de las flechas según la posición del scroll
  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    // Margen de 4px para evitar parpadeo por redondeos de subpíxeles
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, validProducts.length]);

  // Desplaza el carrusel ~el ancho de una tarjeta en la dirección indicada
  const scrollByCard = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const firstItem = el.querySelector(`.${styles.carouselItem}`);
    // Ancho de una tarjeta + gap (1.5rem ≈ 24px). Fallback al 80% del viewport.
    const step = firstItem ? firstItem.offsetWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'next' ? step : -step, behavior: 'smooth' });
  }, []);

  // Autoplay: avanza periódicamente; si llega al final vuelve al inicio.
  useEffect(() => {
    if (!autoPlay || validProducts.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const speed = Math.max(1000, autoPlaySpeed || 5000);
    const timer = setInterval(() => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      if (scrollLeft + clientWidth >= scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        scrollByCard('next');
      }
    }, speed);
    return () => clearInterval(timer);
  }, [autoPlay, autoPlaySpeed, validProducts.length, scrollByCard]);

  // Estado de carga: products undefined/null aún no resuelto
  if (products == null) {
    return (
      <div className={styles.carouselContainer}>
        {title && <h2 className={styles.carouselTitle}>{title}</h2>}
        <div className={styles.loadingText}>Cargando productos...</div>
      </div>
    );
  }

  // Estado vacío: no renderizamos nada (igual que CollectionCarousel)
  if (validProducts.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.carouselContainer}
      style={{ '--visible-items': Math.max(1, Number(visibleItems) || 5) }}
    >
      <div className={styles.carouselHeader}>
        {title && <h2 className={styles.carouselTitle}>{title}</h2>}
      </div>

      <div className={styles.carouselViewport}>
        {/* Flecha izquierda (desktop) */}
        <button
          type="button"
          className={`${styles.navButton} ${styles.navPrev}`}
          onClick={() => scrollByCard('prev')}
          disabled={!canScrollLeft}
          aria-label="Anterior"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>

        <div className={styles.carouselScrollArea} ref={scrollRef}>
          {validProducts.map((product) => (
            <div key={product.id} className={styles.carouselItem}>
              <PremiumProductCard product={product} categories={categories} />
            </div>
          ))}
        </div>

        {/* Flecha derecha (desktop) */}
        <button
          type="button"
          className={`${styles.navButton} ${styles.navNext}`}
          onClick={() => scrollByCard('next')}
          disabled={!canScrollRight}
          aria-label="Siguiente"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(FeaturedCarousel);
