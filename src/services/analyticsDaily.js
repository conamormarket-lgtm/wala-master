import { getDocument, getCollection } from './firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES, safeNumber } from './analytics/schema';

/* ============================================================================
 * analyticsDaily — LECTURA PRE-AGREGADA del dashboard (Fase 2, PARTE 1).
 *
 * En lugar de releer hasta 5000 eventos crudos en cada carga (getGlobalAnalytics),
 * leemos N documentos `analytics_daily/{YYYY-MM-DD}` (uno por día del rango) que
 * una Cloud Function (`aggregateAnalyticsDaily`) deja YA agregados. Esto reduce
 * de ~5300 lecturas a 7/30/90 lecturas por carga.
 *
 * El DÍA EN CURSO (hoy) todavía no tiene doc (el cron corre de madrugada): para
 * ese día hacemos una query pequeña EN VIVO de `analytics_events` de hoy y la
 * agregamos con las MISMAS funciones puras que usa el doc diario, de modo que el
 * resultado combinado tenga EXACTAMENTE la misma forma que produce
 * getGlobalAnalytics (la que ya consumen los charts del dashboard).
 *
 * FALLBACK CRÍTICO: si NO existe ningún doc `analytics_daily` para los días ya
 * cerrados del rango (la CF aún no se desplegó/ejecutó), `getAnalyticsDailyRange`
 * devuelve null. El consumidor (AdminDashboard) cae entonces al getGlobalAnalytics
 * legacy, de modo que desplegar este frontend ANTES de que exista la CF sigue
 * mostrando el dashboard como hoy.
 *
 * NOTA de semántica (documentada en el plan de Fase 2):
 *  - Las identidades únicas y los "users" del embudo NO son sumables entre días
 *    (un mismo usuario en 2 días contaría doble). Aquí se SUMAN los conteos
 *    diarios como aproximación claramente etiquetada; la métrica aditiva fiable
 *    del rango es la suma de page_views.
 *  - scrollDepth/bounce se combinan a partir de SUMAS+CONTEOS crudos del doc
 *    diario (no del promedio) para promediar correctamente sobre el rango.
 *  - Top-N se guarda a 25 por día en el doc para que el top-10 del rango siga
 *    siendo correcto al recombinar; aquí re-rankeamos acumulando por clave.
 * ========================================================================== */

// El doc diario guarda Top-N a 25; el dashboard muestra top-10 (rutas/búsquedas)
// u 8 (categorías/colecciones). Recombinamos a 25 y dejamos que cada consumidor
// haga su propio slice, igual que con getGlobalAnalytics.
const COMBINE_TOP_N = 25;
const LEGACY_TOP_ROUTES = 10;   // getGlobalAnalytics: aggregateRouteMetrics slice(0,10)
const LEGACY_TOP_SEARCH = 10;   // aggregateTopSearches slice(0,10)
const LEGACY_TOP_PRODUCTS = 10; // aggregateTopProducts slice(0,10)
const LEGACY_TOP_CATEGORIES = 8;
const LEGACY_TOP_COLLECTIONS = 8;
const LEGACY_TOP_BANNERS = 10;

// Límite defensivo para la query EN VIVO del día en curso. El día actual es un
// rango chico; este tope solo protege de un pico de tráfico anómalo.
const TODAY_EVENTS_LIMIT = 4000;

/* -------------------------------------------------------------------------- */
/* Helpers de día (clave = día civil de Lima, UTC-5 fijo SIN DST)               */
/* -------------------------------------------------------------------------- */

// Offset fijo de Lima (UTC-5, sin horario de verano). IDÉNTICO al de la Cloud
// Function (functions/analyticsDaily.js): así los doc IDs que LEEMOS aquí
// coinciden con los que ESCRIBE la CF, aunque el admin navegue desde otra zona
// horaria. Restar este offset a un instante UTC y leerlo en UTC equivale a leer
// la fecha civil de Lima.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

// Formatea un instante (epoch ms) a la clave "YYYY-MM-DD" del día civil de Lima.
// Restamos el offset de Lima y leemos los componentes en UTC: eso nos da el
// día/mes/año tal como se ven en Lima, independiente de la zona del navegador.
function dayKeyFromMs(ms) {
  const d = new Date(ms - LIMA_OFFSET_MS);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Convierte una clave "YYYY-MM-DD" (día civil de Lima) al epoch ms de su
// medianoche en Lima: 00:00 Lima = 05:00 UTC, es decir Date.UTC(...) + offset.
function dayKeyToStartMs(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) + LIMA_OFFSET_MS;
}

// Devuelve las claves de día [hoy-(days-1) ... hoy] en orden ascendente,
// usando el día civil de Lima (no el del navegador).
function buildDayKeys(days) {
  const n = Math.max(1, Number(days) || 1);
  const keys = [];
  const todayKey = dayKeyFromMs(Date.now());
  const todayStart = dayKeyToStartMs(todayKey);
  const dayMs = 24 * 60 * 60 * 1000;
  for (let i = n - 1; i >= 0; i--) {
    // Retrocedemos en saltos de 24h desde la medianoche Lima de hoy. Como Lima
    // no tiene DST, cada día tiene exactamente 24h y la clave queda exacta.
    const startMs = todayStart - i * dayMs;
    keys.push({ key: dayKeyFromMs(startMs), startMs });
  }
  return keys;
}

// Personas ÚNICAS de un rango: une los ids de cada día (personasIds del doc,
// desde la medición de visitas). null si ningún día los trae.
export function personasUnicas(docs = []) {
  const app = new Set();
  const web = new Set();
  let conIds = 0;
  docs.forEach((d) => {
    if (!d?.personasIds) return;
    conIds += 1;
    (d.personasIds.app || []).forEach((x) => app.add(x));
    (d.personasIds.web || []).forEach((x) => web.add(x));
  });
  if (!conIds) return null;
  return { total: new Set([...app, ...web]).size, app: app.size, web: web.size };
}

// Claves de día entre dos instantes (rango personalizado), ascendentes.
function buildDayKeysBetween(desdeMs, hastaMs) {
  const dayMs = 24 * 60 * 60 * 1000;
  const inicio = dayKeyToStartMs(dayKeyFromMs(desdeMs));
  const fin = dayKeyToStartMs(dayKeyFromMs(hastaMs));
  const keys = [];
  for (let ms = inicio; ms <= fin && keys.length < 400; ms += dayMs) keys.push({ key: dayKeyFromMs(ms), startMs: ms });
  return keys;
}

// Inicio (00:00 Lima) del día de hoy en ms. El día "en curso" es
// [todayStartMs, ahora]; el resto del rango son días ya cerrados con doc.
function todayStartMs() {
  return dayKeyToStartMs(dayKeyFromMs(Date.now()));
}

/* -------------------------------------------------------------------------- */
/* Acumuladores aditivos {total,app,web}                                       */
/* -------------------------------------------------------------------------- */

function emptyTAW() {
  return { total: 0, app: 0, web: 0 };
}

// Suma in-place b sobre a, tolerando que b sea undefined o un número plano.
function addTAW(a, b) {
  if (!b) return a;
  if (typeof b === 'number') {
    a.total += safeNumber(b);
    return a;
  }
  a.total += safeNumber(b.total);
  a.app += safeNumber(b.app);
  a.web += safeNumber(b.web);
  return a;
}

// Acumula un mapa { clave -> {total,app,web} } (top-N) en un Map JS.
function accTopTAW(map, list, idKey = 'path', extraKeys = []) {
  (list || []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const id = row[idKey];
    if (id == null) return;
    if (!map.has(id)) {
      const seed = { [idKey]: id };
      extraKeys.forEach((k) => { if (row[k] != null) seed[k] = row[k]; });
      seed.__taw = emptyTAW();
      map.set(id, seed);
    }
    const entry = map.get(id);
    // Conserva el primer nombre/label legible que aparezca.
    extraKeys.forEach((k) => { if (entry[k] == null && row[k] != null) entry[k] = row[k]; });
    addTAW(entry.__taw, row.__rawTAW || row.taw || row);
  });
}

