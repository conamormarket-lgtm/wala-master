import TIENDA from './demo/tienda.json';
import LANDINGS from './demo/landings.json';

/*
 * Las landings del builder (/:slug) en la Tienda de prueba. Son reales:
 * landingPages + pages/{slug} y los productos de esas marcas
 * (demo/landings.json). (Los nichos y los vendedores se retiraron el
 * 2026-10-16.)
 */

/* ── Landings del builder (/:slug) ── */

export const LANDINGS_DEMO = LANDINGS.landings;
export const VISTAS_LANDING = LANDINGS.landings.map((l) => [l.titulo, `/${l.slug}`]);

/**
 * Lo que la página de una landing necesita, como lo arma TiendaPage con
 * pageBrandIdOverride: los productos de esa marca repartidos por sección y
 * las categorías que usan.
 */
export function datosLanding(slug) {
  const l = LANDINGS.landings.find((x) => x.slug === slug) || LANDINGS.landings[0];
  const productos = l.productos;
  const usadas = new Set(productos.flatMap((p) => p.categories || []));
  const categorias = TIENDA.categorias.filter((c) => usadas.has(c.id)).map((c) => ({
    categoryId: c.id, name: c.name, imageUrl: c.imageUrl, cuenta: productos.filter((p) => (p.categories || []).includes(c.id)).length,
  }));
  const porCategoria = Object.fromEntries(categorias.map((c) => [c.categoryId, productos.filter((p) => (p.categories || []).includes(c.categoryId))]));
  return {
    landing: l,
    categorias,
    productos: {
      destacados: productos.filter((p) => p.featured === true).sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0)),
      ofertas: productos.filter((p) => Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price)),
      nuevos: productos,
      porCategoria,
      todos: productos,
    },
  };
}
