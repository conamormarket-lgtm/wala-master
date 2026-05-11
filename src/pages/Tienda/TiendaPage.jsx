import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
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
import Testimonials from './components/Testimonials';
import MapLocation from './components/MapLocation';
import TrustBadges from './components/TrustBadges/TrustBadges';
import TextBlock from './components/TextBlock/TextBlock';
import ImageBlock from './components/ImageBlock/ImageBlock';
import HeaderBlock from './components/HeaderBlock/HeaderBlock';
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

const SectionBackground = ({ config }) => {
  const { 
    backgroundColor, 
    backgroundGradient, 
    backgroundImageUrl, 
    backgroundBlur, 
    backgroundOverlay
  } = config;

  const hasImageOrGradient = backgroundImageUrl || backgroundGradient;
  const hasOverlay = backgroundOverlay;

  if (!hasImageOrGradient && (!backgroundColor || backgroundColor === 'transparent') && !hasOverlay) {
    return null;
  }

  return (
    <>
      {hasImageOrGradient && (
        <div style={{
          position: 'absolute',
          top: '-15px', left: '-15px', right: '-15px', bottom: '-15px',
          zIndex: -2,
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : (backgroundGradient || 'none'),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: backgroundBlur ? `blur(${backgroundBlur}px)` : 'none',
          transform: backgroundBlur ? 'scale(1.05)' : 'none',
          pointerEvents: 'none'
        }} />
      )}
      {(!hasImageOrGradient && backgroundColor && backgroundColor !== 'transparent') && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -2,
          backgroundColor: backgroundColor,
          pointerEvents: 'none'
        }} />
      )}
      {backgroundOverlay && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1,
          backgroundColor: backgroundOverlay,
          pointerEvents: 'none'
        }} />
      )}
    </>
  );
};

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

  let emptyMessageShown = false;

  const renderSection = (section) => {
    const s = section.settings || {};
    switch (section.type) {
      case 'header':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0, overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <HeaderBlock config={s} />
          </section>
        );
      case 'categories_nav':
        // Esta sección estructural ahora se renderiza unificada en la cabecera principal.
        return null;
      case 'hero_banner':
        // Usa la configuración local de la sección o el fallback al config global
        const heroConfig = { ...activeConfig.heroBanner, ...s };
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <HeroBanner config={heroConfig} />
          </section>
        );
      case 'text':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0, overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <TextBlock config={s} />
          </section>
        );
      case 'image':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0, overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <ImageBlock config={s} isFirstSection={section.order === 0} />
          </section>
        );
      case 'video': {
        if (!s.url?.trim()) return null;
        let finalUrl = s.url;
        let isEmbed = false;

        // Auto-convertir links de YouTube a formato embed
        const ytMatch = finalUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (ytMatch && ytMatch[1]) {
          finalUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
          isEmbed = true;
        } else if (/vimeo|embed/.test(finalUrl)) {
          isEmbed = true;
        }

        const aspect = s.aspectRatio || '16:9';
        let paddingBottom = '56.25%'; // 16:9
        if (aspect === '9:16') paddingBottom = '177.77%';
        else if (aspect === '1:1') paddingBottom = '100%';

        const forceRatio = isEmbed || aspect !== 'auto';

        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <div 
              className={styles.sectionVideo} 
              style={{ 
                position: 'relative', 
                paddingBottom: forceRatio ? paddingBottom : '0', 
                height: forceRatio ? '0' : 'auto', 
                overflow: 'hidden', 
                borderRadius: '12px',
                maxWidth: aspect === '9:16' ? '450px' : (aspect === '1:1' ? '600px' : '100%'),
                margin: '0 auto',
                background: '#000'
              }}
            >
              {isEmbed ? (
                <iframe 
                  title="Video" 
                  src={finalUrl} 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <video 
                  src={finalUrl} 
                  poster={s.poster || undefined} 
                  controls 
                  style={{ 
                    position: forceRatio ? 'absolute' : 'relative',
                    top: 0, left: 0, 
                    width: '100%', 
                    height: forceRatio ? '100%' : 'auto',
                    objectFit: 'cover',
                    borderRadius: '12px' 
                  }} 
                />
              )}
            </div>
          </section>
        );
      }
      case 'announcement_bar':
        return (
          <section key={section.id} style={{ position: 'relative', overflow: 'hidden' }}>
             <SectionBackground config={s} />
             <AnnouncementBar messages={s.messages} speed={s.speed} bgColor={s.bgColor} textColor={s.textColor} />
          </section>
        );
      case 'hero_carousel':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
             <SectionBackground config={s} />
             <HeroCarousel slides={s.slides} autoPlaySpeed={s.autoPlaySpeed} />
          </section>
        );
      case 'flash_sales':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <FlashSales
               title={s.title}
               collectionName={s.collection}
               endTime={s.endTime}
               categories={categoriesData}
            />
          </section>
        );
      case 'testimonials':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <Testimonials title={s.title} testimonials={s.testimonials} />
          </section>
        );
      case 'map_location':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <MapLocation config={s} />
          </section>
        );
      case 'trust_badges':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <TrustBadges badges={s.badges} />
          </section>
        );
      case 'marquee':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <BrandMarquee items={s.items} speed={s.speed} />
          </section>
        );
      case 'bestsellers_row':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <BestSellersRow cards={s.cards} />
          </section>
        );
      case 'featured_products': {
        const isEmpty = !featuredProducts || featuredProducts.length === 0;
        if (isEmpty) {
          if (emptyMessageShown) return null;
          emptyMessageShown = true;
        }
        return (
          <section key={section.id} className={styles.featuredSection} style={{ position: 'relative', paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            {(!isEmpty && s.title) && <h2 className={styles.featuredTitle}>{s.title}</h2>}
            <ProductGrid products={featuredProducts} loading={false} error={null} categories={categoriesData} emptyMessage={emptyMessage} />
          </section>
        );
      }
      case 'collection_carousel':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <CollectionCarousel
              title={s.title}
              collectionName={s.collection}
              categories={categoriesData}
            />
          </section>
        );
      case 'product_grid': {
        const isEmpty = !productsLoading && (!productsData || productsData.length === 0);
        if (isEmpty) {
          if (emptyMessageShown) return null;
          emptyMessageShown = true;
        }
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            {(!isEmpty && s.title) && <h2 className={styles.featuredTitle}>{s.title}</h2>}
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
      }
      case 'sidebar_catalog': {
        const isEmpty = !productsLoading && (!productsData || productsData.length === 0);
        if (isEmpty) {
          if (emptyMessageShown) return null;
          emptyMessageShown = true;
        }
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <SidebarCatalogLayout 
              productsData={productsData || []}
              productsLoading={productsLoading}
              productsError={productsError?.message}
              emptyMessage={emptyMessage}
              categories={categoriesData}
              layoutConfig={storeConfig?.layout}
              title={(!isEmpty && s.title) ? s.title : undefined}
            />
          </section>
        );
      }
      default:
        return null;
    }
  };

  // El header unificado ha sido movido a LegacyTiendaPage.
  // Esta vista ahora es puramente una Landing Page dinámica.

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
            className={`${styles.inserterBtn} ${isOpen ? styles.active : ''}`} 
            title="Añadir Módulo Aquí"
            onClick={() => setIsOpen(!isOpen)}
          >
            <Plus size={20} strokeWidth={1.5} />
          </button>
          {isOpen && (
            <div className={styles.inserterMenuVisible}>
              <p style={{fontSize: '0.8rem', color: '#64748b', margin: '0 0 10px 0', fontWeight: '600'}}>Añadir módulo nuevo:</p>
              <div className={styles.inserterOptions}>
                <button onClick={() => handleInsert('header')}>Encabezado (Título)</button>
                <button onClick={() => handleInsert('hero_banner')}>Banner Principal</button>
                <button onClick={() => handleInsert('bestsellers_row')}>Lo Más Vendido (Fila 5)</button>
                <button onClick={() => handleInsert('testimonials')}>Testimonios</button>
                <button onClick={() => handleInsert('map_location')}>Ubicación (Mapa)</button>
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
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--gris-texto-secundario)' }}>
          Cargando configuración...
        </div>
      </div>
    );
  }

  const { SECTION_TYPES } = require('./services/storefront');

  return (
    <div className={styles.container}>
      {sorted.map((section, index) => {
        const rendered = renderSection(section);
        if (!rendered) return null;
        const typeLabel = SECTION_TYPES?.find(t => t.id === section.type)?.label || section.type;
        
        return (
          <React.Fragment key={section.id}>
            <ModuleInserter index={index} />
            <EditableSection sectionId={section.id} currentConfig={activeConfig} label={typeLabel}>
              {rendered}
            </EditableSection>
          </React.Fragment>
        );
      })}
      <ModuleInserter index={sorted.length} />
    </div>
  );
};

export default TiendaPage;
