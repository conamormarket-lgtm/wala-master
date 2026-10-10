"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../pagosLogic");
const { puedeUsarPuente } = require("../adminAuth");

test("el adelanto de una landing sale de su configuración, no del navegador", () => {
  const ajustes = { allowAdelanto: true, adelantoMonto: 10 };
  assert.deepEqual(p.cobroLanding({ total: 129, modalidad: "adelanto", ajustes }),
    { modalidad: "adelanto", cobroPen: 10, saldoPen: 119 });
  assert.deepEqual(p.cobroLanding({ total: 129, modalidad: "completo", ajustes }),
    { modalidad: "completo", cobroPen: 129, saldoPen: 0 });
  // Sin adelanto permitido se cobra todo aunque el navegador pida adelanto.
  assert.equal(p.cobroLanding({ total: 129, modalidad: "adelanto", ajustes: { allowAdelanto: false } }).cobroPen, 129);
  // Culqi cobra al menos S/3.
  assert.equal(p.cobroLanding({ total: 129, modalidad: "adelanto", ajustes: { adelantoMonto: 1 } }).cobroPen, 3);
  // Un adelanto mayor que el total es el total.
  assert.equal(p.cobroLanding({ total: 8, modalidad: "adelanto", ajustes: { adelantoMonto: 10 } }).saldoPen, 0);
});

test("lo que se cobra de una intención: primero lo que fijó el servidor", () => {
  assert.equal(p.cobroDeIntencion({ cobro: { cobroPen: 10 }, orderPayload: { montoPendiente: 119, montoTotal: 129 } }), 10);
  // Intenciones de antes de guardar `cobro`.
  assert.equal(p.cobroDeIntencion({ orderPayload: { montoPendiente: 95, montoTotal: 95 } }), 95);
  assert.equal(p.cobroDeIntencion({ orderPayload: {} }), null);
});

test("el monto de Culqi debe ser el del servidor (±1 céntimo)", () => {
  assert.equal(p.coincideMonto(12900, 12900), true);
  assert.equal(p.coincideMonto(12901, 12900), true);
  assert.equal(p.coincideMonto(300, 12900), false);
});

test("el navegador no puede mandar el pedido ya pagado", () => {
  const limpio = p.limpiarPayloadCliente({
    numeroPedido: "PD-1", montoTotal: 50, pagado: true, estadoPago: "pagado",
    culqiChargeId: "chr_x", pagoOnline: { verificadoPor: "servidor" }, buyerUid: "otro",
  });
  assert.deepEqual(limpio, { numeroPedido: "PD-1", montoTotal: 50 });
});

test("montos del pedido pagado: completo y adelanto", () => {
  assert.deepEqual(p.montosPedidoPagado({ total: 95, montoPagadoPen: 95 }), {
    montoAdelanto: 95, montoPendiente: 0, montoDeuda: 0, conDeuda: false, pagado: true, estadoPago: "pagado",
  });
  assert.deepEqual(p.montosPedidoPagado({ total: 129, montoPagadoPen: 10 }), {
    montoAdelanto: 10, montoPendiente: 119, montoDeuda: 119, conDeuda: true, pagado: false, estadoPago: "adelanto_pagado",
  });
});

test("un cobro en curso bloquea otro hasta que vence", () => {
  const ahora = 1_000_000_000;
  const hace = (ms) => ({ toMillis: () => ahora - ms });
  assert.equal(p.cobroEnCursoVigente({ status: "cobrando", cobroIniciadoAt: hace(1000) }, ahora), true);
  assert.equal(p.cobroEnCursoVigente({ status: "cobrando", cobroIniciadoAt: hace(p.COBRO_EN_CURSO_MS + 1) }, ahora), false);
  assert.equal(p.cobroEnCursoVigente({ status: "prepared" }, ahora), false);
  assert.equal(p.cobroEnCursoVigente(null, ahora), false);
});

test("id del cargo en un aviso de Culqi (data como objeto o como texto)", () => {
  assert.equal(p.chargeIdDeEvento({ type: "charge.creation.succeeded", data: { id: "chr_live_abc" } }), "chr_live_abc");
  assert.equal(p.chargeIdDeEvento({ data: JSON.stringify({ object: "charge", id: "chr_test_1" }) }), "chr_test_1");
  assert.equal(p.chargeIdDeEvento({ data: { id: "../../x" } }), null);
  assert.equal(p.chargeIdDeEvento({}), null);
});

test("cargo inexistente: Culqi responde 401 'Ruta inválida'", () => {
  const ruta = JSON.stringify({ object: "error", type: "authentication_error", merchant_message: "Ruta inválida, entérate de las rutas" });
  assert.equal(p.cargoNoExiste(401, ruta), true);
  assert.equal(p.cargoNoExiste(404, ""), true);
  // Una llave mala NO es "no existe": eso hay que arreglarlo, no ignorarlo.
  assert.equal(p.cargoNoExiste(401, JSON.stringify({ merchant_message: "La llave no es válida" })), false);
  assert.equal(p.cargoNoExiste(500, ruta), false);
});

test("venta aprobada según la API de Culqi", () => {
  assert.equal(p.ventaExitosa({ outcome: { type: "venta_exitosa" } }), true);
  assert.equal(p.ventaExitosa({ outcome: { code: "AUT0000" } }), true);
  assert.equal(p.ventaExitosa({ outcome: { type: "tarjeta_rechazada" } }), false);
  assert.equal(p.ventaExitosa({}), false);
});

test("enlaces: vencen por expiresAt o, los antiguos, a las 36 h", () => {
  const ahora = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(p.enlaceVencido({ expiresAt: { toMillis: () => ahora + 1000 } }, ahora), false);
  assert.equal(p.enlaceVencido({ expiresAt: { toMillis: () => ahora - 1000 } }, ahora), true);
  assert.equal(p.enlaceVencido({ createdAt: "2026-10-08T00:00:00Z" }, ahora), true);
  assert.equal(p.enlaceVencido({ createdAt: "2026-10-10T00:00:00Z" }, ahora), false);
});

test("sección de pago de una landing", () => {
  const page = { sections: [{ type: "hero", settings: {} }, { type: "landing_payment", settings: { productId: "p1" } }] };
  assert.deepEqual(p.ajustesPagoLanding(page), { productId: "p1" });
  assert.equal(p.ajustesPagoLanding({ sections: [] }), null);
});

test("adminUsers solo vale para correos verificados de ADMIN_BRIDGE_EMAILS", () => {
  const antes = process.env.ADMIN_BRIDGE_EMAILS;
  process.env.ADMIN_BRIDGE_EMAILS = "dueno@wala.pe, otra@wala.pe";
  try {
    assert.equal(puedeUsarPuente({ email: "Dueno@wala.pe", email_verified: true }), true);
    assert.equal(puedeUsarPuente({ email: "dueno@wala.pe", email_verified: false }), false);
    assert.equal(puedeUsarPuente({ email: "intruso@gmail.com", email_verified: true }), false);
    process.env.ADMIN_BRIDGE_EMAILS = "";
    assert.equal(puedeUsarPuente({ email: "dueno@wala.pe", email_verified: true }), false);
  } finally {
    if (antes === undefined) delete process.env.ADMIN_BRIDGE_EMAILS; else process.env.ADMIN_BRIDGE_EMAILS = antes;
  }
});
