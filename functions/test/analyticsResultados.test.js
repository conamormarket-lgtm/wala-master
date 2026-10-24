"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  productIdFromPath, resumirVentas, resumirOtrosCobros, resumirCarritos,
  resumirInteres, resumirDeseos, resumirCrear, buildResultadosDelDia,
} = require("../analyticsResultados");

const compra = (orderId, items, extra = {}) => ({
  type: "purchase_complete", clientType: "WEB", sessionId: `s-${orderId}`, eventData: { orderId, items }, ...extra,
});

test("ventas: pedidos distintos, ingresos en céntimos y ranking por producto", () => {
  const { ventas, topVendidos } = resumirVentas([
    compra("o1", [{ productId: "polo", qty: 2, price: 39.9, lineaProducto: "polos" }, { productId: "taza", qty: 1, price: 25 }]),
    compra("o1", [{ productId: "polo", qty: 2, price: 39.9 }]), // mismo pedido repetido: no suma nada
    compra("o2", [{ productId: "taza", qty: 3, price: 25 }], { clientType: "APP" }),
    { type: "payment_complete", eventData: { source: "saldo", amountCents: 5000 } }, // no es venta
  ]);
  assert.deepEqual(ventas.pedidos, { total: 2, app: 1, web: 1 });
  assert.equal(ventas.ingresosCents.total, 7980 + 2500 + 7500);
  assert.equal(ventas.unidades.total, 6);
  assert.deepEqual(topVendidos.map((p) => p.productId), ["taza", "polo"]);
  assert.deepEqual(topVendidos[0], { productId: "taza", unidades: 4, ingresosCents: 10000, pedidos: 2, linea: null });
  assert.equal(topVendidos[1].pedidos, 1);
  assert.equal(topVendidos[1].linea, "polos");
});

test("otros cobros: por fuente y moneda, aparte de las ventas", () => {
  const out = resumirOtrosCobros([
    { type: "payment_complete", eventData: { source: "sorteo", amountCents: 1000, currency: "PEN" } },
    { type: "payment_complete", eventData: { source: "sorteo", amountCents: 500, currency: "pen" } },
    { type: "payment_complete", eventData: { source: "pago_rapido", amountCents: 2000, currency: "USD" } },
    { type: "purchase_complete", eventData: { orderId: "x" } },
  ]);
  assert.deepEqual(out, {
    sorteo: { cantidad: 2, porMoneda: { PEN: 1500 } },
    pago_rapido: { cantidad: 1, porMoneda: { USD: 2000 } },
  });
});

test("carritos: sin pedido en la sesión ni de la misma cuenta, con cuenta primero", () => {
  const add = (sessionId, uid, cents, ts) => ({
    type: "add_to_cart", sessionId, uid, displayName: uid ? `Cliente ${uid}` : null, clientTsMs: ts, eventData: { totalCents: cents },
  });
  const { carritosAbandonados: c } = resumirCarritos([
    add("s1", "u1", 4990, 10), add("s1", "u1", 2500, 20), // abandonado, 74.90
    add("s2", null, 1000, 50), // anónimo, abandonado
    add("s3", "u3", 3000, 30), { type: "purchase_complete", sessionId: "s3" }, // compró en la sesión
    add("s4", "u4", 3000, 40), { type: "purchase_complete", sessionId: "otra", uid: "u4" }, // compró en otra pestaña
  ]);
  assert.equal(c.cantidad.total, 2);
  assert.equal(c.valorCents.total, 8490);
  assert.deepEqual(c.lista.map((x) => x.sessionId), ["s1", "s2"]);
  assert.equal(c.lista[0].valorCents, 7490);
  assert.equal(c.lista[0].nombre, "Cliente u1");
  assert.equal(c.lista[0].ts, 20);
});

test("interés: pares con 30 s o más y ranking por producto", () => {
  const dwell = (uid, path, ms, ts = 1) => ({ type: "route_dwell", uid, path, dwellMs: ms, clientTsMs: ts, displayName: uid });
  const { interes } = resumirInteres([
    dwell("u1", "/producto/polo", 20000), dwell("u1", "/producto/polo?x=1", 15000, 5),
    dwell("u2", "/producto/polo", 10000),
    dwell(null, "/producto/taza", 90000),
    dwell("u1", "/tienda", 99999),
  ]);
  assert.deepEqual(interes.pares, [{ uid: "u1", productId: "polo", nombre: "u1", dwellMs: 35000, visitas: 2, ultimaMs: 5 }]);
  assert.deepEqual(interes.productos, [
    { productId: "taza", dwellMs: 90000, personas: 0, anonimos: 1 },
    { productId: "polo", dwellMs: 45000, personas: 2, anonimos: 0 },
  ]);
  assert.equal(productIdFromPath("/producto/a%20b"), "a b");
  assert.equal(productIdFromPath("/producto/%E0%A4%A"), "%E0%A4%A");
});

test("deseos: agregados y quitados (también el quitar viejo con action)", () => {
  const { deseos } = resumirDeseos([
    { type: "wishlist_add", eventData: { action: "add", productId: "polo", name: "Polo" } },
    { type: "wishlist_add", eventData: { action: "add", productId: "polo" } },
    { type: "wishlist_remove", eventData: { action: "remove", productId: "polo" } },
    { type: "wishlist_add", eventData: { action: "remove", productId: "taza" } },
  ]);
  assert.equal(deseos.agregados.total, 2);
  assert.equal(deseos.quitados.total, 2);
  assert.deepEqual(deseos.topProductos, [{ productId: "polo", nombre: "Polo", agregados: 2 }]);
});

test("crear: aperturas del estudio, del combo y guardados", () => {
  const { crear } = resumirCrear([
    { type: "editor_open", eventData: { editorType: "crear" } },
    { type: "editor_open", clientType: "APP", eventData: { editorType: "combo" } },
    { type: "editor_save", eventData: { editorType: "crear" } },
  ]);
  assert.equal(crear.aperturas.total, 1);
  assert.deepEqual(crear.aperturasCombo, { total: 1, app: 1, web: 0 });
  assert.equal(crear.guardados.total, 1);
});

test("un día sin eventos deja todo en cero y listas vacías", () => {
  const r = buildResultadosDelDia([]);
  assert.equal(r.ventas.pedidos.total, 0);
  assert.deepEqual(r.topVendidos, []);
  assert.deepEqual(r.otrosCobros, {});
  assert.deepEqual(r.carritosAbandonados.lista, []);
  assert.deepEqual(r.interes.pares, []);
  assert.deepEqual(r.deseos.topProductos, []);
  assert.equal(r.crear.guardados.total, 0);
});