// Acumula un contador simple por clave (mapas devices/utm/geo: { name -> count }).
function accCountMap(map, list, nameKey = 'name', valueKey = 'count') {
  (list || []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const name = row[nameKey];
    if (name == null) return;
    map.set(name, (map.get(name) || 0) + safeNumber(row[valueKey]));
  });
}

/* -------------------------------------------------------------------------- */
/* Agregación EN VIVO del día en curso (mismas reglas que el doc diario)        */
/* -------------------------------------------------------------------------- */

// ── Top identidades del día EN VIVO (espejo de aggregateTopIdentities de la CF,
// functions/analyticsDaily.js) ────────────────────────────────────────────────
// Clave = uid || anonymousId; acumula page_views y dwellMs por identidad y
// devuelve el top-25 por views (desempate por dwellMs) con el MISMO shape que
// la CF escribe en el doc diario: { clave, nombre, views, dwellMs, logueado }.
// Así el "Top visitantes" del rango incluye también el día en curso.
function buildTopIdentitiesFromEvents(events = []) {
  const T = ANALYTICS_EVENT_TYPES;
  const porIdentidad = new Map();
  events.forEach((ev) => {
    if (!ev) return;
    const clave = ev.uid || ev.anonymousId;
    if (!clave) return;
    if (!porIdentidad.has(clave)) {
      porIdentidad.set(clave, {
        clave, displayName: null, email: null, views: 0, dwellMs: 0, logueado: false,
      });
    }
    const ent = porIdentidad.get(clave);
    if (ev.type === T.PAGE_VIEW) ent.views += 1;
    if (ev.type === T.ROUTE_DWELL) ent.dwellMs += safeNumber(ev.dwellMs);
    // Se queda con el primer displayName/email no vacío visto en el día.
    if (ev.displayName && !ent.displayName) ent.displayName = ev.displayName;
    if (ev.email && !ent.email) ent.email = ev.email;
    if (ev.uid) ent.logueado = true;
  });
  return [...porIdentidad.values()]
    .sort((a, b) => (b.views - a.views) || (b.dwellMs - a.dwellMs))
    .slice(0, COMBINE_TOP_N)
    .map((ent) => ({
      clave: ent.clave,
      nombre: ent.displayName || ent.email || 'anónimo',
      views: ent.views,
      dwellMs: ent.dwellMs,
      logueado: ent.logueado,
    }));
}

