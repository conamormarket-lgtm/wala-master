// ── La Pichanga de Kapi: lógica pura del servidor ─────────────────────────────
// Comprobar una partida con el mismo motor y los mismos niveles que el
// celular (copias generadas por scripts/generar-motor-pichanga.js), unir el
// progreso guardado y ordenar los rankings. Sin firebase-admin: se prueba con
// node --test functions/test/pichangaLogic.test.js.

let cargados = null;
/** El motor, los niveles y el progreso son módulos ES: se cargan una vez. */
const modulos = () => {
  if (!cargados) {
    cargados = Promise.all([import("./pichangaMotor.mjs"), import("./pichangaNiveles.mjs"), import("./pichangaProgreso.mjs")])
      .then(([motor, niveles, progreso]) => ({ motor, niveles, progreso }));
  }
  return cargados;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Lo más que se acepta: toques de más (las ayudas) y tiros en una partida. */
const EXTRAS_MAX = 20;
const TIROS_MAX = 40;
/** El progreso guardado no puede pesar más que esto (en caracteres). */
const PROGRESO_MAX = 20000;

function errorPartida(codigo, mensaje) {
  const e = new Error(mensaje);
  e.codigo = codigo;
  return e;
}

const esTiro = (t) => Array.isArray(t) && t.length === 3 && t.every((v) => Number.isInteger(v) && Math.abs(v) <= 1000);

/**
 * Lee la partida que manda el celular y la comprueba: arma el nivel (o el
 * reto de `hoy`) y repite los tiros. Devuelve { modo, nivel | fecha, toques,
 * goles, estrellas, par } o lanza un error con `codigo`: 'invalid-argument'
 * (mal armada o con tiros que no valen) o 'failed-precondition' (no mete
 * gol, o es el reto de otro día).
 *  - data: { modo: 'nivel' | 'reto', nivel, fecha, tiros: [[chapa, dx, dy]…], extras }
 */
async function comprobarPartidaPichanga(data, hoy) {
  const d = data && typeof data === "object" ? data : {};
  const { motor, niveles } = await modulos();
  let lv;
  let base;
  if (d.modo === "reto") {
    if (typeof d.fecha !== "string" || !FECHA.test(d.fecha)) throw errorPartida("invalid-argument", "Falta la fecha del reto.");
    if (d.fecha !== hoy) throw errorPartida("failed-precondition", "Ese reto ya no es el de hoy.");
    lv = niveles.retoPichanga(d.fecha);
    base = { modo: "reto", fecha: d.fecha };
  } else if (d.modo === "nivel") {
    const n = d.nivel;
    if (!Number.isInteger(n) || n < 1 || n > niveles.TOTAL_NIVELES_PICHANGA) throw errorPartida("invalid-argument", "Nivel inválido.");
    lv = niveles.nivelPichanga(n);
    base = { modo: "nivel", nivel: n };
  } else {
    throw errorPartida("invalid-argument", "Falta el modo de la partida.");
  }
  const extras = d.extras == null ? 0 : d.extras;
  if (!Number.isInteger(extras) || extras < 0 || extras > EXTRAS_MAX) throw errorPartida("invalid-argument", "Toques de más inválidos.");
  if (!Array.isArray(d.tiros) || !d.tiros.length || d.tiros.length > TIROS_MAX || !d.tiros.every(esTiro)) {
    throw errorPartida("invalid-argument", "Los tiros no son válidos.");
  }
  const r = motor.comprobarPartida(lv, d.tiros, extras);
  if (!r.valida) throw errorPartida("invalid-argument", "La partida tiene tiros que no valen.");
  if (!r.ganada) throw errorPartida("failed-precondition", "La partida no mete el gol.");
  return { ...base, toques: r.toques, goles: r.goles, estrellas: motor.estrellasPara(r.toques, lv.par), par: lv.par };
}

/** La semana (el lunes) y el mes de una fecha, con el mismo cálculo del juego. */
async function semanaPichanga(fecha) {
  return (await modulos()).niveles.semanaDe(fecha);
}
async function mesPichanga(fecha) {
  return (await modulos()).niveles.mesDe(fecha);
}

/**
 * Une el progreso que manda el celular con el guardado en la cuenta (lo
 * ganado no se pierde; ver unirProgresos). Lanza 'invalid-argument' si no es
 * un objeto o pesa demasiado.
 */
async function unirProgresoPichanga(enviado, guardado) {
  if (!enviado || typeof enviado !== "object" || Array.isArray(enviado)) throw errorPartida("invalid-argument", "Progreso inválido.");
  if (JSON.stringify(enviado).length > PROGRESO_MAX) throw errorPartida("invalid-argument", "El progreso es demasiado grande.");
  const { progreso } = await modulos();
  return progreso.unirProgresos(enviado, guardado || {});
}

/** El progreso guardado, completo (o null si no hay). */
async function limpiarProgresoPichanga(guardado) {
  if (!guardado) return null;
  return (await modulos()).progreso.progresoPichanga(guardado);
}

/** Ranking del reto de hoy: menos toques; empate, quien lo hizo antes. */
function ordenarRetoDia(filas) {
  return [...filas].sort((a, b) => a.toques - b.toques || (a.hecho || 0) - (b.hecho || 0));
}

/** Ranking de la semana: más retos hechos; empate, menos toques en total. */
function ordenarRetoSemana(filas) {
  return [...filas].sort((a, b) => b.completados - a.completados || a.total - b.total || (a.hecho || 0) - (b.hecho || 0));
}

/** Suma un reto a la semana: el mejor de cada día, cuántos hizo y los toques en total. */
function sumarRetoASemana(semana, fecha, toques) {
  const dias = { ...((semana && semana.dias) || {}) };
  dias[fecha] = dias[fecha] ? Math.min(dias[fecha], toques) : toques;
  const valores = Object.values(dias);
  return { dias, completados: valores.length, total: valores.reduce((t, v) => t + v, 0) };
}

/**
 * Suma los goles de una partida ganada al mes de una persona. Cada nivel (y
 * el reto) cuenta una vez por día: repetir el mismo nivel el mismo día no
 * suma. Devuelve lo nuevo para guardar, o null si no cambia.
 *  - antes: lo guardado ({ goles, contados: { fecha, claves } }) o null
 *  - clave: 'n12' (nivel 12) o 'reto'
 */
function sumarGolesMes(antes, mes, hoy, clave, goles) {
  const a = antes && antes.mes === mes ? antes : { goles: 0, contados: null };
  const delDia = a.contados && a.contados.fecha === hoy ? a.contados.claves || [] : [];
  if (delDia.includes(clave) || !(goles > 0)) return null;
  return { mes, goles: (a.goles || 0) + goles, contados: { fecha: hoy, claves: [...delDia, clave] } };
}

/** Los goleadores del mes: más goles; empate, quien llegó antes. */
function ordenarGoleadores(filas) {
  return [...filas].filter((f) => (f.goles || 0) > 0).sort((a, b) => b.goles - a.goles || (a.hecho || 0) - (b.hecho || 0));
}

module.exports = {
  comprobarPartidaPichanga,
  semanaPichanga,
  mesPichanga,
  unirProgresoPichanga,
  limpiarProgresoPichanga,
  ordenarRetoDia,
  ordenarRetoSemana,
  sumarRetoASemana,
  sumarGolesMes,
  ordenarGoleadores,
  EXTRAS_MAX,
  TIROS_MAX,
};
