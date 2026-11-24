"use strict";
// node --test functions/test/sorteoFechas.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { fueraDeFechas, mensajeFueraDeFechas } = require("../sorteoFechas");

const ms = (iso) => Date.parse(iso);
const s = { fechaInicio: "2026-11-10", fechaFin: "2026-11-20" };

test("abre a las 00:00 del inicio y cierra al final del día de fin, hora de Lima", () => {
  assert.equal(fueraDeFechas(s, ms("2026-11-09T23:59:00-05:00")), "antes");
  assert.equal(fueraDeFechas(s, ms("2026-11-10T00:00:00-05:00")), null);
  assert.equal(fueraDeFechas(s, ms("2026-11-20T23:59:00-05:00")), null);
  assert.equal(fueraDeFechas(s, ms("2026-11-21T00:00:01-05:00")), "despues");
});

test("sin fechas o con formato raro no limita", () => {
  assert.equal(fueraDeFechas({}, 0), null);
  assert.equal(fueraDeFechas({ fechaFin: "" }, Date.now()), null);
  assert.equal(fueraDeFechas({ fechaFin: "20/11/2026" }, Date.now()), null);
  assert.equal(fueraDeFechas({ fechaInicio: "2026-11-10" }, ms("2030-01-01T00:00:00Z")), null);
});

test("mensajes", () => {
  assert.equal(mensajeFueraDeFechas(s, ms("2026-11-01T12:00:00Z")), "El sorteo empieza el 10/11/2026.");
  assert.equal(mensajeFueraDeFechas(s, ms("2026-12-01T12:00:00Z")), "El sorteo ya cerró.");
  assert.equal(mensajeFueraDeFechas(s, ms("2026-11-15T12:00:00Z")), "");
});
