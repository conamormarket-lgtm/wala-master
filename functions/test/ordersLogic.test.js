/**
 * Tests UNITARIOS de functions/ordersLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/ordersLogic.test.js
 */
const assert = require("assert");
const o = require("../ordersLogic");

let count = 0;
function check(name, fn) { fn(); count += 1; }

check("hitoDeEstadoErp agrupa etapas del ERP", () => {
  assert.strictEqual(o.hitoDeEstadoErp("Diseño"), "produccion");
  assert.strictEqual(o.hitoDeEstadoErp("En Impresión"), "produccion");
  assert.strictEqual(o.hitoDeEstadoErp("Listo para Preparar"), "produccion");
  assert.strictEqual(o.hitoDeEstadoErp("Empaquetado"), "produccion");
  assert.strictEqual(o.hitoDeEstadoErp("Reparto"), "enviado");
  assert.strictEqual(o.hitoDeEstadoErp("En Reparto"), "enviado");
  assert.strictEqual(o.hitoDeEstadoErp("Finalizado"), "entregado");
});

check("hitoDeEstadoErp ignora pausas, anulados y estados iniciales", () => {
  assert.strictEqual(o.hitoDeEstadoErp("En Pausa por Stock"), null);
  assert.strictEqual(o.hitoDeEstadoErp("Anulado"), null);
  assert.strictEqual(o.hitoDeEstadoErp("Nuevo"), null);
  assert.strictEqual(o.hitoDeEstadoErp(""), null);
  assert.strictEqual(o.hitoDeEstadoErp(undefined), null);
});

check("hitoDeEstadoWala", () => {
  assert.strictEqual(o.hitoDeEstadoWala("pagado"), "pagado");
  assert.strictEqual(o.hitoDeEstadoWala("pendiente_pago"), null);
  assert.strictEqual(o.hitoDeEstadoWala("cancelado"), null);
});

check("debeAvisar: una vez por hito y nunca hacia atrás", () => {
  assert.strictEqual(o.debeAvisar("produccion", []), true);
  assert.strictEqual(o.debeAvisar("produccion", ["produccion"]), false);
  assert.strictEqual(o.debeAvisar("enviado", ["pagado", "produccion"]), true);
  assert.strictEqual(o.debeAvisar("produccion", ["entregado"]), false);
  assert.strictEqual(o.debeAvisar(null, []), false);
});

check("textoHito incluye el número de pedido", () => {
  assert.ok(o.textoHito("enviado", "W-123").body.includes("#W-123"));
  assert.strictEqual(o.textoHito("otro", "1"), null);
});

console.log(`ordersLogic: ${count} casos OK`);
