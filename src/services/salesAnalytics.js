import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { erpDb, isErpFirestoreAvailable } from './erp/firebase';
import { db } from './firebase/config';
import { getProducts, getCategories } from './products';

/**
 * salesAnalytics — MÁS VENDIDOS desde el ERP.
 *
 * Lee pedidos reales de las colecciones `pedidos_web` y `pedidos` (vía erpDb)
 * en un rango de fechas, recorre sus productos/items y rankea:
 *  - PRODUCTOS por unidades vendidas y por monto (S/)
 *  - LÍNEAS por `lineaProducto` (o categoría disponible)
 *
 * Forma de un pedido (ver src/pages/CheckoutPage.jsx y constants/erpPedidosHeaders.js):
 *  - createdAt: Firestore Timestamp ("Fecha de venta")
 *  - montoTotal: number (S/)  — alias legacy: total
 *  - cantidad: number (total de unidades)
 *  - lineaProducto: string ("Línea de producto") — a veces vacío en pedidos web
 *  - productos: Map { item_0: { productoId, producto, cantidad, precio, subtotal, talla, color, esCombo?, subProductos? }, ... }
 *      alias legacy: items: [{ productId, productName/name, quantity, price, ... }]
 */

// Límite de pedidos leídos por colección (ordenados por createdAt desc).
// Bajado de 1500 a 400 para reducir lecturas de Firestore y evitar "Quota exceeded".
// Con 2 colecciones (pedidos_web + pedidos) son como máximo 800 docs por consulta.
const MAX_ORDERS_PER_COLLECTION = 400;
const ERP_COLLECTIONS = ['pedidos_web', 'pedidos'];

