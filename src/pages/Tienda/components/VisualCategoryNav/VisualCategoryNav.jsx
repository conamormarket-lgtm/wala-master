import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './VisualCategoryNav.module.css';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';

const VisualCategoryNav = ({ categories, loading }) => {
  const location = useLocation();
  
  const isActive = (categoryId) => {
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

  return (
    <div className={styles.container}>
      <nav className={styles.navWrapper}>
        <div className={styles.scrollArea}>
          {/* Item "Todos" */}
          <Link 
            to="/tienda" 
            className={`${styles.navItem} ${location.pathname === '/tienda' && !location.search ? styles.active : ''}`}
          >
            <div className={styles.imageBubble}>
              <div className={styles.allIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </div>
            </div>
            <span className={styles.label}>Todos</span>
          </Link>

          {/* Categorías */}
          {categories?.map((category, idx) => (
            <Link
              key={category.id}
              to={`/tienda?categoria=${category.id}`}
              className={`${styles.navItem} ${isActive(category.id) ? styles.active : ''}`}
            >
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
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default VisualCategoryNav;
