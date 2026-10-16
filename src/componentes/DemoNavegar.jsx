import TIENDA from './demo/tienda.json';
import LANDINGS from './demo/landings.json';
import MARCAS from './demo/marcas.json';
import { navDeMarca } from './kit';

/*
 * Las páginas de marca (/:slug) en la Tienda de prueba, con el diseño nuevo
 * (PaginaMarca). Los productos son reales: los de la landing de cada marca
 * (demo/landings.json) o los de demo/tienda.json. (La pestaña "Landing de
 * marca", con las landings del builder tal como están hoy, se quitó el
 * 2026-10-16; los nichos y los vendedores también se retiraron ese día.)
 */

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
  ['comoHoy', 'Sin identidad (violeta de Walá)'],
];
export const ESTADOS_MARCA = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['sinProductos', 'Sin productos'],
];
const MARCA_DE_CASO = { geeks: GEEKS, parejas: PAREJAS, yoryo: YORYO, comoHoy: PAREJAS };

/** Los productos reales de una marca: los de su landing o los de tienda.json. */
function productosDe(brandId) {
  const landing = LANDINGS.landings.find((l) => l.brandId === brandId);
  return landing ? landing.productos : TIENDA.productos.filter((p) => p.brandId === brandId);
}

/**
 * La ruta de una marca (/conamorgeeks, del menú Marcas) → el caso de la
 * página: el de ejemplo si tiene identidad; si no, la marca tal cual (su id).
 * Las marcas sin productos en los datos de la demo no abren (en la tienda
 * sí tienen): null, como cualquier ruta que la demo no tiene.
 */
export function casoDeRuta(ruta) {
  const m = MARCAS.find((x) => `/${x.slug}` === ruta);
  if (!m || !productosDe(m.id).length) return null;
  return ['geeks', 'parejas', 'yoryo'].find((k) => MARCA_DE_CASO[k] === m.id) || m.id;
}

/**
 * Los datos de PaginaMarca (caso: uno de CASOS_MARCA o el id de una marca):
 * la marca real (marcas.json) con su identidad de ejemplo (sin ella, el
 * violeta de Walá) y sus productos reales (los de su landing o, si no
 * tiene, los de tienda.json).
 */
export function datosMarca(caso) {
  const brandId = MARCA_DE_CASO[caso] || (MARCAS.some((m) => m.id === caso) ? caso : GEEKS);
  const base = MARCAS.find((m) => m.id === brandId) || { id: brandId };
  const marca = caso === 'comoHoy' || !IDENTIDADES[brandId] ? base : { ...base, identidad: IDENTIDADES[brandId] };
  return { marca, ...repartir(productosDe(brandId), brandId) };
}
