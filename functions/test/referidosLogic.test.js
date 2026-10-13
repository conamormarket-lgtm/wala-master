/**
 * Tests UNITARIOS de functions/referidosLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/referidosLogic.test.js
 */
const assert = require("assert");
const r = require("../referidosLogic");

let count = 0;
function check(name, fn) {
  try {
    fn();
    count += 1;
  } catch (e) {
    console.error("FALLA:", name);
    throw e;
  }
}

const AHORA = Date.parse("2026-10-13T12:00:00Z");
const HORA = 60 * 60 * 1000;
const ts = (ms) => ({ toMillis: () => ms });

check("premio: 5% hasta S/200, 10% encima", () => {
  assert.strictEqual(r.calcularRecompensaReferido(100), 5);
  assert.strictEqual(r.calcularRecompensaReferido(200), 10);
  assert.strictEqual(r.calcularRecompensaReferido(250), 25);
  assert.strictEqual(r.calcularRecompensaReferido(0), 0);
  assert.strictEqual(r.calcularRecompensaReferido("x"), 0);
});

check("vigente: abierto hace 2 h, sin compra", () => {
  const ref = { referrerCode: "KS-AAA", status: "clicked", clickedAt: ts(AHORA - 2 * HORA) };
  assert.strictEqual(r.referidoVigenteParaCheckout(ref, { ahoraMs: AHORA, intentId: "PD-1" }), true);
});

check("no vigente: pasaron más de 36 h", () => {
  const ref = { referrerCode: "KS-AAA", status: "clicked", clickedAt: ts(AHORA - 37 * HORA) };
  assert.strictEqual(r.referidoVigenteParaCheckout(ref, { ahoraMs: AHORA, intentId: "PD-1" }), false);
});

check("no vigente: nunca se abrió", () => {
  const ref = { referrerCode: "KS-AAA", status: "sent" };
  assert.strictEqual(r.referidoVigenteParaCheckout(ref, { ahoraMs: AHORA }), false);
});

check("no vigente: ya lo usó otra compra", () => {
  const ref = { referrerCode: "KS-AAA", status: "purchased", orderId: "PD-1", clickedAt: ts(AHORA - HORA) };
  assert.strictEqual(r.referidoVigenteParaCheckout(ref, { ahoraMs: AHORA, intentId: "PD-2" }), false);
  assert.strictEqual(r.referidoVigenteParaCheckout(ref, { ahoraMs: AHORA, intentId: "PD-1" }), true);
});

check("no vigente: reclamado o sin código", () => {
  const base = { referrerCode: "KS-AAA", clickedAt: ts(AHORA - HORA) };
  assert.strictEqual(r.referidoVigenteParaCheckout({ ...base, status: "claimed" }, { ahoraMs: AHORA }), false);
  assert.strictEqual(r.referidoVigenteParaCheckout({ ...base, referrerCode: "", status: "clicked" }, { ahoraMs: AHORA }), false);
  assert.strictEqual(r.referidoVigenteParaCheckout(null, { ahoraMs: AHORA }), false);
});

check("pedidoEsDelReferido: solo si el pedido trae ese referralId", () => {
  assert.strictEqual(r.pedidoEsDelReferido({ referido: { referralId: "abc" } }, "abc"), true);
  assert.strictEqual(r.pedidoEsDelReferido({ referido: { referralId: "abc" } }, "otro"), false);
  assert.strictEqual(r.pedidoEsDelReferido({}, "abc"), false);
  assert.strictEqual(r.pedidoEsDelReferido(null, "abc"), false);
});

check("estado: pedido web sin aprobar", () => {
  const e = r.estadoPedidoReferido({ estadoGeneral: "Nuevo" }, "pedidos_web");
  assert.strictEqual(e.etapa, "por_confirmar");
  assert.strictEqual(e.finalizado, false);
});

check("estado: etapas del ERP", () => {
  assert.strictEqual(r.estadoPedidoReferido({ estadoGeneral: "En Diseño" }, "pedidos").etapa, "produccion");
  assert.strictEqual(r.estadoPedidoReferido({ estadoGeneral: "En Reparto" }, "pedidos").etapa, "enviado");
  const fin = r.estadoPedidoReferido({ estadoGeneral: "Finalizado" }, "pedidos");
  assert.strictEqual(fin.etapa, "entregado");
  assert.strictEqual(fin.finalizado, true);
  assert.strictEqual(r.estadoPedidoReferido({ estadoGeneral: "En Pausa por Stock" }, "pedidos").etapa, "confirmado");
});

check("estado: anulado o borrado nunca está finalizado", () => {
  assert.strictEqual(r.estadoPedidoReferido({ estadoGeneral: "Anulado" }, "pedidos").etapa, "anulado");
  const borrado = r.estadoPedidoReferido({ estadoGeneral: "Finalizado", deletedAt: "x" }, "pedidos");
  assert.strictEqual(borrado.etapa, "anulado");
  assert.strictEqual(borrado.finalizado, false);
});

check("resumen: sin datos del comprador ni diseños personalizados", () => {
  const pedido = {
    clienteNombre: "Ana", clienteContacto: "999", envioDireccion: "Calle 1", dni: "12345678",
    portalPseudoOrderId: "PD-77", montoTotal: 150, estadoGeneral: "En Estampado",
    createdAt: new Date("2026-10-10T10:00:00Z"),
    productos: [
      { producto: "Polo", cantidad: 2, talla: "M", color: "Negro", productoId: "p1", imagenReferencial: "cat.jpg" },
      { producto: "Taza", cantidad: 1, personalizado: true, imagenReferencial: "diseno-con-foto.jpg" },
    ],
  };
  const res = r.resumenPedidoReferido(pedido, "pedidos");
  const texto = JSON.stringify(res);
  ["Ana", "999", "Calle 1", "12345678", "diseno-con-foto"].forEach((dato) => {
    assert.ok(!texto.includes(dato), `no debe incluir ${dato}`);
  });
  assert.strictEqual(res.numeroPedido, "PD-77");
  assert.strictEqual(res.etapa, "produccion");
  assert.strictEqual(res.productos.length, 2);
  assert.strictEqual(res.productos[0].imagen, "cat.jpg");
  assert.strictEqual(res.productos[0].cantidad, 2);
  assert.strictEqual(res.fecha, "2026-10-10T10:00:00.000Z");
});

