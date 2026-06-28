// ════════════════════════════════════════════════════════════════════════════
// FUNCIONES PURAS DE AGREGACIÓN ANALÍTICA (lado servidor)
// ────────────────────────────────────────────────────────────────────────────
// Portadas desde src/services/adminAnalytics.js para que la Cloud Function de
// pre-agregación (functions/analyticsDaily.js) produzca EXACTAMENTE los mismos
// campos que hoy calcula el dashboard en memoria. Sin dependencias de Firestore:
// reciben arrays planos de eventos/sesiones y devuelven objetos serializables.
//
// Diferencias respecto al cálculo legacy del cliente, según el CONTRATO de
// analytics_daily/{YYYY-MM-DD} (Fase 2):
//   - Todo segmentado en { total, app, web } donde el dashboard lo divide.
//   - Top-N a 25 (no 10/8) para que el top-10 del RANGO siga siendo correcto al
//     combinar varios días.
//   - scrollDepth como SUMAS y CONTEOS crudos (no promedio), para promediar bien
//     al combinar N días en el cliente.
// ════════════════════════════════════════════════════════════════════════════

// Tipos de evento (espejo de src/services/analytics/schema.js). Se duplican aquí
// porque functions/ no comparte el árbol de src/.
const ANALYTICS_EVENT_TYPES = {
  PAGE_VIEW: "page_view",
  ROUTE_DWELL: "route_dwell",
  SESSION_START: "session_start",
  SESSION_END: "session_end",
  ADD_TO_CART: "add_to_cart",
  CHECKOUT_START: "checkout_start",
  PURCHASE_COMPLETE: "purchase_complete",
  PRODUCT_VIEW: "product_view",
  SEARCH_QUERY: "search_query",
  SCROLL_DEPTH: "scroll_depth",
  BANNER_CLICK: "banner_click",
  CATEGORY_VIEW: "category_view",
  COLLECTION_VIEW: "collection_view",
  EDITOR_OPEN: "editor_open",
  EDITOR_SAVE: "editor_save",
  MINIGAME_START: "minigame_start",
  MINIGAME_COMPLETE: "minigame_complete",
  MISSION_COMPLETE: "mission_complete",
  WISHLIST_ADD: "wishlist_add",
};

// Top-N para los rankings del doc diario. Se sube a 25 (el cliente legacy usaba
// 10/8) para que el top-10 del rango combinado sea correcto en la práctica.
const TOP_N = 25;

// ── Helpers neutrales (espejo de schema.js) ──────────────────────────────────
function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Segmento del evento/sesión según clientType: 'app' para APP, 'web' en cualquier
// otro caso (igual que el dashboard, que trata todo lo no-APP como web).
function segmentOf(item) {
  return item && item.clientType === "APP" ? "app" : "web";
}

// ── parseUserAgent (idéntico a adminAnalytics.js) ────────────────────────────
function parseUserAgent(ua) {
  if (!ua) return { browser: "Desconocido", os: "Desconocido", device: "Desconocido" };
  const lower = ua.toLowerCase();

  let browser = "Desconocido";
  if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg")) browser = "Edge";
  else if (lower.includes("opr") || lower.includes("opera")) browser = "Opera";
  else if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("safari")) browser = "Safari";

  let os = "Desconocido";
  if (lower.includes("win")) os = "Windows";
  else if (lower.includes("mac")) os = "MacOS";
  else if (lower.includes("linux")) os = "Linux";
  if (lower.includes("android")) os = "Android";
  if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";

  let device = "Desktop";
  if (lower.includes("mobi") || lower.includes("android") || lower.includes("iphone") || lower.includes("ipad")) {
    device = "Mobile";
  }

  return { browser, os, device };
}

// ── Contadores simples segmentados ───────────────────────────────────────────
// pageViews / events / dwellMs / sessions: { total, app, web }.
function blankSeg() {
  return { total: 0, app: 0, web: 0 };
}

