// ════════════════════════════════════════════════════════════════════════════
// Resúmenes del día para "Resultados" (admin). Funciones puras: reciben los
// eventos del día YA filtrados a tráfico real (sin bots ni admin) y devuelven
// campos acotados para analytics_daily/{día}. Así las pantallas leen un doc por
// día en vez de miles de eventos con tope.
//
// Campos (los combina combineDailyDocs en src/services/analyticsDaily.js):
//   ventas              pedidos de la tienda (purchase_complete) y lo vendido
//   otrosCobros         sorteos, suscripción, saldos y pago rápido (payment_complete)
//   carritosAbandonados sesiones con algo en el carrito y sin pedido
//   interes             quién pasó tiempo en qué ficha de producto
//   deseos              agregados y quitados de la lista de deseos
//   crear               aperturas del estudio y creaciones guardadas
// ════════════════════════════════════════════════════════════════════════════

const T = {
  ROUTE_DWELL: "route_dwell",
  ADD_TO_CART: "add_to_cart",
  PURCHASE_COMPLETE: "purchase_complete",
  PAYMENT_COMPLETE: "payment_complete",
  WISHLIST_ADD: "wishlist_add",
  WISHLIST_REMOVE: "wishlist_remove",
  EDITOR_OPEN: "editor_open",
  EDITOR_SAVE: "editor_save",
};

const TOP_VENDIDOS = 50;
const TOP_CARRITOS = 50;
const TOP_PARES_INTERES = 150;
const TOP_PRODUCTOS_INTERES = 25;
const TOP_DESEOS = 25;
// Tiempo mínimo en una ficha para contar como interés de una persona.
const INTERES_MIN_MS = 30 * 1000;
const FUENTES_COBRO = ["sorteo", "suscripcion", "saldo", "pago_rapido"];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const seg = (e) => (e && e.clientType === "APP" ? "app" : "web");
const taw = () => ({ total: 0, app: 0, web: 0 });
const sumar = (o, e, n = 1) => { o.total += n; o[seg(e)] += n; };