// Construye, a partir de los eventos crudos de HOY, un "doc diario" parcial con
// la MISMA forma que produce la CF, para poder combinarlo con los días cerrados.
// Replica la lógica de adminAnalytics.js (segmentación por clientType WEB/APP).
function buildTodayDailyDoc(events = []) {
  const seg = (ev) => (ev.clientType === 'APP' ? 'app' : 'web');

  const pageViews = emptyTAW();
  const dwellMs = emptyTAW();
  const events_taw = emptyTAW();

  // Embudo (counts + usuarios distintos del día).
  const funnelCounters = {
    views: emptyTAW(), adds: emptyTAW(), checkouts: emptyTAW(), purchases: emptyTAW(),
  };
  const funnelUsers = {
    views: { total: new Set(), app: new Set(), web: new Set() },
    adds: { total: new Set(), app: new Set(), web: new Set() },
    checkouts: { total: new Set(), app: new Set(), web: new Set() },
    purchases: { total: new Set(), app: new Set(), web: new Set() },
  };
  const trackFunnel = (key, ev) => {
    const t = seg(ev);
    funnelCounters[key].total++; funnelCounters[key][t]++;
    const id = ev.uid || ev.anonymousId || ev.sessionId;
    if (id) { funnelUsers[key].total.add(id); funnelUsers[key][t].add(id); }
  };

  // Rutas (views + dwell por path).
  const routeViews = new Map();
  const routeDwell = new Map();
  const bumpRoute = (m, path, t, amount) => {
    if (!m.has(path)) m.set(path, emptyTAW());
    m.get(path).total += amount; m.get(path)[t] += amount;
  };

  // Productos / categorías / colecciones / búsquedas / banners.
  const byProduct = new Map();
  const byCategory = new Map();
  const byCollection = new Map();
  const byQuery = new Map();
  const byBanner = new Map();

  // Uso de funciones.
  const feature = { editor: 0, minijuegos: 0, misiones: 0, wishlist: 0, busqueda: 0 };

  // Scroll: sumas+conteos crudos.
  const scrollSum = emptyTAW();
  const scrollCnt = emptyTAW();

  const T = ANALYTICS_EVENT_TYPES;
  const RELEVANT_CAT = new Set([T.PRODUCT_VIEW, T.CATEGORY_VIEW, T.ADD_TO_CART]);
  const RELEVANT_COL = new Set([T.COLLECTION_VIEW, T.PRODUCT_VIEW]);

  events.forEach((ev) => {
    const t = seg(ev);
    events_taw.total++; events_taw[t]++;

    const route = ev.path || 'unknown';

    if (ev.type === T.PAGE_VIEW) {
      pageViews.total++; pageViews[t]++;
      bumpRoute(routeViews, route, t, 1);
    }
    if (ev.type === T.ROUTE_DWELL) {
      const d = safeNumber(ev.dwellMs);
      dwellMs.total += d; dwellMs[t] += d;
      bumpRoute(routeDwell, route, t, d);
    }

    // Embudo (views = page_view + route_dwell, igual que aggregateFunnel).
    if (ev.type === T.PAGE_VIEW || ev.type === T.ROUTE_DWELL) trackFunnel('views', ev);
    if (ev.type === T.ADD_TO_CART) trackFunnel('adds', ev);
    if (ev.type === T.CHECKOUT_START) trackFunnel('checkouts', ev);
    if (ev.type === T.PURCHASE_COMPLETE) trackFunnel('purchases', ev);

    // Productos vistos.
    if (ev.type === T.PRODUCT_VIEW && ev.eventData?.productId) {
      const id = ev.eventData.productId;
      if (!byProduct.has(id)) byProduct.set(id, { productId: id, name: ev.eventData.name, __taw: emptyTAW() });
      byProduct.get(id).__taw.total++; byProduct.get(id).__taw[t]++;
    }

    // Categorías.
    if (RELEVANT_CAT.has(ev.type)) {
      const id = ev.eventData?.categoryId;
      const name = ev.eventData?.categoryName;
      const key = id || name;
      if (key) {
        if (!byCategory.has(key)) byCategory.set(key, { id: id || null, name: name || id || null, total: 0 });
        byCategory.get(key).total++;
        if (name && !byCategory.get(key).name) byCategory.get(key).name = name;
      }
    }

    // Colecciones.
    if (RELEVANT_COL.has(ev.type)) {
      const id = ev.eventData?.collectionId;
      const name = ev.eventData?.collectionName;
      const key = id || name;
      if (key) {
        if (!byCollection.has(key)) byCollection.set(key, { id: id || null, name: name || id || null, total: 0 });
        byCollection.get(key).total++;
        if (name && !byCollection.get(key).name) byCollection.get(key).name = name;
      }
    }

    // Búsquedas.
    if (ev.type === T.SEARCH_QUERY && ev.eventData?.query) {
      const q = ev.eventData.query.toLowerCase();
      if (!byQuery.has(q)) byQuery.set(q, { query: q, __taw: emptyTAW() });
      byQuery.get(q).__taw.total++; byQuery.get(q).__taw[t]++;
    }

    // Banners.
    if (ev.type === T.BANNER_CLICK && ev.eventData?.bannerId) {
      const id = ev.eventData.bannerId;
      if (!byBanner.has(id)) byBanner.set(id, { bannerId: id, __taw: emptyTAW() });
      byBanner.get(id).__taw.total++; byBanner.get(id).__taw[t]++;
    }

    // Uso de funciones.
    switch (ev.type) {
      case T.EDITOR_OPEN:
      case T.EDITOR_SAVE: feature.editor++; break;
      case T.MINIGAME_START:
      case T.MINIGAME_COMPLETE: feature.minijuegos++; break;
      case T.MISSION_COMPLETE: feature.misiones++; break;
      case T.WISHLIST_ADD: feature.wishlist++; break;
      case T.SEARCH_QUERY: feature.busqueda++; break;
      default: break;
    }

    // Scroll depth (sumas+conteos crudos).
    if (ev.type === T.SCROLL_DEPTH && typeof ev.eventData?.depth === 'number') {
      const depth = ev.eventData.depth;
      scrollSum.total += depth; scrollCnt.total++;
      scrollSum[t] += depth; scrollCnt[t]++;
    }
  });

  // Identidades activas del día (distinct uid|email|anonymousId).
  const idsT = new Set(), idsA = new Set(), idsW = new Set();
  events.forEach((ev) => {
    const id = ev.uid || ev.email || ev.anonymousId;
    if (!id) return;
    idsT.add(id);
    if (ev.clientType === 'APP') idsA.add(id); else idsW.add(id);
  });

  // Helpers de serialización de mapas top-N → arrays {key, __rawTAW} a 25.
  const topRouteArr = (m) => [...m.entries()]
    .map(([path, taw]) => ({ path, __rawTAW: taw }))
    .sort((a, b) => b.__rawTAW.total - a.__rawTAW.total)
    .slice(0, COMBINE_TOP_N);

  const topProductsArr = [...byProduct.values()]
    .map((p) => ({ productId: p.productId, name: p.name, __rawTAW: p.__taw }))
    .sort((a, b) => b.__rawTAW.total - a.__rawTAW.total)
    .slice(0, COMBINE_TOP_N);

  const topSearchArr = [...byQuery.values()]
    .map((s) => ({ query: s.query, __rawTAW: s.__taw }))
    .sort((a, b) => b.__rawTAW.total - a.__rawTAW.total)
    .slice(0, COMBINE_TOP_N);

  const topBannerArr = [...byBanner.values()]
    .map((b) => ({ bannerId: b.bannerId, __rawTAW: b.__taw }))
    .sort((a, b) => b.__rawTAW.total - a.__rawTAW.total)
    .slice(0, COMBINE_TOP_N);

  const topCategoriesArr = [...byCategory.values()]
    .sort((a, b) => b.total - a.total).slice(0, COMBINE_TOP_N);
  const topCollectionsArr = [...byCollection.values()]
    .sort((a, b) => b.total - a.total).slice(0, COMBINE_TOP_N);

  // orderTracking del día EN VIVO en forma CRUDA, IDÉNTICA a la que emite la CF:
  // { views, totalDwellMs, dwellEvents, uniqueUsers }. Es clave incluir
  // `dwellEvents` (el DENOMINADOR del promedio): combineDailyDocs acumula
  // order.totalDwellMs (numerador) Y order.dwellEvents (denominador) por doc, y
  // luego promedia avgDwellMs = totalDwellMs / dwellEvents. Si el día en vivo
  // aportara solo el numerador (como hace deriveOrderTracking, que NO trae
  // dwellEvents), el promedio del rango quedaría SESGADO (sumaría dwell al
  // numerador sin sumar sus eventos al denominador).
  //
  // Contamos sobre los MISMOS eventos de permanencia de pedido que usa
  // deriveOrderTracking para totalDwellMs (ruta bajo el prefijo de seguimiento de
  // pedidos). Replicamos el prefijo inline para no depender de un símbolo no
  // exportado de adminAnalytics.js.
  const ORDER_TRACKING_PREFIX = '/cuenta/pedidos';
  const isOrderPath = (path) => {
    if (typeof path !== 'string') return false;
    const clean = path.split('?')[0].split('#')[0];
    return clean === ORDER_TRACKING_PREFIX || clean.startsWith(`${ORDER_TRACKING_PREFIX}/`);
  };
  const orderTrackingRaw = { views: 0, totalDwellMs: 0, dwellEvents: 0, uniqueUsers: 0 };
  const orderUsers = new Set();
  events.forEach((ev) => {
    if (!isOrderPath(ev?.path)) return;
    if (ev.type === T.PAGE_VIEW) orderTrackingRaw.views++;
    if (ev.type === T.ROUTE_DWELL) {
      orderTrackingRaw.totalDwellMs += safeNumber(ev.dwellMs);
      orderTrackingRaw.dwellEvents++;
    }
    const identity = ev.uid || ev.anonymousId || ev.email;
    if (identity) orderUsers.add(identity);
  });
  orderTrackingRaw.uniqueUsers = orderUsers.size;

  return {
    pageViews,
    events: events_taw,
    dwellMs,
    activeIdentities: { total: idsT.size, app: idsA.size, web: idsW.size },
    funnel: {
      events: funnelCounters,
      users: {
        views: { total: funnelUsers.views.total.size, app: funnelUsers.views.app.size, web: funnelUsers.views.web.size },
        adds: { total: funnelUsers.adds.total.size, app: funnelUsers.adds.app.size, web: funnelUsers.adds.web.size },
        checkouts: { total: funnelUsers.checkouts.total.size, app: funnelUsers.checkouts.app.size, web: funnelUsers.checkouts.web.size },
        purchases: { total: funnelUsers.purchases.total.size, app: funnelUsers.purchases.app.size, web: funnelUsers.purchases.web.size },
      },
    },
    routes: {
      byViews: topRouteArr(routeViews),
      byDwellMs: topRouteArr(routeDwell),
    },
    topProducts: topProductsArr,
    topSearches: topSearchArr,
    topCategories: topCategoriesArr,
    topCollections: topCollectionsArr,
    bannerClicks: topBannerArr,
    featureUsage: feature,
    scrollDepth: {
      sumTotal: scrollSum.total, cntTotal: scrollCnt.total,
      sumApp: scrollSum.app, cntApp: scrollCnt.app,
      sumWeb: scrollSum.web, cntWeb: scrollCnt.web,
    },
    // Forma CRUDA igual a la CF; combineDailyDocs la promedia correctamente.
    orderTracking: orderTrackingRaw,
    // Top identidades del día EN VIVO (mismo shape que escribe la CF): permite
    // que el "Top visitantes" del rango incluya HOY además de los días cerrados.
    topIdentities: buildTopIdentitiesFromEvents(events),
    // sessions/devices/utm/geography: el día en vivo NO los calcula (requieren leer
    // sesiones); el dashboard los toma de los días cerrados. Quedan en cero hoy.
    eventCount: events.length,
    __raw: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Tráfico real del día en curso                                               */
/* -------------------------------------------------------------------------- */
// Lo mismo que functions/analyticsTraficoReal.js hace con los días cerrados,
// con lo que se puede saber solo con los eventos: fuera las páginas /admin y
// todo lo de quien las abrió hoy (solo un admin puede abrirlas), y cada
// permanencia recortada a 30 min. Los bots ya no se registran (tracker.js).
const DWELL_MAX_MS = 30 * 60 * 1000;
export function limpiarEventosHoy(events = []) {
  const esAdmin = (e) => String(e.path || '').startsWith('/admin');
  const quienes = new Set(events.filter(esAdmin).map((e) => e.uid || e.anonymousId).filter(Boolean));
  return events
    .filter((e) => !esAdmin(e) && !quienes.has(e.uid || e.anonymousId))
    .map((e) => (e.type === ANALYTICS_EVENT_TYPES.ROUTE_DWELL && Number(e.dwellMs) > DWELL_MAX_MS ? { ...e, dwellMs: DWELL_MAX_MS } : e));
}

/* -------------------------------------------------------------------------- */
/* Lectura del rango: N docs diarios + (opcional) hoy en vivo                   */
/* -------------------------------------------------------------------------- */

/**
 * getAnalyticsDailyRange({ days }) — lee los docs `analytics_daily/{day}` del
 * rango (1 lectura por día) + el día en curso en vivo, y los combina en la MISMA
 * estructura que produce getGlobalAnalytics.
 *
 * FALLBACK: devuelve null si NINGÚN día cerrado del rango tiene doc (la CF aún no
 * existe). El consumidor debe caer a getGlobalAnalytics. Lanza si hay un error de
 * Firestore real (también capturable por el consumidor).
 *
 * @returns {Promise<object|null>} mismo shape que getGlobalAnalytics().data, o null.
 */
export async function getAnalyticsDailyRange({ days = 30, desdeMs, hastaMs } = {}) {
  // Rango personalizado (también pasado): los mismos docs diarios, nunca los
  // eventos crudos del rango.
  const dayList = desdeMs != null && hastaMs != null ? buildDayKeysBetween(desdeMs, hastaMs) : buildDayKeys(days);
  const todayKey = dayKeyFromMs(Date.now());

  // Todos los días del rango, HOY incluido: la CF aggregateAnalyticsToday lo
  // recalcula cada 30 min con la misma lógica (visitas, sin bots ni admin).
  // 1 getDoc por día, en paralelo.
  const closedDays = dayList;

  const docResults = await Promise.all(
    closedDays.map((d) => getDocument(ANALYTICS_COLLECTIONS.DAILY, d.key))
  );

  // Un error de Firestore distinto de "Documento no encontrado" es un fallo real:
  // lo propagamos para que el consumidor caiga al legacy.
  const hardError = docResults.find(
    (r) => r.error && r.error !== 'Documento no encontrado'
  );
  if (hardError) {
    throw new Error(`analytics_daily lectura falló: ${hardError.error}`);
  }

  const dailyDocs = docResults.map((r) => r.data).filter(Boolean);

  // FALLBACK CRÍTICO: ningún doc diario disponible → la CF no se ha desplegado/
  // ejecutado. Devolvemos null para que el dashboard use getGlobalAnalytics.
  if (dailyDocs.length === 0) {
    return null;
  }

  // Respaldo: si el doc de HOY todavía no existe (minutos después de las 00:00),
  // se arma en vivo con los eventos de hoy, como antes.
  let todayDoc = null;
  const hayHoy = dailyDocs.some((d) => d.day === todayKey);
  if (!hayHoy && dayList.some((d) => d.key === todayKey)) try {
    const startMs = todayStartMs();
    const { data: todayEvents, error } = await getCollection(
      ANALYTICS_COLLECTIONS.EVENTS,
      [{ field: 'clientTsMs', operator: '>=', value: startMs }],
      { field: 'clientTsMs', direction: 'desc' },
      TODAY_EVENTS_LIMIT
    );
    // Si la query de hoy falla, NO rompemos: mostramos el histórico ya agregado.
    if (!error && Array.isArray(todayEvents) && todayEvents.length > 0) {
      todayDoc = buildTodayDailyDoc(limpiarEventosHoy(todayEvents));
    }
  } catch {
    todayDoc = null;
  }

  const allDocs = todayDoc ? [...dailyDocs, todayDoc] : dailyDocs;

  return combineDailyDocs(allDocs, dayList);
}

/* -------------------------------------------------------------------------- */
/* Combinación de docs diarios → shape de getGlobalAnalytics                    */
/* -------------------------------------------------------------------------- */

// Lee de un doc diario un sub-objeto top-N normalizando su {total,app,web}.
// El doc de la CF guarda los contadores como {total,app,web} embebido por fila
// (p.ej. routes.byViews[i].views = {t,a,w}); el doc "hoy" usa __rawTAW. Esta
// función unifica ambas formas a __rawTAW para accTopTAW.
function normalizeRows(rows, valueKey) {
  return (rows || []).map((row) => {
    if (!row || typeof row !== 'object') return row;
    if (row.__rawTAW) return row;
    const taw = valueKey && row[valueKey] ? row[valueKey] : (row.taw || row.views || row.dwellMs || row);
    return { ...row, __rawTAW: taw };
  });
}

/* -------------------------------------------------------------------------- */
/* Resultados: ventas, otros cobros, carritos, interés, deseos y Crear          */
/* (functions/analyticsResultados.js). Docs anteriores al 2026-10-24 no traen  */
/* estos campos y no aportan nada: la UI dice "sin datos" en vez de un cero.   */
/* -------------------------------------------------------------------------- */

const TOP_VENDIDOS_RANGO = 50;
const TOP_CARRITOS_RANGO = 50;
const TOP_PARES_INTERES_RANGO = 150;
const TOP_PRODUCTOS_INTERES_RANGO = 25;
const TOP_DESEOS_RANGO = 25;

function nuevosResultados() {
  return {
    dias: 0,
    ventas: { pedidos: emptyTAW(), ingresosCents: emptyTAW(), unidades: emptyTAW() },
    vendidos: new Map(),
    otrosCobros: {},
    carritos: { cantidad: emptyTAW(), valorCents: emptyTAW(), lista: new Map() },
    interesPares: new Map(),
    interesProductos: new Map(),
    deseos: { agregados: emptyTAW(), quitados: emptyTAW(), productos: new Map() },
    crear: { aperturas: emptyTAW(), aperturasCombo: emptyTAW(), guardados: emptyTAW() },
  };
}

function acumularResultados(acc, doc) {
  if (!doc?.ventas) return;
  acc.dias += 1;
  Object.keys(acc.ventas).forEach((k) => addTAW(acc.ventas[k], doc.ventas[k]));
  (doc.topVendidos || []).forEach((p) => {
    if (!p?.productId) return;
    const x = acc.vendidos.get(p.productId) || { productId: p.productId, unidades: 0, ingresosCents: 0, pedidos: 0, linea: null };
    x.unidades += safeNumber(p.unidades);
    x.ingresosCents += safeNumber(p.ingresosCents);
    x.pedidos += safeNumber(p.pedidos);
    x.linea = x.linea || p.linea || null;
    acc.vendidos.set(p.productId, x);
  });
  Object.entries(doc.otrosCobros || {}).forEach(([fuente, c]) => {
    const x = acc.otrosCobros[fuente] || (acc.otrosCobros[fuente] = { cantidad: 0, porMoneda: {} });
    x.cantidad += safeNumber(c?.cantidad);
    Object.entries(c?.porMoneda || {}).forEach(([m, cents]) => { x.porMoneda[m] = (x.porMoneda[m] || 0) + safeNumber(cents); });
  });
  const ca = doc.carritosAbandonados || {};
  addTAW(acc.carritos.cantidad, ca.cantidad);
  addTAW(acc.carritos.valorCents, ca.valorCents);
  (ca.lista || []).forEach((c) => { if (c?.sessionId) acc.carritos.lista.set(c.sessionId, c); });
  (doc.interes?.pares || []).forEach((p) => {
    const clave = `${p.uid}|${p.productId}`;
    const x = acc.interesPares.get(clave) || { uid: p.uid, productId: p.productId, nombre: null, dwellMs: 0, visitas: 0, ultimaMs: 0 };
    x.dwellMs += safeNumber(p.dwellMs);
    x.visitas += safeNumber(p.visitas);
    x.ultimaMs = Math.max(x.ultimaMs, safeNumber(p.ultimaMs));
    x.nombre = x.nombre || p.nombre || null;
    acc.interesPares.set(clave, x);
  });
  (doc.interes?.productos || []).forEach((p) => {
    const x = acc.interesProductos.get(p.productId) || { productId: p.productId, dwellMs: 0, personas: 0, anonimos: 0 };
    x.dwellMs += safeNumber(p.dwellMs);
    x.personas += safeNumber(p.personas); // suma de días: aproximación
    x.anonimos += safeNumber(p.anonimos);
    acc.interesProductos.set(p.productId, x);
  });
  addTAW(acc.deseos.agregados, doc.deseos?.agregados);
  addTAW(acc.deseos.quitados, doc.deseos?.quitados);
  (doc.deseos?.topProductos || []).forEach((p) => {
    const x = acc.deseos.productos.get(p.productId) || { productId: p.productId, nombre: null, agregados: 0 };
    x.agregados += safeNumber(p.agregados);
    x.nombre = x.nombre || p.nombre || null;
    acc.deseos.productos.set(p.productId, x);
  });
  Object.keys(acc.crear).forEach((k) => addTAW(acc.crear[k], doc.crear?.[k]));
}

function cerrarResultados(acc) {
  const carritos = [...acc.carritos.lista.values()]
    .sort((a, b) => (Number(Boolean(b.uid)) - Number(Boolean(a.uid))) || (safeNumber(b.ts) - safeNumber(a.ts)))
    .slice(0, TOP_CARRITOS_RANGO);
  return {
    // Días del rango que ya traen estos campos (0 = sin datos todavía).
    diasConResultados: acc.dias,
    ventas: acc.ventas,
    topVendidos: [...acc.vendidos.values()]
      .sort((a, b) => (b.ingresosCents - a.ingresosCents) || (b.unidades - a.unidades))
      .slice(0, TOP_VENDIDOS_RANGO),
    otrosCobros: acc.otrosCobros,
    carritosAbandonados: { cantidad: acc.carritos.cantidad, valorCents: acc.carritos.valorCents, lista: carritos },
    // Mismo formato que el cálculo viejo (aggregateAbandonedCarts), para las
    // pantallas que ya lo usan.
    abandonedCarts: carritos.map((c) => ({
      id: c.sessionId,
      uid: c.uid || null,
      hasAccount: Boolean(c.uid),
      displayName: c.nombre || null,
      email: c.email || null,
      clientType: c.clientType || 'WEB',
      lastCartValue: safeNumber(c.valorCents),
      abandonedAtMs: safeNumber(c.ts),
    })),
    interes: {
      pares: [...acc.interesPares.values()].sort((a, b) => b.dwellMs - a.dwellMs).slice(0, TOP_PARES_INTERES_RANGO),
      productos: [...acc.interesProductos.values()].sort((a, b) => b.dwellMs - a.dwellMs).slice(0, TOP_PRODUCTOS_INTERES_RANGO),
    },
    deseos: {
      agregados: acc.deseos.agregados,
      quitados: acc.deseos.quitados,
      topProductos: [...acc.deseos.productos.values()].sort((a, b) => b.agregados - a.agregados).slice(0, TOP_DESEOS_RANGO),
    },
    crear: acc.crear,
  };
}

// "Se fueron sin hacer nada" = visitas sin interacción (sin 2+ páginas, 10 s
// ni pedido), en %. Mismo criterio que el recuadro de calidad del panel.
function reboteDesdeVisitas(visitas) {
  const pct = (k) => {
    const total = safeNumber(visitas?.total?.[k]);
    return total > 0 ? Math.round(((total - safeNumber(visitas?.conInteraccion?.[k])) / total) * 100) : 0;
  };
  return { total: pct('total'), app: pct('app'), web: pct('web') };
}

function combineDailyDocs(docs, dayList) {
  // --- contadores aditivos {total,app,web} ---
  const pageViews = emptyTAW();
  const events = emptyTAW();
  const sessions = emptyTAW();
  const dwellMs = emptyTAW();
  const activeIdentities = emptyTAW(); // suma de diarios (aproximación etiquetada)

  // --- embudo ---
  const funnelEvents = { views: emptyTAW(), adds: emptyTAW(), checkouts: emptyTAW(), purchases: emptyTAW() };
  const funnelUsers = { views: emptyTAW(), adds: emptyTAW(), checkouts: emptyTAW(), purchases: emptyTAW() };

  // --- top-N acumulados ---
  const routeViews = new Map();
  const routeDwell = new Map();
  const products = new Map();
  const searches = new Map();
  const banners = new Map();
  const categories = new Map(); // total simple
  const collections = new Map();

  // --- visitas, canales de origen y calidad (docs con traficoReal v2) ---
  const visitas = { total: emptyTAW(), conInteraccion: emptyTAW(), paginas: emptyTAW(), dwellMs: emptyTAW(), pedidos: emptyTAW() };
  const canales = new Map();
  const calidad = { sesionesRegistradas: 0, sesionesBot: 0, sesionesAdmin: 0, sinPaginas: 0, unidas: 0, diasMedidos: 0 };
  let actualizadoEnMs = 0;
  const resultados = nuevosResultados();

  // --- devices/utm/geo (count maps) ---
  const byDevice = new Map(), byBrowser = new Map(), byOS = new Map();
  const bySource = new Map(), byCampaign = new Map();
  const byRegion = new Map();

  // --- campos NUEVOS del doc diario (P1): país real (IP), dispositivo guardado,
  //     segmento APP/WEB e identidades desglosadas. Docs viejos sin estos campos
  //     NO aportan nada y el resultado queda vacío ("sin datos" en la UI). ---
  const byCountryNew = new Map();     // code -> { code, name, count }
  const byCountryAproxNew = new Map();// code -> { code, name, count } (aprox. por timezone, días históricos)
  const byDeviceNew = new Map();      // name -> count (campo nuevo del doc)
  const byBrowserNew = new Map();
  const byOSNew = new Map();
  const byClientTypeNew = new Map();  // 'APP'|'WEB' -> count
  const identitiesNew = {};           // subclave (logged/anonymous/…) -> TAW
  const topIdentitiesAcc = new Map(); // clave -> { clave, nombre, views, dwellMs, logueado }

  // Cobertura de los campos NUEVOS dentro del rango, para que la UI pueda dar
  // el aviso HONESTO ("sin datos para este desglose antes del <fecha>") en vez
  // de ceros engañosos. Solo cuenta días CERRADOS (docs de la CF): el día en
  // vivo no trae desgloses de sesión (byCountry/byDevice…) por diseño.
  const cobertura = {
    closedDocs: 0,             // días cerrados combinados en el rango
    docsWithBreakdowns: 0,     // días con los desgloses nuevos (byCountry/byDevice/…)
    docsWithTopIdentities: 0,  // días con topIdentities
    firstBreakdownDay: null,   // primera clave 'YYYY-MM-DD' con desgloses nuevos
    firstTopIdentitiesDay: null,
  };

  // --- uso de funciones ---
  const feature = { editor: 0, minijuegos: 0, misiones: 0, wishlist: 0, busqueda: 0 };

  // --- scroll (sumas+conteos crudos) ---
  const scrollSum = emptyTAW();
  const scrollCnt = emptyTAW();

  // --- order tracking (sumable salvo uniqueUsers, que aproximamos sumando) ---
  const order = { views: 0, totalDwellMs: 0, dwellEvents: 0, uniqueUsers: 0 };

  // --- serie por día para los charts (page_views por día) ---
  const seriesByDay = new Map();

  const accCategories = (list) => {
    (list || []).forEach((c) => {
      if (!c) return;
      const key = c.id || c.name;
      if (key == null) return;
      if (!categories.has(key)) categories.set(key, { id: c.id || null, name: c.name || c.id || null, total: 0 });
      categories.get(key).total += safeNumber(c.total);
      if (c.name && !categories.get(key).name) categories.get(key).name = c.name;
    });
  };
  const accCollections = (list) => {
    (list || []).forEach((c) => {
      if (!c) return;
      const key = c.id || c.name;
      if (key == null) return;
      if (!collections.has(key)) collections.set(key, { id: c.id || null, name: c.name || c.id || null, total: 0 });
      collections.get(key).total += safeNumber(c.total);
      if (c.name && !collections.get(key).name) collections.get(key).name = c.name;
    });
  };

  docs.forEach((doc) => {
    if (!doc) return;
    addTAW(pageViews, doc.pageViews);
    addTAW(events, doc.events);
    addTAW(sessions, doc.sessions);
    addTAW(dwellMs, doc.dwellMs);
    addTAW(activeIdentities, doc.activeIdentities);

    // Visitas (como Google Analytics), canal de origen y lo que se descartó.
    if (doc.visitas) Object.keys(visitas).forEach((k) => addTAW(visitas[k], doc.visitas[k]));
    Object.entries(doc.canales || {}).forEach(([canal, c]) => {
      const x = canales.get(canal) || { canal, visitas: 0, conInteraccion: 0, paginas: 0, dwellMs: 0, pedidos: 0 };
      ['visitas', 'conInteraccion', 'paginas', 'dwellMs', 'pedidos'].forEach((k) => { x[k] += safeNumber(c?.[k]); });
      canales.set(canal, x);
    });
    if (doc.traficoReal?.version >= 2) {
      calidad.diasMedidos += 1;
      ['sesionesRegistradas', 'sesionesBot', 'sesionesAdmin', 'sinPaginas', 'unidas'].forEach((k) => { calidad[k] += safeNumber(doc.traficoReal[k]); });
    }
    const g = doc.generatedAt;
    const gMs = typeof g?.toMillis === 'function' ? g.toMillis() : safeNumber(g?.seconds) * 1000;
    if (gMs > actualizadoEnMs) actualizadoEnMs = gMs;
    acumularResultados(resultados, doc);

    // Embudo.
    const fe = doc.funnel?.events || {};
    addTAW(funnelEvents.views, fe.views); addTAW(funnelEvents.adds, fe.adds);
    addTAW(funnelEvents.checkouts, fe.checkouts); addTAW(funnelEvents.purchases, fe.purchases);
    const fu = doc.funnel?.users || {};
    addTAW(funnelUsers.views, fu.views); addTAW(funnelUsers.adds, fu.adds);
    addTAW(funnelUsers.checkouts, fu.checkouts); addTAW(funnelUsers.purchases, fu.purchases);

    // Top-N rutas (la CF guarda fila.views = {t,a,w}; "hoy" usa __rawTAW).
    accTopTAW(routeViews, normalizeRows(doc.routes?.byViews, 'views'), 'path');
    accTopTAW(routeDwell, normalizeRows(doc.routes?.byDwellMs, 'dwellMs'), 'path');

    // Top productos: la CF guarda {productId,name,total,app,web}; "hoy" __rawTAW.
    accTopTAW(products, normalizeProductRows(doc.topProducts), 'productId', ['name']);
    accTopTAW(searches, normalizeFlatTAWRows(doc.topSearches), 'query');
    accTopTAW(banners, normalizeFlatTAWRows(doc.bannerClicks), 'bannerId');

    accCategories(doc.topCategories);
    accCollections(doc.topCollections);

    // Devices/utm/geo (de sesiones; el día en vivo no las trae → ceros).
    accCountMap(byDevice, doc.devices?.byDevice ? mapToRows(doc.devices.byDevice) : doc.devices?.topDevices);
    accCountMap(byBrowser, doc.devices?.byBrowser ? mapToRows(doc.devices.byBrowser) : doc.devices?.topBrowsers);
    accCountMap(byOS, doc.devices?.byOS ? mapToRows(doc.devices.byOS) : doc.devices?.topOS);
    accCountMap(bySource, doc.utm?.bySource ? mapToRows(doc.utm.bySource, 'value') : doc.utm?.topSources, 'name', 'value');
    accCountMap(byCampaign, doc.utm?.byCampaign ? mapToRows(doc.utm.byCampaign) : doc.utm?.topCampaigns);
    accCountMap(byRegion, doc.geography?.byTimezone ? mapToRows(doc.geography.byTimezone) : doc.geography?.topRegions);

    // ── Campos NUEVOS (lectura tolerante; docs viejos = no-op) ──────────────
    // País real por IP de las sesiones del día (nuevo en la CF; puede vivir en
    // la raíz del doc o bajo geography según la versión que lo escribió).
    accCountryTolerant(byCountryNew, doc.byCountry ?? doc.geography?.byCountry);
    // País APROXIMADO por zona horaria: serie APARTE que la CF emite SOLO para
    // sesiones históricas sin geo por IP. No se mezcla con byCountry (confiable).
    accCountryTolerant(byCountryAproxNew, doc.byCountryAprox ?? doc.geography?.byCountryAprox);
    // Dispositivo/navegador/SO: preferimos el campo NUEVO (derivado de los
    // campos guardados en la sesión); si el doc es viejo, caemos al desglose
    // existente devices.* (parseo de UA), para no dejar el rango "sin datos".
    accCountsTolerant(byDeviceNew, doc.byDevice ?? doc.devices?.byDevice);
    accCountsTolerant(byBrowserNew, doc.byBrowser ?? doc.devices?.byBrowser);
    accCountsTolerant(byOSNew, doc.byOS ?? doc.devices?.byOS);
    // Segmento APP/WEB: campo nuevo; si falta, lo derivamos de las sesiones
    // segmentadas del día (misma semántica: sessions.app/web YA es clientType).
    if (doc.byClientType != null) {
      accCountsTolerant(byClientTypeNew, doc.byClientType);
    } else if (doc.sessions) {
      const appN = safeNumber(doc.sessions.app);
      const webN = safeNumber(doc.sessions.web);
      if (appN > 0) byClientTypeNew.set('APP', (byClientTypeNew.get('APP') || 0) + appN);
      if (webN > 0) byClientTypeNew.set('WEB', (byClientTypeNew.get('WEB') || 0) + webN);
    }
    // Identidades desglosadas (identities / identitiesLogged / …): suma diaria
    // (aproximación etiquetada, igual que activeIdentities).
    accIdentitiesTolerant(identitiesNew, doc);
    // Top identidades: recombina el top-25 diario sumando views/dwell por clave
    // (docs viejos sin el campo = no-op). El día en vivo también lo aporta.
    accTopIdentities(topIdentitiesAcc, doc.topIdentities);

    // Cobertura de los campos NUEVOS (solo días cerrados, para avisos honestos).
    if (!doc.__raw) {
      cobertura.closedDocs += 1;
      const diaDoc = doc.day || doc.__day || null;
      if (doc.byCountry != null || doc.byDevice != null || doc.byClientType != null) {
        cobertura.docsWithBreakdowns += 1;
        if (diaDoc && (!cobertura.firstBreakdownDay || diaDoc < cobertura.firstBreakdownDay)) {
          cobertura.firstBreakdownDay = diaDoc;
        }
      }
      if (Array.isArray(doc.topIdentities)) {
        cobertura.docsWithTopIdentities += 1;
        if (diaDoc && (!cobertura.firstTopIdentitiesDay || diaDoc < cobertura.firstTopIdentitiesDay)) {
          cobertura.firstTopIdentitiesDay = diaDoc;
        }
      }
    }

    // Uso de funciones.
    const fu2 = doc.featureUsage || {};
    if (Array.isArray(fu2)) {
      fu2.forEach((f) => { if (f?.area && feature[f.area] != null) feature[f.area] += safeNumber(f.total); });
    } else {
      Object.keys(feature).forEach((k) => { feature[k] += safeNumber(fu2[k]); });
    }

    // Scroll (sumas+conteos crudos).
    const sd = doc.scrollDepth || {};
    scrollSum.total += safeNumber(sd.sumTotal); scrollCnt.total += safeNumber(sd.cntTotal);
    scrollSum.app += safeNumber(sd.sumApp); scrollCnt.app += safeNumber(sd.cntApp);
    scrollSum.web += safeNumber(sd.sumWeb); scrollCnt.web += safeNumber(sd.cntWeb);

    // Order tracking.
    const ot = doc.orderTracking || {};
    order.views += safeNumber(ot.views);
    order.totalDwellMs += safeNumber(ot.totalDwellMs);
    order.dwellEvents += safeNumber(ot.dwellEvents);
    order.uniqueUsers += safeNumber(ot.uniqueUsers);

    // Serie por día: page_views del día (para reconstruir eventsForCharts).
    const dKey = doc.day || doc.__day;
    if (dKey) {
      seriesByDay.set(dKey, {
        total: safeNumber(doc.pageViews?.total),
        app: safeNumber(doc.pageViews?.app),
        web: safeNumber(doc.pageViews?.web),
      });
    }
  });

  // El día "hoy" no tiene `day`; lo asociamos a la última clave del rango.
  // (buildTodayDailyDoc no setea day; lo resolvemos aquí por exclusión.)
  // Clave de hoy en día civil de Lima, consistente con buildDayKeys.
  const todayKeyLima = dayKeyFromMs(Date.now());
  if (!seriesByDay.has(todayKeyLima)) {
    const todayDocPv = docs.find((d) => d && d.__raw);
    if (todayDocPv) {
      seriesByDay.set(todayKeyLima, {
        total: safeNumber(todayDocPv.pageViews?.total),
        app: safeNumber(todayDocPv.pageViews?.app),
        web: safeNumber(todayDocPv.pageViews?.web),
      });
    }
  }

  /* ----- serializar top-N al shape exacto de getGlobalAnalytics ----- */
  const sortTAW = (map) => [...map.values()].sort((a, b) => b.__taw.total - a.__taw.total);

  // routes: { path, views: {total,app,web} }  /  { path, dwellMs: {total,app,web} }
  const topRoutesByViews = sortTAW(routeViews)
    .slice(0, LEGACY_TOP_ROUTES)
    .map((r) => ({ path: r.path, views: r.__taw }));
  const topRoutesByDwell = sortTAW(routeDwell)
    .slice(0, LEGACY_TOP_ROUTES)
    .map((r) => ({ path: r.path, dwellMs: r.__taw }));
  const mostTimeRoute = topRoutesByDwell[0] || null;

  // topProducts: { name, total, app, web } (+ productId conservado).
  const topProducts = sortTAW(products)
    .slice(0, LEGACY_TOP_PRODUCTS)
    .map((p) => ({ productId: p.productId, name: p.name, total: p.__taw.total, app: p.__taw.app, web: p.__taw.web }));

  // topSearches: { query, total, app, web }.
  const topSearches = sortTAW(searches)
    .slice(0, LEGACY_TOP_SEARCH)
    .map((s) => ({ query: s.query, total: s.__taw.total, app: s.__taw.app, web: s.__taw.web }));

  // bannerClicks: { bannerId, total, app, web }.
  const bannerClicks = sortTAW(banners)
    .slice(0, LEGACY_TOP_BANNERS)
    .map((b) => ({ bannerId: b.bannerId, total: b.__taw.total, app: b.__taw.app, web: b.__taw.web }));

  const topCategoriesByViews = [...categories.values()].sort((a, b) => b.total - a.total).slice(0, LEGACY_TOP_CATEGORIES);
  const topCollectionsByViews = [...collections.values()].sort((a, b) => b.total - a.total).slice(0, LEGACY_TOP_COLLECTIONS);

  const featureUsage = Object.entries(feature)
    .filter(([, total]) => total > 0)
    .map(([area, total]) => ({ area, total }))
    .sort((a, b) => b.total - a.total);

  // devices/utm/geo → mismo shape que aggregateDevices/UTM/Geography.
  const mapToSorted = (m, k1 = 'name', k2 = 'count') =>
    [...m.entries()].map(([name, v]) => ({ [k1]: name, [k2]: v })).sort((a, b) => b[k2] - a[k2]);

  const deviceStats = {
    topDevices: mapToSorted(byDevice),
    topBrowsers: mapToSorted(byBrowser),
    topOS: mapToSorted(byOS),
  };
  const utmStats = {
    topSources: mapToSorted(bySource, 'name', 'value'),
    topCampaigns: mapToSorted(byCampaign),
  };
  const geographyStats = {
    topRegions: mapToSorted(byRegion),
  };

  // Totales de sesiones: el doc diario trae `sessions` (segmentado). Si la CF no
  // lo emite, queda en cero (el dashboard usa sobre todo page_views/identidades).
  const totalSessions = sessions;

  const avgDwellPerSessionMs = {
    total: totalSessions.total > 0 ? Math.round(dwellMs.total / totalSessions.total) : 0,
    app: totalSessions.app > 0 ? Math.round(dwellMs.app / totalSessions.app) : 0,
    web: totalSessions.web > 0 ? Math.round(dwellMs.web / totalSessions.web) : 0,
  };

  // scrollDepth: promedio combinando sumas+conteos crudos.
  const scrollDepth = {
    avgTotal: scrollCnt.total > 0 ? Math.round(scrollSum.total / scrollCnt.total) : 0,
    avgApp: scrollCnt.app > 0 ? Math.round(scrollSum.app / scrollCnt.app) : 0,
    avgWeb: scrollCnt.web > 0 ? Math.round(scrollSum.web / scrollCnt.web) : 0,
  };

  const orderTracking = {
    views: order.views,
    uniqueUsers: order.uniqueUsers,
    totalDwellMs: order.totalDwellMs,
    avgDwellMs: order.dwellEvents > 0 ? Math.round(order.totalDwellMs / order.dwellEvents) : 0,
  };

  // eventsForCharts: el dashboard SOLO usa los eventos page_view (bucketea por
  // día) y add_to_cart (DashProductos). Reconstruimos marcadores page_view
  // sintéticos por día/segmento a partir de la serie diaria, de modo que la
  // serie temporal salga IDÉNTICA. (add_to_cart por producto solo del día en
  // vivo; los días cerrados no lo desglosan por producto en el doc diario.)
  const eventsForCharts = buildSyntheticPageViewEvents(seriesByDay);
  const resultadosRango = cerrarResultados(resultados);

  return {
    // mismo shape que getGlobalAnalytics().data (parte pesada/cacheable).
    totalRegisteredUsers: 0, // se conoce solo en el legacy; el dashboard no lo usa en charts.
    activeIdentities,
    totalSessions,
    totalEvents: events,
    totalDwellMs: dwellMs,
    avgDwellPerSessionMs,
    funnelStats: { events: funnelEvents, users: funnelUsers },
    abandonedCarts: resultadosRango.abandonedCarts,
    topRoutesByViews,
    topRoutesByDwell,
    mostTimeRoute,
    topSearches,
    topProducts,
    topCategoriesByViews,
    topCollectionsByViews,
    featureUsage,
    bannerClicks,
    orderTracking,
    scrollDepth,
    bounceRate: reboteDesdeVisitas(visitas),
    deviceStats,
    utmStats,
    geographyStats,
    // ── Campos NUEVOS expuestos (P1; la UI de filtros llega en P2) ──────────
    // Forma estable para las páginas: arrays ordenados desc; [] = "sin datos".
    byCountry: [...byCountryNew.values()].sort((a, b) => b.count - a.count),
    // País APROXIMADO por zona horaria (serie APARTE de byCountry): solo días
    // históricos sin geo por IP; [] = "sin datos" o rango totalmente geolocalizado.
    byCountryAprox: [...byCountryAproxNew.values()].sort((a, b) => b.count - a.count),
    byDevice: mapToSorted(byDeviceNew),
    byBrowser: mapToSorted(byBrowserNew),
    byOS: mapToSorted(byOSNew),
    byClientType: mapToSorted(byClientTypeNew),
    // Alias estable del embudo combinado (misma forma y contenido que funnelStats).
    funnel: { events: funnelEvents, users: funnelUsers },
    // Identidades desglosadas: {} = "sin datos" (docs viejos no las traen).
    identities: identitiesNew,
    // Top identidades del rango: recombinado de los top-25 DIARIOS (máx. 25).
    // Honestidad: cada doc guarda solo su top-25 → los totales del rango son un
    // MÍNIMO (una identidad fuera del top de un día no aporta ese día).
    topIdentities: [...topIdentitiesAcc.values()]
      .sort((a, b) => (b.views - a.views) || (b.dwellMs - a.dwellMs))
      .slice(0, COMBINE_TOP_N),
    // Cobertura de los campos nuevos en el rango (avisos honestos en la UI).
    extendedCoverage: cobertura,
    estimatedSummary: null,
    eventsForCharts,
    // Bloque realtime: lo añade el consumidor desde getGlobalAnalytics (lectura
    // barata y siempre fresca). Aquí dejamos vacíos seguros por si se lee directo.
    realtimeActiveSessions: emptyTAW(),
    realtimeSessionsDetails: [],
    // Visitas, de dónde vienen y qué se descartó (recuadros del panel).
    visitas,
    personas: personasUnicas(docs),
    canales: [...canales.values()].sort((a, b) => b.visitas - a.visitas),
    calidad,
    actualizadoEnMs,
    // Resultados: ventas, topVendidos, otrosCobros, carritosAbandonados,
    // interes, deseos, crear y diasConResultados.
    ...resultadosRango,
    // Metadato para diagnóstico/UX (no lo consumen los charts).
    pageViews,
    __source: 'analytics_daily',
  };
}

// Para probar la combinación con docs reales (sin leer Firestore).
export { combineDailyDocs as _combinarDocsDiarios };

/* -------------------------------------------------------------------------- */
/* Normalizadores de filas top-N del doc de la CF                              */
/* -------------------------------------------------------------------------- */

// topProducts de la CF: { productId, name, total, app, web } → __rawTAW.
function normalizeProductRows(rows) {
  return (rows || []).map((row) => {
    if (!row) return row;
    if (row.__rawTAW) return row;
    return { productId: row.productId, name: row.name, __rawTAW: { total: safeNumber(row.total), app: safeNumber(row.app), web: safeNumber(row.web) } };
  });
}

// topSearches/bannerClicks de la CF: { query|bannerId, total, app, web }.
function normalizeFlatTAWRows(rows) {
  return (rows || []).map((row) => {
    if (!row) return row;
    if (row.__rawTAW) return row;
    const { total, app, web, ...rest } = row;
    return { ...rest, __rawTAW: { total: safeNumber(total), app: safeNumber(app), web: safeNumber(web) } };
  });
}

// Convierte un mapa { name: count } (devices/utm/geo del doc CF) a filas.
function mapToRows(obj, valueKey = 'count') {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([name, count]) => ({ name, [valueKey]: safeNumber(count) }));
}

/* -------------------------------------------------------------------------- */
/* Lectura TOLERANTE de los campos NUEVOS del doc diario (P1 geo/dispositivo)  */
/* -------------------------------------------------------------------------- */
/* Los docs diarios NUEVOS pueden traer byCountry / byDevice / byBrowser / byOS /
 * byClientType / identities* (derivados de los campos nuevos de analytics_sessions:
 * countryCode/countryName/device/browser/os/clientType). Los docs VIEJOS no los
 * tienen: cada acumulador tolera la ausencia total (no-op) y acepta las DOS formas
 * razonables de serialización: mapa { clave: n } / { clave: {count|total} } o
 * filas [{ name|code, count|value|total }]. Si nada aporta datos, el resultado
 * queda vacío y las páginas muestran "sin datos". */

// Acumula un contador por nombre desde mapa o filas (formas mixtas toleradas).
function accCountsTolerant(map, value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const name = row.name ?? row.key ?? row.code;
      if (name == null) return;
      const count = safeNumber(row.count ?? row.value ?? row.total);
      map.set(name, (map.get(name) || 0) + count);
    });
    return;
  }
  Object.entries(value).forEach(([name, v]) => {
    const count = typeof v === 'object' && v !== null
      ? safeNumber(v.count ?? v.total ?? v.value)
      : safeNumber(v);
    map.set(name, (map.get(name) || 0) + count);
  });
}

