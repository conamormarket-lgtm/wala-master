import { getDocument, setDocument } from '../../../services/firebase/firestore';

const COLLECTION = 'storefront';
const DOC_ID = 'config';

/**
 * Genera un id único para una sección
 */
export function createSectionId() {
  return `section_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Settings por defecto según tipo de sección
 */
/**
 * Tipos de sección disponibles
 */
export const SECTION_TYPES = [
  { id: 'hero_banner', label: 'Banner Principal (Hero)' },
  { id: 'header', label: 'Encabezado (título y subtítulo)' },
  { id: 'text', label: 'Texto' },
  { id: 'image', label: 'Imagen' },
  { id: 'video', label: 'Video' },
  { id: 'featured_products', label: 'Productos destacados' },
  { id: 'collection_carousel', label: 'Carrusel de colección' },
  { id: 'categories_nav', label: 'Navegación por categorías' },
  { id: 'product_grid', label: 'Grid de productos simple' },
  { id: 'sidebar_catalog', label: 'Catálogo con Sidebar (Mercado Libre)' },
  { id: 'announcement_bar', label: 'Barra de Anuncios Superior' },
  { id: 'hero_carousel', label: 'Carrusel Principal (Hero Slider)' },
  { id: 'trust_badges', label: 'Íconos de Confianza (Badges)' },
  { id: 'flash_sales', label: 'Ofertas Flash (Cuenta Regresiva)' },
  { id: 'testimonials', label: 'Testimonios / Opiniones' },
  { id: 'marquee', label: 'Carrusel de Logos / Marcas' },
  { id: 'bestsellers_row', label: 'Lo Más Vendido (Fila de 5)' },
  { id: 'footer_columns', label: 'Pie de Página (Columnas/Enlaces)' },
  { id: 'map_location', label: 'Ubicación / Mapa' }
];

export function getDefaultSettings(type) {
  switch (type) {
    case 'hero_banner':
      return {
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=2070&auto=format&fit=crop',
        title: 'NUEVA COLECCIÓN',
        subtitle: 'Diseñada para destacar. Construida para durar.',
        buttonText: 'COMPRAR AHORA',
        buttonLink: '/tienda'
      };
    case 'header':
      return { title: 'Nuestra Tienda', subtitle: 'Explora nuestros productos.' };
    case 'text':
      return { heading: '', content: '' };
    case 'image':
      return { url: '', alt: '', link: '' };
    case 'video':
      return { url: '', poster: '' };
    case 'featured_products':
      return { title: 'Productos destacados' };
    case 'collection_carousel':
      return { title: '', collection: '' };
    case 'categories_nav':
      return {};
    case 'product_grid':
      return { title: '', show_search: true };
    case 'sidebar_catalog':
      return { title: 'Catálogo Completo' };
    case 'announcement_bar':
      return { messages: [{ text: 'Envío gratis a Lima', link: '' }], speed: 3000, bgColor: '#000000', textColor: '#ffffff' };
    case 'hero_carousel':
      return { slides: [{ imageUrl: '', link: '', alt: '' }], autoPlaySpeed: 5000 };
    case 'trust_badges':
      return { badges: [{ icon: 'truck', text: 'Envío Rápido' }, { icon: 'lock', text: 'Pago Seguro' }] };
    case 'flash_sales':
      return { title: 'Ofertas Relámpago', collection: '', endTime: new Date(Date.now() + 86400000).toISOString() };
    case 'testimonials':
      return { title: 'Lo que dicen nuestros clientes', testimonials: [{ text: 'Me encantó mi polera, el diseño súper nítido!', author: 'María P.', rating: 5 }] };
    case 'marquee':
      return { items: [{ imageUrl: '', alt: 'Marca 1' }], speed: 20000 };
    case 'bestsellers_row':
      return {
        cards: [
          { id: 'card1', title: 'Top 1', subtitle: 'Descripción breve', imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80', link: '/tienda' },
          { id: 'card2', title: 'Top 2', subtitle: 'Descripción breve', imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80', link: '/tienda' },
          { id: 'card3', title: 'Top 3', subtitle: 'Descripción breve', imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80', link: '/tienda' },
          { id: 'card4', title: 'Top 4', subtitle: 'Descripción breve', imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80', link: '/tienda' },
          { id: 'card5', title: 'Top 5', subtitle: 'Descripción breve', imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80', link: '/tienda' }
        ]
      };
    case 'footer_columns':
      return {
        columns: [
          {
            id: 'col_1',
            title: 'Walá',
            content: 'Prendas personalizadas con amor y dedicación',
            type: 'text' // text, links, social
          },
          {
            id: 'col_2',
            title: 'Enlaces',
            type: 'links',
            links: [
              { text: 'Tienda', url: '/tienda' },
              { text: 'Mi cuenta', url: '/cuenta' }
            ]
          }
        ]
      };
    case 'map_location':
      return {
        title: 'Encuéntranos',
        description: 'Visita nuestra tienda física de Lunes a Viernes de 9am a 6pm.',
        embedUrl: '',
        layout: 'mapRight',
        mapWidth: '50%',
        mapHeight: '400px'
      };
    default:
      return {};
  }
}

/**
 * Obtener la configuración del storefront (secciones ordenadas).
 * Acepta un pageId. Si es 'home', busca también en 'storefront/config' por retrocompatibilidad.
 */
export async function getStorefrontConfig(pageId = 'home') {
  const collection = 'pages';
  const { data, error } = await getDocument(collection, pageId);
  
  if (data?.sections && Array.isArray(data.sections)) {
    return { sections: [...data.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), error: null };
  }

  // Fallback para Home desde la colección antigua 'storefront'
  if (pageId === 'home') {
    const { data: legacyData, error: legacyError } = await getDocument('storefront', 'config');
    if (legacyData?.sections && Array.isArray(legacyData.sections)) {
      return { sections: [...legacyData.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), error: null };
    }
  }

  // Si no hay nada, devuelve el default para esa página
  return { sections: getDefaultSections(pageId), error: null };
}

/**
 * Config por defecto según la página
 */
function getDefaultSections(pageId) {
  if (pageId === 'home') {
    return [
      { id: createSectionId(), type: 'hero_banner', order: 0, settings: getDefaultSettings('hero_banner') },
      { id: createSectionId(), type: 'header', order: 1, settings: getDefaultSettings('header') },
      { id: createSectionId(), type: 'featured_products', order: 2, settings: getDefaultSettings('featured_products') },
      { id: createSectionId(), type: 'categories_nav', order: 3, settings: {} },
      { id: createSectionId(), type: 'product_grid', order: 4, settings: getDefaultSettings('product_grid') }
    ];
  } else if (pageId === 'tienda') {
    return [
      { id: createSectionId(), type: 'header', order: 0, settings: { title: 'Tienda Completa', subtitle: 'Todos nuestros productos' } },
      { id: createSectionId(), type: 'sidebar_catalog', order: 1, settings: getDefaultSettings('sidebar_catalog') }
    ];
  }
  
  return [];
}

export function getDefaultFavoritesPopupSettings() {
  return {
    loggedOutTitle: 'Tus Favoritos',
    loggedOutText: 'Aún no tienes artículos guardados. Inicia sesión para crear tu lista de deseos.',
    loggedInTitle: 'Tus Favoritos',
    loggedInText: 'Aún no has marcado nada como favorito.',
    buttonText: 'Mira lo que te puede interesar',
    buttonLink: '/tienda',
    fontFamily: '',
    fontSize: '14px',
    color: '#666666',
    bold: false,
    italic: false
  };
}

/**
 * Guardar la configuración del storefront (array de secciones) para una página específica.
 */
export async function saveStorefrontConfig(sections, pageId = 'home') {
  const list = Array.isArray(sections) ? sections : [];
  const cleaned = JSON.parse(JSON.stringify(list));
  const payload = { sections: cleaned };
  
  // Guardar en la nueva colección pages
  const result = await setDocument('pages', pageId, payload);
  
  // Guardar también en el lugar legacy para mantener compatibilidad temporal si es el home
  if (pageId === 'home') {
    await setDocument('storefront', 'config', payload);
  }
  
  return result;
}
