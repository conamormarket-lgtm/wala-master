// Funciones puras de derivación de datos para los dashboards de analítica.
// JS puro (sin React). Todas las funciones son tolerantes a undefined/null,
// estructuras vacías y a las dos formas que pueden tener los contadores en
// adminAnalytics.js: un número plano (p.ej. 12) o un objeto desglosado
// { total, app, web }.
//
// IMPORTANTE: los nombres de campo se derivan de src/services/adminAnalytics.js.
//  - topProducts[]: { name, total, app, web } (a veces enriquecido con
//    { views, category, image }). El recuento real de vistas vive en `total`,
//    aunque también se tolera `views`.
//  - topRoutesByViews[]: { path, views } donde `views` es { total, app, web }.
//  - funnelStats: { events: { views, adds, checkouts, purchases }, users: {...} }
//    donde cada contador es { total, app, web }. También se toleran las claves
//    alternativas vistas/compras y la forma de número plano.

// --- Helpers internos ---------------------------------------------------------

// Convierte de forma segura un valor a número finito; si no, devuelve fallback.
function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Normaliza un contador que puede ser un número plano o un objeto { total, ... }.
// Devuelve siempre un número (el "total"). Tolera undefined/null.
function readCount(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return toFiniteNumber(value);
  if (typeof value === 'object') {
    // Forma desglosada { total, app, web }; caemos a app+web si no hay total.
    if (value.total != null) return toFiniteNumber(value.total);
    return toFiniteNumber(value.app) + toFiniteNumber(value.web);
  }
  return toFiniteNumber(value);
}

// Calcula un porcentaje (0..100) seguro ante divisor 0/undefined.
function safePct(numerator, denominator) {
  const num = toFiniteNumber(numerator);
  const den = toFiniteNumber(denominator);
  if (den <= 0) return 0;
  const pct = (num / den) * 100;
  return Number.isFinite(pct) ? Math.round(pct * 10) / 10 : 0;
}

// --- Áreas de la app para deriveAppUsage -------------------------------------
// Orden importa: se evalúa de la más específica a la más genérica. La última
// entrada ('Otros') es el catch-all y su test siempre devuelve true.
const APP_AREAS = [
  { area: 'Búsqueda', test: (p) => p.startsWith('/buscar') },
  { area: 'Categorías', test: (p) => p.startsWith('/categoria') || p.startsWith('/coleccion') },
  { area: 'Carrito/Checkout', test: (p) => p.startsWith('/carrito') || p.startsWith('/checkout') },
  { area: 'Mi cuenta', test: (p) => p.startsWith('/cuenta') || p.startsWith('/perfil') },
  { area: 'Minijuegos', test: (p) => p.startsWith('/minijuegos') },
  { area: 'Editor', test: (p) => p.startsWith('/editor') },
  { area: 'Ofertas', test: (p) => p.startsWith('/ofertas') },
  { area: 'Producto', test: (p) => p.startsWith('/producto') },
  { area: 'Tienda', test: (p) => p.startsWith('/tienda') },
  { area: 'Inicio', test: (p) => p === '/' },
  { area: 'Otros', test: () => true },
];

function classifyArea(path) {
  const p = typeof path === 'string' && path.length > 0 ? path : '/';
  const match = APP_AREAS.find((a) => a.test(p));
  return match ? match.area : 'Otros';
}

// --- Funciones exportadas -----------------------------------------------------

// deriveLinesViewed(topProducts) -> [{ name, views }]
// Agrupa los productos más vistos por su `category` (string) y suma las vistas.
// Tolera productos sin categoría (se agrupan en 'Sin categoría') y sin recuento.
// El recuento se toma de `views` si existe, si no de `total`.
// Ordena desc por vistas y devuelve el top 8.
export function deriveLinesViewed(topProducts) {
  const list = Array.isArray(topProducts) ? topProducts : [];
  const byCategory = new Map();

  list.forEach((product) => {
    if (!product || typeof product !== 'object') return;
    const rawCategory = product.category;
    const name = typeof rawCategory === 'string' && rawCategory.trim().length > 0
      ? rawCategory.trim()
      : 'Sin categoría';
    // El recuento real de vistas: preferimos `views`, caemos a `total`.
    const views = product.views != null ? readCount(product.views) : readCount(product.total);
    byCategory.set(name, (byCategory.get(name) || 0) + views);
  });

  return [...byCategory.entries()]
    .map(([name, views]) => ({ name, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);
}

// deriveAppUsage(topRoutesByViews) -> [{ area, views, pct }]
// Agrupa las rutas más vistas en áreas legibles por prefijo y calcula el
// porcentaje de cada área sobre el total de vistas. Tolera que `views` sea un
// número plano o un objeto { total, app, web }.
// Ordena desc por vistas; las áreas sin tráfico no aparecen.
export function deriveAppUsage(topRoutesByViews) {
  const list = Array.isArray(topRoutesByViews) ? topRoutesByViews : [];
  const byArea = new Map();
  let grandTotal = 0;

  list.forEach((route) => {
    if (!route || typeof route !== 'object') return;
    const area = classifyArea(route.path);
    const views = readCount(route.views);
    if (views <= 0) return;
    byArea.set(area, (byArea.get(area) || 0) + views);
    grandTotal += views;
  });

  return [...byArea.entries()]
    .map(([area, views]) => ({ area, views, pct: safePct(views, grandTotal) }))
    .sort((a, b) => b.views - a.views);
}

// deriveConversion(funnelStats) -> { vistaACarrito, carritoACheckout, checkoutACompra, global }
// Calcula los ratios de conversión del embudo como porcentajes (0..100).
// Tolera la forma { events: { views, adds, checkouts, purchases } } de
// adminAnalytics.js, así como una forma plana { views, adds, checkouts, purchases }
// y las claves alternativas en español (vistas/compras). Cada contador puede ser
// un número o un objeto { total, app, web }.
export function deriveConversion(funnelStats) {
  const stats = funnelStats && typeof funnelStats === 'object' ? funnelStats : {};
  // El desglose puede venir anidado en `.events` o directamente en la raíz.
  const source = stats.events && typeof stats.events === 'object' ? stats.events : stats;

  const views = readCount(source.views != null ? source.views : source.vistas);
  const adds = readCount(source.adds);
  const checkouts = readCount(source.checkouts);
  const purchases = readCount(source.purchases != null ? source.purchases : source.compras);

  return {
    vistaACarrito: safePct(adds, views),
    carritoACheckout: safePct(checkouts, adds),
    checkoutACompra: safePct(purchases, checkouts),
    global: safePct(purchases, views),
  };
}

// buildSafeSeries(arr, xKey, yKeys) -> [{ [xKey], [...yKeys] }]
// Helper genérico para construir series seguras para gráficos (recharts u otros).
// Filtra elementos no-objeto, garantiza que la clave X exista (string) y que
// cada clave Y sea un número finito (0 por defecto). Tolera que yKeys sea un
// string suelto o un array. Devuelve [] si la entrada no es un array.
export function buildSafeSeries(arr, xKey, yKeys) {
  const list = Array.isArray(arr) ? arr : [];
  const yList = Array.isArray(yKeys) ? yKeys : (yKeys != null ? [yKeys] : []);
  const xField = xKey != null ? String(xKey) : 'x';

  return list
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const point = {};
      // Clave X: se conserva su valor crudo si existe; si no, cadena vacía.
      point[xField] = item[xField] != null ? item[xField] : '';
      // Claves Y: siempre numéricas y finitas.
      yList.forEach((key) => {
        const field = String(key);
        point[field] = readCount(item[field]);
      });
      return point;
    });
}
