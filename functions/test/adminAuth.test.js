"use strict";
// node --test functions/test/adminAuth.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { adminConPermiso, permisosAlcanzan, permisosEfectivos } = require("../adminAuth");

// Un Firestore falso con adminRoles/{correo} y adminUsers/{uid}.
const dbCon = (docs) => ({
  collection: (c) => ({
    doc: (id) => ({
      get: async () => {
        const data = (docs[c] || {})[id];
        return { exists: data !== undefined, data: () => data };
      },
    }),
  }),
});
const ctx = (token, uid = "u1") => ({ auth: { uid, token } });
const db = dbCon({
  adminRoles: {
    "super@w.pe": { permissions: ["superadmin"] },
    "cata@w.pe": { permissions: ["catalogo"] },
    "vieja@w.pe": { permissions: ["manage_clients"] },
    "vacio@w.pe": { permissions: [] },
  },
});

test("el claim admin entra a todo, también a lo solo de cuentas principales", async () => {
  assert.equal(await adminConPermiso(db, ctx({ admin: true }), null), true);
  assert.equal(await adminConPermiso(db, ctx({ admin: true }), ["premios"]), true);
});

test("el equipo entra por grupo, con el correo verificado", async () => {
  const v = (email) => ctx({ email, email_verified: true });
  assert.equal(await adminConPermiso(db, v("super@w.pe"), ["premios"]), true);
  assert.equal(await adminConPermiso(db, v("super@w.pe"), []), true);
  assert.equal(await adminConPermiso(db, v("Cata@W.pe"), ["catalogo"]), true);
  assert.equal(await adminConPermiso(db, v("cata@w.pe"), ["premios"]), false);
  assert.equal(await adminConPermiso(db, v("cata@w.pe"), []), false);
  // Los permisos de antes se traducen: manage_clients da clientes, premios, campañas.
  assert.equal(await adminConPermiso(db, v("vieja@w.pe"), ["clientes"]), true);
  assert.equal(await adminConPermiso(db, v("vacio@w.pe"), ["premios"]), false);
  assert.equal(await adminConPermiso(db, v("nadie@w.pe"), ["premios"]), false);
});

test("sin correo verificado, sin sesión o en funciones solo de principales, el equipo no entra", async () => {
  assert.equal(await adminConPermiso(db, ctx({ email: "super@w.pe", email_verified: false }), ["premios"]), false);
  assert.equal(await adminConPermiso(db, ctx({ email: "super@w.pe", email_verified: true }), null), false);
  assert.equal(await adminConPermiso(db, {}, ["premios"]), false);
  assert.equal(await adminConPermiso(db, null, ["premios"]), false);
});

test("si leer adminRoles falla, no entra", async () => {
  const roto = { collection: () => ({ doc: () => ({ get: async () => { throw new Error("x"); } }) }) };
  assert.equal(await adminConPermiso(roto, ctx({ email: "super@w.pe", email_verified: true }), ["premios"]), false);
});

test("permisos", () => {
  assert.deepEqual(permisosEfectivos(["diseno"]), ["diseno", "premios"]);
  assert.equal(permisosAlcanzan(["manage_design"], ["paginas"]), true);
  assert.equal(permisosAlcanzan(["catalogo"], []), false);
  assert.equal(permisosAlcanzan("superadmin", ["x"]), false);
});
