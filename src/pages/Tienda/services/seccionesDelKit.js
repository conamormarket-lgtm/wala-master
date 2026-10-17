// Qué secciones del builder dibuja el kit (paso 5 de la migración,
// guia/MIGRACION.md). Lo usan TiendaPage (para elegir qué dibuja) y el
// arranque (startup.js, para no bajar el código viejo de lo que ya no se usa).
import { isKcheroLanding } from '../../../constants/landingSlugs';

/** Tipos que ya tienen su sección en el kit (Secciones.jsx, REGISTRO_SECCIONES). */
export const TIPOS_DEL_KIT = new Set([
  'announcement_bar', 'hero_carousel', 'trust_badges', 'testimonials', 'faq_accordion',
  'featured_carousel', 'new_arrivals_carousel', 'sale_carousel', 'category_carousel', 'collection_carousel',
  'flash_sales', 'banner_grid', 'category_grid', 'header', 'marquee', 'sidebar_catalog', 'product_grid',
  'featured_products', 'hero_banner', 'categories_nav', 'text', 'image', 'video', 'bestsellers_row',
  'feature_list', 'map_location',
]);

/** Los tipos propios de la landing del reloj (cacherito): no van al kit. */
const TIPOS_DEL_CACHERITO = new Set(['conversion_fold', 'landing_payment']);

/**
 * ¿Es una página del cacherito? Las del reloj K-CHERO por su slug y
 * cualquier otra que lleve su pliegue o su pago (p. ej. el combo reloj +
 * billetera). Esas páginas siguen enteras con lo de antes.
 */
export const esDelCacherito = (pageId, secciones = []) =>
  isKcheroLanding(pageId) || secciones.some((s) => TIPOS_DEL_CACHERITO.has(s?.type));