// Cuenta cuántos elementos hay por segmento (con condición opcional).
function countSeg(arr = [], cond = () => true) {
  const out = blankSeg();
  arr.forEach((item) => {
    if (!cond(item)) return;
    out.total += 1;
    out[segmentOf(item)] += 1;
  });
  return out;
}

// pageViews del día: eventos PAGE_VIEW segmentados.
function aggregatePageViews(events = []) {
  return countSeg(events, (e) => e.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW);
}

// dwellMs del día: suma de route_dwell.dwellMs segmentada.
function aggregateDwellMs(events = []) {
  const out = blankSeg();
  events.forEach((e) => {
    if (e.type !== ANALYTICS_EVENT_TYPES.ROUTE_DWELL) return;
    const d = safeNumber(e.dwellMs);
    out.total += d;
    out[segmentOf(e)] += d;
  });
  return out;
}

// activeIdentities del día: distinct uid|email|anonymousId, segmentado.
// NOTA †: NO es sumable entre días; se guarda el conteo diario para mostrarlo por día.
function aggregateActiveIdentities(events = []) {
  const sT = new Set(), sA = new Set(), sW = new Set();
  events.forEach((e) => {
    const id = e.uid || e.email || e.anonymousId;
    if (!id) return;
    sT.add(id);
    if (segmentOf(e) === "app") sA.add(id); else sW.add(id);
  });
  return { total: sT.size, app: sA.size, web: sW.size };
}

// ── byType: conteo por cada tipo de evento, segmentado ───────────────────────
// Recorre TODOS los tipos vistos (no solo los del enum) para no perder señales.
function aggregateByType(events = []) {
  const byType = {};
  events.forEach((e) => {
    const t = e.type || "unknown";
    if (!byType[t]) byType[t] = blankSeg();
    byType[t].total += 1;
    byType[t][segmentOf(e)] += 1;
  });
  return byType;
}

// ── Embudo (espejo de aggregateFunnel): counts + users distintos ─────────────
function aggregateFunnel(events = []) {
  const counters = {
    views: blankSeg(),
    adds: blankSeg(),
    checkouts: blankSeg(),
    purchases: blankSeg(),
  };
  const unique = {
    views: { total: new Set(), app: new Set(), web: new Set() },
    adds: { total: new Set(), app: new Set(), web: new Set() },
    checkouts: { total: new Set(), app: new Set(), web: new Set() },
    purchases: { total: new Set(), app: new Set(), web: new Set() },
  };

  events.forEach((e) => {
    const id = e.uid || e.anonymousId || e.sessionId;
    const seg = segmentOf(e);
    const track = (key) => {
      counters[key].total += 1;
      counters[key][seg] += 1;
      if (id) {
        unique[key].total.add(id);
        unique[key][seg].add(id);
      }
    };

    if (e.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW || e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) track("views");
    if (e.type === ANALYTICS_EVENT_TYPES.ADD_TO_CART) track("adds");
    if (e.type === ANALYTICS_EVENT_TYPES.CHECKOUT_START) track("checkouts");
    if (e.type === ANALYTICS_EVENT_TYPES.PURCHASE_COMPLETE) track("purchases");
  });

  const sizes = (k) => ({
    total: unique[k].total.size,
    app: unique[k].app.size,
    web: unique[k].web.size,
  });

  return {
    events: counters,
    users: {
      views: sizes("views"),
      adds: sizes("adds"),
      checkouts: sizes("checkouts"),
      purchases: sizes("purchases"),
    },
  };
}

// ── Rutas (espejo de aggregateRouteMetrics): views + dwell segmentados, top25 ─
function aggregateRouteMetrics(events = []) {
  const byViews = new Map();
  const byDwell = new Map();
  events.forEach((ev) => {
    const route = ev.path || "unknown";
    const seg = segmentOf(ev);
    if (!byViews.has(route)) byViews.set(route, blankSeg());
    if (!byDwell.has(route)) byDwell.set(route, blankSeg());

    if (ev.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW) {
      byViews.get(route).total += 1;
      byViews.get(route)[seg] += 1;
    }
    if (ev.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) {
      const dwell = safeNumber(ev.dwellMs);
      byDwell.get(route).total += dwell;
      byDwell.get(route)[seg] += dwell;
    }
  });

  const byViewsTop = [...byViews.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, TOP_N)
    .map(([path, views]) => ({ path, views }));

  const byDwellMsTop = [...byDwell.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, TOP_N)
    .map(([path, dwellMs]) => ({ path, dwellMs }));

  return { byViews: byViewsTop, byDwellMs: byDwellMsTop };
}

