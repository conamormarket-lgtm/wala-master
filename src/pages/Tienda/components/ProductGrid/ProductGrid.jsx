import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PremiumProductCard from '../PremiumProductCard/PremiumProductCard';
import { useLanguage } from '../../../../contexts/LanguageContext';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import styles from './ProductGrid.module.css';

const SKELETON_COUNT = 6;

// Esqueleto glass premium: imagen 3:4 + 2 lineas de titulo + fila de precio.
// El shimmer (banda de luz que recorre ~1.6s) vive en una capa overlay con
// aria-hidden; se desactiva por completo con prefers-reduced-motion (ver CSS).
const SkeletonCard = () => (
  <div className={styles.skeletonCard} aria-hidden="true">
    <div className={styles.skeletonImage} />
    <div className={styles.skeletonContent}>
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLineShort} />
      <div className={styles.skeletonPriceRow}>
        <div className={styles.skeletonPrice} />
        <div className={styles.skeletonChip} />
      </div>
    </div>
    {/* Capa de brillo (sheen) que recorre la tarjeta en bucle */}
    <div className={styles.skeletonShimmer} />
  </div>
);

/**
 * Grilla de productos con DOS modos de paginación (retrocompatibles):
 *
 *  1) MODO PAGINACIÓN EN SERVIDOR (Fase 3 · C-1): cuando el padre pasa `onLoadMore`.
 *     `products` es "lo cargado hasta ahora" (páginas aplanadas). El
 *     IntersectionObserver y el botón "Cargar más" piden la SIGUIENTE página al
 *     padre (que la trae de Firestore con cursor). No se monta todo el catálogo:
 *     cada página añade ~PAGE_SIZE nodos.
 *
 *  2) MODO INCREMENTAL EN RAM (comportamiento previo): cuando NO se pasa
 *     `onLoadMore`. Se mantiene el slice creciente (visibleCount) sobre el array
 *     `products` completo. Lo usan secciones con pocos productos (p.ej.
 *     featured_products) donde traer todo de una es barato y se ve igual que hoy.
 *
 * Props nuevas (todas opcionales -> retrocompatible):
 *  @param {boolean}  hasMore          ¿hay más páginas por cargar? (modo servidor)
 *  @param {Function} onLoadMore       pide la siguiente página al padre (modo servidor)
 *  @param {boolean}  isFetchingMore   ¿se está cargando la siguiente página? (modo servidor)
 */
