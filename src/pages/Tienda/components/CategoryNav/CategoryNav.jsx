import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './CategoryNav.module.css';

const CategoryNav = ({ categories, loading }) => {
  const location = useLocation();
  const isActive = (categoryId) => {
    const params = new URLSearchParams(location.search);
    return params.get('categoria') === categoryId;
  };

  if (loading) {
    return <div className={styles.nav}>Cargando categorías...</div>;
  }

  return (
    <nav className={styles.nav}>
      <Link 
        to="/tienda" 
        className={`${styles.categoryLink} ${location.pathname === '/tienda' && !location.search ? styles.active : ''}`}
      >
        Todos
      </Link>
      {categories?.map(category => (
        <Link
          key={category.id}
          to={`/tienda?categoria=${category.id}`}
          className={`${styles.categoryLink} ${isActive(category.id) ? styles.active : ''}`}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
};

export default CategoryNav;
