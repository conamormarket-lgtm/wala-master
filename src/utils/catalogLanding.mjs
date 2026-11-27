export const LUMI_CATALOG_LANDING_ROUTE = '/lumi/landing';
export const LUMI_CART_ROUTE = '/carrito?catalogo=lumi';

export const isLumiCatalogLandingPath = (pathname) => /^\/lumi\/landing\/*$/i.test(pathname || '');

// The origin stays in this link, so other Walá carts keep their usual layout.
export const isLumiCart = (location = {}) => /^\/carrito\/?$/.test(location.pathname || '')
  && new URLSearchParams(location.search || '').get('catalogo') === 'lumi';

export const isLumiProduct = (location = {}) => /^\/producto\/[^/]+\/?$/.test(location.pathname || '')
  && new URLSearchParams(location.search || '').get('catalogo') === 'lumi';

/** Keep the existing catalog and everything below it, without copying its data. */
export function sectionsFromCatalog(sections) {
  const index = sections.findIndex(({ type }) => type === 'sidebar_catalog' || type === 'product_grid');
  return index < 0 ? [] : sections.slice(index);
}
