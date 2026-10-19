import React, { lazy, useState } from 'react';

// Cada tipo de sección del constructor va en su propio archivo: la portada solo
// descarga las que usa (antes las ~25 viajaban en el bundle de arranque de
// cualquier visita, p. ej. la landing del reloj en cada portada).
//
// Para que no se note la espera, loadStorefrontPage (startup.js) las empieza a
// pedir apenas llega la configuración de la página, en paralelo con el resto
// del arranque. Si al dibujar ya llegaron, se pintan directo, sin Suspense.

function seccion(cargar) {
  let modulo = null;
  let promesa = null;
  const precargar = () => {
    promesa ||= cargar().then(
      (m) => { modulo = m; return m; },
      (error) => { promesa = null; throw error; }, // reintenta al dibujar
    );
    return promesa;
  };
  const Perezosa = lazy(precargar);
  function Seccion(props) {
    // Se decide al montar: cambiar de tipo de componente después lo remontaría.
    const [Lista] = useState(() => modulo?.default || null);
    return Lista ? <Lista {...props} /> : <Perezosa {...props} />;
  }
  Seccion.precargar = precargar;
  return Seccion;
}

export const AnnouncementBar = seccion(() => import('../components/AnnouncementBar'));
export const BannerGrid = seccion(() => import('../components/BannerGrid/BannerGrid'));
export const BestSellersRow = seccion(() => import('../components/BestSellersRow/BestSellersRow'));
export const BrandMarquee = seccion(() => import('../components/BrandMarquee/BrandMarquee'));
export const CategoryGrid = seccion(() => import('../components/CategoryGrid/CategoryGrid'));
export const CollectionCarousel = seccion(() => import('../components/CollectionCarousel'));
export const FaqAccordion = seccion(() => import('../components/FaqAccordion/FaqAccordion'));
export const FeatureList = seccion(() => import('../components/FeatureList/FeatureList'));
export const FeaturedCarousel = seccion(() => import('../components/FeaturedCarousel'));
export const FlashSales = seccion(() => import('../components/FlashSales'));
export const HeaderBlock = seccion(() => import('../components/HeaderBlock/HeaderBlock'));
export const HeroBanner = seccion(() => import('../components/HeroBanner'));
export const HeroCarousel = seccion(() => import('../components/HeroCarousel'));
export const ImageBlock = seccion(() => import('../components/ImageBlock/ImageBlock'));
export const MapLocation = seccion(() => import('../components/MapLocation'));
export const ProductGrid = seccion(() => import('../components/ProductGrid'));
export const ProductQueryCarousel = seccion(() => import('../components/ProductQueryCarousel/ProductQueryCarousel'));
export const SidebarCatalogLayout = seccion(() => import('../components/SidebarCatalogLayout'));
export const Testimonials = seccion(() => import('../components/Testimonials'));
export const TextBlock = seccion(() => import('../components/TextBlock/TextBlock'));
export const TrustBadges = seccion(() => import('../components/TrustBadges/TrustBadges'));
export const VisualCategoryNav = seccion(() => import('../components/VisualCategoryNav/VisualCategoryNav'));

// Qué componente dibuja cada tipo (los que no salen aquí, como 'video', se
// dibujan directo en TiendaPage).
const POR_TIPO = {
  header: HeaderBlock,
  categories_nav: VisualCategoryNav,
  hero_banner: HeroBanner,
  text: TextBlock,
  image: ImageBlock,
  announcement_bar: AnnouncementBar,
  hero_carousel: HeroCarousel,
  flash_sales: FlashSales,
  testimonials: Testimonials,
  map_location: MapLocation,
  trust_badges: TrustBadges,
  feature_list: FeatureList,
  faq_accordion: FaqAccordion,
  marquee: BrandMarquee,
  bestsellers_row: BestSellersRow,
  featured_products: ProductGrid,
  collection_carousel: CollectionCarousel,
  new_arrivals_carousel: ProductQueryCarousel,
  sale_carousel: ProductQueryCarousel,
  category_carousel: ProductQueryCarousel,
  category_grid: CategoryGrid,
  banner_grid: BannerGrid,
  featured_carousel: FeaturedCarousel,
  product_grid: ProductGrid,
  sidebar_catalog: SidebarCatalogLayout,
};

/** Pide el código de esas secciones; la promesa se cumple cuando llegó todo. */
export function precargarSecciones(sections = []) {
  const componentes = new Set(sections.map((s) => POR_TIPO[s?.type]).filter(Boolean));
  return Promise.all([...componentes].map((c) => c.precargar()));
}
