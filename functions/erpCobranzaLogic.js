"use strict";

// ════════════════════════════════════════════════════════════════════════════
// Cobranza del ERP, vista desde Walá
// ────────────────────────────────────────────────────────────────────────────
// Un pago online de Walá tiene que quedar en el ERP IGUAL que un pago que
// registra cobranza a mano. Si no, el ERP no lo ve: calcula la deuda con su
// propio historial de pagos y la recalcula al guardar, así que la deuda volvía a
// aparecer y el ingreso no llegaba a Finanzas.
//
// Este archivo copia (sin I/O) las reglas del repo del ERP
// (github.com/conamormarket-lgtm/sistema). Si allá cambian, hay que cambiarlas aquí:
//   lib/utils.ts              parseMontoRobust, montoCastigadoDePedido
//   lib/saldo-pedido.ts       calcularSaldoTotal
//   lib/delivery-restante.ts  deliveryPendiente, adjuntarDelivery, camposDeposito
//   lib/auto-habilitado.ts    permiteAutoHabilitado
//   lib/movimiento-cobro.ts   crearMovimientoAbono
//   lib/cobranza-payment.ts   planificarPago, normalizarOperacion
// Tests: functions/test/erpCobranzaLogic.test.js.
// ════════════════════════════════════════════════════════════════════════════

function parseMontoRobust(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isNaN(v) ? 0 : v;
  let str = String(v).trim();
  if (!str) return 0;
  str = str.replace(/[^0-9.,-]/g, "");
  if (!str) return 0;
  const hasDot = str.includes(".");
  const hasComma = str.includes(",");
  if (hasDot && hasComma) {
    str = str.lastIndexOf(".") > str.lastIndexOf(",")
      ? str.replace(/,/g, "")
      : str.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    str = /,\d{1,2}$/.test(str) ? str.replace(/,/g, ".") : str.replace(/,/g, "");
  } else if (hasDot) {
    if (!/\.\d{1,2}$/.test(str) && /\.\d{3}$/.test(str)) str = str.replace(/\./g, "");
  }
  const n = parseFloat(str);
  return Number.isNaN(n) ? 0 : n;
}

const cents = (v) => Math.round(parseMontoRobust(v) * 100);

function montoCastigadoDePedido(pedido) {
  const v = parseMontoRobust(pedido && pedido.cobranza && pedido.cobranza.montoIncobrable);
  return v > 0 ? v : 0;
}

function calcularSaldoTotal(pedido) {
  if (!pedido) return 0;
  const cob = pedido.cobranza || {};
  const dis = pedido["diseño"] || {};
  const montoBase = parseMontoRobust(pedido.montoTotal);
  const adelanto = parseMontoRobust(pedido.montoAdelanto);
  const historial = Array.isArray(cob.historialPagos) ? cob.historialPagos : [];
  const pagosGenerales = historial.length > 0
    ? historial.reduce((s, p) => s + parseMontoRobust(p && p.monto), 0)
    : parseMontoRobust(cob.pago1) + parseMontoRobust(cob.pago2);
  const totalA = parseMontoRobust(cob.montoTotalAnadidos ?? dis.montoTotalAnadidos);
  const histA = [...(cob["añadidos"] || cob.anadidos || []), ...(dis["añadidos"] || dis.anadidos || [])];
  const pagA = histA.reduce((s, h) => s + parseMontoRobust(h && h.monto), 0);
  const totalC = parseMontoRobust(cob.montoTotalComplementos ?? dis.montoTotalComplementos);
  const histC = [...(cob.complementos || []), ...(dis.complementos || [])];
  const pagC = histC.reduce((s, h) => s + parseMontoRobust(h && h.monto), 0);
  const castigado = montoCastigadoDePedido(pedido);
  const raw = (montoBase + totalA + totalC) - (adelanto + pagosGenerales + pagA + pagC + castigado);
  return raw <= 0.01 ? 0 : Number(raw.toFixed(2));
}

