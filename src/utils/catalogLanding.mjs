export const LUMI_CATALOG_LANDING_ROUTE = '/lumi/landing';

export const isLumiCatalogLandingPath = (pathname) => /^\/lumi\/landing\/*$/i.test(pathname || '');

/** Keep the existing catalog and everything below it, without copying its data. */
export function sectionsFromCatalog(sections) {
  const index = sections.findIndex(({ type }) => type === 'sidebar_catalog' || type === 'product_grid');
  return index < 0 ? [] : sections.slice(index);
}
