/**
 * Tests UNITARIOS de functions/encuestaRecordatorioLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/encuestaRecordatorioLogic.test.js
 */
const assert = require("assert");
const { avisoQueToca, MAX_DIAS, DIA_MS } = require("../encuestaRecordatorioLogic");

const ahoraMs = Date.UTC(2026, 9, 23, 15);
const hace = (dias) => ahoraMs - dias * DIA_MS;

let count = 0;
function check(name, fn) { fn(); count += 1; }

check("antes de 3 días no toca nada", () => {
  assert.strictEqual(avisoQueToca({ creadaMs: hace(2.9), ahoraMs }), null);
});

check("a los 3 días toca el primero", () => {
  assert.strictEqual(avisoQueToca({ creadaMs: hace(3), ahoraMs }), "survey_3d");
  assert.strictEqual(avisoQueToca({ creadaMs: hace(9.5), ahoraMs }), "survey_3d");
});

check("el primero no se repite", () => {
  assert.strictEqual(avisoQueToca({ creadaMs: hace(4), ahoraMs, enviados: { survey_3d: "x" } }), null);
});

check("a los 10 días toca el segundo, haya salido o no el primero", () => {
  assert.strictEqual(avisoQueToca({ creadaMs: hace(10), ahoraMs, enviados: { survey_3d: "x" } }), "survey_10d");
  assert.strictEqual(avisoQueToca({ creadaMs: hace(12), ahoraMs }), "survey_10d");
});

check("el segundo no se repite", () => {
  assert.strictEqual(avisoQueToca({ creadaMs: hace(11), ahoraMs, enviados: { survey_10d: "x" } }), null);
});

check("cuentas viejas no reciben nada", () => {
  assert.strictEqual(avisoQueToca({ creadaMs: hace(MAX_DIAS), ahoraMs }), null);
  assert.strictEqual(avisoQueToca({ creadaMs: hace(200), ahoraMs }), null);
});

check("sin fecha de creación no toca nada", () => {
  assert.strictEqual(avisoQueToca({ creadaMs: NaN, ahoraMs }), null);
});

console.log(`encuestaRecordatorioLogic: ${count} pruebas OK`);
