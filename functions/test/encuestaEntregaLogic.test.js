/**
 * Tests UNITARIOS de functions/encuestaEntregaLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/encuestaEntregaLogic.test.js
 */
const assert = require("assert");
const { configEntrega, limpiarRespuestaEntrega, claveEntrega, OPCIONES_POR_DEFECTO, MONEDAS_POR_DEFECTO } = require("../encuestaEntregaLogic");

let count = 0;
function check(name, fn) { fn(); count += 1; }

check("sin config: activa, 5 monedas y las opciones por defecto", () => {
  const c = configEntrega(undefined);
  assert.strictEqual(c.activo, true);
  assert.strictEqual(c.monedas, MONEDAS_POR_DEFECTO);
  assert.deepStrictEqual(c.opcionesMejorar, OPCIONES_POR_DEFECTO);
});

check("las monedas se limitan entre 0 y 50", () => {
  assert.strictEqual(configEntrega({ monedas: 999 }).monedas, 50);
  assert.strictEqual(configEntrega({ monedas: -3 }).monedas, 0);
  assert.strictEqual(configEntrega({ monedas: 0 }).monedas, 0);
});

check("estrellas obligatorias de 1 a 5", () => {
  const c = configEntrega();
  assert.ok(limpiarRespuestaEntrega({}, c).error);
  assert.ok(limpiarRespuestaEntrega({ estrellas: 6 }, c).error);
  assert.ok(limpiarRespuestaEntrega({ estrellas: 2.5 }, c).error);
  assert.strictEqual(limpiarRespuestaEntrega({ estrellas: 4 }, c).estrellas, 4);
});

check("solo opciones de la config, sin repetir; comentario recortado", () => {
  const c = configEntrega({ opcionesMejorar: ["Empaque", "Precio"] });
  const r = limpiarRespuestaEntrega({ estrellas: 3, mejorar: ["Empaque", "Empaque", "Inventada"], comentario: ` ${"x".repeat(600)} ` }, c);
  assert.deepStrictEqual(r.mejorar, ["Empaque"]);
  assert.strictEqual(r.comentario.length, 500);
});

check("una respuesta por cliente y pedido (clave limpia)", () => {
  assert.strictEqual(claveEntrega("u1", "PD-12/3"), "u1__PD-12-3");
});

console.log(`encuestaEntregaLogic: ${count} pruebas OK`);
