/**
 * Tests UNITARIOS de visitas y canales (functions/analyticsTraficoReal.js).
 * Ejecutar:  node functions/test/analyticsVisitas.test.js
 */
const assert = require("assert");
const { armarVisitas, resumenVisitas, canalDe, filtrarTraficoReal } = require("../analyticsTraficoReal");

let count = 0;
function check(name, fn) { fn(); count += 1; }

const MIN = 60 * 1000;
const ses = (id, quien, inicioMin, finMin, extra = {}) => ({ id, anonymousId: quien, startedAtClientMs: inicioMin * MIN, lastSeenAtClientMs: finMin * MIN, clientType: "WEB", ...extra });
const pv = (sessionId) => ({ type: "page_view", sessionId, path: "/" });

check("una pestaña sin páginas vistas no es visita", () => {
  const r = armarVisitas([pv("a")], [ses("a", "p1", 0, 1), ses("vacia", "p2", 0, 0)]);
  assert.strictEqual(r.visitas.length, 1);
  assert.strictEqual(r.calidad.sinPaginas, 1);
});

check("pestañas del mismo dispositivo a menos de 30 min son una visita; con más pausa, otra", () => {
  const r = armarVisitas(
    [pv("a"), pv("b"), pv("c")],
    [ses("a", "p1", 0, 5), ses("b", "p1", 12, 20), ses("c", "p1", 60, 61)],
  );
  assert.strictEqual(r.visitas.length, 2);
  assert.strictEqual(r.calidad.unidas, 1);
  assert.strictEqual(r.visitas[0].paginas, 2);
  assert.deepStrictEqual(r.representantes.map((s) => s.id), ["a", "c"]);
});

check("con interacción: 2+ páginas, 10 s o más, o un pedido", () => {
  const r = armarVisitas(
    [pv("rebote"), pv("lee"), { type: "route_dwell", sessionId: "lee", dwellMs: 15000 }, pv("dos"), pv("dos")],
    [ses("rebote", "a", 0, 0), ses("lee", "b", 0, 1), ses("dos", "c", 0, 1)],
  );
  assert.deepStrictEqual(r.visitas.map((v) => v.conInteraccion), [false, true, true]);
});

check("canal: app, UTM, buscador, redes, directo", () => {
  assert.strictEqual(canalDe({ clientType: "APP", referrer: "https://google.com" }), "App Walá");
  assert.strictEqual(canalDe({ utm_source: "ig" }), "Instagram");
  assert.strictEqual(canalDe({ utm_source: "newsletter" }), "Campañas (UTM)");
  assert.strictEqual(canalDe({ referrer: "https://www.google.com.pe/" }), "Google");
  assert.strictEqual(canalDe({ referrer: "https://l.instagram.com/?u=x" }), "Instagram");
  assert.strictEqual(canalDe({ referrer: "https://lm.facebook.com/" }), "Facebook");
  assert.strictEqual(canalDe({ referrer: "https://www.wala.pe/tienda" }), "Directo o sin dato");
  assert.strictEqual(canalDe({}), "Directo o sin dato");
  assert.strictEqual(canalDe({ referrer: "https://blog.ejemplo.com/" }), "Otros sitios");
});

check("resumen sumable: visitas, con interacción, pedidos y por canal", () => {
  const { visitas, canales } = resumenVisitas([
    { canal: "Google", clientType: "WEB", paginas: 3, dwellMs: 20000, pedidos: 1, conInteraccion: true },
    { canal: "App Walá", clientType: "APP", paginas: 1, dwellMs: 2000, pedidos: 0, conInteraccion: false },
  ]);
  assert.deepStrictEqual(visitas.total, { total: 2, app: 1, web: 1 });
  assert.deepStrictEqual(visitas.conInteraccion, { total: 1, app: 0, web: 1 });
  assert.strictEqual(visitas.pedidos.total, 1);
  assert.deepStrictEqual(canales.Google, { visitas: 1, conInteraccion: 1, paginas: 3, dwellMs: 20000, pedidos: 1 });
});

check("un dispositivo que abrió /admin otro día queda fuera (adminIds)", () => {
  const r = filtrarTraficoReal(
    [{ type: "page_view", sessionId: "s1", path: "/", anonymousId: "pcAdmin" }, { type: "page_view", sessionId: "s2", path: "/", anonymousId: "cliente" }],
    [{ id: "s1", anonymousId: "pcAdmin" }, { id: "s2", anonymousId: "cliente" }],
    { adminIds: new Set(["pcAdmin"]) },
  );
  assert.deepStrictEqual(r.sessions.map((s) => s.id), ["s2"]);
  assert.deepStrictEqual(r.events.map((e) => e.sessionId), ["s2"]);
});

console.log(`analyticsVisitas: ${count} pruebas OK`);
