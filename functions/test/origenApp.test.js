const test = require("node:test");
const assert = require("node:assert/strict");
const { vieneDeLaApp } = require("../origenApp");

const llamada = (origin) => ({ rawRequest: { headers: origin === undefined ? {} : { origin } } });

test("la app de ahora (SDK nativo, sin Origin) cuenta como app", () => {
  assert.equal(vieneDeLaApp({ origenApp: true }, llamada(undefined)), true);
  assert.equal(vieneDeLaApp({ origenApp: true }, llamada("")), true);
});

test("la app de antes (Capacitor) sigue contando como app", () => {
  assert.equal(vieneDeLaApp({ origenApp: true }, llamada("https://localhost")), true);
  assert.equal(vieneDeLaApp({ origenApp: true }, llamada("capacitor://localhost")), true);
  assert.equal(vieneDeLaApp({ origenApp: true }, llamada("Capacitor://LocalHost")), true);
});

test("la web no pasa por app aunque mande origenApp: true", () => {
  assert.equal(vieneDeLaApp({ origenApp: true }, llamada("https://www.wala.pe")), false);
  assert.equal(vieneDeLaApp({ origenApp: true }, llamada("http://localhost:3000")), false);
});

test("sin origenApp: true nunca es app", () => {
  assert.equal(vieneDeLaApp({}, llamada(undefined)), false);
  assert.equal(vieneDeLaApp({ origenApp: "true" }, llamada(undefined)), false);
  assert.equal(vieneDeLaApp(null, llamada(undefined)), false);
  assert.equal(vieneDeLaApp({ origenApp: true }, undefined), true);
});
