"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// El módulo pide firebase-functions/admin al cargar: se simulan (solo se
// prueban las funciones puras).
const cargarOriginal = Module._load;
Module._load = function (pedido, ...resto) {
  if (pedido === "firebase-functions") {
    const fn = () => ({ document: () => ({ onWrite: (f) => f }), https: { onCall: (f) => f } });
    return { firestore: fn(), runWith: fn, https: { HttpsError: Error } };
  }
  if (pedido === "firebase-admin") return {};
  return cargarOriginal.call(this, pedido, ...resto);
};
const { _internals } = require("../clientesBusqueda");
Module._load = cargarOriginal;
const { prefijosBusqueda, normalizarBusqueda } = _internals;

test("nombre, correo, DNI y teléfono sin tildes ni mayúsculas", () => {
  const p = prefijosBusqueda({
    displayName: "Lucía Pérez", email: "Lucia.P@Gmail.com", dni: "12345678", phoneIntl: { full: "+51 987 654 321" },
  });
  ["lu", "luc", "lucia", "pe", "perez", "lucia.p@gmail.com", "12", "12345678", "98765", "987654321", "51987"].forEach((x) =>
    assert.ok(p.includes(x), `falta ${x}`));
  assert.ok(!p.includes("l"), "no guarda una sola letra");
  assert.deepEqual(p, [...p].sort(), "orden estable para comparar");
});

test("perfil vacío no tiene comienzos y el tope se respeta", () => {
  assert.deepEqual(prefijosBusqueda({}), []);
  const largo = prefijosBusqueda({ displayName: Array.from({ length: 40 }, (_, i) => `nombre${i}largoextra`).join(" ") });
  assert.ok(largo.length <= 300);
});

test("normalizarBusqueda quita tildes y espacios de los bordes", () => {
  // La ñ también pierde la tilde: se busca igual con n o con ñ (el cliente normaliza igual).
  assert.equal(normalizarBusqueda("  ÑANDÚ Ávila "), "nandu avila");
});
