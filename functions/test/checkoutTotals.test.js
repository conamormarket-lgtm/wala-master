"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { totalEsperadoCheckout, topeMonedasCheckout } = require("../checkoutTotals");

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
