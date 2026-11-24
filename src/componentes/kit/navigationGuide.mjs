// Admin-configured navigation has generated IDs. Use its destination/menu type
// to identify the actual control, never its label or a page-wide URL search.
export function navigationGuide({ menu, url }) {
  if (menu === 'tienda' || url === '/tienda') return 'store';
  if (url === '/personalizar') return 'create';
  return undefined;
}
