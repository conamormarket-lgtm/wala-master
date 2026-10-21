// ── Las Bolitas de Kapi: lógica pura del servidor ─────────────────────────────
// Comprobar una partida (con el mismo motor que el celular, en
// bolitasMotor.mjs, copia generada), el nombre que se muestra en el ranking y
// el orden del ranking. Sin firebase-admin: se prueba con
// node functions/test/bolitasLogic.test.js.

let motorCargado = null;
/** El motor es un módulo ES: se carga una vez con import(). */
const motor = () => {
  if (!motorCargado) motorCargado = import("./bolitasMotor.mjs");
  return motorCargado;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const NIVEL_MAXIMO = 100000;

/** Un error con código (index.js lo pasa a HttpsError). */
function errorPartida(codigo, mensaje) {
  const e = new Error(mensaje);
  e.codigo = codigo;
  return e;
}

/**
 * Lee la partida que manda el celular y la comprueba: rearma el nivel (o el
 * reto de `hoy`) y repite los movimientos. Devuelve
 * { modo, nivel | fecha, movimientos (cuántos), tubos } o lanza un error
 * con `codigo` 'invalid-argument' (mal armada) o 'failed-precondition' (no
 * resuelve el nivel, o es el reto de otro día).
 *  - data: { modo: 'nivel' | 'reto', nivel, fecha, movimientos: [[de, a]…], tubos }
 */
async function comprobarPartidaBolitas(data, hoy) {
  const d = data && typeof data === "object" ? data : {};
  const m = await motor();
  let armado;
  let base;
  if (d.modo === "reto") {
    if (typeof d.fecha !== "string" || !FECHA.test(d.fecha)) throw errorPartida("invalid-argument", "Falta la fecha del reto.");
    if (d.fecha !== hoy) throw errorPartida("failed-precondition", "Ese reto ya no es el de hoy.");
    armado = m.retoDelDia(d.fecha);
    base = { modo: "reto", fecha: d.fecha };
  } else if (d.modo === "nivel") {
    const n = d.nivel;
    if (!Number.isInteger(n) || n < 1 || n > NIVEL_MAXIMO) throw errorPartida("invalid-argument", "Nivel inválido.");
    armado = m.nivel(n);
    base = { modo: "nivel", nivel: n };
  } else {
    throw errorPartida("invalid-argument", "Falta el modo de la partida.");
  }
  const tubos = d.tubos == null ? 0 : d.tubos;
  const r = m.comprobarPartida(armado, { movimientos: d.movimientos, tubos });
  if (!r.ok) {
    const codigo = ["movimientos", "tubos", "formato"].includes(r.motivo) ? "invalid-argument" : "failed-precondition";
    throw errorPartida(codigo, "La partida no resuelve el nivel (" + r.motivo + ").");
  }
  return { ...base, movimientos: r.movimientos, tubos };
}

/** La semana del ranking (el lunes), con el mismo cálculo del motor. */
async function semanaBolitas(fecha) {
  return (await motor()).semanaDe(fecha);
}

/**
 * El nombre que se ve en el ranking: el primer nombre y la inicial del
 * apellido ("Lucía R."). Nunca el correo; si no hay nombre, null (la
 * persona sale como "Jugador").
 */
function nombrePublico(perfil) {
  const p = perfil || {};
  const crudo = [p.displayName, p.nombres && p.apellidos ? p.nombres + " " + p.apellidos : p.nombres, p.clienteNombre, p.name, p.nombre]
    .map((v) => String(v == null ? "" : v).trim())
    .find((v) => v && !v.includes("@"));
  if (!crudo) return null;
  const palabras = crudo.split(/\s+/).map((w) => w.replace(/[^\p{L}'-]/gu, "")).filter(Boolean);
  if (!palabras.length || palabras[0].length < 2) return null;
  const capital = (w) => w.charAt(0).toLocaleUpperCase("es") + w.slice(1).toLocaleLowerCase("es");
  const nombre = capital(palabras[0].slice(0, 20));
  const inicial = palabras[1] ? " " + palabras[1].charAt(0).toLocaleUpperCase("es") + "." : "";
  return nombre + inicial;
}

/** Ranking del día: menos movimientos primero; empate, quien lo hizo antes. */
function ordenarRankingDia(filas) {
  return [...filas].sort((a, b) => a.movimientos - b.movimientos || (a.hecho || 0) - (b.hecho || 0));
}

/** Ranking de la semana: más retos hechos; empate, menos movimientos en total. */
function ordenarRankingSemana(filas) {
  return [...filas].sort((a, b) => b.completados - a.completados || a.total - b.total || (a.hecho || 0) - (b.hecho || 0));
}

/**
 * Suma un reto a la semana de una persona: guarda el mejor de cada día y
 * recalcula cuántos hizo y los movimientos en total.
 *  - semana: lo guardado ({ dias: { fecha: movimientos } }) o null
 */
function sumarRetoASemana(semana, fecha, movimientos) {
  const dias = { ...((semana && semana.dias) || {}) };
  dias[fecha] = dias[fecha] ? Math.min(dias[fecha], movimientos) : movimientos;
  const valores = Object.values(dias);
  return { dias, completados: valores.length, total: valores.reduce((t, v) => t + v, 0) };
}

module.exports = {
  comprobarPartidaBolitas,
  semanaBolitas,
  nombrePublico,
  ordenarRankingDia,
  ordenarRankingSemana,
  sumarRetoASemana,
};