// MANTENER EN SYNC con productIdFromPath de src/services/analytics/productInterest.mjs.
function productIdFromPath(path) {
  const m = /^\/producto\/([^/?#]+)/.exec(String(path || ""));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// ── Ventas: pedidos enviados desde la tienda (web y app) ────────────────────
// Como getTopSellingWala (salesAnalytics.js): ingresos = precio × unidades de
// cada línea; pedidos = orderId distintos (o eventos sin orderId).
function resumirVentas(events = []) {
  const pedidos = taw();
  const ingresosCents = taw();
  const unidades = taw();
  const vistos = new Set();
  const porProducto = new Map();
  events.forEach((e) => {
    if (!e || e.type !== T.PURCHASE_COMPLETE) return;
    const d = e.eventData || {};
    // El mismo pedido registrado dos veces (p. ej. al recargar la página de
    // éxito) se cuenta una sola vez, con sus productos.
    const clave = d.orderId || e.id || null;
    if (clave && vistos.has(clave)) return;
    if (clave) vistos.add(clave);
    sumar(pedidos, e);
    const enEstePedido = new Set();
    (Array.isArray(d.items) ? d.items : []).forEach((it) => {
      if (!it || typeof it !== "object") return;
      const u = num(it.qty != null ? it.qty : (it.quantity != null ? it.quantity : 1));
      const cents = Math.round(num(it.price) * u * 100);
      sumar(unidades, e, u);
      sumar(ingresosCents, e, cents);
      if (!it.productId) return;
      const p = porProducto.get(it.productId)
        || { productId: it.productId, unidades: 0, ingresosCents: 0, pedidos: 0, linea: null };
      p.unidades += u;
      p.ingresosCents += cents;
      if (!enEstePedido.has(it.productId)) { p.pedidos += 1; enEstePedido.add(it.productId); }
      p.linea = p.linea || it.lineaProducto || it.lineId || it.categoryId || null;
      porProducto.set(it.productId, p);
    });
  });
  return {
    ventas: { pedidos, ingresosCents, unidades },
    topVendidos: [...porProducto.values()]
      .sort((a, b) => (b.ingresosCents - a.ingresosCents) || (b.unidades - a.unidades))
      .slice(0, TOP_VENDIDOS),
  };
}

// ── Otros cobros: no son pedidos de la tienda ───────────────────────────────
// Por fuente y moneda (el pago rápido puede ser en dólares).
function resumirOtrosCobros(events = []) {
  const out = {};
  events.forEach((e) => {
    if (!e || e.type !== T.PAYMENT_COMPLETE) return;
    const d = e.eventData || {};
    const fuente = FUENTES_COBRO.includes(d.source) ? d.source : "otro";
    const moneda = String(d.currency || "PEN").toUpperCase();
    const x = out[fuente] || (out[fuente] = { cantidad: 0, porMoneda: {} });
    x.cantidad += 1;
    x.porMoneda[moneda] = (x.porMoneda[moneda] || 0) + Math.round(num(d.amountCents));
  });
  return out;
}

// ── Carritos abandonados ────────────────────────────────────────────────────
// Una sesión con algo agregado al carrito y sin pedido ese día (ni en esa
// sesión ni de la misma cuenta en otra). Valor = suma de lo agregado.
function resumirCarritos(events = []) {
  const compraron = { sesiones: new Set(), uids: new Set() };
  const porSesion = new Map();
  events.forEach((e) => {
    if (!e) return;
    if (e.type === T.PURCHASE_COMPLETE) {
      if (e.sessionId) compraron.sesiones.add(e.sessionId);
      if (e.uid) compraron.uids.add(e.uid);
    }
  });
  events.forEach((e) => {
    if (!e || !e.sessionId || e.type !== T.ADD_TO_CART) return;
    const c = porSesion.get(e.sessionId) || {
      sessionId: e.sessionId, uid: null, nombre: null, email: null,
      valorCents: 0, productos: 0, ts: 0, clientType: e.clientType || "WEB",
    };
    c.uid = c.uid || e.uid || null;
    c.nombre = c.nombre || e.displayName || null;
    c.email = c.email || e.email || null;
    c.valorCents += Math.round(num(e.eventData && e.eventData.totalCents));
    c.productos += 1;
    c.ts = Math.max(c.ts, num(e.clientTsMs));
    porSesion.set(e.sessionId, c);
  });
  const abandonados = [...porSesion.values()]
    .filter((c) => !compraron.sesiones.has(c.sessionId) && !(c.uid && compraron.uids.has(c.uid)));
  const resumen = taw();
  const valor = taw();
  abandonados.forEach((c) => {
    sumar(resumen, c);
    sumar(valor, c, c.valorCents);
  });
  return {
    carritosAbandonados: {
      cantidad: resumen,
      valorCents: valor,
      // Primero los que tienen cuenta (se les puede escribir), luego los recientes.
      lista: abandonados
        .sort((a, b) => (Number(Boolean(b.uid)) - Number(Boolean(a.uid))) || (b.ts - a.ts))
        .slice(0, TOP_CARRITOS),
    },
  };
}

// ── Interés por producto ────────────────────────────────────────────────────
// route_dwell en /producto/:id (ya recortado a 30 min por página). Pares
// cuenta+producto con al menos INTERES_MIN_MS, y un ranking por producto.
function resumirInteres(events = []) {
  const pares = new Map();
  const porProducto = new Map();
  events.forEach((e) => {
    if (!e || e.type !== T.ROUTE_DWELL) return;
    const productId = productIdFromPath(e.path);
    if (!productId) return;
    const dwell = num(e.dwellMs);
    const p = porProducto.get(productId) || { productId, dwellMs: 0, personas: new Set(), anonimos: 0 };
    p.dwellMs += dwell;
    if (e.uid) p.personas.add(e.uid); else p.anonimos += 1;
    porProducto.set(productId, p);
    if (!e.uid) return;
    const clave = `${e.uid}|${productId}`;
    const par = pares.get(clave)
      || { uid: e.uid, productId, nombre: e.displayName || null, dwellMs: 0, visitas: 0, ultimaMs: 0 };
    par.dwellMs += dwell;
    par.visitas += 1;
    par.ultimaMs = Math.max(par.ultimaMs, num(e.clientTsMs));
    par.nombre = par.nombre || e.displayName || null;
    pares.set(clave, par);
  });
  return {
    interes: {
      pares: [...pares.values()]
        .filter((p) => p.dwellMs >= INTERES_MIN_MS)
        .sort((a, b) => b.dwellMs - a.dwellMs)
        .slice(0, TOP_PARES_INTERES),
      productos: [...porProducto.values()]
        .sort((a, b) => b.dwellMs - a.dwellMs)
        .slice(0, TOP_PRODUCTOS_INTERES)
        .map((p) => ({ productId: p.productId, dwellMs: p.dwellMs, personas: p.personas.size, anonimos: p.anonimos })),
    },
  };
}

// ── Lista de deseos ─────────────────────────────────────────────────────────
// Antes del 2026-10-24 wishlist_add también podía ser un "quitar"
// (action: 'remove'): se respeta action para no contarlo como agregado.
function resumirDeseos(events = []) {
  const agregados = taw();
  const quitados = taw();
  const porProducto = new Map();
  events.forEach((e) => {
    if (!e) return;
    const d = e.eventData || {};
    const quita = e.type === T.WISHLIST_REMOVE || (e.type === T.WISHLIST_ADD && d.action === "remove");
    if (quita) { sumar(quitados, e); return; }
    if (e.type !== T.WISHLIST_ADD) return;
    sumar(agregados, e);
    if (!d.productId) return;
    const p = porProducto.get(d.productId) || { productId: d.productId, nombre: d.name || null, agregados: 0 };
    p.agregados += 1;
    p.nombre = p.nombre || d.name || null;
    porProducto.set(d.productId, p);
  });
  return {
    deseos: {
      agregados,
      quitados,
      topProductos: [...porProducto.values()].sort((a, b) => b.agregados - a.agregados).slice(0, TOP_DESEOS),
    },
  };
}

// ── Crear: aperturas del estudio (y del combo) y creaciones guardadas ───────
function resumirCrear(events = []) {
  const out = { aperturas: taw(), aperturasCombo: taw(), guardados: taw() };
  events.forEach((e) => {
    if (!e) return;
    const tipo = e.eventData && e.eventData.editorType;
    if (e.type === T.EDITOR_OPEN) sumar(tipo === "combo" ? out.aperturasCombo : out.aperturas, e);
    if (e.type === T.EDITOR_SAVE) sumar(out.guardados, e);
  });
  return { crear: out };
}

function buildResultadosDelDia(events = []) {
  return {
    ...resumirVentas(events),
    otrosCobros: resumirOtrosCobros(events),
    ...resumirCarritos(events),
    ...resumirInteres(events),
    ...resumirDeseos(events),
    ...resumirCrear(events),
  };
}

module.exports = {
  INTERES_MIN_MS,
  productIdFromPath,
  resumirVentas,
  resumirOtrosCobros,
  resumirCarritos,
  resumirInteres,
  resumirDeseos,
  resumirCrear,
  buildResultadosDelDia,
};
