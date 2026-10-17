import { getStorefrontConfig, migrateHomeCategoryGrid } from './storefront';
import { firstHeroUrl, initialSectionCount } from './startup.mjs';
import { precargarSecciones } from './seccionesPorTipo';
import { TIPOS_DEL_KIT, esDelCacherito } from './seccionesDelKit';
import { forzadoLocal } from '../../../hooks/useLoViejo';
import { toDirectImageUrl } from '../../../utils/imageUrl';

export function preloadHero(sections) {
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const url = toDirectImageUrl(firstHeroUrl(sections, mobile));
  if (!url || typeof document === 'undefined') return;
  let link = document.getElementById('storefront-hero-preload');
  if (!link) {
    link = document.createElement('link');
    link.id = 'storefront-hero-preload';
    link.rel = 'preload';
    link.as = 'image';
    link.fetchPriority = 'high';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== url) link.href = url;
}

// Pide el código de las secciones apenas se sabe cuáles lleva la página, en
// paralelo con el resto del arranque: las de la primera pantalla ya, las de
// abajo cuando el navegador queda libre (se montan al acercarse con el scroll).
// Lo que dibuja el kit no necesita el código de su componente viejo (salvo
// en el cacherito o con el interruptor seccionesViejo puesto en este
// navegador; el de Firestore se conoce después y, si está, ese código se
// pide al dibujar la sección).
function precargarCodigo(sections, pageId) {
  if (typeof window === 'undefined') return;
  const viejas = esDelCacherito(pageId, sections) || forzadoLocal('secciones')
    ? sections
    : sections.filter((s) => !TIPOS_DEL_KIT.has(s?.type));
  const ordenadas = [...viejas].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const n = initialSectionCount(ordenadas);
  precargarSecciones(ordenadas.slice(0, n)).catch(() => {});
  const resto = () => precargarSecciones(ordenadas.slice(n)).catch(() => {});
  if ('requestIdleCallback' in window) window.requestIdleCallback(resto, { timeout: 4000 });
  else setTimeout(resto, 2000);
}

export async function loadStorefrontPage(pageId) {
  const bootstrap = typeof window !== 'undefined' && window.__walaStorefrontBootstrap;
  if (bootstrap?.pageId === pageId && !bootstrap.consumed) {
    bootstrap.consumed = true;
    const initialSections = await bootstrap.promise;
    if (initialSections) {
      const sections = migrateHomeCategoryGrid(initialSections, pageId);
      preloadHero(sections);
      precargarCodigo(sections, pageId);
      return { sections };
    }
  }
  const { sections, version, error } = await getStorefrontConfig(pageId);
  if (error) throw new Error(error);
  preloadHero(sections || []);
  precargarCodigo(sections || [], pageId);
  return { sections: sections || [], version: version || null };
}
