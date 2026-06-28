import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import ProductGrid from './components/ProductGrid';
import VisualCategoryNav from './components/VisualCategoryNav/VisualCategoryNav';
import ProductSearch from './components/ProductSearch';
import CollectionCarousel from './components/CollectionCarousel';
import FeaturedCarousel from './components/FeaturedCarousel';
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
import { getStorefrontConfig, SECTION_TYPES, getDefaultSettings } from './services/storefront';
import { getDocument } from '../../services/firebase/firestore';
import { toDirectImageUrl } from '../../utils/imageUrl';
import OptimizedImage from '../../components/common/OptimizedImage/OptimizedImage';
import HeroBanner from './components/HeroBanner';
import EditableSection from '../../components/admin/EditableSection';
import { useVisualEditor } from './contexts/VisualEditorContext';
import AppDownloadBanner from './components/AppDownloadBanner';
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

// ── HELPERS REUTILIZABLES DE ESTILO DE TEXTO (aditivos y retrocompatibles) ──
// Para cada campo de texto editable (title, subtitle, heading, content...) el
// editor puede guardar en settings las claves: <campo>Align, <campo>Underline,
// <campo>Bg y <campo>Link. Si NO existen, los helpers devuelven valores neutros
// y el render queda EXACTAMENTE como hoy.

/**
 * Estilo de bloque (contenedor del texto): solo alineación horizontal.
 * Va en el elemento de bloque (p.ej. el <h2>) para no romper su ancho.
 * @param {object} s     settings de la sección
 * @param {string} campo prefijo del campo (p.ej. 'title', 'heading', 'content')
 */
const estiloBloque = (s, campo) => {
  if (!s || !campo) return {};
  const align = s[`${campo}Align`];
  return align ? { textAlign: align } : {};
};

/**
 * Estilo inline del texto en sí: subrayado y fondo (con padding para que el
 * fondo abrace el texto en vez de ocupar todo el ancho del bloque).
 * @param {object} s     settings de la sección
 * @param {string} campo prefijo del campo
 */
const estiloTexto = (s, campo) => {
  if (!s || !campo) return {};
  const style = {};
  if (s[`${campo}Underline`]) style.textDecoration = 'underline';
  const bg = s[`${campo}Bg`];
  if (bg) {
    style.backgroundColor = bg;
    // inline-block + padding para que el color de fondo abrace el texto.
    style.display = 'inline-block';
    style.padding = '0.15em 0.4em';
    style.borderRadius = '4px';
  }
  return style;
};

/**
 * Envuelve un nodo en un enlace si la URL existe.
 * - URL interna (empieza con '/') -> <Link> de react-router.
 * - URL externa (http...) -> <a target="_blank" rel="noopener noreferrer">.
 * Si no hay URL, devuelve el nodo tal cual (retrocompatible).
 */
const envolverLink = (nodo, url) => {
  const link = (url || '').trim();
  if (!link) return nodo;
  if (link.startsWith('/')) {
    return (
      <Link to={link} style={{ color: 'inherit', textDecoration: 'inherit' }}>
        {nodo}
      </Link>
    );
  }
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'inherit', textDecoration: 'inherit' }}
    >
      {nodo}
    </a>
  );
};

/**
 * Construye el contenido interno estilizado de un texto: aplica subrayado/fondo
 * y, si hay <campo>Link, lo envuelve en un enlace. Pensado para colocarse dentro
 * del elemento de bloque (que solo lleva la alineación vía estiloBloque).
 * Si no hay ningún campo nuevo, devuelve el texto crudo (idéntico a hoy).
 * @param {object} s     settings de la sección
 * @param {string} campo prefijo del campo
 * @param {string} texto el texto a renderizar
 */
const renderTextoEstilizado = (s, campo, texto) => {
  const styleTexto = estiloTexto(s, campo);
  const tieneEstilo = Object.keys(styleTexto).length > 0;
  const nodo = tieneEstilo ? <span style={styleTexto}>{texto}</span> : texto;
  return envolverLink(nodo, s?.[`${campo}Link`]);
};

/**
 * Renderiza el botón opcional de una sección (buttonText/buttonLink).
 * Devuelve null si no hay texto o enlace, manteniendo el render actual intacto.
 */
const renderBotonSeccion = (s) => {
  const texto = (s?.buttonText || '').trim();
  const enlace = (s?.buttonLink || '').trim();
  if (!texto || !enlace) return null;

  const estilo = {
    display: 'inline-block',
    marginTop: '1rem',
    padding: '0.65rem 1.4rem',
    borderRadius: '8px',
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
    backgroundColor: s.buttonBgColor || '#000000',
    color: s.buttonTextColor || '#ffffff'
  };

  const contenido = <span style={estilo}>{texto}</span>;

  if (enlace.startsWith('/')) {
    return <Link to={enlace}>{contenido}</Link>;
  }
  return (
    <a href={enlace} target="_blank" rel="noopener noreferrer">
      {contenido}
    </a>
  );
};

