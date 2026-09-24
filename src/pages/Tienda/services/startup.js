import { getStorefrontConfig, migrateHomeCategoryGrid } from './storefront';
import { firstHeroUrl } from './startup.mjs';
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

export async function loadStorefrontPage(pageId) {
  const bootstrap = typeof window !== 'undefined' && window.__walaStorefrontBootstrap;
  if (bootstrap?.pageId === pageId && !bootstrap.consumed) {
    bootstrap.consumed = true;
    const initialSections = await bootstrap.promise;
    if (initialSections) {
      const sections = migrateHomeCategoryGrid(initialSections, pageId);
      preloadHero(sections);
      return { sections };
    }
  }
  const { sections, error } = await getStorefrontConfig(pageId);
  if (error) throw new Error(error);
  preloadHero(sections || []);
  return { sections: sections || [] };
}