const ProductGrid = React.memo(({
  products,
  loading,
  error,
  emptyMessage,
  categories,
  layoutConfig,
  hasMore,
  onLoadMore,
  isFetchingMore
}) => {

  // Función de traducción para textos estáticos del grid.
  const { t } = useLanguage();

  // ¿Paginación en servidor? Activa solo si el padre nos da el callback.
  const serverPaginated = typeof onLoadMore === 'function';

  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef(null);

  // Reiniciar la cuenta base cuando los productos o filtros cambian (modo RAM).
  // En modo servidor no aplica: `products` ya crece página a página.
  useEffect(() => {
    if (!serverPaginated) setVisibleCount(12);
  }, [products, serverPaginated]);

  // ── Disparador de carga incremental (observer "infinite scroll") ──────
  // Modo servidor : pide la siguiente página al padre (fetchNextPage).
  // Modo RAM       : crece el slice local 12 en 12 sobre el array ya cargado.
  const total = products ? products.length : 0;
  const ramHasMore = !serverPaginated && visibleCount < total;
  const showLoadTrigger = serverPaginated ? !!hasMore : ramHasMore;

  const handleLoadMore = useCallback(() => {
    if (serverPaginated) {
      // Evita pedir mientras una página está en vuelo.
      if (hasMore && !isFetchingMore) onLoadMore();
    } else {
      setVisibleCount((prev) => Math.min(prev + 12, total));
    }
  }, [serverPaginated, hasMore, isFetchingMore, onLoadMore, total]);

  useEffect(() => {
    if (!showLoadTrigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) handleLoadMore();
      },
      { rootMargin: '400px', threshold: 0.1 } // Anticipa el scroll
    );

    const node = loadMoreRef.current;
    if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [showLoadTrigger, handleLoadMore]);

  // En modo servidor mostramos TODO lo cargado; en modo RAM, el slice creciente.
  const visibleProducts = useMemo(() => {
    if (!products) return [];
    return serverPaginated ? products : products.slice(0, visibleCount);
  }, [products, visibleCount, serverPaginated]);

  const gridStyle = useMemo(() => {
    // Si layoutConfig especifica 'auto', mapearlo a 'auto-fit'
    const desktopCols = layoutConfig?.productGridColumnsDesktop;
    const desktopVal = desktopCols === 'auto' || !desktopCols ? 'auto-fit' : desktopCols;

    return {
      '--grid-cols-desktop': desktopVal,
      '--grid-cols-mobile': layoutConfig?.productGridColumnsMobile || 2,
    };
  }, [layoutConfig]);

  // Spinner de "primera carga": en modo servidor también cubre el caso de que
  // aún no haya llegado la primera página (products vacío + isFetchingMore).
  const showInitialSkeleton = loading || (serverPaginated && total === 0 && isFetchingMore);

  if (showInitialSkeleton) {
    return (
      <div className={styles.grid} style={gridStyle}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorTitle}>{t('grid.errorCargar', 'No pudimos cargar los productos')}</p>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  // Caso "todavía no hay nada visible PERO quedan páginas por cargar" (modo
  // servidor): puede pasar cuando un filtro de cliente (p.ej. marca) descarta las
  // primeras páginas y sus coincidencias están más adelante. En vez de mostrar el
  // estado vacío en falso, mostramos skeletons y dejamos que el observer pida la
  // siguiente página automáticamente.
  if ((!products || products.length === 0) && serverPaginated && (hasMore || isFetchingMore)) {
    return (
      <>
        <div className={styles.grid} style={gridStyle}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        {/* Sensor para seguir cargando páginas hasta encontrar coincidencias */}
        {hasMore && (
          <div ref={loadMoreRef} style={{ height: '20px', width: '100%', marginTop: '20px' }} />
        )}
      </>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>◇</div>
        <h3 className={styles.emptyTitle}>{t('grid.proximamente', 'Próximamente más productos')}</h3>
        <p className={styles.emptyText}>
          {emptyMessage || 'Estamos preparando novedades. Revisa de nuevo en unos días.'}
        </p>
        <Link to="/" className={styles.emptyLink}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.grid} style={gridStyle}>
        {visibleProducts.map((product, index) => (
          <PremiumProductCard
            key={product.id}
            product={product}
            categories={categories}
            isAboveFold={index < 4}
            showHoverSecondaryMedia={layoutConfig?.showHoverSecondaryMedia ?? true}
          />
        ))}
      </div>

      {/* Skeletons al final mientras se trae la siguiente página (modo servidor) */}
      {serverPaginated && isFetchingMore && (
        <div className={styles.grid} style={{ ...gridStyle, marginTop: '1rem' }}>
          {Array.from({ length: Math.min(SKELETON_COUNT, 4) }, (_, i) => (
            <SkeletonCard key={`more-${i}`} />
          ))}
        </div>
      )}

      {/* Botón explícito "Cargar más" (fallback accesible al scroll automático) */}
      {showLoadTrigger && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            type="button"
            className={styles.loadMoreBtn}
            onClick={handleLoadMore}
            disabled={serverPaginated && isFetchingMore}
          >
            {serverPaginated && isFetchingMore
              ? t('grid.cargando', 'Cargando…')
              : t('grid.cargarMas', 'Cargar más')}
          </button>
        </div>
      )}

      {/* Sensor invisible que dispara la carga incremental por scroll */}
      {showLoadTrigger && (
        <div ref={loadMoreRef} style={{ height: '20px', width: '100%', marginTop: '20px' }} />
      )}

      {/* Fin de lista: solo cuando ya hay productos y no queda nada por cargar */}
      {!showLoadTrigger && !(serverPaginated && isFetchingMore) && total > 0 && (
        <p
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            color: 'var(--gris-texto-secundario, #888)',
            fontSize: '0.9rem'
          }}
        >
          {t('grid.finLista', 'No hay más productos')}
        </p>
      )}
    </>
  );
});

export default ProductGrid;
