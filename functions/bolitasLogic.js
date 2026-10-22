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

// ── Fase 3: marcas, cupones y métricas ────────────────────────────────────────

const TIPOS_CUPON_BOLITAS = ["descuento", "envio_gratis"];
// Topes de un cupón de las bolitas, aunque el admin ponga más: mientras las
// reglas de producción sigan abiertas (ver JUEGOS.md, fase 3), la
// configuración se puede tocar desde fuera; esto acota lo que se pierde.
const LIMITES_CUPON = { pct: 50, monto: 100, cupo: 1000 };
const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * La plantilla de un cupón que pone el admin (patrocinio o premio semanal),
 * normalizada: { tipo, descuentoPct, descuentoMonto, topeDescuento,
 * vigenciaDias } o null si no sirve. Solo descuento (porcentaje o monto) y
 * envío gratis: los cupones de la marca se aplican sobre sus productos.
 */
function normalizarPlantillaCupon(p) {
  if (!p || !TIPOS_CUPON_BOLITAS.includes(p.tipo)) return null;
  const vigenciaDias = Math.min(90, Math.max(1, Math.floor(numero(p.vigenciaDias)) || 15));
  if (p.tipo === "envio_gratis") return { tipo: "envio_gratis", descuentoPct: 0, descuentoMonto: 0, topeDescuento: 0, vigenciaDias };
  const descuentoPct = Math.min(LIMITES_CUPON.pct, Math.max(0, numero(p.descuentoPct)));
  const descuentoMonto = descuentoPct > 0 ? 0 : Math.min(LIMITES_CUPON.monto, Math.max(0, numero(p.descuentoMonto)));
  if (!descuentoPct && !descuentoMonto) return null;
  const topeDescuento = descuentoPct > 0 ? Math.max(0, numero(p.topeDescuento)) : 0;
  return { tipo: "descuento", descuentoPct, descuentoMonto, topeDescuento, vigenciaDias };
}

/**
 * Un patrocinio del reto (lo pone el admin para un día), normalizado:
 * { marcaId, marcaNombre, cupon (plantilla), cupo, activo } o null si no sirve.
 */
function normalizarPatrocinio(p) {
  if (!p || typeof p.marcaId !== "string" || !p.marcaId) return null;
  const cupon = normalizarPlantillaCupon(p.cupon);
  const cupo = Math.min(LIMITES_CUPON.cupo, Math.max(0, Math.floor(numero(p.cupo))));
  if (!cupon || !cupo) return null;
  return { marcaId: p.marcaId.slice(0, 80), marcaNombre: String(p.marcaNombre || "").slice(0, 60), cupon, cupo, activo: p.activo !== false };
}

/** El texto del cupón ("15 % de descuento en productos de Rosaditas"…). */
function textoCupon(plantilla, marca) {
  const deMarca = marca ? " en productos de " + marca : "";
  if (plantilla.tipo === "envio_gratis") return "Envío gratis" + (marca ? " en un pedido con productos de " + marca : "");
  const tope = plantilla.topeDescuento > 0 ? " (hasta S/ " + plantilla.topeDescuento + ")" : "";
  return plantilla.descuentoPct > 0
    ? plantilla.descuentoPct + " % de descuento" + deMarca + tope
    : "S/ " + plantilla.descuentoMonto + " de descuento" + deMarca;
}

/**
 * El premio del ranking semanal que le toca a un puesto (o null).
 *  - premios: [{ desde, hasta, cupon }] (lo pone el admin)
 */
function premioDePuesto(puesto, premios) {
  const lista = Array.isArray(premios) ? premios : [];
  const p = lista.find((x) => puesto >= numero(x.desde) && puesto <= numero(x.hasta || x.desde));
  return p ? normalizarPlantillaCupon(p.cupon) : null;
}

/** El lunes anterior a `semana` ('AAAA-MM-DD'): la semana que se premia. */
function semanaAnterior(semana) {
  const [y, m, d] = semana.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 7 * 86400000).toISOString().slice(0, 10);
}

/**
 * Lo que se guarda de cada jugador para las métricas, al ganar: el primer día,
 * el último, cuántos días distintos jugó y el nivel más alto.
 */
function sumarJugador(antes, hoy, nivel) {
  const a = antes || {};
  return {
    primerDia: a.primerDia || hoy,
    ultimoDia: hoy,
    dias: (a.dias || 0) + (a.ultimoDia === hoy ? 0 : 1),
    nivelMax: Math.max(a.nivelMax || 0, nivel || 0),
  };
}

/** Días entre dos fechas 'AAAA-MM-DD'. */
function diasEntre(desde, hasta) {
  const f = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((f(hasta) - f(desde)) / 86400000);
}

/**
 * Las métricas de los jugadores (con sesión) para el admin:
 *  - vuelven: de los que empezaron hace al menos 1 (o 7) días, cuántos
 *    jugaron otro día (o seguían jugando 7 días después)
 *  - trabados: de los que no juegan hace 3 días o más, en qué nivel quedaron
 */
function metricasJugadores(jugadores, hoy) {
  const conDia = (n) => jugadores.filter((j) => j.primerDia && diasEntre(j.primerDia, hoy) >= n);
  const base1 = conDia(1);
  const base7 = conDia(7);
  const trabados = {};
  for (const j of jugadores) {
    if (j.ultimoDia && diasEntre(j.ultimoDia, hoy) >= 3) trabados[j.nivelMax || 0] = (trabados[j.nivelMax || 0] || 0) + 1;
  }
  return {
    jugadores: jugadores.length,
    vuelven: { base: base1.length, cantidad: base1.filter((j) => j.dias >= 2).length },
    siguen7: { base: base7.length, cantidad: base7.filter((j) => diasEntre(j.primerDia, j.ultimoDia) >= 7).length },
    trabados,
  };
}

module.exports = {
  comprobarPartidaBolitas,
  semanaBolitas,
  nombrePublico,
  ordenarRankingDia,
  ordenarRankingSemana,
  sumarRetoASemana,
  LIMITES_CUPON,
  normalizarPlantillaCupon,
  normalizarPatrocinio,
  textoCupon,
  premioDePuesto,
  semanaAnterior,
  sumarJugador,
  metricasJugadores,
};