check("resumen: productos como mapa (pedido web)", () => {
  const res = r.resumenPedidoReferido({ productos: { item_0: { producto: "Gorra" } } }, "pedidos_web");
  assert.deepStrictEqual(res.productos.map((p) => p.nombre), ["Gorra"]);
  assert.strictEqual(res.etapa, "por_confirmar");
});

check("primerNombre: solo el primero, con mayúscula inicial", () => {
  assert.strictEqual(r.primerNombre({ displayName: "JOSÉ ALEJANDRO MINAYA" }), "José");
  assert.strictEqual(r.primerNombre({ displayName: "flor huaman huaman" }), "Flor");
  assert.strictEqual(r.primerNombre({ displayName: "  Ñato  Pérez" }), "Ñato");
  assert.strictEqual(r.primerNombre({ clienteNombre: "María" }), "María");
});

check("primerNombre: nunca correo ni vacío", () => {
  assert.strictEqual(r.primerNombre({ displayName: "ana@gmail.com" }), null);
  assert.strictEqual(r.primerNombre({ displayName: "ana@gmail.com", name: "Ana" }), "Ana");
  assert.strictEqual(r.primerNombre({ displayName: "" }), null);
  assert.strictEqual(r.primerNombre({ displayName: "1 2 3" }), null);
  assert.strictEqual(r.primerNombre(null), null);
});

const DIA = 24 * HORA;

check("invitación aceptada: vale 30 días y solo para la cuenta invitada", () => {
  const inv = { referrerCode: "KS-AAA", tipo: "invitacion", status: "registered", invitadoUid: "u-ana", aceptadaAt: ts(AHORA - 10 * DIA), clickedAt: ts(AHORA - 11 * DIA) };
  assert.strictEqual(r.referidoVigenteParaCheckout(inv, { ahoraMs: AHORA, uid: "u-ana", intentId: "PD-1" }), true);
  assert.strictEqual(r.referidoVigenteParaCheckout(inv, { ahoraMs: AHORA, uid: "u-otro", intentId: "PD-1" }), false);
  assert.strictEqual(r.referidoVigenteParaCheckout(inv, { ahoraMs: AHORA, intentId: "PD-1" }), false);
  const vieja = { ...inv, aceptadaAt: ts(AHORA - 31 * DIA) };
  assert.strictEqual(r.referidoVigenteParaCheckout(vieja, { ahoraMs: AHORA, uid: "u-ana" }), false);
  const usada = { ...inv, status: "purchased", orderId: "PD-0" };
  assert.strictEqual(r.referidoVigenteParaCheckout(usada, { ahoraMs: AHORA, uid: "u-ana", intentId: "PD-1" }), false);
});

check("invitación sin aceptar: funciona como link de 36 h", () => {
  const inv = { referrerCode: "KS-AAA", tipo: "invitacion", status: "clicked", clickedAt: ts(AHORA - 2 * HORA) };
  assert.strictEqual(r.referidoVigenteParaCheckout(inv, { ahoraMs: AHORA, uid: "u-luis" }), true);
  assert.strictEqual(r.premioReferido(inv, 100), 5);
});

check("premio: invitación aceptada paga 15 o el %, lo que sea mayor", () => {
  const inv = { tipo: "invitacion", invitadoUid: "u-ana" };
  assert.strictEqual(r.premioReferido(inv, 80), 15);
  assert.strictEqual(r.premioReferido(inv, 500), 50);
  assert.strictEqual(r.premioReferido(inv, 0), 0);
  assert.strictEqual(r.premioReferido({ tipo: "producto" }, 80), 4);
});

check("cuenta nueva: creada después de abrir el link y dentro de 7 días", () => {
  const clic = AHORA - 3 * DIA;
  assert.strictEqual(r.cuentaCreadaPorInvitacion({ clicMs: clic, creadaMs: clic + HORA }), true);
  assert.strictEqual(r.cuentaCreadaPorInvitacion({ clicMs: clic, creadaMs: clic - 5 * 60 * 1000 }), true);
  assert.strictEqual(r.cuentaCreadaPorInvitacion({ clicMs: clic, creadaMs: clic - DIA }), false);
  assert.strictEqual(r.cuentaCreadaPorInvitacion({ clicMs: clic, creadaMs: clic + 8 * DIA }), false);
  assert.strictEqual(r.cuentaCreadaPorInvitacion({ clicMs: 0, creadaMs: clic }), false);
});

check("teléfonos: mismas formas que guardan el ERP y la tienda", () => {
  assert.deepStrictEqual(r.variantesTelefono("+51 999 888 777"), ["999888777", "51999888777", "+51999888777", "+51 999888777"]);
  assert.deepStrictEqual(r.variantesTelefono("999888777"), ["999888777", "51999888777", "+51999888777", "+51 999888777"]);
  assert.deepStrictEqual(r.variantesTelefono(""), []);
  assert.strictEqual(r.normDocumento(" 12.345.678 "), "12345678");
});

console.log(`referidosLogic: ${count} pruebas OK`);