// ── Top productos (espejo de aggregateTopProducts), top25 segmentado ─────────
function aggregateTopProducts(events = []) {
  const byProduct = new Map();
  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.PRODUCT_VIEW && ev.eventData && ev.eventData.productId) {
      const id = ev.eventData.productId;
      const seg = segmentOf(ev);
      if (!byProduct.has(id)) byProduct.set(id, { productId: id, name: ev.eventData.name || null, total: 0, app: 0, web: 0 });
      byProduct.get(id).total += 1;
      byProduct.get(id)[seg] += 1;
    }
  });
  return [...byProduct.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

// ── Top categorías (espejo de aggregateTopCategories), top25 ─────────────────
function aggregateTopCategories(events = []) {
  const RELEVANT = new Set([
    ANALYTICS_EVENT_TYPES.PRODUCT_VIEW,
    ANALYTICS_EVENT_TYPES.CATEGORY_VIEW,
    ANALYTICS_EVENT_TYPES.ADD_TO_CART,
  ]);
  const byCategory = new Map();
  events.forEach((ev) => {
    if (!RELEVANT.has(ev.type)) return;
    const id = ev.eventData && ev.eventData.categoryId;
    const name = ev.eventData && ev.eventData.categoryName;
    const key = id || name;
    if (!key) return;
    if (!byCategory.has(key)) byCategory.set(key, { id: id || null, name: name || id || null, total: 0 });
    byCategory.get(key).total += 1;
    if (name && !byCategory.get(key).name) byCategory.get(key).name = name;
  });
  return [...byCategory.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

// ── Top colecciones (espejo de aggregateTopCollections), top25 ───────────────
function aggregateTopCollections(events = []) {
  const RELEVANT = new Set([
    ANALYTICS_EVENT_TYPES.COLLECTION_VIEW,
    ANALYTICS_EVENT_TYPES.PRODUCT_VIEW,
  ]);
  const byCollection = new Map();
  events.forEach((ev) => {
    if (!RELEVANT.has(ev.type)) return;
    const id = ev.eventData && ev.eventData.collectionId;
    const name = ev.eventData && ev.eventData.collectionName;
    const key = id || name;
    if (!key) return;
    if (!byCollection.has(key)) byCollection.set(key, { id: id || null, name: name || id || null, total: 0 });
    byCollection.get(key).total += 1;
    if (name && !byCollection.get(key).name) byCollection.get(key).name = name;
  });
  return [...byCollection.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

// ── Top búsquedas (espejo de aggregateTopSearches), top25 segmentado ─────────
function aggregateTopSearches(events = []) {
  const byQuery = new Map();
  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.SEARCH_QUERY && ev.eventData && ev.eventData.query) {
      const q = String(ev.eventData.query).toLowerCase();
      const seg = segmentOf(ev);
      if (!byQuery.has(q)) byQuery.set(q, { total: 0, app: 0, web: 0 });
      byQuery.get(q).total += 1;
      byQuery.get(q)[seg] += 1;
    }
  });
  return [...byQuery.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, TOP_N)
    .map(([query, stats]) => ({ query, ...stats }));
}

// ── Uso de funcionalidades (espejo de aggregateFeatureUsage) ─────────────────
// El CONTRATO pide un objeto { editor, minijuegos, misiones, wishlist, busqueda }.
function aggregateFeatureUsage(events = []) {
  const counters = { editor: 0, minijuegos: 0, misiones: 0, wishlist: 0, busqueda: 0 };
  events.forEach((ev) => {
    switch (ev.type) {
      case ANALYTICS_EVENT_TYPES.EDITOR_OPEN:
      case ANALYTICS_EVENT_TYPES.EDITOR_SAVE:
        counters.editor += 1;
        break;
      case ANALYTICS_EVENT_TYPES.MINIGAME_START:
      case ANALYTICS_EVENT_TYPES.MINIGAME_COMPLETE:
        counters.minijuegos += 1;
        break;
      case ANALYTICS_EVENT_TYPES.MISSION_COMPLETE:
        counters.misiones += 1;
        break;
      case ANALYTICS_EVENT_TYPES.WISHLIST_ADD:
        counters.wishlist += 1;
        break;
      case ANALYTICS_EVENT_TYPES.SEARCH_QUERY:
        counters.busqueda += 1;
        break;
      default:
        break;
    }
  });
  return counters;
}

// ── Clicks de banner (espejo de aggregateBannerClicks), top25 segmentado ─────
function aggregateBannerClicks(events = []) {
  const byBanner = new Map();
  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.BANNER_CLICK && ev.eventData && ev.eventData.bannerId) {
      const id = ev.eventData.bannerId;
      const seg = segmentOf(ev);
      if (!byBanner.has(id)) byBanner.set(id, { total: 0, app: 0, web: 0 });
      byBanner.get(id).total += 1;
      byBanner.get(id)[seg] += 1;
    }
  });
  return [...byBanner.entries()]
    .map(([bannerId, stats]) => ({ bannerId, ...stats }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

// ── scrollDepth como SUMAS y CONTEOS crudos (no promedio) ─────────────────────
// El cliente promedia (sum/cnt) al combinar N días → no se pierde precisión.
function aggregateScrollDepth(events = []) {
  const out = { sumTotal: 0, cntTotal: 0, sumApp: 0, cntApp: 0, sumWeb: 0, cntWeb: 0 };
  events.forEach((ev) => {
    if (ev.type === ANALYTICS_EVENT_TYPES.SCROLL_DEPTH && ev.eventData && typeof ev.eventData.depth === "number") {
      const depth = ev.eventData.depth;
      out.sumTotal += depth;
      out.cntTotal += 1;
      if (segmentOf(ev) === "app") {
        out.sumApp += depth; out.cntApp += 1;
      } else {
        out.sumWeb += depth; out.cntWeb += 1;
      }
    }
  });
  return out;
}

// ── Devices (espejo de aggregateDevices) sobre SESIONES del día ──────────────
// Se devuelven como mapas { nombre: count } para que el cliente los combine sumando.
function aggregateDevices(sessions = []) {
  const byDevice = {};
  const byBrowser = {};
  const byOS = {};
  sessions.forEach((s) => {
    const { device, browser, os } = parseUserAgent(s.userAgent);
    byDevice[device] = (byDevice[device] || 0) + 1;
    byBrowser[browser] = (byBrowser[browser] || 0) + 1;
    byOS[os] = (byOS[os] || 0) + 1;
  });
  return { byDevice, byBrowser, byOS };
}

// ── UTM (espejo de aggregateUTM) sobre sesiones del día ──────────────────────
function aggregateUTM(sessions = []) {
  const bySource = {};
  const byCampaign = {};
  sessions.forEach((s) => {
    const src = s.utm_source || "Directo";
    bySource[src] = (bySource[src] || 0) + 1;
    if (s.utm_campaign) byCampaign[s.utm_campaign] = (byCampaign[s.utm_campaign] || 0) + 1;
  });
  return { bySource, byCampaign };
}

// ── Geografía (espejo de aggregateGeography) sobre sesiones del día ──────────
function aggregateGeography(sessions = []) {
  const byTimezone = {};
  sessions.forEach((s) => {
    if (s.timeZone) {
      const region = (s.timeZone.split("/")[1] || s.timeZone).replace(/_/g, " ");
      byTimezone[region] = (byTimezone[region] || 0) + 1;
    }
  });
  return { byTimezone };
}

// ── Seguimiento de pedidos (espejo de deriveOrderTracking) ───────────────────
// Engagement sobre el estado del pedido (rutas que empiezan por /cuenta/pedidos).
// uniqueUsers se guarda como CONTEO diario (no sumable entre días).
const ORDER_TRACKING_PREFIX = "/cuenta/pedidos";

function isOrderTrackingPath(path) {
  if (typeof path !== "string") return false;
  const clean = path.split("?")[0].split("#")[0];
  return clean === ORDER_TRACKING_PREFIX || clean.startsWith(`${ORDER_TRACKING_PREFIX}/`);
}

function aggregateOrderTracking(events = []) {
  let views = 0;
  let totalDwellMs = 0;
  let dwellEvents = 0;
  const uniqueUsers = new Set();

  events.forEach((ev) => {
    if (!isOrderTrackingPath(ev && ev.path)) return;
    if (ev.type === ANALYTICS_EVENT_TYPES.PAGE_VIEW) views += 1;
    if (ev.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL) {
      totalDwellMs += safeNumber(ev.dwellMs);
      dwellEvents += 1;
    }
    const identity = ev.uid || ev.anonymousId || ev.email;
    if (identity) uniqueUsers.add(identity);
  });

  return {
    views,
    totalDwellMs,
    dwellEvents,
    // Conteo diario (no sumable entre días); el cliente lo muestra por día.
    uniqueUsers: uniqueUsers.size,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ENSAMBLADO DEL DOC DEL CONTRATO analytics_daily/{YYYY-MM-DD}
// ────────────────────────────────────────────────────────────────────────────
// Recibe los eventos y sesiones YA filtrados al día (rango Lima de clientTsMs) y
// devuelve el objeto a guardar con .set(). NO incluye generatedAt (lo añade la CF
// con serverTimestamp para no acoplar este módulo a firebase-admin).
// ════════════════════════════════════════════════════════════════════════════
function buildDailyDoc(dayKey, events = [], sessions = []) {
  const funnel = aggregateFunnel(events);
  const routes = aggregateRouteMetrics(events);

  return {
    day: dayKey,
    // Contadores segmentados que el dashboard divide en total/app/web.
    pageViews: aggregatePageViews(events),
    sessions: countSeg(sessions),
    events: countSeg(events),
    activeIdentities: aggregateActiveIdentities(events),
    dwellMs: aggregateDwellMs(events),
    // Embudo: counts + usuarios distintos del día (users NO sumable entre días).
    funnel,
    // Por tipo de evento.
    byType: aggregateByType(events),
    // Por ruta (top25): views + dwell segmentados.
    routes,
    // Rankings (top25 para que el top-10 del rango combinado sea correcto).
    topProducts: aggregateTopProducts(events),
    topCategories: aggregateTopCategories(events),
    topCollections: aggregateTopCollections(events),
    topSearches: aggregateTopSearches(events),
    featureUsage: aggregateFeatureUsage(events),
    bannerClicks: aggregateBannerClicks(events),
    // scrollDepth como sumas+conteos crudos (el cliente promedia al combinar días).
    scrollDepth: aggregateScrollDepth(events),
    // Devices / UTM / Geo (de sesiones del día).
    devices: aggregateDevices(sessions),
    utm: aggregateUTM(sessions),
    geography: aggregateGeography(sessions),
    // Seguimiento de pedidos.
    orderTracking: aggregateOrderTracking(events),
    // Auditoría: nº de eventos procesados.
    eventCount: events.length,
  };
}

module.exports = {
  ANALYTICS_EVENT_TYPES,
  TOP_N,
  // helpers
  safeNumber,
  toMillis,
  segmentOf,
  parseUserAgent,
  // agregadores individuales (exportados para test/backfill granular)
  aggregatePageViews,
  aggregateDwellMs,
  aggregateActiveIdentities,
  aggregateByType,
  aggregateFunnel,
  aggregateRouteMetrics,
  aggregateTopProducts,
  aggregateTopCategories,
  aggregateTopCollections,
  aggregateTopSearches,
  aggregateFeatureUsage,
  aggregateBannerClicks,
  aggregateScrollDepth,
  aggregateDevices,
  aggregateUTM,
  aggregateGeography,
  aggregateOrderTracking,
  // ensamblado del doc
  buildDailyDoc,
};
