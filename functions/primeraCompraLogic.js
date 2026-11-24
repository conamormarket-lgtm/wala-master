"use strict";

/**
 * Lógica PURA de la promo "Tu primera compra puede salir gratis" (saldo de
 * bienvenida). Sin firebase-admin: se testea con Node puro
 * (functions/test/primeraCompraLogic.test.js). Espejo en el navegador:
 * src/utils/primeraCompra.js (las mismas cuentas para mostrar el total).
 *
 * La promo, en corto (plan del 2026-11-11):
 *  - Toda cuenta nueva desde el lanzamiento tiene `horas` (168) desde que se
 *    registra: su "fase de bienvenida".
 *  - Por cada amigo nuevo (B) que entra con su invitación y paga al menos
 *    `minimoNeto` en productos con dinero, dejando `margenMinimo` de margen,
 *    gana `premio` (S/ 10) de saldo.
 *  - El saldo es dinero solo para PRODUCTOS (el envío va aparte, como siempre),
 *    hasta el % de cada marca. Si dejaría el pedido en S/ 0, deja S/ 1.
 *  - Mientras dura la fase, monedas y cupones se ganan pero no se usan.
 *  - Termina con la primera compra o a las `horas`: lo que no se usó vence y
 *    nunca vuelve.
 */

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

const CONFIG_POR_DEFECTO = Object.freeze({
  activa: false,
  desdeMs: 0,               // las cuentas creadas antes no participan
  horas: 168,
  premio: 10,
  minimoNeto: 50,           // lo que B paga en productos con dinero
  margenMinimo: 15,         // margen de la canasta de B, después de costos
  comisionPct: 4,           // comisión de la pasarela sobre lo cobrado
  provisionMonedas: 5,      // reserva por las monedas que se regalan
  margenPorDefecto: 66.67,  // % de margen de una marca sin configurar
  saldoPctPorDefecto: 100,  // % del precio que se puede pagar con saldo
  diasProteccionMonedas: 7, // días sin reinicio de monedas tras la fase
  totalMinimo: 1,           // un pedido no queda en S/ 0: deja S/ 1
  marcas: {},               // { brandId: { margenPct, saldoPct } }
  costos: {},               // { productId: costo unitario } (Lumi, del Excel)
});

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v, porDefecto) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : porDefecto;
};
const pct = (v, porDefecto) => Math.max(0, Math.min(100, num(v, porDefecto)));

function aMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const p = Date.parse(v);
  return Number.isFinite(p) ? p : 0;
}

/** La config guardada (loyaltyConfig/primeraCompra) con sus valores por defecto. */
function normalizarConfig(raw = {}) {
  const c = raw || {};
  const d = CONFIG_POR_DEFECTO;
  const marcas = {};
  for (const [id, m] of Object.entries(c.marcas || {})) {
    if (!id || !m || typeof m !== "object") continue;
    marcas[id] = {
      ...(m.margenPct !== undefined && m.margenPct !== null && m.margenPct !== "" ? { margenPct: pct(m.margenPct, d.margenPorDefecto) } : {}),
      ...(m.saldoPct !== undefined && m.saldoPct !== null && m.saldoPct !== "" ? { saldoPct: pct(m.saldoPct, d.saldoPctPorDefecto) } : {}),
    };
  }
  const costos = {};
  for (const [id, v] of Object.entries(c.costos || {})) {
    const n = Number(v);
    if (id && Number.isFinite(n) && n >= 0) costos[id] = n;
  }
  return {
    activa: c.activa === true,
    desdeMs: aMs(c.desde) || num(c.desdeMs, 0),
    horas: Math.max(1, num(c.horas, d.horas)),
    premio: Math.max(0, num(c.premio, d.premio)),
    minimoNeto: Math.max(0, num(c.minimoNeto, d.minimoNeto)),
    margenMinimo: Math.max(0, num(c.margenMinimo, d.margenMinimo)),
    comisionPct: pct(c.comisionPct, d.comisionPct),
    provisionMonedas: Math.max(0, num(c.provisionMonedas, d.provisionMonedas)),
    margenPorDefecto: pct(c.margenPorDefecto, d.margenPorDefecto),
    saldoPctPorDefecto: pct(c.saldoPctPorDefecto, d.saldoPctPorDefecto),
    diasProteccionMonedas: Math.max(0, num(c.diasProteccionMonedas, d.diasProteccionMonedas)),
    totalMinimo: Math.max(0, num(c.totalMinimo, d.totalMinimo)),
    marcas,
    costos,
  };
}

// ── La fase de bienvenida ───────────────────────────────────────────────────

