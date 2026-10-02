/**
 * Lógica PURA del aviso "Producto que estuvo mirando" (categoría product_views
 * del panel de notificaciones). Sin firebase-admin: se testea con Node puro
 * (functions/test/productViewLogic.test.js).
 *
 * Fuente: eventos route_dwell de analytics_events en "/producto/<id>" (se
 * guardan cada vez que el cliente sale de la ficha o cambia de pestaña).
 */

const VISITA_MIN_MS = 3000;          // menos de 3 s no cuenta como "verlo"
const MIN_VISITAS = 3;               // lo vio 3 veces o más…
const MIN_TIEMPO_MS = 2 * 60 * 1000; // …o pasó más de 2 minutos en total
const HORAS_DESDE_ULTIMA = 12;       // se avisa cuando ya se fue (al día siguiente), no mientras mira
const DIAS_SIN_REPETIR = 14;         // el mismo producto no se vuelve a avisar en 14 días

const PRODUCT_PATH = /^\/producto\/([^/?#]+)/;

function productIdDePath(path) {
  const m = PRODUCT_PATH.exec(String(path || ""));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch (e) {
    return m[1];
  }
}

/**
 * Agrupa los eventos por cliente y producto.
 * @returns {Map<string, Array<{productId, visitas, dwellMs, ultimoMs}>>}
 */
function agruparInteres(eventos) {
  const porUsuario = new Map();
  for (const e of eventos || []) {
    if (!e || !e.uid) continue;
    const productId = productIdDePath(e.path);
    if (!productId) continue;
    const dwell = Number(e.dwellMs) || 0;
    if (!porUsuario.has(e.uid)) porUsuario.set(e.uid, new Map());
    const productos = porUsuario.get(e.uid);
    if (!productos.has(productId)) productos.set(productId, { productId, visitas: 0, dwellMs: 0, ultimoMs: 0 });
    const r = productos.get(productId);
    r.dwellMs += dwell;
    if (dwell >= VISITA_MIN_MS) r.visitas += 1;
    r.ultimoMs = Math.max(r.ultimoMs, Number(e.clientTsMs) || 0);
  }
  const out = new Map();
  porUsuario.forEach((productos, uid) => out.set(uid, [...productos.values()]));
  return out;
}

function interesado(r) {
  return r.visitas >= MIN_VISITAS || r.dwellMs >= MIN_TIEMPO_MS;
}

/**
 * Elige, para un cliente, el producto a recordarle (o null): el de más interés
 * entre los que ya dejó de mirar hace al menos 12 h, no compró y no se le avisó
 * en los últimos 14 días.
 * @param {Array} lista       salida de agruparInteres para un uid
 * @param {object} log        { [productId]: ISO de la última vez que se avisó }
 * @param {Set<string>} comprados  productIds que ya compró
 */
function elegirProducto(lista, log, comprados, now = Date.now()) {
  const avisados = log || {};
  const compras = comprados || new Set();
  const candidatos = (lista || []).filter((r) => {
    if (!interesado(r)) return false;
    if (now - r.ultimoMs < HORAS_DESDE_ULTIMA * 3600 * 1000) return false;
    if (compras.has(r.productId)) return false;
    const previo = avisados[r.productId] ? Date.parse(avisados[r.productId]) : NaN;
    if (!Number.isNaN(previo) && now - previo < DIAS_SIN_REPETIR * 86400 * 1000) return false;
    return true;
  });
  candidatos.sort((a, b) => (b.visitas - a.visitas) || (b.dwellMs - a.dwellMs) || (b.ultimoMs - a.ultimoMs));
  return candidatos[0] || null;
}

module.exports = {
  VISITA_MIN_MS,
  MIN_VISITAS,
  MIN_TIEMPO_MS,
  HORAS_DESDE_ULTIMA,
  DIAS_SIN_REPETIR,
  productIdDePath,
  agruparInteres,
  elegirProducto,
};
