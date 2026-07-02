export const ANALYTICS_COLLECTIONS = {
  EVENTS: 'analytics_events',
  SESSIONS: 'analytics_sessions',
  USER_SUMMARY: 'analytics_user_summary',
  GLOBAL_SUMMARY: 'analytics_global_summary',
  // Doc por día YA pre-agregado por la CF aggregateAnalyticsDaily (Fase 2).
  // Clave del doc = día Lima del clientTsMs (YYYY-MM-DD).
  DAILY: 'analytics_daily',
};

export const ANALYTICS_EVENT_TYPES = {
  PAGE_VIEW: 'page_view',
  ROUTE_DWELL: 'route_dwell',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  ADD_TO_CART: 'add_to_cart',
  CHECKOUT_START: 'checkout_start',
  PURCHASE_COMPLETE: 'purchase_complete',
  PRODUCT_VIEW: 'product_view',
  SEARCH_QUERY: 'search_query',
  SCROLL_DEPTH: 'scroll_depth',
  BANNER_CLICK: 'banner_click',
  // Eventos de navegacion por categoria/coleccion
  CATEGORY_VIEW: 'category_view',
  COLLECTION_VIEW: 'collection_view',
  // Eventos del editor de prendas
  EDITOR_OPEN: 'editor_open',
  EDITOR_SAVE: 'editor_save',
  // Eventos de gamificacion / fidelizacion
  MINIGAME_START: 'minigame_start',
  MINIGAME_COMPLETE: 'minigame_complete',
  MISSION_COMPLETE: 'mission_complete',
  WISHLIST_ADD: 'wishlist_add',
  // Observabilidad (Fase 4): errores de cliente y Web Vitals.
  // Se registran fire-and-forget; no contienen PII (solo message/stack/url/ua).
  CLIENT_ERROR: 'client_error',
  WEB_VITAL: 'web_vital',
  // Enlaces útiles (link-in-bio): visita a la página pública /l/{slug} y clic en
  // un botón. eventData lleva { pageId, slug } / { pageId, botonId, url }. El país
  // y el dispositivo se derivan de la sesión (mismo mecanismo que el resto).
  LINK_PAGE_VIEW: 'link_page_view',
  LINK_CLICK: 'link_click',
};

export const ANALYTICS_KEYS = {
  ANON_ID: 'pc_analytics_anonymous_id',
  SESSION_ID: 'pc_analytics_session_id',
};

export const UNKNOWN_ROUTE = 'unknown';

export function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function formatDayKey(value) {
  const ms = toMillis(value);
  if (!ms) return null;
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeRoute(pathname) {
  if (!pathname || typeof pathname !== 'string') return UNKNOWN_ROUTE;
  const cleaned = pathname.trim();
  return cleaned || UNKNOWN_ROUTE;
}

export function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
