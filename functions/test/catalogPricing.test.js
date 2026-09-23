"use strict";

const assert = require("node:assert/strict");
const { precioDeCatalogo } = require("../catalogPricing");

// Regresión del producto real factos-polo-adicto-rosaditas: S/45 sin oferta.
const rosaditas = { price: 45, salePrice: null };
assert.equal(precioDeCatalogo(rosaditas), 45);
assert.equal(precioDeCatalogo(rosaditas) + 15, 60); // una unidad + envío

for (const salePrice of [undefined, null, "", " ", "\t\n"]) {
  assert.equal(precioDeCatalogo({ price: 45, salePrice }), 45);
}

// Las ofertas existentes y los precios serializados como texto se conservan.
assert.equal(precioDeCatalogo({ price: 45, salePrice: 35 }), 35);
assert.equal(precioDeCatalogo({ price: "45.00", salePrice: "35.50" }), 35.5);
assert.equal(precioDeCatalogo({ price: 45, salePrice: " 35 " }), 35);
assert.equal(precioDeCatalogo({ price: 45, salePrice: 45 }), 45);
assert.equal(precioDeCatalogo({ price: 45, salePrice: 60 }), 45);

// No confundir una oferta explícita de cero con ausencia de oferta.
assert.equal(precioDeCatalogo({ price: 45, salePrice: 0 }), 0);
assert.equal(precioDeCatalogo({ price: 45, salePrice: "0" }), 0);
assert.equal(precioDeCatalogo({ price: 0, salePrice: null }), 0);

// Datos no numéricos no deben convertirse accidentalmente en una oferta.
for (const salePrice of ["inválido", NaN, Infinity, false, true, [], [1], {}]) {
  assert.equal(precioDeCatalogo({ price: 45, salePrice }), 45);
}
assert.equal(precioDeCatalogo({ price: "inválido", salePrice: null }), null);
assert.equal(precioDeCatalogo({ price: undefined, salePrice: null }), null);

console.log("catalogPricing.test.js: OK");
