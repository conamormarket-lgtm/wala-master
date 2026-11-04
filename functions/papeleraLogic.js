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

/** productos: [{ id, ...datos }] (todos, vivos y borrados) → { marcar, borrar, enUso } (ids). */
function planPapelera(productos = [], ahora = Date.now()) {
  const vivos = productos
    .filter((p) => p && p.deleted !== true)
    .map((p) => ({ id: p.id, texto: JSON.stringify(p) }));
  const marcar = [];
  const borrar = [];
  const enUso = [];
  for (const p of productos) {
    if (!p || p.deleted !== true || !p.id) continue;
    const desde = msDe(p.papeleraDesde);
    if (desde === null) { marcar.push(p.id); continue; }
    if (ahora - desde < DIAS_PAPELERA * DIA_MS) continue;
    const aguja = `"${p.id}"`;
    if (vivos.some((v) => v.id !== p.id && v.texto.includes(aguja))) { enUso.push(p.id); continue; }
    borrar.push(p.id);
  }
  return { marcar, borrar, enUso };
}

module.exports = { DIAS_PAPELERA, planPapelera, msDe };
