import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './VisualCategoryNav.module.css';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';

/**
 * Navegación visual de categorías (burbujas con miniatura).
 *
 * DOS MODOS (retrocompatibles):
 *  1) MODO ENLACE (por defecto, cabecera global): NO se pasa `onSelectCategory`.
 *     Cada burbuja es un <Link to=/tienda?categoria=ID> y el activo se deriva de
 *     la URL. Es el comportamiento histórico — no cambia.
 *  2) MODO FILTRO LOCAL (storefront por marca): se pasa `onSelectCategory`.
 *     Cada burbuja es un <button> que llama onSelectCategory(cat.categoryId);
 *     la burbuja "Todos" llama onSelectCategory(null). El activo se resalta
 *     comparando con `activeCategory` (no con la URL). No navega: solo filtra
 *     el catálogo de la MISMA página en cliente.
 *
 * @param {Array}  categories       Items del nav. En modo enlace: {id,name,imageUrl}.
 *                                   En modo filtro: {categoryId,name,imageUrl}.
 * @param {boolean} loading         Muestra el skeleton.
 * @param {Function} onSelectCategory  (categoryId|null)=>void. Si está presente,
 *                                   activa el MODO FILTRO LOCAL.
 * @param {string|null} activeCategory  Categoría activa en modo filtro (para resaltar).
 */
const VisualCategoryNav = ({ categories, loading, onSelectCategory, activeCategory = null }) => {
  const location = useLocation();

  // ¿Estamos en modo filtro local? (hay handler de selección)
  const isFilterMode = typeof onSelectCategory === 'function';

  // Activo según el modo: en filtro se compara con activeCategory; en enlace, con la URL.
  const isActive = (categoryId) => {
    if (isFilterMode) return activeCategory === categoryId;
    const params = new URLSearchParams(location.search);
    return params.get('categoria') === categoryId;
  };

  if (loading) {
    return (
      <div className={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={styles.skeletonItem}></div>
        ))}
      </div>
    );
  }

  // Placeholder images for visual layout if no category image exists
  const getCategoryImage = (category, index) => {
    if (category.imageUrl) return category.imageUrl;
    const placeholders = [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80', // tee
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=400&q=80', // hoodie
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=400&q=80', // basic
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=400&q=80', // bag
      'https://images.unsplash.com/photo-1520975954732-57dd22299614?auto=format&fit=crop&w=400&q=80' // access
    ];
    return placeholders[index % placeholders.length];
  };

  // Id de la categoría según el modo: en filtro usamos categoryId; en enlace, id.
  const getCatId = (cat) => (isFilterMode ? cat.categoryId : cat.id);

  // Icono "cuadrícula" reutilizado por la burbuja "Todos".
  const allIcon = (
    <div className={styles.allIcon}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    </div>
  );

  return (
    <div className={styles.container}>
      <nav className={styles.navWrapper}>
        <div className={styles.scrollArea}>
          {/* Item "Todos" */}
          {isFilterMode ? (
            // Modo filtro: botón que limpia la categoría (null = sin filtro).
            <button
              type="button"
              className={`${styles.navItem} ${activeCategory === null ? styles.active : ''}`}
              style={{ background: 'none', border: 'none', padding: 0 }}
              onClick={() => onSelectCategory(null)}
            >
              <div className={styles.imageBubble}>{allIcon}</div>
              <span className={styles.label}>Todos</span>
            </button>
          ) : (
            // Modo enlace: link a la tienda global sin categoría.
            <Link
              to="/tienda"
              className={`${styles.navItem} ${location.pathname === '/tienda' && !location.search ? styles.active : ''}`}
            >
              <div className={styles.imageBubble}>{allIcon}</div>
              <span className={styles.label}>Todos</span>
            </Link>
          )}

          {/* Categorías */}
          {categories?.map((category, idx) => {
            const catId = getCatId(category);
            const bubble = (
              <>
                <div className={styles.imageBubble}>
                  <OptimizedImage
                    src={getCategoryImage(category, idx)}
                    alt={category.name}
                    containerClassName={styles.imageContainer}
                    className={styles.image}
                    objectFit="cover"
                  />
                </div>
                <span className={styles.label}>{category.name}</span>
              </>
            );

            // Modo filtro: botón que fija la categoría de esta página (cliente).
            if (isFilterMode) {
              return (
                <button
                  type="button"
                  key={catId || idx}
                  className={`${styles.navItem} ${isActive(catId) ? styles.active : ''}`}
                  style={{ background: 'none', border: 'none', padding: 0 }}
                  onClick={() => onSelectCategory(catId)}
                >
                  {bubble}
                </button>
              );
            }

            // Modo enlace (retrocompat con la cabecera global).
            return (
              <Link
                key={catId || idx}
                to={`/tienda?categoria=${catId}`}
                className={`${styles.navItem} ${isActive(catId) ? styles.active : ''}`}
              >
                {bubble}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default VisualCategoryNav;