const TiendaPage = ({ isLandingPage = false }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
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

  // Fase 1: la búsqueda de la tienda lleva a la página facetada /buscar (searchCatalog).
  // Si el término viene vacío, mantiene el filtrado en página (comportamiento previo).
  const handleSearch = (term) => {
    const q = (term || '').trim();
    if (q) navigate(`/buscar?q=${encodeURIComponent(q)}`);
    else setSearchTerm('');
  };

  // ── Valores con fallback inmediato — NUNCA esperar a que carguen ──
  const title = storeMessages?.title ?? DEFAULT_STORE_TITLE;
  const subtitle = storeMessages?.subtitle ?? DEFAULT_STORE_SUBTITLE;
  const emptyMessage = storeMessages?.emptyMessage ?? '';
  const featuredProducts = featuredData ?? [];
  const sections = storefrontConfig?.sections ?? [];

  // Usar el borrador en vivo si existe, si no usar el de Firestore
  let activeConfig = storeConfigDraft || storeConfig || {};

  // Fallback neutro cuando no hay heroBanner configurado:
  // sin imágenes demo externas (p.ej. Unsplash) ni textos de marketing falsos.
  // Usamos un pixel transparente (data-URI, sin petición externa) para que no
  // aparezca el icono de imagen rota; el fondo neutro del .heroContainer queda
  // a la vista y los textos se dejan vacíos para que el page-builder los rellene.
  if (!activeConfig.heroBanner || !activeConfig.heroBanner.mediaUrl) {
    const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    activeConfig = {
      ...activeConfig,
      heroBanner: {
        ...(activeConfig.heroBanner || {}),
        mediaType: 'image',
        mediaUrl: TRANSPARENT_PIXEL,
        title: activeConfig.heroBanner?.title || '',
        subtitle: activeConfig.heroBanner?.subtitle || '',
        buttonText: activeConfig.heroBanner?.buttonText || '',
        buttonLink: activeConfig.heroBanner?.buttonLink || ''
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
             {/* config={s}: aditivo, para que el componente reciba los campos de estilo/botón guardados por el editor */}
             <AnnouncementBar config={s} messages={s.messages} speed={s.speed} bgColor={s.bgColor} textColor={s.textColor} animationType={s.animationType} />
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
            {/* config={s}: aditivo, para que el componente reciba los campos de estilo/botón guardados por el editor */}
            <FlashSales
               config={s}
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
            {/* config={s}: aditivo, para que el componente reciba los campos de estilo/botón guardados por el editor */}
            <Testimonials config={s} title={s.title} testimonials={s.testimonials} />
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
            <BrandMarquee items={s.items} speed={s.speed} title={s.title} />
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
            {(!isEmpty && s.title) && (
              <h2 className={styles.featuredTitle} style={estiloBloque(s, 'title')}>
                {renderTextoEstilizado(s, 'title', s.title)}
              </h2>
            )}
            {(() => {
              const boton = !isEmpty ? renderBotonSeccion(s) : null;
              return boton ? (
                <div style={{ textAlign: s.titleAlign || 'center', marginBottom: '1rem' }}>
                  {boton}
                </div>
              ) : null;
            })()}
            <ProductGrid products={featuredProducts} loading={false} error={null} categories={categoriesData} emptyMessage={emptyMessage} />
          </section>
        );
      }
      case 'collection_carousel':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            {/* config={s}: aditivo, para que el componente reciba los campos de estilo/botón guardados por el editor */}
            <CollectionCarousel
              config={s}
              title={s.title}
              collectionName={s.collection}
              categories={categoriesData}
            />
          </section>
        );
      case 'featured_carousel':
        // Reutiliza la MISMA data de productos destacados que 'featured_products'
        // (featuredData/featuredProducts) — no duplicamos la query.
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            {/* config={s}: aditivo, para que el componente reciba los campos de estilo/botón guardados por el editor */}
            <FeaturedCarousel
              config={s}
              title={s.title}
              products={featuredProducts}
              categories={categoriesData}
              visibleItems={s.visibleItems}
              autoPlay={s.autoPlay}
              autoPlaySpeed={s.autoPlaySpeed}
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
            {(!isEmpty && s.title) && (
              <h2 className={styles.featuredTitle} style={estiloBloque(s, 'title')}>
                {renderTextoEstilizado(s, 'title', s.title)}
              </h2>
            )}
            {(() => {
              const boton = !isEmpty ? renderBotonSeccion(s) : null;
              return boton ? (
                <div style={{ textAlign: s.titleAlign || 'center', marginBottom: '1rem' }}>
                  {boton}
                </div>
              ) : null;
            })()}
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

  return (
    <div className={styles.container}>
      {!categoryId && !searchTerm && <AppDownloadBanner />}
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