/** Delivery que se cobra junto con el restante (cobranza.delivery con integrarEnRestante). */
function deliveryPendiente(cobranza) {
  return ((cobranza && cobranza.delivery) || []).reduce((sum, d) =>
    sum + (d && d.integrarEnRestante === true && !d.paymentId ? cents(d.monto) : 0), 0) / 100;
}

function adjuntarDelivery(cobranza, index, paymentId) {
  const monto = deliveryPendiente(cobranza);
  if (!monto) return cobranza;
  return {
    ...cobranza,
    delivery: cobranza.delivery.map((d) => (d.integrarEnRestante === true && !d.paymentId ? { ...d, paymentId } : d)),
    historialPagos: cobranza.historialPagos.map((p, i) => (i === index
      ? { ...p, paymentId, deliveryMonto: (cents(p.deliveryMonto) + cents(monto)) / 100 } : p)),
  };
}

function camposDeposito(payment) {
  return {
    amount: (cents(payment.monto) + cents(payment.deliveryMonto)) / 100,
    pedidoMonto: parseMontoRobust(payment.monto),
    deliveryMonto: parseMontoRobust(payment.deliveryMonto),
  };
}

/** Lo que paga online quien salda un pedido: el saldo más el delivery que va con el restante. */
function saldoCobrableOnline(pedido) {
  const saldo = calcularSaldoTotal(pedido);
  if (saldo <= 0) return 0;
  return (cents(saldo) + cents(deliveryPendiente(pedido.cobranza))) / 100;
}

const normalizarOperacion = (value) => String(value || "").trim().toUpperCase().replace(/[\s.-]/g, "");

// Lima Metropolitana (incluye Callao). Sin `tipoEnvio` guardado, ante la duda se
// toma como Lima: así nunca se habilita solo un pedido que no debía.
function esDeliveryLima(pedido) {
  if (pedido && pedido.tipoEnvio) return pedido.tipoEnvio === "delivery";
  const dept = String((pedido && (pedido.envioDepartamento || pedido.clienteDepartamento)) || "").trim().toUpperCase();
  const prov = String((pedido && (pedido.envioProvincia || pedido.clienteProvincia)) || "").trim().toUpperCase();
  if (dept === "CALLAO") return true;
  if (dept === "LIMA") return prov !== "PROVINCIA";
  return false;
}

/**
 * ¿Puede el saldo en 0 dejar el pedido "Habilitado" solo? (lib/auto-habilitado.ts)
 * @param {boolean} limaSinAutoHabilitar flag cobranzaLimaSinAutoHabilitar (default true en el ERP)
 */
function permiteAutoHabilitado(pedido, limaSinAutoHabilitar = true) {
  if (String((pedido && pedido.cobranza && pedido.cobranza.estado) || "").trim() === "Habilitado") return true;
  if (!limaSinAutoHabilitar) return true;
  return !esDeliveryLima(pedido);
}