// Acumula byCountry conservando código ISO-2 y nombre legible.
// Tolera: mapa { PE: 12 } | { PE: {name:'Perú', count:12} } | filas
// [{ code|countryCode, name|countryName, count|total|value }].
function accCountryTolerant(map, value) {
  if (!value || typeof value !== 'object') return;
  const bump = (code, name, count) => {
    if (code == null) return;
    if (!map.has(code)) map.set(code, { code, name: name || code, count: 0 });
    const entry = map.get(code);
    entry.count += safeNumber(count);
    // Conserva el primer nombre legible distinto del código que aparezca.
    if (name && entry.name === entry.code) entry.name = name;
  };
  if (Array.isArray(value)) {
    value.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      bump(
        row.code ?? row.countryCode ?? row.name,
        row.name ?? row.countryName ?? null,
        row.count ?? row.value ?? row.total
      );
    });
    return;
  }
  Object.entries(value).forEach(([code, v]) => {
    if (typeof v === 'object' && v !== null) {
      bump(code, v.name ?? v.countryName ?? null, v.count ?? v.total ?? v.value);
    } else {
      bump(code, null, v);
    }
  });
}

// Acumula topIdentities del doc diario en un Map por clave de identidad:
// suma views/dwellMs, hace OR de `logueado` y conserva el primer nombre "real"
// (distinto de 'anónimo') visto en el rango — si la persona se logueó un solo
// día, el rango completo muestra su nombre. Docs viejos sin el campo = no-op.
function accTopIdentities(map, rows) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    if (!row || typeof row !== 'object' || row.clave == null) return;
    if (!map.has(row.clave)) {
      map.set(row.clave, { clave: row.clave, nombre: null, views: 0, dwellMs: 0, logueado: false });
    }
    const ent = map.get(row.clave);
    ent.views += safeNumber(row.views);
    ent.dwellMs += safeNumber(row.dwellMs);
    if (row.logueado) ent.logueado = true;
    if (row.nombre && row.nombre !== 'anónimo') {
      if (!ent.nombre || ent.nombre === 'anónimo') ent.nombre = row.nombre;
    } else if (!ent.nombre && row.nombre) {
      ent.nombre = row.nombre;
    }
  });
}

