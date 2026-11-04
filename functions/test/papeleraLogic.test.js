/**
 * Tests UNITARIOS de functions/papeleraLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/papeleraLogic.test.js
 */
const assert = require("assert");
const { planPapelera, msDe } = require("../papeleraLogic");

const ahora = Date.parse("2026-11-04T08:30:00Z");
const dia = 24 * 60 * 60 * 1000;

const plan = planPapelera([
  { id: "viejo", deleted: true, deletedAt: "2026-09-01T00:00:00Z" },
  { id: "nuevo", deleted: true, papeleraDesde: ahora - 5 * dia },
  { id: "vencido", deleted: true, papeleraDesde: ahora - 30 * dia },
  { id: "pieza", deleted: true, papeleraDesde: ahora - 40 * dia },
  { id: "combo", name: "Combo", isComboProduct: true, comboItems: [{ productId: "pieza" }] },
  { id: "vivo", name: "Vivo", papeleraDesde: ahora - 90 * dia },
], ahora);

assert.deepStrictEqual(plan.marcar, ["viejo"], "sin fecha: se le pone hoy, no se borra");
assert.deepStrictEqual(plan.borrar, ["vencido"], "a los 30 días se borra");
assert.deepStrictEqual(plan.enUso, ["pieza"], "la pieza de un combo vivo se queda");
assert.strictEqual(msDe({ seconds: 10 }), 10000);
assert.strictEqual(msDe(""), null);
assert.deepStrictEqual(planPapelera([], ahora), { marcar: [], borrar: [], enUso: [] });
console.log("papeleraLogic: OK");