function toIsoDate(val) {
  let d = null;
  if (!val) d = null;
  else if (val instanceof Date) d = val;
  else if (typeof val.toDate === "function") d = val.toDate();
  else if (val.seconds != null || val._seconds != null) d = new Date((val.seconds ?? val._seconds) * 1000);
  else d = new Date(val);
  if (!d || Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const fechaLima = (now = new Date()) => new Date(now.getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10);
const horaLima = (now = new Date()) => new Date(now.getTime() - LIMA_OFFSET_MS).toISOString().slice(11, 19);

/** Movimiento de Finanzas (fp_transactions), igual que crearMovimientoAbono del ERP. */
function crearMovimientoAbono({
  pedidoId, numeroPedido, clienteContacto, clienteNombre, monto, fechaVentaPedido,
  sourceType, usuarioEmail, fechaPago, operationNumber, accountId, now = new Date(),
}) {
  if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido");
  const labelId = sourceType === "adelanto" ? "lbl_4"
    : sourceType === "restante" ? "lbl_5"
      : sourceType === "contraEntrega" ? "lbl_7"
        : "lbl_6";
  const tipoLabel = sourceType === "adelanto" ? "Adelanto"
    : sourceType === "restante" ? "Restante"
      : sourceType === "contraEntrega" ? "Contra Entrega"
        : "Abono";
  const descripcion = [tipoLabel, numeroPedido ? `Pedido #${numeroPedido}` : "", clienteNombre || clienteContacto || ""]
    .filter(Boolean).join(" — ");
  return {
    type: "income",
    sourceType,
    sourcePedidoId: String(pedidoId),
    registeredAt: toIsoDate(fechaVentaPedido),
    date: fechaPago || "",
    amount: monto,
    status: "pending", // no suma como ingreso hasta que Finanzas lo valide
    contactPhone: clienteContacto || "",
    contactId: null,
    accountId: accountId ?? null,
    operationNumber: operationNumber ?? null,
    labelIds: [labelId],
    topCategoryId: null,
    categoryId: "",
    subCategoryId: "",
    category: "",
    subcategory: "",
    tags: [],
    verified: false,
    verifiedBy: null,
    verifiedAt: null,
    description: descripcion,
    createdAt: now.toISOString(),
    createdAtLocal: fechaLima(now),
    createdBy: usuarioEmail || "sistema",
  };
}

const USUARIO_PORTAL = "portal-web@wala.pe";

/**
 * Un pago online que salda (o abona) un pedido del ERP, como planificarPago del ERP
 * (cobranza-payment.ts) para un pago sin comprobante: la pasarela es el respaldo.
 *
 * @param {object} pedido  doc de `pedidos`, leído en la transacción
 * @param {object} p       { pedidoId, coleccion, montoPagado (lo cobrado, soles), metodo, pagoId,
 *                           txId, accountId, autoHabilitar, now }
 * @returns {{ updates, movimiento, nuevoSaldo }}
 */
function planificarPagoOnline(pedido, p) {
  const now = p.now || new Date();
  const saldo = calcularSaldoTotal(pedido);
  const delivery = saldo > 0 ? deliveryPendiente(pedido.cobranza) : 0;
  // El cobro incluye el delivery que va con el restante. Si lo pagado no alcanza
  // para todo, va primero al pedido (el delivery queda pendiente, como en el ERP).
  const cubreTodo = cents(p.montoPagado) >= cents(saldo) + cents(delivery);
  const montoPedido = cubreTodo ? saldo : Math.min(saldo, parseMontoRobust(p.montoPagado));
  const historial = [...((pedido.cobranza && pedido.cobranza.historialPagos) || [])];
  if (!historial.length) {
    // No perder pagos legacy al introducir la primera entrada del historial moderno.
    for (const campo of ["pago1", "pago2"]) {
      const monto = parseMontoRobust(pedido.cobranza && pedido.cobranza[campo]) || 0;
      const fechaCampo = pedido.cobranza && pedido.cobranza[`fecha${campo[0].toUpperCase()}${campo.slice(1)}`];
      if (monto > 0) historial.push({ monto, usuarioEmail: `migrado-${campo}`, fecha: fechaCampo || null });
    }
  }
  const fechaPago = fechaLima(now);
  const hora = horaLima(now);
  const fecha = new Date(`${fechaPago}T${hora}-05:00`);
  const operationNumber = normalizarOperacion(p.pagoId) || null;
  historial.push({
    monto: montoPedido, fecha: fechaPago, hora, timestamp: fecha.toISOString(), usuarioEmail: USUARIO_PORTAL,
    paymentId: p.txId, operationNumber, accountId: p.accountId || null, comprobanteHashes: [],
    pasarela: { metodo: p.metodo, id: String(p.pagoId) },
  });
  let cobranza = { ...(pedido.cobranza || {}), historialPagos: historial, fechaUltimoPago: fecha };
  const nuevoSaldo = Math.max(0, calcularSaldoTotal({ ...pedido, cobranza }));
  const sourceType = nuevoSaldo === 0 ? "restante" : "abono";
  historial[historial.length - 1] = { ...historial[historial.length - 1], sourceType, esRestante: nuevoSaldo === 0 };
  if (nuevoSaldo === 0) cobranza = adjuntarDelivery(cobranza, historial.length - 1, p.txId);
  cobranza.estado = (pedido.cobranza && pedido.cobranza.estado === "Habilitado") || (nuevoSaldo === 0 && p.autoHabilitar)
    ? "Habilitado" : "Abonado";
  if (nuevoSaldo === 0 && !cobranza.fechaPagoCero) cobranza.fechaPagoCero = now;
  const total = parseMontoRobust(pedido.montoTotal) || 0;
  const pagado = (parseMontoRobust(pedido.montoAdelanto) || 0) +
    cobranza.historialPagos.reduce((s, h) => s + (parseMontoRobust(h.monto) || 0), 0);
  const metodoTexto = p.metodo === "paypal" ? "PayPal" : "Culqi";
  const updates = {
    cobranza,
    montoPendiente: nuevoSaldo,
    deudaTotal: nuevoSaldo,
    esMostacero: pedido.importado === true
      ? (pedido.esMostacero ?? false)
      : total > 0 && pagado < (pedido.tipoEnvio === "delivery" ? 0.27 : 0.30) * total,
    historialModificaciones: [...(pedido.historialModificaciones || []), {
      timestamp: now, usuarioId: "portal-web", usuarioEmail: USUARIO_PORTAL, accion: "Pago Registrado",
      paymentId: p.txId,
      detalle: `Pago online (${metodoTexto} ${p.pagoId}) de S/ ${montoPedido.toFixed(2)} registrado con fecha ${fechaPago}. Nuevo saldo: S/ ${nuevoSaldo.toFixed(2)}`,
    }],
    updatedAt: now,
  };
  const ultimo = cobranza.historialPagos[cobranza.historialPagos.length - 1];
  const movimiento = {
    ...crearMovimientoAbono({
      pedidoId: p.pedidoId, numeroPedido: pedido.numeroPedido || p.pedidoId,
      clienteContacto: pedido.clienteContacto || pedido.clienteTelefono || "",
      clienteNombre: pedido.clienteNombre || "",
      monto: montoPedido, fechaVentaPedido: pedido.createdAt || fecha, fechaPago, sourceType,
      usuarioEmail: USUARIO_PORTAL, accountId: p.accountId || undefined, operationNumber: operationNumber || undefined, now,
    }),
    id: p.txId,
    paymentId: p.txId,
    sourceCollection: p.coleccion,
    comprobanteHashes: [],
    pasarela: { metodo: p.metodo, id: String(p.pagoId) },
    ...camposDeposito(ultimo),
  };
  return { updates, movimiento, nuevoSaldo, montoPedido };
}

/** Cuenta de Finanzas de una pasarela: la ÚNICA cuyo nombre o alias es "culqi" / "paypal". */
function cuentaDePasarela(cuentas, metodo) {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const buscada = norm(metodo);
  const coinciden = (cuentas || []).filter((a) => a && a.id != null && !a.deletedAt &&
    (norm(a.name) === buscada || (Array.isArray(a.aliases) ? a.aliases : []).some((al) => norm(al) === buscada)));
  return coinciden.length === 1 ? String(coinciden[0].id) : null;
}

module.exports = {
  USUARIO_PORTAL,
  parseMontoRobust,
  calcularSaldoTotal,
  deliveryPendiente,
  adjuntarDelivery,
  camposDeposito,
  saldoCobrableOnline,
  normalizarOperacion,
  permiteAutoHabilitado,
  crearMovimientoAbono,
  planificarPagoOnline,
  cuentaDePasarela,
  fechaLima,
};
