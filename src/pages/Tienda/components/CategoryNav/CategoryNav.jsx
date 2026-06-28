import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { T } from '../../../../i18n/useTranslatedText';
import styles from './CategoryNav.module.css';

const CategoryNav = ({ categories, loading }) => {
  const location = useLocation();
  // Función de traducción para textos estáticos de la navegación.
  const { t } = useLanguage();
  const isActive = (categoryId) => {
    const params = new URLSearchParams(location.search);
    return params.get('categoria') === categoryId;
  };

  if (loading) {
    return <div className={styles.nav}>{t('nav.cargandoCategorias', 'Cargando categorías…')}</div>;
  }

  return (
    <nav className={styles.nav}>
      <Link
        to="/tienda"
        className={`${styles.categoryLink} ${location.pathname === '/tienda' && !location.search ? styles.active : ''}`}
      >
        {t('nav.todos', 'Todos')}
      </Link>
      {categories?.map(category => (
        <Link
          key={category.id}
          to={`/tienda?categoria=${category.id}`}
          className={`${styles.categoryLink} ${isActive(category.id) ? styles.active : ''}`}
        >
          {/* Nombre dinámico de categoría (viene de la BD): se traduce con <T>. */}
          <T>{category.name}</T>
        </Link>
      ))}
    </nav>
  );
};

export default CategoryNav;
