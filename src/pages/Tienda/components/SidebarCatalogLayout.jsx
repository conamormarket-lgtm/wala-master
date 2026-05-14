import React, { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import ProductGrid from './ProductGrid';
import styles from './SidebarCatalogLayout.module.css';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { useQuery } from '@tanstack/react-query';
import { getCollections } from '../../../services/collections';
import { getBrands } from '../../../services/brands';
import { getTags } from '../../../services/tags';
import { getCharacters } from '../../../services/characters';
import { getProductTypes } from '../../../services/productTypes';

const SidebarCatalogLayout = ({ productsData, productsLoading, productsError, emptyMessage, categories, layoutConfig, title }) => {
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null);
  const [activeBrand, setActiveBrand] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Prevenir scroll en el body cuando el drawer esté abierto
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileDrawerOpen]);

  const { data: collections } = useQuery({ queryKey: ['collections'], queryFn: async () => (await getCollections()).data });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: async () => (await getBrands()).data });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: async () => (await getTags()).data });
  const { data: characters } = useQuery({ queryKey: ['characters'], queryFn: async () => (await getCharacters()).data });
  const { data: productTypes } = useQuery({ queryKey: ['productTypes'], queryFn: async () => (await getProductTypes()).data });

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId === activeCategory ? null : catId);
    setIsMobileDrawerOpen(false);
  };

  const handleFilterClick = (setter, id) => {
    setter(prev => prev === id ? null : id);
    setIsMobileDrawerOpen(false);
  };

  const filteredProducts = (productsData || []).filter(p => {
    if (activeCategory && p.categoryId !== activeCategory && p.category !== activeCategory && !(p.categories || []).includes(activeCategory)) return false;
    if (activeCollection && !(p.collections || []).includes(activeCollection)) return false;
    if (activeBrand && p.brandId !== activeBrand) return false;
    if (activeTag && !(p.tags || []).includes(activeTag)) return false;
    if (activeCharacter && !(p.characters || []).includes(activeCharacter)) return false;
    if (activeType && p.productType !== activeType) return false;
    return true;
  });

  return (
    <div className={styles.catalogWrapper}>
      {title && <h2 className={styles.catalogTitle}>{title}</h2>}
      
      <div className={styles.catalogLayout}>
        {/* BOTÓN MÓVIL (Visible solo en CSS) */}
        <div className={styles.mobileFilterControls}>
          <button 
            className={styles.mobileFilterBtn} 
            onClick={() => setIsMobileDrawerOpen(true)}
          >
            <Filter size={18} /> Filtrar y Categorías
          </button>
        </div>

        {/* OVERLAY FONDO OSCURO (Móvil) */}
        <div 
          className={`${styles.drawerOverlay} ${isMobileDrawerOpen ? styles.overlayVisible : ''}`} 
          onClick={() => setIsMobileDrawerOpen(false)}
        />

        {/* SIDEBAR Izquierdo / Drawer Móvil */}
        <aside className={`${styles.sidebar} ${isMobileDrawerOpen ? styles.sidebarOpen : ''}`}>
          
          <div className={styles.drawerHeader}>
            <h3 style={{ margin: 0 }}>Filtros</h3>
            <button className={styles.closeDrawerBtn} onClick={() => setIsMobileDrawerOpen(false)}>
              <X size={24} color="#666" />
            </button>
          </div>

          <div className={styles.sidebarSection}>
            <h3>Categorías</h3>
            <ul className={styles.categoryList}>
              <li 
                className={activeCategory === null ? styles.activeItem : ''}
                onClick={() => handleCategoryClick(null)}
              >
                Todas las categorías
              </li>
              {(categories || []).map(cat => (
                <li 
                  key={cat.id} 
                  className={activeCategory === cat.id ? styles.activeItem : ''}
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  {cat.name}
                </li>
              ))}
            </ul>
          </div>

          {(collections || []).length > 0 && (
            <div className={styles.sidebarSection}>
              <h3>Colecciones</h3>
              <ul className={styles.categoryList}>
                <li className={activeCollection === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCollection, null)}>Todas</li>
                {(collections || []).map(c => (
                  <li key={c.id} className={activeCollection === c.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCollection, c.id)}>
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {(brands || []).length > 0 && (
            <div className={styles.sidebarSection}>
              <h3>Marcas</h3>
              <ul className={styles.brandList}>
                <li className={activeBrand === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveBrand, null)}>Todas</li>
                {(brands || []).map(b => (
                  <li key={b.id} className={activeBrand === b.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveBrand, b.id)}>
                    {b.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          

          {(productTypes || []).length > 0 && (
            <div className={styles.sidebarSection}>
              <h3>Tipo de Producto</h3>
              <ul className={styles.categoryList}>
                <li className={activeType === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveType, null)}>Todos</li>
                {(productTypes || []).map(t => (
                  <li key={t.id} className={activeType === t.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveType, t.id)}>
                    {t.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(tags || []).length > 0 && (
            <div className={styles.sidebarSection}>
              <h3>Etiquetas</h3>
              <ul className={styles.categoryList}>
                <li className={activeTag === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveTag, null)}>Todas</li>
                {(tags || []).map(t => (
                  <li key={t.id} className={activeTag === t.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveTag, t.id)}>
                    {t.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(characters || []).length > 0 && (
            <div className={styles.sidebarSection}>
              <h3>Personajes</h3>
              <ul className={styles.categoryList}>
                <li className={activeCharacter === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCharacter, null)}>Todos</li>
                {(characters || []).map(c => (
                  <li key={c.id} className={activeCharacter === c.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCharacter, c.id)}>
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* MAIN Content */}
        <main className={styles.mainContent}>
          <ProductGrid
            products={filteredProducts || []}
            loading={productsLoading}
            error={productsError}
            emptyMessage={emptyMessage}
            categories={categories}
            layoutConfig={layoutConfig}
          />
        </main>
      </div>
    </div>
  );
};

export default SidebarCatalogLayout;
