import React, { useState, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import ProductGrid from './components/ProductGrid';
import VisualCategoryNav from './components/VisualCategoryNav/VisualCategoryNav';
import ProductSearch from './components/ProductSearch';
import CollectionCarousel from './components/CollectionCarousel';
import AnnouncementBar from './components/AnnouncementBar';
import HeroCarousel from './components/HeroCarousel';
import FlashSales from './components/FlashSales';
import SidebarCatalogLayout from './components/SidebarCatalogLayout';
import BrandMarquee from './components/BrandMarquee/BrandMarquee';
import BestSellersRow from './components/BestSellersRow/BestSellersRow';
import {
  getProducts,
  getCategories,
  searchProducts,
  getProductsByCategory,
  getFeaturedProducts,
  getCachedProducts,
  getCachedCategories,
  getCachedFeaturedProducts
} from '../../services/products';
import { getMessage } from '../../services/messages';
import { getStorefrontConfig } from './services/storefront';
import { getDocument } from '../../services/firebase/firestore';
import { toDirectImageUrl } from '../../utils/imageUrl';
import OptimizedImage from '../../components/common/OptimizedImage/OptimizedImage';
import HeroBanner from './components/HeroBanner';
import EditableSection from '../../components/admin/EditableSection';
import { useVisualEditor } from './contexts/VisualEditorContext';
import styles from './TiendaPage.module.css';

const DEFAULT_STORE_TITLE = 'Nuestra Tienda';
const DEFAULT_STORE_SUBTITLE = 'Explora nuestros productos y personaliza el que más te guste.';

const TiendaPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const categoryId = searchParams.get('categoria');
  const isPreview = searchParams.has('t');

  // Determinar pageId basado en la URL
  const pageId = location.pathname === '/' || location.pathname === '/home' ? 'home' : 
                 location.pathname.replace(/^\/+/, '').split('/')[0] || 'home';

  const { storeConfigDraft, activePageId, setActivePageId } = useVisualEditor();

  // Actualizar el pageId activo en el contexto del editor para que guarde en el lugar correcto
  React.useEffect(() => {
    if (setActivePageId && activePageId !== pageId && activePageId !== 'footer') {
      setActivePageId(pageId);
    }
  }, [pageId, setActivePageId, activePageId]);

  // ── TODAS LAS QUERIES SE LANZAN EN PARALELO ──────────────────────

  const { data: storefrontConfig, isLoading: isConfigLoading } = useQuery({
    queryKey: ['storefront-config', pageId],
    queryFn: async () => {
      const { sections, error } = await getStorefrontConfig(pageId);
      if (error) throw new Error(error);
      return { sections: sections ?? [] };
    },
    staleTime: isPreview ? 0 : 10 * 60 * 1000,
    refetchOnMount: isPreview ? 'always' : false,
  });

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

  const { data: storeConfig } = useQuery({
    queryKey: ['store-config-custom'],
    queryFn: async () => {
      const { data, error } = await getDocument('storeConfig', 'homePage');
      if (error) return null;
      return data;
    },
    staleTime: 5 * 60 * 1000,
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

  const { data: featuredData } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await getFeaturedProducts();
      if (error) throw new Error(error);
      return data;
    },
    initialData: getCachedFeaturedProducts()
  });

  // ── QUERY PRINCIPAL DE PRODUCTOS ──────────────────────────────────
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
      } else {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      return sorted;
    },
    placeholderData: keepPreviousData,
    initialData: (!searchTerm && !categoryId && sortBy === 'name') ? getCachedProducts() : undefined,
  });

  const handleSearch = (term) => setSearchTerm(term);

  // ── Valores con fallback inmediato — NUNCA esperar a que carguen ──
  const title = storeMessages?.title ?? DEFAULT_STORE_TITLE;
  const subtitle = storeMessages?.subtitle ?? DEFAULT_STORE_SUBTITLE;
  const emptyMessage = storeMessages?.emptyMessage ?? '';
  const featuredProducts = featuredData ?? [];
  const sections = storefrontConfig?.sections ?? [];

  // Usar el borrador en vivo si existe, si no usar el de Firestore
  let activeConfig = storeConfigDraft || storeConfig || {};

  // Configuración por defecto estilo Nude Project si está vacía
  if (!activeConfig.heroBanner || !activeConfig.heroBanner.mediaUrl) {
    activeConfig = {
      ...activeConfig,
      heroBanner: {
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=2070&auto=format&fit=crop',
        title: 'NUEVA COLECCIÓN',
        subtitle: 'Diseñada para destacar. Construida para durar.',
        buttonText: 'COMPRAR AHORA',
        buttonLink: '/tienda'
      }
    };
  }

  // ── MANEJO DEL ARRAY DE SECCIONES (DEFAULT FALLBACKS) ────────────────
  // La configuración de secciones ahora proviene 100% de la BD o del borrador,
  // y storefront.js se encarga de inyectar defaults si la BD está vacía.
  let displaySections = storeConfigDraft?.sections || storefrontConfig?.sections || [];

  // ── RENDERIZADO PROGRESIVO ────────────────────────────────────────

  const renderSection = (section) => {
    const s = section.settings || {};
    switch (section.type) {
      case 'header':
      case 'categories_nav':
        // Estas secciones estructurales ahora se renderizan unificadas en la cabecera principal.
        return null;
      case 'hero_banner':
        // Usa la configuración local de la sección o el fallback al config global
        const heroConfig = { ...activeConfig.heroBanner, ...s };
        return (
          <section key={section.id} className={styles.sectionBlock}>
            <HeroBanner config={heroConfig} />
          </section>
        );
      case 'text':
        return (
          <section key={section.id} className={styles.sectionBlock}>
            {s.heading && <h2 className={styles.sectionHeading}>{s.heading}</h2>}
            {s.content && <div className={styles.sectionContent}>{s.content}</div>}
          </section>
        );
      case 'image':
        if (!s.url?.trim()) return null;
        const img = (
          <OptimizedImage
            src={toDirectImageUrl(s.url)}
            alt={s.alt || ''}
            className={styles.sectionImage}
            loading={section.order === 0 ? "eager" : "lazy"}
            fetchPriority={section.order === 0 ? "high" : "auto"}
            showSkeleton={false}
          />
        );
        return (
          <section key={section.id} className={styles.sectionBlock}>
            {s.link?.trim() ? <a href={s.link} target="_blank" rel="noopener noreferrer">{img}</a> : img}
          </section>
        );
      case 'video':
        if (!s.url?.trim()) return null;
        const isEmbed = /youtube|vimeo|embed/.test(s.url);
        return (
          <section key={section.id} className={styles.sectionBlock}>
            <div className={styles.sectionVideo}>
              {isEmbed ? (
                <iframe title="Video" src={s.url.startsWith('http') ? s.url : `https://www.youtube.com/embed/${s.url}`} allowFullScreen />
              ) : (
                <video src={s.url} poster={s.poster || undefined} controls />
              )}
            </div>
          </section>
        );
      case 'announcement_bar':
        return (
          <section key={section.id}>
             <AnnouncementBar messages={s.messages} speed={s.speed} bgColor={s.bgColor} textColor={s.textColor} />
          </section>
        );
      case 'hero_carousel':
        return (
          <section key={section.id} className={styles.sectionBlock}>
             <HeroCarousel slides={s.slides} autoPlaySpeed={s.autoPlaySpeed} />
          </section>
        );
      case 'flash_sales':
        return (
          <section key={section.id} className={styles.sectionBlock}>
            <FlashSales
               title={s.title}
               collectionName={s.collection}
               endTime={s.endTime}
               categories={categoriesData}
            />
          </section>
        );
      case 'marquee':
        return (
          <section key={section.id} className={styles.sectionBlock}>
            <BrandMarquee items={s.items} speed={s.speed} />
          </section>
        );
      case 'bestsellers_row':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0 }}>
            <BestSellersRow cards={s.cards} />
          </section>
        );
      case 'featured_products':
        return (
          <section key={section.id} className={styles.featuredSection}>
            {s.title && <h2 className={styles.featuredTitle}>{s.title}</h2>}
            <ProductGrid products={featuredProducts} loading={false} error={null} categories={categoriesData} />
          </section>
        );
      case 'collection_carousel':
        return (
          <section key={section.id} className={styles.sectionBlock}>
            <CollectionCarousel
              title={s.title}
              collectionName={s.collection}
              categories={categoriesData}
            />
          </section>
        );
      case 'product_grid':
        return (
          <section key={section.id} className={styles.sectionBlock}>
            {s.title && <h2 className={styles.featuredTitle}>{s.title}</h2>}
            <ProductGrid
              products={productsData || []}
              loading={productsLoading}
              error={productsError?.message}
              emptyMessage={emptyMessage}
              categories={categoriesData}
              layoutConfig={storeConfig?.layout}
            />
          </section>
        );
      case 'sidebar_catalog':
        return (
          <section key={section.id} className={styles.sectionBlock}>
            <SidebarCatalogLayout 
              productsData={productsData || []}
              productsLoading={productsLoading}
              productsError={productsError?.message}
              emptyMessage={emptyMessage}
              categories={categoriesData}
              layoutConfig={storeConfig?.layout}
              title={s.title}
            />
          </section>
        );
      default:
        return null;
    }
  };

  // ── HEADER UNIFICADO ──────────────────────────────────────────────
  const headerSection = displaySections.find(s => s.type === 'header');
  const displayTitle = headerSection?.settings?.title?.trim() || title;
  const displaySubtitle = headerSection?.settings?.subtitle?.trim() || subtitle;

  const renderUnifiedHeader = () => (
    <div className={styles.storeHeader}>
      <div className={styles.storeHeaderContent}>
        <div className={styles.storeInfo}>
          <h1 className={styles.title}>{displayTitle}</h1>
          <p className={styles.subtitle}>{displaySubtitle}</p>
        </div>
        <div className={styles.searchWrap}>
          <ProductSearch onSearch={handleSearch} />
        </div>
      </div>

      <div className={styles.storeNavRow}>
        <div className={styles.categoryWrap}>
          <VisualCategoryNav categories={categoriesData} loading={false} />
        </div>
        <div className={styles.sortWrap}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={styles.sortSelect}>
            <option value="name">Ordenar: A-Z</option>
            <option value="price">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
          </select>
        </div>
      </div>
    </div>
  );

  const { isEditModeActive, updateSectionsDraft } = useVisualEditor();

  const ModuleInserter = ({ index }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (!isEditModeActive) return null;

    const handleInsert = (type) => {
      const { SECTION_TYPES, getDefaultSettings } = require('./services/storefront');
      const newSections = [...displaySections];
      newSections.splice(index, 0, {
        id: `section_${Date.now()}`,
        type,
        order: index,
        settings: getDefaultSettings(type)
      });
      newSections.forEach((s, i) => s.order = i);
      updateSectionsDraft(newSections);
      setIsOpen(false);
    };

    return (
      <div className={styles.moduleInserterWrapper} onMouseLeave={() => setIsOpen(false)}>
        <div className={styles.inserterLine}></div>
        <div className={styles.inserterContent}>
          <button 
            className={styles.inserterBtn} 
            title="Añadir Módulo Aquí"
            onClick={() => setIsOpen(!isOpen)}
          >+</button>
          {isOpen && (
            <div className={styles.inserterMenuVisible}>
              <p>Insertar módulo:</p>
              <div className={styles.inserterOptions}>
                <button onClick={() => handleInsert('hero_banner')}>Banner Principal</button>
                <button onClick={() => handleInsert('bestsellers_row')}>Lo Más Vendido (Fila 5)</button>
                <button onClick={() => handleInsert('product_grid')}>Grilla de Productos</button>
                <button onClick={() => handleInsert('sidebar_catalog')}>Catálogo (Filtros)</button>
                <button onClick={() => handleInsert('hero_carousel')}>Carrusel Imágenes</button>
                <button onClick={() => handleInsert('collection_carousel')}>Carrusel Colección</button>
                <button onClick={() => handleInsert('text')}>Texto Simple</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const sorted = [...displaySections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  
  if (isConfigLoading && !storefrontConfig) {
    return (
      <div className={styles.container}>
        {renderUnifiedHeader()}
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--gris-texto-secundario)' }}>
          Cargando configuración...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {renderUnifiedHeader()}
      {sorted.map((section, index) => (
        <React.Fragment key={section.id}>
          <ModuleInserter index={index} />
          {renderSection(section)}
        </React.Fragment>
      ))}
      <ModuleInserter index={sorted.length} />
    </div>
  );
};

export default TiendaPage;
