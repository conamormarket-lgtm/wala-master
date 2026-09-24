// Only the first section and header can hold the initial full-page loader.
export function initialSectionCount(sections = []) {
  const firstContent = sections.findIndex((section) => !['header', 'announcement_bar'].includes(section.type));
  return firstContent < 0 ? sections.length : firstContent + 1;
}

export function resolveCatalogFacet(selection, pageId, brandId) {
  if (brandId) return { type: 'brand', value: brandId };
  return selection.pageId === pageId ? selection.facet : null;
}

export function firstHeroUrl(sections = [], mobile = false) {
  for (const section of [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const settings = section.settings || {};
    if (section.type === 'hero_banner' && settings.mediaType !== 'video' && settings.mediaUrl) return settings.mediaUrl;
    if (section.type === 'hero_carousel') {
      const first = settings.slides?.find((slide) => slide?.imageUrl?.trim());
      if (first) return (mobile && first.mobileImageUrl?.trim()) || first.imageUrl;
    }
  }
  return '';
}

export function criticalQueryNames(sections = []) {
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const names = new Set(['storefront-config', 'store-config-custom']);
  const byType = {
    header: ['store-messages', 'tienda-page-brand'],
    featured_products: ['featured-products', 'categories'],
    featured_carousel: ['featured-products', 'categories'],
    product_grid: ['products', 'products-infinite', 'categories'],
    sidebar_catalog: ['products', 'products-infinite', 'categories'],
    category_grid: ['storefront-category-grid-products', 'categories'],
    categories_nav: ['categories-nav-brands', 'categories'],
    banner_grid: ['brands'],
    collection_carousel: ['collection-products', 'collection-details'],
    flash_sales: ['flash-sales'],
    new_arrivals_carousel: ['query-carousel'],
    sale_carousel: ['query-carousel'],
    category_carousel: ['query-carousel'],
  };
  for (const section of sorted) {
    for (const name of byType[section.type] || []) names.add(name);
    if (!['header', 'announcement_bar'].includes(section.type)) break;
  }
  return names;
}