/**
 * ¿Esta cuenta empieza la fase? Solo las creadas desde el lanzamiento, con
 * cuenta de verdad (no anónima), que no vinieron de un pedido del ERP y que
 * nunca compraron.
 */
function puedeIniciarFase({ config, creadaMs, anonima = false, origen = "", tieneCompras = false }) {
  const c = config || CONFIG_POR_DEFECTO;
  if (!c.activa) return { puede: false, motivo: "promo_apagada" };
  if (anonima) return { puede: false, motivo: "anonima" };
  // Firebase guarda la creación de la cuenta sin milisegundos: un segundo de margen.
  if (!creadaMs || (c.desdeMs && creadaMs + 1000 <= c.desdeMs)) return { puede: false, motivo: "cuenta_anterior" };
  if (origen === "erp_auto") return { puede: false, motivo: "cliente_previo" };
  if (tieneCompras) return { puede: false, motivo: "cliente_previo" };
  return { puede: true, motivo: null };
}

/** El vencimiento de una fase que empieza ahora. */
function venceDesde(inicioMs, config) {
  return inicioMs + (config || CONFIG_POR_DEFECTO).horas * HORA_MS;
}

/**
 * ¿La fase sigue abierta? `reservaIntentId`: un pedido que se preparó antes del
 * vencimiento con el saldo reservado se respeta aunque se pague un poco después.
 */
function faseActiva(estado, ahoraMs, { intentId = "" } = {}) {
  if (!estado || estado.estado !== "activa") return false;
  if (ahoraMs < aMs(estado.venceAt)) return true;
  const reserva = estado.reserva;
  return Boolean(intentId && reserva && String(reserva.intentId) === String(intentId));
}

/** Cuándo terminó la fase (ms), o 0 si sigue abierta o nunca hubo. */
function finDeFase(estado, ahoraMs) {
  if (!estado) return 0;
  if (estado.estado === "usada") return aMs(estado.cerradaAt) || aMs(estado.venceAt);
  if (estado.estado === "activa" && ahoraMs >= aMs(estado.venceAt)) return aMs(estado.venceAt);
  return 0;
}

/**
 * El reinicio de monedas de fin de mes no toca a quien está en su fase ni a
 * quien salió de ella hace menos de `diasProteccionMonedas`: sus monedas
 * estuvieron en pausa y tienen que poder usarse.
 */
function protegidoDelReinicio(estado, ahoraMs, config) {
  if (!estado || estado.estado === "no_aplica") return false;
  if (faseActiva(estado, ahoraMs)) return true;
  const fin = finDeFase(estado, ahoraMs);
  const dias = (config || CONFIG_POR_DEFECTO).diasProteccionMonedas;
  return Boolean(fin) && ahoraMs - fin < dias * DIA_MS;
}

// ── El saldo ────────────────────────────────────────────────────────────────

/** Saldo disponible y pendiente a partir de los premios. */
function saldoDesdePremios(premios = []) {
  let disponible = 0;
  let pendiente = 0;
  for (const p of premios) {
    const monto = Math.max(0, Number(p && p.monto) || 0);
    if (p && p.estado === "disponible") disponible += monto;
    else if (p && p.estado === "pendiente") pendiente += monto;
  }
  return { disponible: redondear(disponible), pendiente: redondear(pendiente) };
}

function ajustesDeMarca(config, brandId) {
  const c = config || CONFIG_POR_DEFECTO;
  const m = (brandId && c.marcas && c.marcas[brandId]) || {};
  return {
    margenPct: m.margenPct !== undefined ? m.margenPct : c.margenPorDefecto,
    saldoPct: m.saldoPct !== undefined ? m.saldoPct : c.saldoPctPorDefecto,
  };
}

/**
 * Hasta cuánto se puede pagar con saldo en estas líneas: el % de cada marca
 * sobre su importe. `lineas`: [{ importe, brandId }].
 */
function topeSaldo(lineas, config) {
  const suma = (lineas || []).reduce((tot, l) => {
    const importe = Math.max(0, Number(l && l.importe) || 0);
    return tot + importe * ajustesDeMarca(config, l && l.brandId).saldoPct / 100;
  }, 0);
  return Math.floor(suma * 100 + 1e-6) / 100;
}

/**
 * El saldo que de verdad se aplica: lo que hay, hasta el tope de las marcas, y
 * sin dejar el pedido por debajo de `totalMinimo` (S/ 1) contando el envío.
 */
