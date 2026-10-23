// ════════════════════════════════════════════════════════════════════════════
// TRÁFICO REAL para el Dashboard Analítica. Puro (sin Firebase): lo usa la suma
// diaria (analyticsDaily.procesarDia) antes de armar el doc del día. Pruebas:
// functions/test/analyticsTraficoReal.test.js.
//
// Fuera del conteo (auditoría del 2026-10-23, últimos 30 días: ~30% de las
// sesiones eran bots, ~6% de las páginas vistas eran del admin y el 56% del
// tiempo navegado venía de pestañas olvidadas):
//   - Sesiones de bots: buscadores y navegadores automáticos (por su userAgent).
//   - El admin: páginas /admin y lo que navegan las cuentas de administrador.
//   - Permanencias larguísimas: cada route_dwell se recorta a DWELL_MAX_MS.
// Desde el mismo cambio, tracker.js ya no registra bots ni admin; esto limpia el
// histórico y cualquier evento que se cuele.
// ════════════════════════════════════════════════════════════════════════════

// ¡MANTENER EN SYNC con BOT_UA de src/services/analytics/tracker.js!
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|pingdom|uptime/i;
const DWELL_MAX_MS = 30 * 60 * 1000;

const esBot = (userAgent) => BOT_UA.test(String(userAgent || ""));
const esRutaAdmin = (path) => String(path || "").startsWith("/admin");

/**
 * @param {Array} events    analytics_events del día
 * @param {Array} sessions  analytics_sessions que EMPEZARON ese día (se cuentan)
 * @param {object} opts
 *   - adminUids: Set de uids con claim admin
 *   - sesionesExtra: sesiones de otros días con eventos en este (solo para saber si son bots)
 * @returns {{ events, sessions, descarte }}
 */
function filtrarTraficoReal(events = [], sessions = [], { adminUids = new Set(), sesionesExtra = [] } = {}) {
  const todas = [...sessions, ...sesionesExtra];
  const sesionesBot = new Set(todas.filter((s) => esBot(s.userAgent)).map((s) => s.id));
  const sesionesAdmin = new Set(todas.filter((s) => s.uid && adminUids.has(s.uid)).map((s) => s.id));

  // Sesiones que solo navegaron el admin: sus páginas vistas son todas /admin.
  const vistas = new Map();
  events.forEach((e) => {
    if (e.type !== "page_view" || !e.sessionId) return;
    const v = vistas.get(e.sessionId) || { tienda: false, admin: false };
    if (esRutaAdmin(e.path)) v.admin = true; else v.tienda = true;
    vistas.set(e.sessionId, v);
  });
  const soloAdmin = (id) => { const v = vistas.get(id); return Boolean(v && v.admin && !v.tienda); };

  // Quien abrió /admin ese día es admin (solo un admin puede abrirlo): fuera
  // también lo que navegó antes de iniciar sesión, por su id anónimo.
  const quienAdmin = new Set(events.filter((e) => esRutaAdmin(e.path)).map((e) => e.uid || e.anonymousId).filter(Boolean));
  const fuera = (e) => sesionesBot.has(e.sessionId) || sesionesAdmin.has(e.sessionId)
    || (e.uid && adminUids.has(e.uid)) || esRutaAdmin(e.path)
    || quienAdmin.has(e.uid || e.anonymousId);

  let dwellRecortados = 0;
  const eventosOk = events.filter((e) => !fuera(e)).map((e) => {
    if (e.type === "route_dwell" && Number(e.dwellMs) > DWELL_MAX_MS) {
      dwellRecortados += 1;
      return { ...e, dwellMs: DWELL_MAX_MS };
    }
    return e;
  });
  const sesionesOk = sessions.filter((s) => !sesionesBot.has(s.id) && !sesionesAdmin.has(s.id) && !soloAdmin(s.id)
    && !quienAdmin.has(s.uid) && !quienAdmin.has(s.anonymousId));

  return {
    events: eventosOk,
    sessions: sesionesOk,
    descarte: {
      sesionesBot: sessions.filter((s) => sesionesBot.has(s.id)).length,
      sesionesAdmin: sessions.length - sesionesOk.length - sessions.filter((s) => sesionesBot.has(s.id)).length,
      eventos: events.length - eventosOk.length,
      dwellRecortados,
    },
  };
}

/** sessionIds de eventos cuya sesión no está en la lista del día (empezó otro día). */
function sesionesFaltantes(events = [], sessions = []) {
  const conocidas = new Set(sessions.map((s) => s.id));
  return [...new Set(events.map((e) => e.sessionId).filter((id) => id && !conocidas.has(id)))];
}

module.exports = { BOT_UA, DWELL_MAX_MS, esBot, esRutaAdmin, filtrarTraficoReal, sesionesFaltantes };
