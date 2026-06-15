import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';

import ProductGrid from '../Tienda/components/ProductGrid';
import ProductSearch from '../Tienda/components/ProductSearch';
import MobileCategorySubheader from '../Tienda/components/MobileCategorySubheader/MobileCategorySubheader';

import {
  getProducts,
  getCategories,
  searchProducts,
  getProductsByCategory,
  getCachedProducts,
  getCachedCategories
} from '../../services/products';
import { getMessage } from '../../services/messages';

import styles from './LegacyTiendaPage.module.css';

const DEFAULT_STORE_TITLE = 'Nuestra Tienda';
const DEFAULT_STORE_SUBTITLE = 'Explora nuestros productos y personaliza el que más te guste.';

const LegacyTiendaPage = () => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const categoryId = searchParams.get('categoria');

  const { data: storeMessages } = useQuery({
    queryKey: ['store-messages'],
    queryFn: async () => {
      const [titleRes, subtitleRes, emptyRes] = await Promise.all([
        getMessage('store_title'),
        getMessage('store_subtitle'),
        getMessage('store_empty_message')
      ]);
      return {
        title: titleRes.data?.trim() || DEFAULT_STORE_TITLE,
        subtitle: subtitleRes.data?.trim() || DEFAULT_STORE_SUBTITLE,
        emptyMessage: emptyRes.data?.trim() || ''
      };
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await getCategories();
      if (error) throw new Error(error);
      return data;
    },
    initialData: getCachedCategories()
  });

  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['products', categoryId, searchTerm, sortBy],
    queryFn: async () => {
      let result;
      if (searchTerm) {
        result = await searchProducts(searchTerm);
      } else if (categoryId) {
        result = await getProductsByCategory(categoryId);
      } else {
        result = await getProducts([], null, null);
      }
      if (result.error) throw new Error(result.error);

      let sorted = [...(result.data || [])];
      if (sortBy === 'price') {
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      } else if (sortBy === 'price-desc') {
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      } else if (sortBy === 'newest') {
        sorted.sort((a, b) => {
          const getTime = (val) => {
            if (!val) return 0;
            if (typeof val.toDate === 'function') return val.toDate().getTime();
            if (val.seconds) return val.seconds * 1000;
            return new Date(val).getTime() || 0;
          };
          return getTime(b.createdAt) - getTime(a.createdAt);
        });
      } else {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      return sorted;
    },
    placeholderData: keepPreviousData,
    initialData: (!searchTerm && !categoryId && sortBy === 'newest') ? getCachedProducts() : undefined,
  });

  const handleSearch = (term) => setSearchTerm(term);

  const title = storeMessages?.title ?? DEFAULT_STORE_TITLE;
  const subtitle = storeMessages?.subtitle ?? DEFAULT_STORE_SUBTITLE;
  const emptyMessage = storeMessages?.emptyMessage ?? '';

  const isNativeApp = Capacitor.isNativePlatform();

  return (
    <div className={styles.container}>
      <div className={styles.storeHeader}>
        <div className={styles.storeHeaderContent}>
          <div className={styles.storeInfo}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <div className={styles.searchWrap}>
            <ProductSearch onSearch={handleSearch} />
          </div>
        </div>
      </div>

      <div className={styles.pageLayout}>
        {!isNativeApp && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Categorías</h3>
              <ul className={styles.categoryList}>
                <li>
                  <Link to="/tienda" className={!categoryId ? styles.activeCat : ''}>
                    Todas
                  </Link>
                </li>
                {categoriesData?.map(c => (
                  <li key={c.id}>
                    <Link to={`/tienda?categoria=${c.id}`} className={categoryId === c.id ? styles.activeCat : ''}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        <main className={styles.mainContent}>
          <div className={styles.topBar}>
            <span className={styles.resultsCount}>
              {productsData ? productsData.length : 0} resultados
            </span>
            <div className={styles.sortWrap}>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={styles.sortSelect}>
                <option value="newest">Más recientes</option>
                <option value="name">Ordenar: A-Z</option>
                <option value="price">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
              </select>
            </div>
          </div>

          <MobileCategorySubheader categories={categoriesData} />

          <section className={styles.sectionBlock}>
            <ProductGrid
              products={productsData || []}
              loading={productsLoading}
              error={productsError?.message}
              emptyMessage={emptyMessage}
              categories={categoriesData}
            />
          </section>
        </main>
      </div>
    </div>
  );
};

export default LegacyTiendaPage;