function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function safeNumber(value) {
  if (value == null) return 0;
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanName(value, fallback = 'Producto') {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s.length ? s : fallback;
}

/**
 * Normaliza la lista de líneas de productos de un pedido en un array uniforme:
 * [{ productId, name, units, amount, line }]
 * Acepta tanto `productos` (Map del ERP) como `items` (array legacy).
 */
function extractLineItems(pedido) {
  const lines = [];

  const pushItem = (raw) => {
    if (!raw || typeof raw !== 'object') return;
    const units = safeNumber(raw.cantidad ?? raw.quantity ?? 1) || 1;
    // Monto del item: subtotal directo, o precio * unidades.
    const precio = safeNumber(raw.subtotal ?? raw.precio ?? raw.price ?? 0);
    const amount = raw.subtotal != null
      ? safeNumber(raw.subtotal)
      : precio * units;
    lines.push({
      productId: raw.productoId ?? raw.productId ?? raw.id ?? null,
      name: cleanName(raw.producto ?? raw.productName ?? raw.name),
      units,
      amount,
    });
  };

  // Estructura ERP: productos como Map (objeto) de item_0, item_1, ...
  const productos = pedido.productos;
  if (productos && typeof productos === 'object' && !Array.isArray(productos)) {
    Object.values(productos).forEach(pushItem);
  } else if (Array.isArray(productos)) {
    productos.forEach(pushItem);
  }

  // Estructura legacy: items como array
  if (Array.isArray(pedido.items)) {
    pedido.items.forEach(pushItem);
  }

  return lines;
}

/**
 * Determina la "línea de producto" de un pedido para el ranking de líneas.
 * Prioriza el campo ERP `lineaProducto`; si está vacío, usa category del primer item.
 */
function resolveLine(pedido, items) {
  const explicit = cleanName(pedido.lineaProducto ?? pedido.linea ?? pedido.category, '');
  if (explicit) return explicit;
  const firstWithCat = items.find((it) => it.category);
  if (firstWithCat) return cleanName(firstWithCat.category, '');
  return 'Sin línea';
}

/**
 * Lee pedidos de una colección del ERP filtrando por createdAt >= startMs.
 * Si el filtro indexado falla (sin índice / campo distinto), cae a lectura
 * acotada y filtra en memoria.
 */
async function fetchOrdersFromCollection(collName, startMs, endMs) {
  const coll = collection(erpDb, collName);

  try {
    const q = query(
      coll,
      where('createdAt', '>=', Timestamp.fromMillis(startMs)),
      where('createdAt', '<=', Timestamp.fromMillis(endMs)),
      orderBy('createdAt', 'desc'),
      limit(MAX_ORDERS_PER_COLLECTION)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback: leer las más recientes y filtrar en memoria.
    console.warn(`[salesAnalytics] Filtro indexado falló en ${collName}, usando fallback:`, err?.message);
    try {
      const qFallback = query(coll, orderBy('createdAt', 'desc'), limit(MAX_ORDERS_PER_COLLECTION));
      const snap = await getDocs(qFallback);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => {
          const ms = toMillis(p.createdAt);
          return ms >= startMs && ms <= endMs;
        });
    } catch (err2) {
      console.warn(`[salesAnalytics] Fallback también falló en ${collName}:`, err2?.message);
      return [];
    }
  }
}

/**
 * Calcula el ranking de productos más vendidos desde el ERP.
 *
 * @param {Object} [options]
 * @param {number} [options.days=30] - Días hacia atrás desde hoy.
 * @param {number} [options.topLimit=10] - Máximo de productos/líneas a devolver en cada ranking.
 * @returns {Promise<{
 *   topByUnits: Array<{ productId: string|null, name: string, units: number, amount: number }>,
 *   topByAmount: Array<{ productId: string|null, name: string, units: number, amount: number }>,
 *   topLines: Array<{ name: string, units: number, amount: number }>,
 *   totalRevenue: number,
 *   totalOrders: number,
 *   totalUnits: number,
 *   rangeDays: number,
 *   available: boolean,
 *   error: string|null,
 * }>}
 */
export async function getTopSelling({ days = 30, topLimit = 10 } = {}) {
  const empty = {
    topByUnits: [],
    topByAmount: [],
    topLines: [],
    totalRevenue: 0,
    totalOrders: 0,
    totalUnits: 0,
    rangeDays: days,
    available: false,
    error: null,
  };

  if (!isErpFirestoreAvailable()) {
    return { ...empty, error: 'ERP Firestore no disponible' };
  }

  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;

  let pedidos = [];
  try {
    const results = await Promise.all(
      ERP_COLLECTIONS.map((c) => fetchOrdersFromCollection(c, startMs, endMs))
    );
    pedidos = results.flat();
  } catch (err) {
    return { ...empty, available: true, error: err?.message || 'Error al leer pedidos del ERP' };
  }

  // De-dup por id (un pedido podría existir en ambas colecciones tras validación).
  const seen = new Set();
  pedidos = pedidos.filter((p) => {
    if (!p?.id) return true;
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const byProduct = new Map(); // key -> { productId, name, units, amount }
  const byLine = new Map(); // name -> { name, units, amount }
  let totalRevenue = 0;
  let totalUnits = 0;

  pedidos.forEach((pedido) => {
    const items = extractLineItems(pedido);

    // Ingresos del pedido: usar montoTotal si existe; si no, suma de items.
    const itemsAmount = items.reduce((acc, it) => acc + it.amount, 0);
    const orderRevenue = pedido.montoTotal != null || pedido.total != null
      ? safeNumber(pedido.montoTotal ?? pedido.total)
      : itemsAmount;
    totalRevenue += orderRevenue;

    // Línea del pedido (un pedido se cuenta una vez por su línea principal).
    const lineName = resolveLine(pedido, items);
    const orderUnits = items.reduce((acc, it) => acc + it.units, 0)
      || safeNumber(pedido.cantidad)
      || 0;
    if (!byLine.has(lineName)) byLine.set(lineName, { name: lineName, units: 0, amount: 0 });
    const lineEntry = byLine.get(lineName);
    lineEntry.units += orderUnits;
    lineEntry.amount += orderRevenue;

    totalUnits += orderUnits;

    // Productos individuales.
    items.forEach((it) => {
      const key = it.productId || `name:${it.name.toLowerCase()}`;
      if (!byProduct.has(key)) {
        byProduct.set(key, { productId: it.productId || null, name: it.name, units: 0, amount: 0 });
      }
      const entry = byProduct.get(key);
      entry.units += it.units;
      entry.amount += it.amount;
      // Mantener el nombre más informativo si aparece.
      if ((!entry.name || entry.name === 'Producto') && it.name) entry.name = it.name;
    });
  });

  const products = [...byProduct.values()].map((p) => ({
    ...p,
    amount: Math.round(p.amount * 100) / 100,
  }));

  const topByUnits = [...products]
    .sort((a, b) => b.units - a.units || b.amount - a.amount)
    .slice(0, topLimit);

  const topByAmount = [...products]
    .sort((a, b) => b.amount - a.amount || b.units - a.units)
    .slice(0, topLimit);

  const topLines = [...byLine.values()]
    .map((l) => ({ ...l, amount: Math.round(l.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount || b.units - a.units)
    .slice(0, topLimit);

  return {
    topByUnits,
    topByAmount,
    topLines,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders: pedidos.length,
    totalUnits,
    rangeDays: days,
    available: true,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Cachés en memoria (a nivel de módulo) para resolver nombres/imágenes sin
// re-leer Firestore en cada llamada del dashboard. Se cachea la PROMESA para
// deduplicar lecturas concurrentes; si falla, se limpia para reintentar luego.
// ---------------------------------------------------------------------------
let _productsCachePromise = null; // Promise<Map<productId, { name, mainImage }>>
let _categoriesCachePromise = null; // Promise<Map<categoryId, name>>

/**
 * Mapa cacheado productId -> { name, mainImage } desde `productos_wala`.
 * Solo contiene productos REALES de WALA (sirve para filtrar el ranking).
 * Tolerante a fallos: si la lectura falla, devuelve un Map vacío.
 */
function loadWalaProductsMap() {
  if (_productsCachePromise) return _productsCachePromise;
  _productsCachePromise = (async () => {
    const map = new Map();
    try {
      const { data, error } = await getProducts([]);
      if (error || !Array.isArray(data)) return map;
      data.forEach((p) => {
        if (!p?.id) return;
        // mainImage del producto; fallback a la primera imagen normalizada.
        const image = p.mainImage || (Array.isArray(p.images) ? p.images[0] : '') || '';
        map.set(p.id, { name: cleanName(p.name, 'Producto'), mainImage: image });
      });
    } catch (err) {
      console.warn('[salesAnalytics] No se pudieron cargar productos_wala:', err?.message);
    }
    return map;
  })();
  // Si la promesa rechaza (no debería: capturamos arriba), permitir reintento.
  _productsCachePromise.catch(() => { _productsCachePromise = null; });
  return _productsCachePromise;
}

/**
 * Mapa cacheado categoryId -> name desde `categories`.
 * Sirve para resolver una clave de línea que en realidad sea un categoryId.
 * Tolerante a fallos: si la lectura falla, devuelve un Map vacío.
 */
function loadCategoriesMap() {
  if (_categoriesCachePromise) return _categoriesCachePromise;
  _categoriesCachePromise = (async () => {
    const map = new Map();
    try {
      const { data, error } = await getCategories();
      if (error || !Array.isArray(data)) return map;
      data.forEach((c) => {
        if (!c?.id) return;
        map.set(c.id, cleanName(c.name, c.id));
      });
    } catch (err) {
      console.warn('[salesAnalytics] No se pudieron cargar categories:', err?.message);
    }
    return map;
  })();
  _categoriesCachePromise.catch(() => { _categoriesCachePromise = null; });
  return _categoriesCachePromise;
}

/**
 * getTopSellingWala — MÁS VENDIDOS NATIVOS DE WALA (su PROPIO negocio).
 *
 * DROP-IN de getTopSelling: devuelve EXACTAMENTE el mismo shape que consume el
 * dashboard (MasVendidosSection): topByUnits/topByAmount (con name e image),
 * topLines, totalOrders, totalRevenue, totalUnits, rangeDays, available, error.
 *
 * A diferencia de getTopSelling (que lee el ERP mezclado), esto lee SOLO las
 * compras registradas por WALA en la colección `analytics_events` de la DB
 * PRINCIPAL, con eventos type == 'purchase_complete'.
 *
 * Forma del evento (ver src/services/analytics/tracker.js -> trackPurchaseComplete
 * y src/pages/CheckoutPage.jsx):
 *  - type: 'purchase_complete'
 *  - clientTsMs: number (ms epoch del cliente, en la RAÍZ del doc)
 *  - eventData: {
 *      orderId, total, totalCents, currency, method, itemsCount,
 *      items: [{ productId, qty, price, categoryId?, lineaProducto?, lineId? }]
 *    }
 *
 * Con el índice compuesto (type ASC, clientTsMs DESC) ya disponible, la query
 * filtra y ordena SERVER-SIDE por el rango de fechas (where clientTsMs >= startMs
 * + orderBy clientTsMs desc), así solo trae los eventos del rango. Si ese índice
 * fallara (p.ej. aún construyéndose), cae al comportamiento anterior: query simple
 * where('type','==','purchase_complete') + limit y filtro de fechas en memoria.
 *
 * Reglas clave:
 *  - totalRevenue/totalUnits/totalOrders cuentan TODOS los eventos/items del rango.
 *  - topByUnits/topByAmount muestran SOLO productId que existan en productos_wala
 *    (resueltos a name e image); los productos inexistentes se OMITEN del ranking
 *    pero SÍ suman a los totales.
 *  - topLines agrupa por línea (lineaProducto || lineId || categoryId), resolviendo
 *    a nombre vía categories cuando la clave es un categoryId.
 *
 * @param {Object} [options]
 * @param {number} [options.days=30] - Días hacia atrás desde hoy para el rango.
 * @param {number} [options.topLimit=10] - Máximo de productos/líneas por ranking.
 * @returns {Promise<{
 *   topByUnits: Array<{ productId: string, name: string, image: string, units: number, amount: number }>,
 *   topByAmount: Array<{ productId: string, name: string, image: string, units: number, amount: number }>,
 *   topLines: Array<{ name: string, units: number, amount: number }>,
 *   totalRevenue: number,
 *   totalOrders: number,
 *   totalUnits: number,
 *   rangeDays: number,
 *   available: boolean,
 *   error: string|null,
 * }>}
 */
export async function getTopSellingWala({ days = 30, topLimit = 10 } = {}) {
  const empty = {
    topByUnits: [],
    topByAmount: [],
    topLines: [],
    totalRevenue: 0,
    totalOrders: 0,
    totalUnits: 0,
    rangeDays: days,
    available: false,
    error: null,
  };

  // Sin DB principal no hay nada que leer.
  if (!db) {
    return { ...empty, error: 'Firestore no disponible' };
  }

  // Rango de fechas. Si un evento no trae fecha reconocible, NO se filtra (se incluye).
  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;

  // Lectura de eventos. Preferimos la query INDEXADA que filtra y ordena por
  // clientTsMs SERVER-SIDE (índice compuesto type ASC + clientTsMs DESC): así solo
  // trae los eventos del rango y no se rompe al crecer la colección. Si ese índice
  // fallara (aún construyéndose, campo ausente, etc.), capturamos y caemos al
  // comportamiento anterior (query simple + filtro de fechas en memoria) para no
  // romper el dashboard/Destacados.
  const coll = collection(db, 'analytics_events');
  let docs = [];
  try {
    const q = query(
      coll,
      where('type', '==', 'purchase_complete'),
      where('clientTsMs', '>=', startMs),
      orderBy('clientTsMs', 'desc'),
      limit(5000)
    );
    const snap = await getDocs(q);
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback: query simple (sin orderBy ni rango) + filtro de fechas en memoria.
    console.warn(
      '[salesAnalytics] Query indexada (clientTsMs) falló, usando fallback:',
      err?.message
    );
    try {
      const qFallback = query(
        coll,
        where('type', '==', 'purchase_complete'),
        limit(3000)
      );
      const snap = await getDocs(qFallback);
      docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err2) {
      return {
        ...empty,
        available: false,
        error: err2?.message || 'Error al leer analytics_events',
      };
    }
  }

  const eventMillis = (ev) => {
    // El campo real es clientTsMs en la raíz; toleramos variantes y eventData.
    const raw = ev?.clientTsMs
      ?? ev?.eventData?.clientTsMs
      ?? ev?.createdAt
      ?? ev?.timestamp
      ?? null;
    return toMillis(raw);
  };

  const byProduct = new Map(); // productId -> { productId, units, amount }
  const byLine = new Map(); // lineKey -> { key, units, amount }
  const orderIds = new Set(); // orderId distintos (para totalOrders cuando exista)
  let totalUnits = 0;
  let totalRevenue = 0;
  let eventsInRange = 0; // nº de eventos del rango (fallback de totalOrders)

  docs.forEach((ev) => {
    // Filtro de fecha en memoria: solo si el evento trae fecha (>0).
    const ms = eventMillis(ev);
    if (ms > 0 && (ms < startMs || ms > endMs)) return;

    eventsInRange += 1;
    // totalOrders: contar orderId distintos si está; si no, se cuenta el evento.
    const orderId = ev?.eventData?.orderId;
    if (orderId) orderIds.add(orderId);

    const items = ev?.eventData?.items;
    if (!Array.isArray(items)) return; // tolerante a items/eventData ausentes

    items.forEach((it) => {
      if (!it || typeof it !== 'object') return;
      const productId = it.productId;
      const units = safeNumber(it.qty ?? it.quantity ?? 1) || 0;
      const price = safeNumber(it.price ?? 0);
      const amount = price * units;

      // Los totales cuentan TODOS los items (existan o no en productos_wala).
      totalUnits += units;
      totalRevenue += amount;

      // Acumular por producto (filtrado al final contra productos_wala).
      if (productId) {
        if (!byProduct.has(productId)) {
          byProduct.set(productId, { productId, units: 0, amount: 0 });
        }
        const entry = byProduct.get(productId);
        entry.units += units;
        entry.amount += amount;
      }

      // Acumular por LÍNEA. Clave: lineaProducto || lineId || categoryId.
      const lineKey = cleanName(
        it.lineaProducto ?? it.lineId ?? it.categoryId ?? '',
        ''
      );
      const key = lineKey || '__sin_linea__';
      if (!byLine.has(key)) byLine.set(key, { key: lineKey, units: 0, amount: 0 });
      const lineEntry = byLine.get(key);
      lineEntry.units += units;
      lineEntry.amount += amount;
    });
  });

  // totalOrders: nº de orderId distintos si hubo alguno; si no, nº de eventos.
  const totalOrders = orderIds.size > 0 ? orderIds.size : eventsInRange;

  // Resolver nombres/imágenes de producto y nombres de línea (cacheado, tolerante).
  const [productsMap, categoriesMap] = await Promise.all([
    loadWalaProductsMap(),
    loadCategoriesMap(),
  ]);

  // Productos: SOLO los que existen en productos_wala (resueltos a name/image).
  // Los inexistentes se omiten del ranking (pero ya sumaron a los totales).
  const products = [...byProduct.values()]
    .filter((p) => productsMap.has(p.productId))
    .map((p) => {
      const info = productsMap.get(p.productId);
      return {
        productId: p.productId,
        name: info.name,
        image: info.mainImage || '',
        units: p.units,
        amount: Math.round(p.amount * 100) / 100,
      };
    });

  const topByUnits = [...products]
    .sort((a, b) => b.units - a.units || b.amount - a.amount)
    .slice(0, topLimit);

  const topByAmount = [...products]
    .sort((a, b) => b.amount - a.amount || b.units - a.units)
    .slice(0, topLimit);

  // Líneas: resolver el nombre. Si la clave es un categoryId conocido, usar su
  // nombre; si es texto de línea, dejarlo tal cual; vacío -> 'Sin línea'.
  const topLines = [...byLine.values()]
    .map((l) => {
      let name = l.key;
      if (!name) {
        name = 'Sin línea';
      } else if (categoriesMap.has(name)) {
        name = categoriesMap.get(name);
      }
      return { name, units: l.units, amount: Math.round(l.amount * 100) / 100 };
    })
    .sort((a, b) => b.amount - a.amount || b.units - a.units)
    .slice(0, topLimit);

  return {
    topByUnits,
    topByAmount,
    topLines,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    totalUnits,
    rangeDays: days,
    available: true,
    error: null,
  };
}

export default getTopSelling;
