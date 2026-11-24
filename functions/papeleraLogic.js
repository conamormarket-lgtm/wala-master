/**
 * La papelera de productos (Productos › Papelera, 2026-11-04): qué hacer con
 * los `deleted` de productos_wala cada madrugada. Lógica pura (sin Firestore)
 * para probarla; la usa vaciarPapeleraVieja (./papelera).
 *  - Sin papeleraDesde (los archivados de antes de la papelera): se le pone
 *    hoy. Así nada se borra el mismo día que llega la función: cuentan sus
 *    DIAS_PAPELERA días desde ahí.
 *  - Con DIAS_PAPELERA días o más: se borra (solo el documento).
 *  - Menos los que nombra un producto vivo (la pieza de un combo, el que
 *    reemplaza a otro…): borrarlos rompería ese producto. Se quedan.
 * Mismos números que src/componentes/kit/adaptadoresAdmin.js (papeleraDesde).
 */
const DIAS_PAPELERA = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

function msDe(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

// Quién nombra a quién: ids entre comillas o al final de /crear/<id> o
// /combo/<id> (personalizarEn), en el documento entero. Igual que
// src/componentes/kit/adaptadoresAdmin.js (usosDeProductos).
const NOMBRADOS = /"([A-Za-z0-9_-]{1,64})"|\/(?:crear|combo)\/([A-Za-z0-9_-]{1,64})"/g;
function idsNombrados(texto, ids) {
  const vistos = new Set();
  for (const m of String(texto).matchAll(NOMBRADOS)) {
    const id = m[1] || m[2];
    if (ids.has(id)) vistos.add(id);
  }
  return vistos;
}

/**
 * productos: [{ id, ...datos }] (todos, vivos y borrados) · premios: los de
 * ruletaPrizes y rewardsCatalog ([{ id, ...datos }]) → { marcar, borrar, enUso } (ids).
 * Uno vencido que usa algo que se queda (un producto vivo, otro de la
 * papelera que todavía no vence, un premio) no se borra; si quien lo usa
 * también se borra hoy, sí.
 */
function planPapelera(productos = [], ahora = Date.now(), premios = []) {
  const lista = productos.filter((p) => p && p.id);
  const ids = new Set(lista.map((p) => p.id));
  const usos = new Map();
  const anotar = (quien, texto) => idsNombrados(texto, ids).forEach((id) => {
    if (id === quien) return;
    if (!usos.has(id)) usos.set(id, new Set());
    usos.get(id).add(quien);
  });
  lista.forEach((p) => anotar(p.id, JSON.stringify(p)));
  premios.filter((x) => x && x.id).forEach((x) => anotar(`premio:${x.id}`, JSON.stringify(x)));

  const marcar = [];
  const vencidos = [];
  for (const p of lista) {
    if (p.deleted !== true) continue;
    const desde = msDe(p.papeleraDesde);
    if (desde === null) { marcar.push(p.id); continue; }
    if (ahora - desde >= DIAS_PAPELERA * DIA_MS) vencidos.push(p.id);
  }
  let borrar = new Set(vencidos);
  for (;;) {
    const siguen = new Set([...borrar].filter((id) => [...(usos.get(id) || [])].every((u) => borrar.has(u))));
    if (siguen.size === borrar.size) break;
    borrar = siguen;
  }
  return { marcar, borrar: vencidos.filter((id) => borrar.has(id)), enUso: vencidos.filter((id) => !borrar.has(id)) };
}

module.exports = { DIAS_PAPELERA, planPapelera, msDe };
