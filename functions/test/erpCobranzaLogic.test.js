"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../erpCobranzaLogic");

const pedidoBase = (extra = {}) => ({
  numeroPedido: "12001",
  montoTotal: 129,
  montoAdelanto: 10,
  clienteNombre: "Ana",
  clienteContacto: "999888777",
  createdAt: new Date("2026-10-01T15:00:00Z"),
  tipoEnvio: "agencia",
  ...extra,
});

test("saldo: total + añadidos + complementos − adelanto − pagos − castigado (como el ERP)", () => {
  assert.equal(c.calcularSaldoTotal(pedidoBase()), 119);
  assert.equal(c.calcularSaldoTotal(pedidoBase({
    cobranza: {
      historialPagos: [{ monto: 50 }],
      montoTotalAnadidos: 20, ["añadidos"]: [{ monto: 5 }],
      montoIncobrable: 4,
    },
  })), 129 + 20 - 10 - 50 - 5 - 4);
  // Sin historial moderno cuentan pago1/pago2.
  assert.equal(c.calcularSaldoTotal(pedidoBase({ cobranza: { pago1: "30", pago2: "9,50" } })), 79.5);
  assert.equal(c.calcularSaldoTotal(pedidoBase({ montoAdelanto: 129 })), 0);
});

test("lo que se cobra online incluye el delivery que va con el restante", () => {
  const p = pedidoBase({ cobranza: { delivery: [{ monto: 10, integrarEnRestante: true }, { monto: 7, integrarEnRestante: true, paymentId: "x" }] } });
  assert.equal(c.saldoCobrableOnline(p), 129);
  assert.equal(c.saldoCobrableOnline(pedidoBase({ montoAdelanto: 129 })), 0);
});

test("pago online que salda: historial, movimiento 'restante' y saldo 0", () => {
  const now = new Date("2026-10-10T17:30:00Z"); // 12:30 en Lima
  const pedido = pedidoBase({ cobranza: { delivery: [{ monto: 10, integrarEnRestante: true }] } });
  const r = c.planificarPagoOnline(pedido, {
    pedidoId: "12001", coleccion: "pedidos", montoPagado: 129, metodo: "culqi", pagoId: "chr_live_ABC",
    txId: "cobro_x", accountId: "acc_culqi", autoHabilitar: true, now,
  });
  assert.equal(r.nuevoSaldo, 0);
  assert.equal(r.updates.montoPendiente, 0);
  assert.equal(r.updates.cobranza.estado, "Habilitado");
  const h = r.updates.cobranza.historialPagos.at(-1);
  assert.equal(h.monto, 119);
  assert.equal(h.deliveryMonto, 10);
  assert.equal(h.fecha, "2026-10-10");
  assert.equal(h.operationNumber, "CHR_LIVE_ABC");
  assert.equal(h.sourceType, "restante");
  assert.equal(r.updates.cobranza.delivery[0].paymentId, "cobro_x");
  // El movimiento es el depósito completo (pedido + delivery), pendiente de validar.
  assert.equal(r.movimiento.amount, 129);
  assert.equal(r.movimiento.pedidoMonto, 119);
  assert.equal(r.movimiento.status, "pending");
  assert.equal(r.movimiento.verified, false);
  assert.deepEqual(r.movimiento.labelIds, ["lbl_5"]);
  assert.equal(r.movimiento.accountId, "acc_culqi");
  assert.equal(r.movimiento.sourcePedidoId, "12001");
  assert.equal(r.movimiento.date, "2026-10-10");
  assert.equal(c.calcularSaldoTotal({ ...pedido, ...r.updates }), 0);
});

test("sin permiso de auto-habilitar queda 'Abonado'; un 'Habilitado' nunca se degrada", () => {
  const args = { pedidoId: "1", coleccion: "pedidos", montoPagado: 119, metodo: "culqi", pagoId: "chr_1", txId: "t" };
  assert.equal(c.planificarPagoOnline(pedidoBase(), { ...args, autoHabilitar: false }).updates.cobranza.estado, "Abonado");
  assert.equal(c.planificarPagoOnline(pedidoBase({ cobranza: { estado: "Habilitado" } }), { ...args, autoHabilitar: false })
    .updates.cobranza.estado, "Habilitado");
});

test("conserva pago1/pago2 al crear el primer historial moderno", () => {
  const r = c.planificarPagoOnline(pedidoBase({ cobranza: { pago1: 19 } }), {
    pedidoId: "1", coleccion: "pedidos", montoPagado: 100, metodo: "paypal", pagoId: "CAP1", txId: "t", autoHabilitar: true,
  });
  assert.deepEqual(r.updates.cobranza.historialPagos.map((h) => h.monto), [19, 100]);
  assert.equal(r.nuevoSaldo, 0);
});

test("auto-habilitar: Lima Metropolitana no se habilita sola con el flag del ERP", () => {
  assert.equal(c.permiteAutoHabilitado({ tipoEnvio: "delivery" }, true), false);
  assert.equal(c.permiteAutoHabilitado({ tipoEnvio: "agencia" }, true), true);
  assert.equal(c.permiteAutoHabilitado({ tipoEnvio: "delivery" }, false), true);
  assert.equal(c.permiteAutoHabilitado({ envioDepartamento: "Callao" }, true), false);
  assert.equal(c.permiteAutoHabilitado({ envioDepartamento: "Arequipa" }, true), true);
});

test("cuenta de la pasarela: solo si hay UNA con ese nombre o alias", () => {
  const cuentas = [{ id: "a", name: "BCP" }, { id: "b", name: "Culqi" }, { id: "c", name: "Otra", aliases: ["PayPal"] }];
  assert.equal(c.cuentaDePasarela(cuentas, "culqi"), "b");
  assert.equal(c.cuentaDePasarela(cuentas, "paypal"), "c");
  assert.equal(c.cuentaDePasarela([...cuentas, { id: "d", name: "CULQI" }], "culqi"), null);
  assert.equal(c.cuentaDePasarela([{ id: "b", name: "Culqi", deletedAt: "x" }], "culqi"), null);
});

test("parseMontoRobust como el ERP", () => {
  assert.equal(c.parseMontoRobust("1.234,56"), 1234.56);
  assert.equal(c.parseMontoRobust("1,234.56"), 1234.56);
  assert.equal(c.parseMontoRobust("S/ 9,50"), 9.5);
  assert.equal(c.parseMontoRobust(""), 0);
});