// Acumula identidades desglosadas del doc: forma anidada doc.identities =
// { logged: {t,a,w}, anonymous: {...}, ... } y/o claves planas
// doc.identitiesLogged / doc.identitiesAnonymous / etc. Suma diaria = misma
// APROXIMACIÓN etiquetada que activeIdentities (no distinct del rango).
function accIdentitiesTolerant(acc, doc) {
  if (!doc || typeof doc !== 'object') return;
  const nested = doc.identities;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    Object.entries(nested).forEach(([key, v]) => {
      if (!acc[key]) acc[key] = emptyTAW();
      addTAW(acc[key], v);
    });
  }
  Object.keys(doc).forEach((k) => {
    const m = /^identities([A-Z].*)$/.exec(k);
    if (!m) return;
    const sub = m[1].charAt(0).toLowerCase() + m[1].slice(1);
    if (!acc[sub]) acc[sub] = emptyTAW();
    addTAW(acc[sub], doc[k]);
  });
}

/* -------------------------------------------------------------------------- */
/* eventsForCharts sintético (solo page_view por día/segmento)                 */
/* -------------------------------------------------------------------------- */

// A partir de la serie diaria { dayKey -> {total,app,web} } genera marcadores
// page_view ligeros: por cada día y segmento empuja N eventos {type:'page_view',
// clientTsMs, clientType}. El bucketing por día de AdminDashboard/DashPaginas/
// AdminUsuariosAnalyticsPage queda EXACTO. clientTsMs = mediodía del día (12:00)
// para evitar cualquier corrimiento de zona al cruzar medianoche.
function buildSyntheticPageViewEvents(seriesByDay) {
  const out = [];
  for (const [dayKey, pv] of seriesByDay.entries()) {
    const [y, m, d] = dayKey.split('-').map(Number);
    if (!y || !m || !d) continue;
    const ts = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
    const app = safeNumber(pv.app);
    const web = safeNumber(pv.web);
    // Total puede exceder app+web si el doc segmentó distinto; respetamos web/app
    // explícitos y completamos el remanente como 'web' (lo que ya hace el legacy
    // para clientType !== 'APP').
    const remainder = Math.max(0, safeNumber(pv.total) - app - web);
    for (let i = 0; i < app; i++) out.push({ type: 'page_view', clientTsMs: ts, clientType: 'APP' });
    for (let i = 0; i < web + remainder; i++) out.push({ type: 'page_view', clientTsMs: ts, clientType: 'WEB' });
  }
  return out;
}
