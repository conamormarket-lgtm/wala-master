"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("../tarjetasGuardadas");

const sesion = (proveedor, email = "ana@correo.com") => ({ uid: "u1", token: { email, firebase: { sign_in_provider: proveedor } } });

test("guardar tarjetas pide una cuenta con correo, no anónima", () => {
  assert.equal(t.puedeGuardarTarjetas(sesion("password")), true);
  assert.equal(t.puedeGuardarTarjetas(sesion("google.com")), true);
  assert.equal(t.puedeGuardarTarjetas(sesion("anonymous", "")), false);
  assert.equal(t.puedeGuardarTarjetas(sesion("custom")), false);
  assert.equal(t.puedeGuardarTarjetas(sesion("password", "  ")), false);
  assert.equal(t.puedeGuardarTarjetas(null), false);
});

test("la tarjeta de Culqi en lo que se muestra", () => {
  const card = {
    object: "card",
    id: "crd_test_abc123",
    source: { last_four: "1111", card_number: "411111******1111", iin: { bin: "411111", card_brand: "Visa", card_type: "crédito", issuer: { name: "BCP" } } },
  };
  assert.equal(t.esTarjetaCulqi(card), true);
  assert.deepEqual(t.datosDeTarjeta(card), {
    culqiCardId: "crd_test_abc123", marca: "Visa", ultimos4: "1111", tipo: "crédito", banco: "BCP", bin: "411111",
  });
  // Sin datos no se inventa nada.
  assert.deepEqual(t.datosDeTarjeta({}), { culqiCardId: "", marca: "Tarjeta", ultimos4: "", tipo: "", banco: "", bin: "" });
  // Un 3DS pendiente o un error no es una tarjeta.
  assert.equal(t.esTarjetaCulqi({ action_code: "REVIEW" }), false);
  assert.equal(t.esTarjetaCulqi({ object: "error" }), false);
});

test("el token sirve para ver si ya estaba guardada", () => {
  const delToken = t.datosDeTarjeta({ source: { object: "token", card_number: "411111******1111", last_four: "1111", iin: { bin: "411111" } } });
  assert.equal(t.yaGuardada([{ bin: "411111", ultimos4: "1111" }], delToken), true);
  assert.equal(t.yaGuardada([{ bin: "411111", ultimos4: "2222" }], delToken), false);
  // Sin bin o sin dígitos no se compara: se guarda.
  assert.equal(t.yaGuardada([{ bin: "", ultimos4: "" }], { bin: "", ultimos4: "" }), false);
});

test("al navegador no va el cliente de Culqi", () => {
  const c = t.tarjetaParaCliente("crd_test_abc123", { marca: "Visa", ultimos4: "1111", culqiCustomerId: "cus_test_x", bin: "411111" });
  assert.deepEqual(c, { id: "crd_test_abc123", marca: "Visa", ultimos4: "1111", tipo: "", banco: "" });
});

test("ids de tarjeta y de intento", () => {
  assert.equal(t.tarjetaIdValido("crd_live_AbC123"), true);
  assert.equal(t.tarjetaIdValido("tkn_live_AbC123"), false);
  assert.equal(t.tarjetaIdValido("crd_live_../x"), false);
  assert.equal(t.intentoValido("a1b2c3d4e5f6g7h8"), true);
  assert.equal(t.intentoValido("corto"), false);
  assert.equal(t.intentoValido("con/barra-1234567"), false);
});
