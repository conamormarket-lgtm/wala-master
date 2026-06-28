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

/**
 * getTopSellingWala — MÁS VENDIDOS NATIVOS DE WALA (su PROPIO negocio).
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
 * Para evitar índices compuestos NO ordenamos ni filtramos por fecha en la query:
 * solo where('type','==','purchase_complete') + limit. El filtro de rango de
 * fechas se hace en memoria.
 *
 * @param {Object} [options]
 * @param {number} [options.days=30] - Días hacia atrás desde hoy para el rango.
 * @param {number} [options.topLimit=10] - Máximo de productos por ranking.
 * @returns {Promise<{
 *   topByUnits: Array<{ productId: string, units: number, amount: number }>,
 *   topByAmount: Array<{ productId: string, units: number, amount: number }>,
 *   totalUnits: number,
 *   totalRevenue: number,
 *   rangeDays: number,
 *   available: boolean,
 *   error: string|null,
 * }>}
 */
export async function getTopSellingWala({ days = 30, topLimit = 10 } = {}) {
  const empty = {
    topByUnits: [],
    topByAmount: [],
    totalUnits: 0,
    totalRevenue: 0,
    rangeDays: days,
    available: false,
    error: null,
  };

  // Sin DB principal no hay nada que leer.
  if (!db) {
    return { ...empty, error: 'Firestore no disponible' };
  }

  // Query simple (sin orderBy ni rango): evita exigir un índice compuesto.
  let docs = [];
  try {
    const q = query(
      collection(db, 'analytics_events'),
      where('type', '==', 'purchase_complete'),
      limit(3000)
    );
    const snap = await getDocs(q);
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return { ...empty, available: false, error: err?.message || 'Error al leer analytics_events' };
  }

  // Rango de fechas. Si un evento no trae fecha reconocible, NO se filtra (se incluye).
  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;

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
  let totalUnits = 0;
  let totalRevenue = 0;

  docs.forEach((ev) => {
    // Filtro de fecha en memoria: solo si el evento trae fecha (>0).
    const ms = eventMillis(ev);
    if (ms > 0 && (ms < startMs || ms > endMs)) return;

    const items = ev?.eventData?.items;
    if (!Array.isArray(items)) return; // tolerante a items/eventData ausentes

    items.forEach((it) => {
      if (!it || typeof it !== 'object') return;
      const productId = it.productId;
      if (!productId) return; // sin productId no se puede agregar
      const units = safeNumber(it.qty ?? it.quantity ?? 1) || 0;
      const price = safeNumber(it.price ?? 0);
      const amount = price * units;

      if (!byProduct.has(productId)) {
        byProduct.set(productId, { productId, units: 0, amount: 0 });
      }
      const entry = byProduct.get(productId);
      entry.units += units;
      entry.amount += amount;

      totalUnits += units;
      totalRevenue += amount;
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

  return {
    topByUnits,
    topByAmount,
    totalUnits,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    rangeDays: days,
    available: true,
    error: null,
  };
}

export default getTopSelling;
