"use strict";

// ¿El sorteo acepta participantes hoy? fechaInicio y fechaFin las guarda el
// admin como 'AAAA-MM-DD' (día de Lima). Abre a las 00:00 del inicio y cierra
// a las 23:59:59 del fin, hora de Lima (UTC-5, sin horario de verano). Sin
// fecha, no hay límite por ese lado. Antes las fechas no hacían nada: un
// sorteo "activo" aceptaba gente antes y después.
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const inicioMs = (f) => (typeof f === "string" && DIA.test(f) ? Date.parse(`${f}T00:00:00-05:00`) : NaN);
const finMs = (f) => (typeof f === "string" && DIA.test(f) ? Date.parse(`${f}T23:59:59.999-05:00`) : NaN);

/** null si está dentro de sus fechas; 'antes' o 'despues' si no. */
function fueraDeFechas(sorteo, ahora = Date.now()) {
  const ini = inicioMs(sorteo && sorteo.fechaInicio);
  const fin = finMs(sorteo && sorteo.fechaFin);
  if (Number.isFinite(ini) && ahora < ini) return "antes";
  if (Number.isFinite(fin) && ahora > fin) return "despues";
  return null;
}

/** El mensaje para el cliente, o '' si está dentro de sus fechas. */
function mensajeFueraDeFechas(sorteo, ahora = Date.now()) {
  const f = fueraDeFechas(sorteo, ahora);
  if (f === "antes") {
    const [a, m, d] = String(sorteo.fechaInicio).split("-");
    return `El sorteo empieza el ${Number(d)}/${Number(m)}/${a}.`;
  }
  if (f === "despues") return "El sorteo ya cerró.";
  return "";
}

module.exports = { fueraDeFechas, mensajeFueraDeFechas };