function saldoAplicable({ disponible, tope, subtotal, envio = 0, config }) {
  const minimo = (config || CONFIG_POR_DEFECTO).totalMinimo;
  const sub = Math.max(0, Number(subtotal) || 0);
  const hueco = Math.max(0, sub + Math.max(0, Number(envio) || 0) - minimo);
  const maximo = Math.min(Math.max(0, Number(disponible) || 0), Math.max(0, Number(tope) || 0), sub, hueco);
  return Math.floor(maximo * 100 + 1e-6) / 100;
}

/** Total del pedido con saldo: productos menos saldo, más el envío. */
function totalConSaldo({ subtotal, saldo = 0, envio = 0 }) {
  const sub = Math.max(0, Number(subtotal) || 0);
  return redondear(Math.max(0, sub - Math.max(0, Number(saldo) || 0)) + Math.max(0, Number(envio) || 0));
}

// ── El premio por un amigo ──────────────────────────────────────────────────

/** Margen (fracción) de una línea: costo real si lo hay; si no, el de su marca. */
function margenDeLinea(linea, config) {
  const c = config || CONFIG_POR_DEFECTO;
  const importe = Math.max(0, Number(linea && linea.importe) || 0);
  const costo = linea && linea.productId ? c.costos[linea.productId] : undefined;
  if (costo !== undefined && importe > 0) {
    const cantidad = Math.max(1, Number(linea.cantidad) || 1);
    return Math.max(-1, (importe - costo * cantidad) / importe);
  }
  return ajustesDeMarca(c, linea && linea.brandId).margenPct / 100;
}

const MOTIVOS = Object.freeze({
  no_invitacion: "No llegó con tu invitación como cuenta nueva.",
  minimo: "Su compra en productos no llegó al mínimo.",
  margen: "Los productos que eligió no alcanzan para el premio.",
  con_saldo: "Pagó con su propio saldo de bienvenida.",
  revertido: "Canceló o devolvió su pedido.",
  vencido: "Su pago se confirmó después de tu plazo.",
  ya_premiado: "Esa persona ya generó un premio antes.",
});

/**
 * ¿La compra de B le da el premio a quien lo invitó?
 * `lineas`: [{ productId, brandId, importe, cantidad }] (precio × cantidad).
 * `descuentos`: lo que B no pagó con dinero (monedas, cupón, su saldo).
 * `cobrado`: lo que se cobra (para la comisión de la pasarela).
 * Devuelve { elegible, motivo, neto, contribucion, falta } — `falta`: cuánto
 * más en productos (aprox.) haría falta, o null.
 */
function evaluarPremio({ lineas = [], descuentos = 0, cobrado = 0, config, esInvitacion = true, usoSaldo = false }) {
  const c = config || CONFIG_POR_DEFECTO;
  const subtotal = lineas.reduce((t, l) => t + Math.max(0, Number(l && l.importe) || 0), 0);
  const desc = Math.max(0, Number(descuentos) || 0);
  const neto = redondear(Math.max(0, subtotal - desc));
  const bruto = lineas.reduce((t, l) => t + Math.max(0, Number(l && l.importe) || 0) * margenDeLinea(l, c), 0);
  const comision = Math.max(0, Number(cobrado) || 0) * c.comisionPct / 100;
  const contribucion = redondear(bruto - desc - comision - c.provisionMonedas);
  const base = { neto, contribucion };
  if (!esInvitacion) return { ...base, elegible: false, motivo: "no_invitacion", falta: null };
  if (usoSaldo) return { ...base, elegible: false, motivo: "con_saldo", falta: null };
  if (neto < c.minimoNeto) {
    return { ...base, elegible: false, motivo: "minimo", falta: redondear(c.minimoNeto - neto) };
  }
  if (contribucion < c.margenMinimo) {
    // Cuánto más en productos parecidos a los del carrito: cada sol suma su
    // margen medio menos la comisión.
    const margenMedio = subtotal > 0 ? bruto / subtotal : c.margenPorDefecto / 100;
    const porSol = margenMedio - c.comisionPct / 100;
    const falta = porSol > 0 ? Math.ceil((c.margenMinimo - contribucion) / porSol) : null;
    return { ...base, elegible: false, motivo: "margen", falta };
  }
  return { ...base, elegible: true, motivo: null, falta: null };
}

/** El texto que ve quien invitó. */
function textoMotivo(motivo) {
  return MOTIVOS[motivo] || "";
}

module.exports = {
  CONFIG_POR_DEFECTO, HORA_MS, DIA_MS, MOTIVOS,
  normalizarConfig, puedeIniciarFase, venceDesde, faseActiva, finDeFase, protegidoDelReinicio,
  saldoDesdePremios, ajustesDeMarca, topeSaldo, saldoAplicable, totalConSaldo,
  margenDeLinea, evaluarPremio, textoMotivo, aMs, redondear,
};
