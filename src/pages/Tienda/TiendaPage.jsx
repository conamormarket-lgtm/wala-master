import React, { useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
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
import LandingPaymentBlock from './components/LandingPaymentBlock/LandingPaymentBlock';
import ConversionFold from './components/ConversionFold/ConversionFold';
import FeatureList from './components/FeatureList/FeatureList';
import FaqAccordion from './components/FaqAccordion/FaqAccordion';
import TextBlock from './components/TextBlock/TextBlock';
import ImageBlock from './components/ImageBlock/ImageBlock';
import HeaderBlock from './components/HeaderBlock/HeaderBlock';
import {
  getProducts,
  getCategories,
  searchProducts,
  getProductsByCategory,
  getProductsByBrand,
  getFeaturedProducts,
  getStoreProductsPage,
  STORE_PAGE_SIZE,
  getCachedProducts,
  getCachedCategories,
  getCachedFeaturedProducts
} from '../../services/products';
import { getMessage } from '../../services/messages';
import { getStorefrontConfig, SECTION_TYPES, getDefaultSettings } from './services/storefront';
import { getDocument } from '../../services/firebase/firestore';
import { getBrand } from '../../services/brands';
import { toDirectImageUrl } from '../../utils/imageUrl';
import OptimizedImage from '../../components/common/OptimizedImage/OptimizedImage';
import HeroBanner from './components/HeroBanner';
import EditableSection from '../../components/admin/EditableSection';
import { useVisualEditor } from './contexts/VisualEditorContext';
import AppDownloadBanner from './components/AppDownloadBanner';
import { isKcheroLanding } from '../../constants/landingSlugs';
import styles from './TiendaPage.module.css';

const DEFAULT_STORE_TITLE = 'Nuestra Tienda';
const DEFAULT_STORE_SUBTITLE = 'Explora nuestros productos y personaliza el que más te guste.';

const MATADOR_FAQ_ITEMS = [
  {
    question: '¿De verdad puedo pagar al recibir?',
    answer:
      'Sí. Trabajamos con pago contra entrega verificado: liquidas el total cuando el courier te entrega el pedido en mano. Si quieres asegurar tu unidad antes del despacho, puedes separarla con un adelanto de S/ 10 (reserva de stock) y completar el saldo al recibir. Si cambias de opinión antes de que salga de almacén, puedes solicitar la anulación completa del pedido sin penalidad.',
  },
  {
    question: '¿Cuánto demora el delivery?',
    answer:
      'En Lima Metropolitana despachamos en modalidad express: entrega en un máximo de 48 horas hábiles desde la confirmación de tu pedido. Te enviamos seguimiento por WhatsApp en cuanto el paquete sale de nuestro centro de distribución.',
  },
  {
    question: '¿Puedo elegir color o acabado?',
    answer:
      'Sí. El reloj incluye 14 acabados oficiales disponibles en catálogo (variedad de cronógrafos, deportivos y ediciones limitadas). Al comprar indicas la referencia que ves en el carrusel o nos confirmas por WhatsApp; validamos stock del acabado elegido antes del despacho para garantizar que recibes exactamente el modelo que seleccionaste.',
  },
];

// Ordena un array de productos EN MEMORIA según el criterio de la UI.
// Se usa en los modos NO paginados (categoría/búsqueda) y como red de seguridad
// cuando la paginación con cursor cae al catálogo completo. En el modo paginado
// "normal" el orden lo aplica Firestore (ver getStoreProductsPage), no esto.
const ordenarEnMemoria = (arr, sortBy) => {
  const sorted = [...(arr || [])];
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
};

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

const TiendaPage = ({ isLandingPage = false, pageIdOverride = null, pageBrandIdOverride = null }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  // ── Categoría activa del NAV de categorías por marca (Fase 3 multimarca) ──
  // Estado ELEVADO aquí para compartirlo entre la sección 'categories_nav'
  // (las burbujas con miniatura) y la sección 'sidebar_catalog' de la MISMA
  // página: al pulsar una burbuja se fija aquí y el sidebar filtra su catálogo
  // en CLIENTE por esa categoría (la marca sigue server-side). null = sin filtro.
  const [navCategoryId, setNavCategoryId] = useState(null);
  const categoryId = searchParams.get('categoria');
  const isPreview = searchParams.has('t');

  // Determinar pageId. Si es una landing/marca, se usa el id canónico que pasa
  // DynamicLandingPage (el slug GUARDADO), NO el segmento crudo de la URL: así
  // /CONAMOR, /ConAmor y /conamor leen y guardan SIEMPRE las mismas secciones
  // (la búsqueda de la landing es case-insensitive, ver getLandingPageBySlug).
  const pageId = pageIdOverride || (location.pathname === '/' || location.pathname === '/home' ? 'home' :
                 location.pathname.replace(/^\/+/, '').split('/')[0] || 'home');

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

  // ── MARCA DE LA PÁGINA (Fase 1 multimarca) ────────────────────────
  // Una sección sidebar_catalog (o product_grid) puede fijarse a UNA marca via
  // settings.brandId (doc id de tienda_brands). Si existe, el catálogo paginado
  // se ACOTA en servidor a esa marca (faceta { type:'brand' } -> where('brandId','==',...)
  // ver facetToWhere en products.js). brandId vacío/ausente = catálogo GLOBAL
  // (retrocompatible: home y /tienda no cambian). Se busca la PRIMERA sección de
  // ese tipo con brandId no vacío. Calculado desde el borrador/Firestore directamente
  // (no de displaySections, que se define más abajo) para poder inicializar el estado.
  // Definido ANTES de las queries de destacados/colección para que puedan acotarse.
  const pageBrandId = useMemo(() => {
    // OVERRIDE explícito de la landing (doc landingPages.brandId vía DynamicLandingPage).
    // Si la página tiene marca GUARDADA, manda y NO se infiere de las secciones. Solo si
    // no hay override se cae a la inferencia actual (retrocompatible: landings antiguas
    // sin brandId guardado siguen derivando la marca de sus secciones como hasta hoy).
    if (typeof pageBrandIdOverride === 'string' && pageBrandIdOverride.trim() !== '') {
      return pageBrandIdOverride.trim();
    }
    const secs = storeConfigDraft?.sections || storefrontConfig?.sections || [];
    const conMarca = (sec) =>
      typeof sec?.settings?.brandId === 'string' && sec.settings.brandId.trim() !== '';
    // Prioridad: la marca la define el CATÁLOGO (sidebar_catalog/product_grid). Si la
    // página NO tiene un catálogo de marca pero SÍ un nav de marca (categories_nav),
    // se usa la marca del nav para acotar también el catálogo — así pulsar una burbuja
    // del nav de la marca A no muestra esa categoría de TODAS las marcas.
    const catalogo = secs.find(
      (sec) => (sec?.type === 'sidebar_catalog' || sec?.type === 'product_grid') && conMarca(sec)
    );
    if (catalogo) return catalogo.settings.brandId.trim();
    const nav = secs.find((sec) => sec?.type === 'categories_nav' && conMarca(sec));
    return nav ? nav.settings.brandId.trim() : null;
  }, [storeConfigDraft, storefrontConfig, pageBrandIdOverride]);

  // ── IDENTIDAD DE MARCA (mensajes de tienda + indicador) ────────────
  // Doc completo de la marca de esta página (mismo pageBrandId de arriba). Se usa
  // para: (1) mensajes de tienda propios (storeTitle/storeSubtitle/storeEmpty) con
  // fallback al global, y (2) el indicador "Estás en: <Marca>". Sin pageBrandId
  // (Con Amor / páginas globales) NO se lanza la query y todo queda EXACTO como hoy.
  const { data: pageBrandData } = useQuery({
    queryKey: ['tienda-page-brand', pageBrandId || null],
    queryFn: async () => {
      const { data, error } = await getBrand(pageBrandId);
      if (error) return null;
      return data;
    },
    enabled: !!pageBrandId,
    staleTime: 15 * 60 * 1000,
  });

  // Destacados ACOTADOS a la marca de la página (pageBrandId). Sin marca = global como hoy.
  // El caché de localStorage SOLO se usa como initialData en el caso global, para no
  // pintar destacados globales en una página de marca antes de que llegue la query.
  const { data: featuredData } = useQuery({
    queryKey: ['featured-products', pageBrandId || null],
    queryFn: async () => {
      const { data, error } = await getFeaturedProducts(pageBrandId || null);
      if (error) throw new Error(error);
      return data;
    },
    initialData: pageBrandId ? undefined : getCachedFeaturedProducts()
  });

  // ── QUERY PRINCIPAL DE PRODUCTOS ──────────────────────────────────
  // CON marca de página (pageBrandId): la vista por categoría (?categoria=ID) se
  // ACOTA a esa marca (filtro client-side en getProductsByCategory, sin índices
  // nuevos) para no expulsar al usuario al catálogo global. SIN marca, la query
  // key y el resultado quedan EXACTOS a hoy (pageBrandId es null fuera de marca).
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['products', categoryId, searchTerm, sortBy, pageBrandId || null],
    queryFn: async () => {
      let result;
      if (searchTerm) {
        result = await searchProducts(searchTerm);
      } else if (categoryId) {
        result = await getProductsByCategory(categoryId, pageBrandId || null);
      } else {
        result = await getProducts([], null, null);
      }
      if (result.error) throw new Error(result.error);

      return ordenarEnMemoria(result.data || [], sortBy);
    },
    placeholderData: keepPreviousData,
    initialData: (!searchTerm && !categoryId && sortBy === 'newest') ? getCachedProducts() : undefined,
  });

  // ── CATÁLOGO PAGINADO CON CURSOR (Fase 3 · C-1) ───────────────────
  // Las secciones product_grid y sidebar_catalog ya NO reciben TODO el catálogo
  // de una sola query. En el modo "tienda normal" (sin categoría de URL ni
  // búsqueda) se pagina con cursor de Firestore: primera página + "Cargar más" +
  // scroll incremental. Cuando hay categoryId/searchTerm en la URL se conserva el
  // comportamiento previo (productsData), que ya devuelve un conjunto acotado.
  const usePaginatedCatalog = !categoryId && !searchTerm;

  // ── NAV DE CATEGORÍAS POR MARCA (Fase 3 multimarca) ───────────────
  // Cada sección 'categories_nav' apunta a UNA marca (settings.brandId). Las
  // burbujas con miniatura se leen del array `categoryNav` guardado en el doc
  // tienda_brands/{brandId}. Recolectamos los brandIds presentes en la config y
  // cargamos sus docs para mapear brandId -> categoryNav. Sin brandId no se pide
  // nada (retrocompat: el nav queda vacío).
  const navBrandIds = useMemo(() => {
    const secs = storeConfigDraft?.sections || storefrontConfig?.sections || [];
    const ids = secs
      .filter((sec) => sec?.type === 'categories_nav')
      .map((sec) => (typeof sec?.settings?.brandId === 'string' ? sec.settings.brandId.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [storeConfigDraft, storefrontConfig]);

  // Mapa { categoryId -> { id, name, imageUrl, order } } a partir de las categorías
  // globales (tienda_categories vía getCategories). Es la fuente de la imagen y el
  // nombre de cada burbuja AUTO-derivada. Se memoiza para tener una referencia
  // estable y poder derivar una "firma" de ids para la queryKey del nav.
  const categoriesById = useMemo(() => {
    const map = new Map();
    (categoriesData || []).forEach((cat) => {
      if (cat && cat.id) map.set(cat.id, cat);
    });
    return map;
  }, [categoriesData]);

  // Firma de las categorías cargadas (ids ordenados) para la queryKey: así, cuando
  // categoriesData llega/cambia, el nav AUTO-derivado se recalcula y mapea ids a
  // nombre/imagen. Sin esto el queryFn capturaría un mapa vacío en el primer render.
  const categoriesSignature = useMemo(
    () => Array.from(categoriesById.keys()).sort().join(','),
    [categoriesById]
  );

  // Misma extracción de id que usa el SIDEBAR al filtrar (idOf sobre objeto/string).
  // CLAVE de consistencia: las burbujas DEBEN exponer EXACTAMENTE estos ids para
  // que onSelectCategory(categoryId) coincida con activeCategory en el filtro de
  // cliente del sidebar (p.categories.map(idOf) / p.categoryId / p.category).
  const idOf = (c) => (c && typeof c === 'object') ? (c.id || c.slug || c.name || '') : c;

  // Mapa { brandId: categoryNav[] } para las marcas referenciadas por el nav.
  //
  // DOS FUENTES (override manual > AUTO-derivado):
  //  1) MANUAL: si la marca (tienda_brands/{brandId}) tiene un `categoryNav` con
  //     items, se usa tal cual (respeta orden e imágenes elegidas en el panel de
  //     la marca). Retrocompatibilidad total con lo que existía.
  //  2) AUTO: si el `categoryNav` está VACÍO, se derivan las burbujas de las
  //     CATEGORÍAS presentes en los PRODUCTOS de la marca (getProductsByBrand):
  //     se recolectan los ids de categoría con la MISMA extracción que el sidebar
  //     (idOf sobre p.categories, con fallback legacy p.categoryId/p.category) y
  //     se mapea cada id a su categoría global (categoriesById) para sacar
  //     { categoryId, name, imageUrl }. Se ordena por el `order` de la categoría
  //     (y, a igualdad, por nombre). Marca sin productos -> [] (solo "Todos").
  //
  // El resultado mantiene el MISMO formato que consume VisualCategoryNav en modo
  // filtro: { categoryId, name, imageUrl }.
  const { data: navCategoriesByBrand } = useQuery({
    queryKey: ['categories-nav-brands', navBrandIds, categoriesSignature],
    queryFn: async () => {
      // Estilo del nav por marca, retrocompat: sin categoryNavStyle → default
      // { align:'center', animation:'static' } (= comportamiento histórico).
      const styleOf = (data) => {
        const s = data?.categoryNavStyle || {};
        return {
          align: ['left', 'center', 'right', 'justify'].includes(s.align) ? s.align : 'center',
          animation: ['static', 'slider'].includes(s.animation) ? s.animation : 'static',
        };
      };

      const entries = await Promise.all(
        navBrandIds.map(async (bid) => {
          const { data } = await getBrand(bid);
          const style = styleOf(data);
          const manual = Array.isArray(data?.categoryNav) ? data.categoryNav : [];

          // (1) Override manual: si hay items, se usa con su orden del admin.
          if (manual.length > 0) {
            const sorted = [...manual].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
            return [bid, { items: sorted, style }];
          }

          // (2) AUTO-derivar desde los productos de la marca.
          const { data: products, error } = await getProductsByBrand(bid);
          if (error || !Array.isArray(products)) return [bid, { items: [], style }];

          // Recolecta los ids de categoría DISTINTOS de los productos, con la misma
          // extracción que el filtro del sidebar (categories[] + legacy single).
          const seen = new Set();
          products.forEach((p) => {
            const ids = [
              ...(Array.isArray(p.categories) ? p.categories.map(idOf) : []),
              p.categoryId,
              p.category,
            ];
            ids.forEach((cid) => {
              const clean = idOf(cid);
              if (clean) seen.add(clean);
            });
          });

          // Mapea cada id a su categoría global (nombre + imagen). Descarta ids que
          // no existan en tienda_categories (categoría borrada o id huérfano).
          const burbujas = Array.from(seen)
            .map((cid) => {
              const cat = categoriesById.get(cid);
              if (!cat) return null;
              return {
                categoryId: cid,
                name: cat.name || '',
                imageUrl: cat.imageUrl || '',
                order: typeof cat.order === 'number' ? cat.order : 0,
              };
            })
            .filter(Boolean)
            // Orden por el `order` de la categoría; a igualdad, alfabético por nombre.
            .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));

          return [bid, { items: burbujas, style }];
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: navBrandIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Faceta única que se filtra EN SERVIDOR. Su valor inicial:
  //  · CON marca de página: faceta de MARCA FIJA ({ type:'brand', value: pageBrandId }),
  //    así getStoreProductsPage trae SOLO esa marca, paginada. La categoría del sidebar
  //    NO se empuja como faceta server-side (sobrescribiría la marca): se aplica como
  //    filtro de CLIENTE en SidebarCatalogLayout.
  //  · SIN marca de página: null (la elige el sidebar al pulsar una categoría, como hoy).
  // Las demás facetas siguen filtrándose en cliente. Cambiarla reinicia el cursor
  // (forma parte de la queryKey de la infinite query).
  const [catalogFacet, setCatalogFacet] = useState(
    pageBrandId ? { type: 'brand', value: pageBrandId } : null
  );

  // Si pageBrandId aparece/cambia tras el primer render (config asíncrona o cambio
  // de página), re-fija la faceta de marca server-side. Sin pageBrandId no toca nada
  // aquí (retrocompat: la faceta la maneja el sidebar como hoy).
  React.useEffect(() => {
    if (!pageBrandId) return;
    setCatalogFacet((prev) =>
      prev && prev.type === 'brand' && prev.value === pageBrandId
        ? prev
        : { type: 'brand', value: pageBrandId }
    );
  }, [pageBrandId]);

  const {
    data: catalogPages,
    isLoading: catalogLoading,
    isFetchingNextPage: catalogFetchingMore,
    hasNextPage: catalogHasMore,
    fetchNextPage: catalogFetchNext,
    error: catalogError,
  } = useInfiniteQuery({
    queryKey: ['products-infinite', sortBy, catalogFacet?.type ?? null, catalogFacet?.value ?? null],
    queryFn: async ({ pageParam }) => {
      const res = await getStoreProductsPage({
        facet: catalogFacet,
        sort: sortBy,
        cursor: pageParam,
        pageSize: STORE_PAGE_SIZE,
      });
      // RETROCOMPATIBLE: si la página falla (p.ej. falta un índice compuesto para
      // faceta+orden), caemos al comportamiento actual (catálogo completo en una
      // sola "página") en vez de romper la tienda.
      if (res.error) {
        const fallback = await getProducts([], null, null);
        if (fallback.error) throw new Error(res.error);
        const sorted = ordenarEnMemoria(fallback.data || [], sortBy);
        return { items: sorted, lastDoc: null, hasMore: false, error: null, _fallback: true };
      }
      return res;
    },
    initialPageParam: null,
    // El cursor es un DocumentSnapshot de Firestore (no serializable): se usa tal
    // cual desde la memoria de React Query.
    getNextPageParam: (last) => (last?.hasMore ? last.lastDoc : undefined),
    enabled: usePaginatedCatalog,
    staleTime: 5 * 60 * 1000,
    // Primera pintura instantánea desde la caché local (igual que hoy): solo en el
    // estado neutro (sin faceta, orden por defecto). Mostramos una "primera página"
    // recortada del catálogo cacheado con hasMore:false (cursor nulo = sin avance
    // falso). initialDataUpdatedAt:0 marca esa caché como obsoleta para que se
    // refetchee de inmediato la primera página REAL de Firestore (con cursor), que
    // sustituye al placeholder y habilita la paginación incremental.
    initialData: (!catalogFacet && sortBy === 'newest')
      ? (() => {
          const cached = getCachedProducts();
          if (!cached || cached.length === 0) return undefined;
          const firstPage = ordenarEnMemoria(cached, 'newest').slice(0, STORE_PAGE_SIZE);
          return {
            pages: [{ items: firstPage, lastDoc: null, hasMore: false, error: null }],
            pageParams: [null],
          };
        })()
      : undefined,
    initialDataUpdatedAt: 0,
  });

  // Aplana todas las páginas cargadas hasta ahora en un único array para el grid.
  const paginatedItems = useMemo(
    () => (catalogPages?.pages || []).flatMap((p) => p.items || []),
    [catalogPages]
  );

  // Reinicia la faceta de servidor al salir del modo paginado (categoría/búsqueda)
  // para que al volver a la tienda normal arranque limpio desde la primera página.
  // CON marca de página: el "estado limpio" es la faceta de MARCA (no null), para
  // que el catálogo siga acotado a esa marca al volver. SIN marca: null como hoy.
  React.useEffect(() => {
    if (usePaginatedCatalog) return;
    if (pageBrandId) {
      // Vuelve a la faceta de marca si la query estaba apuntando a otra cosa.
      setCatalogFacet((prev) =>
        prev && prev.type === 'brand' && prev.value === pageBrandId
          ? prev
          : { type: 'brand', value: pageBrandId }
      );
    } else if (catalogFacet) {
      setCatalogFacet(null);
    }
  }, [usePaginatedCatalog, catalogFacet, pageBrandId]);

  // Callback estable que el sidebar usa para empujar UNA faceta al servidor.
  // null = sin faceta de servidor (vuelve a la primera página del catálogo).
  //
  // CLAVE (marca server-side + categoría cliente): Firestore solo permite UNA
  // faceta+orden por query. Cuando hay pageBrandId, la faceta de MARCA es la
  // server-side FIJA, así que IGNORAMOS lo que empuje el sidebar (que sería la
  // categoría): la categoría se aplica como filtro de CLIENTE en
  // SidebarCatalogLayout sobre las páginas de esa marca. Sin pageBrandId, todo
  // queda EXACTAMENTE como hoy (la categoría puede ir server-side).
  const handleServerFacetChange = useCallback((facet) => {
    if (pageBrandId) {
      // Mantén SIEMPRE la marca server-side; no la sobrescribas con la categoría.
      // Reusa el objeto previo si ya es la marca (evita re-render/refetch inútil).
      setCatalogFacet((prev) =>
        prev && prev.type === 'brand' && prev.value === pageBrandId
          ? prev
          : { type: 'brand', value: pageBrandId }
      );
      return;
    }
    setCatalogFacet(facet || null);
  }, [pageBrandId]);

  // Fase 1: la búsqueda de la tienda lleva a la página facetada /buscar (searchCatalog).
  // Si el término viene vacío, mantiene el filtrado en página (comportamiento previo).
  const handleSearch = (term) => {
    const q = (term || '').trim();
    if (q) navigate(`/buscar?q=${encodeURIComponent(q)}`);
    else setSearchTerm('');
  };

  // ── Valores con fallback inmediato — NUNCA esperar a que carguen ──
  // MENSAJES DE TIENDA POR MARCA: en página de marca (pageBrandId), si la marca
  // tiene storeTitle/storeSubtitle/storeEmpty propios (no vacíos), se usan esos;
  // si no, cae al mensaje global (mismo de siempre). Sin marca, comportamiento
  // EXACTO como hoy (global).
  const title = (pageBrandId && pageBrandData?.storeTitle?.trim())
    ? pageBrandData.storeTitle.trim()
    : (storeMessages?.title ?? DEFAULT_STORE_TITLE);
  const subtitle = (pageBrandId && pageBrandData?.storeSubtitle?.trim())
    ? pageBrandData.storeSubtitle.trim()
    : (storeMessages?.subtitle ?? DEFAULT_STORE_SUBTITLE);
  const emptyMessage = (pageBrandId && pageBrandData?.storeEmpty?.trim())
    ? pageBrandData.storeEmpty.trim()
    : (storeMessages?.emptyMessage ?? '');
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

  // ¿Hay una sección 'categories_nav' (con marca) en la página? Solo entonces el
  // sidebar_catalog deja que TiendaPage controle su categoría (estado compartido
  // con el nav). Sin nav, el sidebar conserva su estado interno (retrocompatible).
  const hasCategoriesNav = displaySections.some(
    (sec) => sec?.type === 'categories_nav' && (sec?.settings?.brandId || '').trim() !== ''
  );

  // ── RENDERIZADO PROGRESIVO ────────────────────────────────────────

  let emptyMessageShown = false;

  // ── DATOS RESUELTOS PARA EL CATÁLOGO (product_grid / sidebar_catalog) ──
  // Según el modo:
  //  · Paginado (tienda normal): se usan las páginas de la infinite query, con
  //    "Cargar más" + scroll incremental que pide la siguiente página (cursor).
  //  · No paginado (categoría/búsqueda en la URL): se conserva el comportamiento
  //    previo con productsData (conjunto ya acotado) y grilla incremental en RAM.
  const catalogProducts = usePaginatedCatalog ? paginatedItems : (productsData || []);
  const catalogLoadingResolved = usePaginatedCatalog ? catalogLoading : productsLoading;
  const catalogErrorResolved = usePaginatedCatalog
    ? (catalogError?.message || null)
    : (productsError?.message || null);
  // Props de paginación servidor: solo se pasan en modo paginado (si no, el grid
  // usa su modo incremental en RAM, idéntico a hoy).
  const catalogPaginationProps = usePaginatedCatalog
    ? {
        hasMore: !!catalogHasMore,
        onLoadMore: catalogFetchNext,
        isFetchingMore: catalogFetchingMore,
      }
    : {};
  // ¿Está vacío el catálogo? (respeta el spinner: durante la carga no se da por vacío)
  const catalogIsEmpty = !catalogLoadingResolved && catalogProducts.length === 0;

  const renderSection = (section) => {
    const s = section.settings || {};
    switch (section.type) {
      case 'header': {
        // Landing específica: "reloj matador" ya tiene otra forma de elegir acabado
        // (evitamos duplicidad en la estructura final).
        if (isKcheroLanding(pageId) && (s.title || '').trim() === 'Elige tu acabado') {
          return null;
        }
        if (isKcheroLanding(pageId) && (s.title || '').trim() === 'En acción') {
          return null;
        }
        // Bloque final "Últimas unidades" (CTA "Comprar ahora") — eliminado a pedido:
        // la barra sticky ya cumple ese rol de cierre.
        if (isKcheroLanding(pageId) && (s.title || '').trim() === 'Últimas unidades') {
          return null;
        }
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0, overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <HeaderBlock config={s} />
          </section>
        );
      }
      case 'categories_nav': {
        // Nav de categorías con MINIATURAS por marca. La marca se elige en el
        // editor (s.brandId); sus burbujas vienen del `categoryNav` de esa marca.
        const navBrandId = (s.brandId || '').trim();
        // El query devuelve { items, style } por marca. Retrocompat: sin entrada o
        // sin style → burbujas vacías y estilo default { align:'center', animation:'static' }.
        const navEntry = navBrandId ? navCategoriesByBrand?.[navBrandId] : null;
        const navCategorias = navEntry?.items || [];
        const navStyle = navEntry?.style || { align: 'center', animation: 'static' };
        // RETROCOMPAT: sin marca configurada, no renderizamos el nav (queda vacío),
        // igual que antes esta sección no pintaba nada en el storefront.
        if (!navBrandId) return null;
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ overflow: 'hidden' }}>
            <SectionBackground config={s} />
            {/* Modo FILTRO LOCAL: cada burbuja fija navCategoryId (cliente), que el
                sidebar_catalog de esta misma página usa como filtro de categoría.
                La burbuja "Todos" limpia el filtro (null).
                align/animation vienen del categoryNavStyle de la marca (sincronizado). */}
            <VisualCategoryNav
              categories={navCategorias}
              activeCategory={navCategoryId}
              onSelectCategory={setNavCategoryId}
              align={navStyle.align}
              animation={navStyle.animation}
            />
          </section>
        );
      }
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
        if (
          isKcheroLanding(pageId) &&
          /video-02\.mp4/i.test(s.url)
        ) {
          return null;
        }
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

        const isPortraitVideo = aspect === '9:16';
        // En mobile el 9:16 ocupa más de 1 viewport y el <video controls> traga la rueda/gesto.
        const videoMaxHeight = isPortraitVideo ? 'min(68dvh, 520px)' : undefined;

        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <div 
              className={styles.sectionVideo} 
              style={{ 
                position: 'relative', 
                paddingBottom: forceRatio && !isPortraitVideo ? paddingBottom : '0',
                height: isPortraitVideo ? videoMaxHeight : (forceRatio ? '0' : 'auto'),
                aspectRatio: isPortraitVideo ? '9 / 16' : undefined,
                maxHeight: videoMaxHeight,
                overflow: 'hidden', 
                borderRadius: '12px',
                maxWidth: aspect === '9:16' ? '450px' : (aspect === '1:1' ? '600px' : '100%'),
                margin: '0 auto',
                background: '#000',
                touchAction: 'pan-y',
              }}
            >
              {isEmbed ? (
                <iframe 
                  title="Video" 
                  src={finalUrl} 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                />
              ) : (
                <video 
                  src={finalUrl} 
                  poster={s.poster || undefined} 
                  controls={s.controls === true}
                  playsInline
                  muted={s.autoplay !== false}
                  autoPlay={s.autoplay !== false}
                  loop={s.loop !== false}
                  style={{ 
                    position: forceRatio || isPortraitVideo ? 'absolute' : 'relative',
                    top: 0, left: 0, 
                    width: '100%', 
                    height: forceRatio || isPortraitVideo ? '100%' : 'auto',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    pointerEvents: 'none',
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
               brandId={pageBrandId}
            />
          </section>
        );
      case 'testimonials':
        // Comentarios ya están en el conversion_fold (carrusel arriba)
        if (isKcheroLanding(pageId)) return null;
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
      case 'feature_list': {
        if (isKcheroLanding(pageId)) {
          const sub = (s.subtitle || '').trim();
          const title = (s.title || '').trim();
          const itemsText = Array.isArray(s.items) ? s.items.map((item) => (item?.text || '').trim()) : [];
          // Galería redundante (imagen grande + bullets de color)
          if (sub === 'Indica tu color al pedir o por WhatsApp') return null;
          // Segunda imagen suelta + testimonio embebido
          if (!title && !sub && (s.quote || '').trim()) return null;
          // Bloque compra segura / garantías redundante
          if (sub === 'Tu dinero protegido hasta que lo tengas en mano') return null;
          // Bloque de beneficios redundante antes del carrusel
          if (
            sub === 'Un reloj elegante, resistente y listo para usar todos los días.' ||
            itemsText.includes('Cronógrafo funcional + ventana de fecha')
          ) {
            return null;
          }
        }
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0, overflow: 'hidden' }}>
            <FeatureList config={s} />
          </section>
        );
      }
      case 'faq_accordion': {
        const faqConfig = isKcheroLanding(pageId)
          ? { ...s, items: MATADOR_FAQ_ITEMS }
          : s;
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0, overflow: 'hidden' }}>
            <FaqAccordion config={faqConfig} />
          </section>
        );
      }
      case 'conversion_fold':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ padding: 0, overflow: 'hidden' }}>
            <ConversionFold config={s} />
          </section>
        );
      case 'landing_payment': {
        const payConfig = isKcheroLanding(pageId)
          ? {
              ...s,
              landingSlug: pageId,
              peruOnly: true,
              showPayPal: false,
              montoUSD: 0,
            }
          : { ...s, landingSlug: pageId };
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '1.5rem', paddingBottom: s.paddingBottom || '0', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <LandingPaymentBlock config={payConfig} />
          </section>
        );
      }
      case 'marquee':
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <BrandMarquee items={s.items} speed={s.speed} title={s.title} />
          </section>
        );
      case 'bestsellers_row':
        // Coverflow del fold ya muestra los 14 acabados arriba
        if (isKcheroLanding(pageId)) return null;
        return (
          <section
            key={section.id}
            id={s.anchorId || undefined}
            className={styles.sectionBlock}
            style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'visible' }}
          >
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
              brandId={pageBrandId}
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
        const isEmpty = catalogIsEmpty;
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
            {/* Grilla con paginación por cursor (modo tienda) o incremental en RAM */}
            <ProductGrid
              products={catalogProducts}
              loading={catalogLoadingResolved}
              error={catalogErrorResolved}
              emptyMessage={emptyMessage}
              categories={categoriesData}
              layoutConfig={storeConfig?.layout}
              {...catalogPaginationProps}
            />
          </section>
        );
      }
      case 'sidebar_catalog': {
        const isEmpty = catalogIsEmpty;
        if (isEmpty) {
          if (emptyMessageShown) return null;
          emptyMessageShown = true;
        }
        return (
          <section key={section.id} className={styles.sectionBlock} style={{ paddingTop: s.paddingTop || '0rem', paddingBottom: s.paddingBottom || '0rem', overflow: 'hidden' }}>
            <SectionBackground config={s} />
            <SidebarCatalogLayout
              productsData={catalogProducts}
              productsLoading={catalogLoadingResolved}
              productsError={catalogErrorResolved}
              emptyMessage={emptyMessage}
              categories={categoriesData}
              // ── Aislamiento del sidebar por marca (multimarca) ──────────────
              // Con pageBrandId, el sidebar deriva sus facetas SOLO de los
              // productos de la marca (patrón categories_nav: :474-501). Sin
              // pageBrandId (Con Amor / páginas globales) llega null y el
              // sidebar mantiene EXACTAMENTE las listas globales de hoy.
              brandId={pageBrandId}
              layoutConfig={storeConfig?.layout}
              title={(!isEmpty && s.title) ? s.title : undefined}
              paginationProps={catalogPaginationProps}
              onServerFacetChange={usePaginatedCatalog ? handleServerFacetChange : undefined}
              serverFacet={usePaginatedCatalog ? catalogFacet : null}
              {...(hasCategoriesNav
                ? { controlledCategory: navCategoryId, onCategoryChange: setNavCategoryId }
                : {})}
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
    // En una landing NO mostramos texto de sistema ("Cargando configuración…"):
    // se ve roto y rompe la continuidad. Reusamos el mismo fondo oscuro del
    // arranque (.landing-page-boot) para que la transición sea invisible.
    if (isLandingPage) {
      return <div className="landing-page-boot" aria-busy="true" aria-label="Cargando" />;
    }
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
      {/* INDICADOR DE MARCA ACTIVA: solo en páginas de marca (pageBrandId). No
          intrusivo, arriba del contenido, para que el cliente sepa en qué tienda
          está. Sin marca (Con Amor / páginas globales) no se renderiza nada,
          quedando EXACTO como hoy. */}
      {pageBrandId && pageBrandData?.name && (
        <div className={styles.brandActiveBar}>
          {pageBrandData.logoUrl && (
            <img
              src={pageBrandData.logoUrl}
              alt=""
              aria-hidden="true"
              className={styles.brandActiveBarLogo}
            />
          )}
          <span className={styles.brandActiveBarLabel}>
            Estás en: <span className={styles.brandActiveBarName}>{pageBrandData.name}</span>
          </span>
        </div>
      )}
      {!isLandingPage && !categoryId && !searchTerm && <AppDownloadBanner />}
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
