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
function filtrarTraficoReal(events = [], sessions = [], { adminUids = new Set(), adminIds = new Set(), sesionesExtra = [] } = {}) {
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
  // adminIds: los dispositivos y cuentas que abrieron /admin alguna vez (guardados en
  // analytics_config/admin): fuera también los días que no abrieron el panel.
  const quienAdmin = new Set([...adminIds, ...idsAdminDelDia(events)]);
  const fuera = (e) => sesionesBot.has(e.sessionId) || sesionesAdmin.has(e.sessionId)
    || (e.uid && adminUids.has(e.uid)) || esRutaAdmin(e.path)
    || quienAdmin.has(e.uid) || quienAdmin.has(e.anonymousId);

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

/** uids e ids anónimos que abrieron /admin en estos eventos (solo un admin puede). */
function idsAdminDelDia(events = []) {
  const ids = new Set();
  events.forEach((e) => {
    if (!esRutaAdmin(e.path)) return;
    if (e.uid) ids.add(e.uid);
    if (e.anonymousId) ids.add(e.anonymousId);
  });
  return ids;
}

// ── Visitas (como Google Analytics) ─────────────────────────────────────────
// Una VISITA es alguien que entra y ve al menos una página. Las pestañas y
// recargas del mismo dispositivo con menos de 30 min entre una y otra son la
// misma visita. Una "sesión" del registro es una pestaña (sessionStorage): en
// la auditoría del 2026-10-23, 1 de cada 3 no tenía ninguna página vista y 4 de
// cada 10 eran otra pestaña de la misma persona a los pocos minutos.
const PAUSA_VISITA_MS = 30 * 60 * 1000;
// Con interacción: vio 2+ páginas, estuvo 10 s o más, o hizo un pedido.
const INTERACCION_MS = 10 * 1000;

const CANALES = [
  ["Google", /(^|\.)google\./],
  ["Otros buscadores", /(^|\.)(bing|yahoo|duckduckgo|yandex|ecosia)\./],
  ["Instagram", /(^|\.)instagram\.com$/],
  ["Facebook", /(^|\.)(facebook\.com|fb\.me|fb\.com|messenger\.com)$/],
  ["TikTok", /(^|\.)tiktok\.com$/],
  ["WhatsApp", /(^|\.)(whatsapp\.com|wa\.me)$/],
  ["YouTube", /(^|\.)(youtube\.com|youtu\.be)$/],
  ["Enlace corto (wl.co)", /(^|\.)wl\.co$/],
];
const UTM_CANAL = {
  ig: "Instagram", instagram: "Instagram", fb: "Facebook", facebook: "Facebook", tiktok: "TikTok", tt: "TikTok",
  google: "Google", whatsapp: "WhatsApp", wa: "WhatsApp", youtube: "YouTube",
};

/** De dónde vino una visita: la app, la etiqueta UTM del enlace o la página anterior (referrer). */
function canalDe(s = {}) {
  if (s.clientType === "APP") return "App Walá";
  const utm = String(s.utm_source || "").trim().toLowerCase();
  if (utm) return UTM_CANAL[utm] || "Campañas (UTM)";
  let host = "";
  try { host = s.referrer ? new URL(s.referrer).hostname.toLowerCase().replace(/^(www|m|l|lm)\./, "") : ""; } catch { host = ""; }
  // Sin página anterior, o desde la misma tienda: entró directo (o la app de
  // donde venía no lo dice: Instagram y WhatsApp suelen ocultarlo).
  if (!host || /(^|\.)wala\.pe$|vercel\.app$|^localhost$/.test(host)) return "Directo o sin dato";
  const canal = CANALES.find(([, re]) => re.test(host));
  return canal ? canal[0] : "Otros sitios";
}

/**
 * Une las sesiones (pestañas) en visitas. Recibe lo ya filtrado por
 * filtrarTraficoReal. Devuelve:
 *  - representantes: una sesión por visita (la primera), para buildDailyDoc: así
 *    sessions/devices/utm/geo del doc cuentan VISITAS
 *  - events: solo los eventos de sesiones que entraron a alguna visita
 *  - visitas: [{ canal, clientType, paginas, dwellMs, pedidos, conInteraccion, quien }]
 *  - calidad: { sinPaginas, unidas }
 */
function armarVisitas(events = [], sessions = []) {
  const porSesion = new Map();
  events.forEach((e) => {
    if (!e.sessionId) return;
    const x = porSesion.get(e.sessionId) || { paginas: 0, dwellMs: 0, pedidos: 0 };
    if (e.type === "page_view") x.paginas += 1;
    if (e.type === "route_dwell") x.dwellMs += Number(e.dwellMs) || 0;
    if (e.type === "purchase_complete") x.pedidos += 1;
    porSesion.set(e.sessionId, x);
  });
  const conPaginas = sessions.filter((s) => (porSesion.get(s.id) || {}).paginas > 0);
  const porQuien = new Map();
  conPaginas.forEach((s) => {
    const quien = s.anonymousId || s.uid || s.id;
    if (!porQuien.has(quien)) porQuien.set(quien, []);
    porQuien.get(quien).push(s);
  });

  const visitas = [];
  let unidas = 0;
  porQuien.forEach((lista, quien) => {
    lista.sort((a, b) => (a.startedAtClientMs || 0) - (b.startedAtClientMs || 0));
    let actual = null;
    lista.forEach((s) => {
      const inicio = s.startedAtClientMs || 0;
      const fin = Math.max(inicio, s.lastSeenAtClientMs || 0);
      const x = porSesion.get(s.id);
      if (actual && inicio - actual.fin < PAUSA_VISITA_MS) {
        unidas += 1;
        actual.fin = Math.max(actual.fin, fin);
        actual.paginas += x.paginas;
        actual.dwellMs += x.dwellMs;
        actual.pedidos += x.pedidos;
        return;
      }
      actual = { sesion: s, fin, quien, paginas: x.paginas, dwellMs: x.dwellMs, pedidos: x.pedidos };
      visitas.push(actual);
    });
  });
  const enVisita = new Set(conPaginas.map((s) => s.id));
  return {
    representantes: visitas.map((v) => v.sesion),
    events: events.filter((e) => enVisita.has(e.sessionId)),
    visitas: visitas.map((v) => ({
      canal: canalDe(v.sesion),
      clientType: v.sesion.clientType === "APP" ? "APP" : "WEB",
      paginas: v.paginas,
      dwellMs: v.dwellMs,
      pedidos: v.pedidos,
      conInteraccion: v.paginas >= 2 || v.dwellMs >= INTERACCION_MS || v.pedidos > 0,
      quien: v.quien,
    })),
    calidad: { sinPaginas: sessions.length - conPaginas.length, unidas },
  };
}

/** Resumen de las visitas del día para el doc diario (todo sumable entre días). */
function resumenVisitas(visitas = []) {
  const taw = () => ({ total: 0, app: 0, web: 0 });
  const sumar = (o, v, n = 1) => { o.total += n; o[v.clientType === "APP" ? "app" : "web"] += n; };
  const res = { total: taw(), conInteraccion: taw(), paginas: taw(), dwellMs: taw(), pedidos: taw() };
  const canales = {};
  visitas.forEach((v) => {
    sumar(res.total, v);
    if (v.conInteraccion) sumar(res.conInteraccion, v);
    sumar(res.paginas, v, v.paginas);
    sumar(res.dwellMs, v, v.dwellMs);
    sumar(res.pedidos, v, v.pedidos);
    const c = canales[v.canal] || (canales[v.canal] = { visitas: 0, conInteraccion: 0, paginas: 0, dwellMs: 0, pedidos: 0 });
    c.visitas += 1;
    if (v.conInteraccion) c.conInteraccion += 1;
    c.paginas += v.paginas;
    c.dwellMs += v.dwellMs;
    c.pedidos += v.pedidos;
  });
  return { visitas: res, canales };
}

/** sessionIds de eventos cuya sesión no está en la lista del día (empezó otro día). */
function sesionesFaltantes(events = [], sessions = []) {
  const conocidas = new Set(sessions.map((s) => s.id));
  return [...new Set(events.map((e) => e.sessionId).filter((id) => id && !conocidas.has(id)))];
}

module.exports = {
  BOT_UA, DWELL_MAX_MS, PAUSA_VISITA_MS, esBot, esRutaAdmin, filtrarTraficoReal, sesionesFaltantes,
  idsAdminDelDia, canalDe, armarVisitas, resumenVisitas,
};
