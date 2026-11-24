import { productRoute } from './productRoute.mjs';

// El origen viaja en el enlace de compra (también al volver al carrito).
// Visitar una landing no cambia los demás checkouts del navegador.
export function productoLandingDeCompra(location = {}) {
  const product = productRoute(location.pathname);
  if (product?.landing) return product.id;
  if (!/^\/(checkout|carrito)\/?$/.test(location.pathname || '')) return null;
  const id = new URLSearchParams(location.search || '').get('landing');
  return id && id.trim() === id && !/[/?#]/.test(id) ? id : null;
}

export function rutaCompra(location, destino = '/checkout') {
  const id = productoLandingDeCompra(location);
  return id ? `${destino}?${new URLSearchParams({ landing: id })}` : destino;
}

export function isLandingCheckout(location = {}) {
  return /^\/checkout\/?$/.test(location.pathname || '') && Boolean(productoLandingDeCompra(location));
}
