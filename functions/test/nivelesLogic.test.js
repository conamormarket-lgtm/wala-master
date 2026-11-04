"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { nivelDeXp, regalosPendientes, XP_PEDIDO } = require("../nivelesLogic");

test("el nivel sale de la XP", () => {
  assert.equal(nivelDeXp(0).key, "bronce");
  assert.equal(nivelDeXp(99).key, "bronce");
  assert.equal(nivelDeXp(100).key, "plata");
  assert.equal(nivelDeXp(999).key, "oro");
  assert.equal(nivelDeXp(1000).key, "diamante");
  assert.equal(nivelDeXp(-5).key, "bronce");
  assert.equal(XP_PEDIDO, 20);
});

test("regalos: cada nivel alcanzado una sola vez, también los de antes", () => {
  assert.deepEqual(regalosPendientes(50, []), []);
  assert.deepEqual(regalosPendientes(100, []).map((r) => r.key), ["plata"]);
  // Quien ya era Oro antes de que existiera esto recibe Plata y Oro.
  assert.deepEqual(regalosPendientes(350, []).map((r) => r.key), ["plata", "oro"]);
  assert.deepEqual(regalosPendientes(350, ["plata"]).map((r) => r.key), ["oro"]);
  assert.deepEqual(regalosPendientes(350, ["plata", "oro"]), []);
  const diamante = regalosPendientes(1200, ["plata", "oro"]);
  assert.equal(diamante[0].premio.stickers, "kapi");
  assert.equal(diamante[0].premio.topeDescuento, 50);
});
