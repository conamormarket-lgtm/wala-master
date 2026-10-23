/**
 * Tests UNITARIOS de functions/analyticsTraficoReal.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/analyticsTraficoReal.test.js
 */
const assert = require("assert");
const { filtrarTraficoReal, sesionesFaltantes, esBot, DWELL_MAX_MS } = require("../analyticsTraficoReal");

let count = 0;
function check(name, fn) { fn(); count += 1; }

const UA_PERSONA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36";
const UA_HEADLESS = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 HeadlessChrome/153.0.0.0 Safari/537.36";

check("reconoce bots por su userAgent y deja pasar a las personas", () => {
  assert.ok(esBot(UA_HEADLESS));
  assert.ok(esBot("Mozilla/5.0 (compatible; Googlebot/2.1)"));
  assert.ok(esBot("Mozilla/5.0 (compatible; bingbot/2.0)"));
  assert.ok(!esBot(UA_PERSONA));
  assert.ok(!esBot(""));
});

check("saca las sesiones de bots con sus eventos", () => {
  const r = filtrarTraficoReal(
    [{ type: "page_view", sessionId: "s1", path: "/" }, { type: "page_view", sessionId: "bot", path: "/" }],
    [{ id: "s1", userAgent: UA_PERSONA }, { id: "bot", userAgent: UA_HEADLESS }],
  );
  assert.deepStrictEqual(r.sessions.map((s) => s.id), ["s1"]);
  assert.strictEqual(r.events.length, 1);
  assert.strictEqual(r.descarte.sesionesBot, 1);
});

check("saca el admin: rutas /admin, cuentas admin y sesiones que solo vieron el admin", () => {
  const r = filtrarTraficoReal(
    [
      { type: "page_view", sessionId: "mixta", path: "/tienda" },
      { type: "page_view", sessionId: "mixta", path: "/admin/pedidos" },
      { type: "page_view", sessionId: "panel", path: "/admin/dashboard" },
      { type: "page_view", sessionId: "jefe", path: "/tienda", uid: "adm1" },
    ],
    [
      { id: "mixta", userAgent: UA_PERSONA },
      { id: "panel", userAgent: UA_PERSONA },
      { id: "jefe", userAgent: UA_PERSONA, uid: "adm1" },
    ],
    { adminUids: new Set(["adm1"]) },
  );
  assert.deepStrictEqual(r.events.map((e) => e.path), ["/tienda"]);
  assert.deepStrictEqual(r.sessions.map((s) => s.id), ["mixta"]);
  assert.strictEqual(r.descarte.sesionesAdmin, 2);
});

check("recorta las permanencias larguísimas a 30 minutos", () => {
  const r = filtrarTraficoReal(
    [{ type: "route_dwell", sessionId: "s1", path: "/", dwellMs: 65 * 3600000 }, { type: "route_dwell", sessionId: "s1", path: "/", dwellMs: 4000 }],
    [{ id: "s1", userAgent: UA_PERSONA }],
  );
  assert.deepStrictEqual(r.events.map((e) => e.dwellMs), [DWELL_MAX_MS, 4000]);
  assert.strictEqual(r.descarte.dwellRecortados, 1);
});

check("un evento de una sesión de otro día se juzga con esa sesión (sesionesExtra)", () => {
  const ev = [{ type: "page_view", sessionId: "ayer", path: "/" }];
  assert.deepStrictEqual(sesionesFaltantes(ev, []), ["ayer"]);
  const r = filtrarTraficoReal(ev, [], { sesionesExtra: [{ id: "ayer", userAgent: UA_HEADLESS }] });
  assert.strictEqual(r.events.length, 0);
  assert.strictEqual(r.sessions.length, 0, "las sesiones extra no se cuentan");
});

check("quien abrió el admin ese día queda fuera también antes de iniciar sesión", () => {
  const r = filtrarTraficoReal(
    [
      { type: "page_view", sessionId: "s1", path: "/tienda", anonymousId: "anonAdmin" },
      { type: "page_view", sessionId: "s2", path: "/admin/pedidos", anonymousId: "anonAdmin" },
      { type: "page_view", sessionId: "s3", path: "/tienda", anonymousId: "cliente" },
    ],
    [
      { id: "s1", userAgent: UA_PERSONA, anonymousId: "anonAdmin" },
      { id: "s2", userAgent: UA_PERSONA, anonymousId: "anonAdmin" },
      { id: "s3", userAgent: UA_PERSONA, anonymousId: "cliente" },
    ],
  );
  assert.deepStrictEqual(r.sessions.map((s) => s.id), ["s3"]);
  assert.deepStrictEqual(r.events.map((e) => e.sessionId), ["s3"]);
});

console.log(`analyticsTraficoReal: ${count} pruebas OK`);
