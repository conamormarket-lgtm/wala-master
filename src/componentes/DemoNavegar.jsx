import TIENDA from './demo/tienda.json';
import LANDINGS from './demo/landings.json';
import MARCAS from './demo/marcas.json';
import { navDeMarca } from './kit';

/*
 * Las landings del builder (/:slug) en la Tienda de prueba. Son reales:
 * landingPages + pages/{slug} y los productos de esas marcas
 * (demo/landings.json). (Los nichos y los vendedores se retiraron el
 * 2026-10-16.)
 */

/* ── Landings del builder (/:slug) ── */

export const LANDINGS_DEMO = LANDINGS.landings;
export const VISTAS_LANDING = LANDINGS.landings.map((l) => [l.titulo, `/${l.slug}`]);

/** Los productos de una marca repartidos como los pide cada sección (como TiendaPage). */
function repartir(productos, brandId) {
  const usadas = new Set(productos.flatMap((p) => p.categories || []));
  const categorias = TIENDA.categorias.filter((c) => usadas.has(c.id)).map((c) => ({
    categoryId: c.id, name: c.name, imageUrl: c.imageUrl, cuenta: productos.filter((p) => (p.categories || []).includes(c.id)).length,
  }));
  const porCategoria = Object.fromEntries(categorias.map((c) => [c.categoryId, productos.filter((p) => (p.categories || []).includes(c.categoryId))]));
  // Las burbujas de categories_nav: la lista curada real de la marca (marcas.json).
  const marca = MARCAS.find((m) => m.id === brandId) || {};
  return {
    categorias,
    navPorMarca: brandId ? { [brandId]: navDeMarca(marca, { productos, categorias: TIENDA.categorias }) } : {},
    productos: {
      destacados: productos.filter((p) => p.featured === true).sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0)),
      ofertas: productos.filter((p) => Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price)),
      nuevos: productos,
      porCategoria,
      todos: productos,
    },
  };
}

/**
 * Lo que la página de una landing necesita, como lo arma TiendaPage con
 * pageBrandIdOverride: los productos de esa marca repartidos por sección y
 * las categorías que usan.
 */
export function datosLanding(slug) {
  const l = LANDINGS.landings.find((x) => x.slug === slug) || LANDINGS.landings[0];
  return { landing: l, ...repartir(l.productos, l.brandId) };
}

/* ── Página de marca (PaginaMarca: identidad + plantilla) ── */

const GEEKS = 'xjlrkw1JM8InbEw1mWtt';
const PAREJAS = 'y5eh2sd61nUC5kTBndax';
const YORYO = 'rEPEpl4Hvzi6ogOBHn7x';
const FOTO_GEEKS = LANDINGS.landings.find((l) => l.brandId === GEEKS)?.secciones.find((s) => s.type === 'hero_banner')?.settings?.mediaUrl;

/*
 * Identidades DE EJEMPLO: todavía no hay dónde elegirlas (en tienda_brands
 * todas tienen bgColor blanco). Los colores salen de cada logo (Con Amor
 * Geeks: rojo y azul marino; Con Amor Parejas: rojo; Yoryo: negro y crema) y
 * la foto de Con Amor Geeks es la de su landing real. Las frases son de
 * ejemplo.
 */
const IDENTIDADES = {
  [GEEKS]: { color: '#D7192D', color2: '#0F2A5C', estilo: 'foto', imagen: FOTO_GEEKS, frase: 'Anime, series y gaming: casacas para tu lado geek.' },
  [PAREJAS]: { color: '#E3141B', estilo: 'color', frase: 'Regalos para dos, con su nombre y su fecha.' },
  [YORYO]: { color: '#1C1917', color2: '#EFE6CF', estilo: 'collage', frase: 'Relojes y billeteras de estilo clásico.' },
};

/** "Cómo se abre" la página de marca. */
export const CASOS_MARCA = [
  ['geeks', 'Con Amor Geeks · foto'],
  ['parejas', 'Con Amor Parejas · color'],
  ['yoryo', 'Yoryo · collage'],
  ['comoHoy', 'Sin identidad (como hoy)'],
];
export const ESTADOS_MARCA = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['sinProductos', 'Sin productos'],
];
const MARCA_DE_CASO = { geeks: GEEKS, parejas: PAREJAS, yoryo: YORYO, comoHoy: PAREJAS };

/**
 * Los datos de PaginaMarca: la marca real (marcas.json) con su identidad de
 * ejemplo ("Sin identidad": la marca como está hoy, violeta de Walá) y sus
 * productos reales (los de su landing o, si no tiene, los de tienda.json).
 */
export function datosMarca(caso) {
  const brandId = MARCA_DE_CASO[caso] || GEEKS;
  const base = MARCAS.find((m) => m.id === brandId) || { id: brandId };
  const marca = caso === 'comoHoy' ? base : { ...base, identidad: IDENTIDADES[brandId] };
  const landing = LANDINGS.landings.find((l) => l.brandId === brandId);
  const productos = landing ? landing.productos : TIENDA.productos.filter((p) => p.brandId === brandId);
  return { marca, ...repartir(productos, brandId) };
}
