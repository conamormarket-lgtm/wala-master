export const PRODUCT_ROUTE = '/producto/:id';
export const PRODUCT_LANDING_ROUTE = '/producto/:id/landing';

/** The landing is another view of the same product, not another product ID. */
export function productRoute(pathname) {
  const match = /^\/producto\/([^/?#]+)(\/landing)?\/*$/i.exec(pathname || '');
  if (!match) return null;
  let id;
  try { id = decodeURIComponent(match[1]); } catch { return null; }
  if (!id || id.includes('/')) return null;
  return { id, landing: Boolean(match[2]) };
}

export const isProductLandingPath = pathname => productRoute(pathname)?.landing === true;

export function replacementProductLocation(id, location) {
  return {
    pathname: `/producto/${encodeURIComponent(id)}${isProductLandingPath(location.pathname) ? '/landing' : ''}`,
    search: location.search,
    hash: location.hash,
  };
}
