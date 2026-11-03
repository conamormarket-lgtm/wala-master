"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { totalEsperadoCheckout, topeMonedasCheckout, pctMonedasDeMarca, topeDeMarca } = require("../checkoutTotals");

const reglas = { envioEstandar: 15, envioGratisDesde: 100 };

test("envío se cobra hasta S/100 y es gratis por encima", () => {
  assert.deepEqual(totalEsperadoCheckout({ subtotal: 80, ...reglas }), { envio: 15, total: 95 });
  assert.deepEqual(totalEsperadoCheckout({ subtotal: 120, ...reglas }), { envio: 0, total: 120 });
});

test("las monedas no quitan el envío gratis (umbral sobre los productos)", () => {
  assert.deepEqual(totalEsperadoCheckout({ subtotal: 109, monedas: 28, ...reglas }), { envio: 0, total: 81 });
});

test("cupón de monto y cupón de envío gratis", () => {
  assert.equal(totalEsperadoCheckout({ subtotal: 80, descuentoCupon: 10, ...reglas }).total, 85);
  assert.equal(totalEsperadoCheckout({ subtotal: 80, envioGratis: true, ...reglas }).total, 80);
});

test("nunca negativo y el tope de monedas es la mitad", () => {
  assert.equal(totalEsperadoCheckout({ subtotal: 20, monedas: 10, descuentoCupon: 50, ...reglas }).total, 15);
  assert.equal(topeMonedasCheckout(109), 54);
  assert.equal(topeMonedasCheckout(1), 0);
});

test("tope por marca: porcentaje por línea, redondeo una sola vez", () => {
  assert.equal(topeMonedasCheckout([{ importe: 100, pct: 20 }, { importe: 45, pct: 50 }]), 42);
  assert.equal(topeMonedasCheckout([{ importe: 45, pct: 50 }, { importe: 45, pct: 50 }]), 45);
  assert.equal(topeMonedasCheckout([{ importe: 30, pct: 0 }]), 0);
  assert.equal(topeMonedasCheckout([{ importe: 80, pct: 100 }]), 80);
  assert.equal(topeMonedasCheckout([{ importe: 0.3, pct: 100 }, { importe: 0.7, pct: 100 }]), 1);
  assert.equal(topeMonedasCheckout([{ importe: 40 }]), 20);
});

test("% de la marca: sin configurar es la mitad, se acota a 0-100", () => {
  assert.equal(pctMonedasDeMarca(null), 50);
  assert.equal(pctMonedasDeMarca({}), 50);
  assert.equal(pctMonedasDeMarca({ topeMonedasPct: "" }), 50);
  assert.equal(pctMonedasDeMarca({ topeMonedasPct: 0 }), 0);
  assert.equal(pctMonedasDeMarca({ topeMonedasPct: 30 }), 30);
  assert.equal(pctMonedasDeMarca({ topeMonedasPct: 150 }), 100);
  assert.equal(pctMonedasDeMarca({ topeMonedasPct: -5 }), 0);
  assert.equal(pctMonedasDeMarca({ topeMonedasPct: "abc" }), 50);
});

test("tope por producto: monedas fijas por unidad, nunca más que el importe", () => {
  // 10 por unidad: 3 polos de S/ 40 → 30; 1 llavero de S/ 6 → 6 (no 10).
  assert.equal(topeMonedasCheckout([{ importe: 120, cantidad: 3, tope: { tipo: "monedas", valor: 10 } }]), 30);
  assert.equal(topeMonedasCheckout([{ importe: 6, cantidad: 1, tope: { tipo: "monedas", valor: 10 } }]), 6);
  // Se mezcla con las del %: 30 fijas + 50 % de 45.
  assert.equal(topeMonedasCheckout([
    { importe: 120, cantidad: 3, tope: { tipo: "monedas", valor: 10 } },
    { importe: 45, cantidad: 1, tope: { tipo: "pct", valor: 50 } },
  ]), 52);
  assert.equal(topeMonedasCheckout([{ importe: 40, tope: 25 }]), 10);
});

test("tope de la marca: % o monedas; sin cantidad válida, el %", () => {
  assert.deepEqual(topeDeMarca(null), { tipo: "pct", valor: 50 });
  assert.deepEqual(topeDeMarca({ topeMonedasPct: 20 }), { tipo: "pct", valor: 20 });
  assert.deepEqual(topeDeMarca({ topeMonedasTipo: "monedas", topeMonedasCantidad: 12 }), { tipo: "monedas", valor: 12 });
  assert.deepEqual(topeDeMarca({ topeMonedasTipo: "monedas", topeMonedasCantidad: "7.9" }), { tipo: "monedas", valor: 7 });
  assert.deepEqual(topeDeMarca({ topeMonedasTipo: "monedas", topeMonedasCantidad: "", topeMonedasPct: 30 }), { tipo: "pct", valor: 30 });
  assert.deepEqual(topeDeMarca({ topeMonedasTipo: "pct", topeMonedasCantidad: 12, topeMonedasPct: 30 }), { tipo: "pct", valor: 30 });
});
