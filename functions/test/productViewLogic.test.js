/**
 * Tests UNITARIOS de functions/productViewLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/productViewLogic.test.js
 */
const assert = require("assert");
const p = require("../productViewLogic");

const H = 3600 * 1000;
const NOW = Date.parse("2026-10-03T17:00:00Z");
const ev = (uid, pid, dwellMs, horasAtras) => ({ uid, path: `/producto/${pid}`, dwellMs, clientTsMs: NOW - horasAtras * H });

let count = 0;
function check(name, fn) { fn(); count += 1; }

check("agrupa por cliente y producto; visitas cortas no cuentan", () => {
  const m = p.agruparInteres([
    ev("u1", "A", 10000, 30), ev("u1", "A", 2000, 29), ev("u1", "A", 8000, 28),
    ev("u1", "B", 5000, 20), { uid: null, path: "/producto/A", dwellMs: 9000 },
    { uid: "u1", path: "/tienda", dwellMs: 99999 },
  ]);
  const a = m.get("u1").find((r) => r.productId === "A");
  assert.strictEqual(a.visitas, 2);
  assert.strictEqual(a.dwellMs, 20000);
  assert.strictEqual(m.size, 1);
});

check("elige el de más visitas, ya dejado de mirar hace 12 h+", () => {
  const lista = p.agruparInteres([
    ev("u1", "A", 5000, 30), ev("u1", "A", 5000, 26), ev("u1", "A", 5000, 20),
    ev("u1", "B", 5000, 40), ev("u1", "B", 5000, 39), ev("u1", "B", 5000, 38), ev("u1", "B", 5000, 37),
  ]).get("u1");
  assert.strictEqual(p.elegirProducto(lista, {}, new Set(), NOW).productId, "B");
});

check("no avisa mientras lo sigue mirando (menos de 12 h)", () => {
  const lista = p.agruparInteres([ev("u1", "A", 5000, 5), ev("u1", "A", 5000, 4), ev("u1", "A", 5000, 2)]).get("u1");
  assert.strictEqual(p.elegirProducto(lista, {}, new Set(), NOW), null);
});

check("más de 2 minutos en una sola visita también cuenta", () => {
  const lista = p.agruparInteres([ev("u1", "A", 150000, 20)]).get("u1");
  assert.strictEqual(p.elegirProducto(lista, {}, new Set(), NOW).productId, "A");
});

check("poco interés no avisa", () => {
  const lista = p.agruparInteres([ev("u1", "A", 5000, 20), ev("u1", "A", 5000, 19)]).get("u1");
  assert.strictEqual(p.elegirProducto(lista, {}, new Set(), NOW), null);
});

check("no avisa si ya lo compró o si se avisó hace menos de 14 días", () => {
  const lista = p.agruparInteres([ev("u1", "A", 150000, 20)]).get("u1");
  assert.strictEqual(p.elegirProducto(lista, {}, new Set(["A"]), NOW), null);
  const hace3dias = new Date(NOW - 3 * 24 * H).toISOString();
  assert.strictEqual(p.elegirProducto(lista, { A: hace3dias }, new Set(), NOW), null);
  const hace20dias = new Date(NOW - 20 * 24 * H).toISOString();
  assert.strictEqual(p.elegirProducto(lista, { A: hace20dias }, new Set(), NOW).productId, "A");
});

console.log(`productViewLogic: ${count} casos OK`);
