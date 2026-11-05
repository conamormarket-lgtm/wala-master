"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { embudoDePopup, VENTANA_MS } = require("../popupsEmbudo");

const DIA = 24 * 60 * 60 * 1000;

test("cuenta personas, no veces", () => {
  const e = embudoDePopup({
    objetivo: "enlace",
    eventos: {
      vistas: [{ uid: "a", ts: 1 }, { uid: "a", ts: 2 }, { anonymousId: "x", ts: 3 }],
      cierres: [{ uid: "a", ts: 2 }, { uid: "a", ts: 5 }],
      clics: [{ anonymousId: "x", ts: 4 }],
      conversiones: [],
    },
  });
  assert.deepEqual(
    [e.vistas, e.vieron, e.cierres, e.cerraron, e.clics, e.tocaron, e.empezaron, e.cumplieron],
    [3, 2, 2, 1, 1, 1, null, 0],
  );
});

test("encuesta: cumple si la llenó en los 7 días después de su primer clic", () => {
  const t0 = 1000 * DIA;
  const eventos = {
    vistas: [{ uid: "u1" }, { uid: "u2" }, { uid: "u3" }, { uid: "u4" }],
    clics: [
      { uid: "u1", ts: t0 },
      { uid: "u1", ts: t0 + 3 * DIA }, // el segundo clic no mueve la ventana
      { uid: "u2", ts: t0 },
      { uid: "u3", ts: t0 },
      { uid: "u4", ts: t0 },
    ],
  };
  const completoEn = new Map([
    ["u1", t0 + 2 * DIA], // dentro
    ["u2", t0 + VENTANA_MS + 1], // tarde
    ["u3", t0 - DIA], // ya la había llenado antes
  ]);
  const abrieron = new Set(["u:u4"]); // abrió la encuesta y no la terminó
  const e = embudoDePopup({ objetivo: "encuesta", eventos, completoEn, abrieron });
  assert.deepEqual([e.tocaron, e.empezaron, e.cumplieron, e.conversiones], [4, 2, 1, 1]);
});

test("la conversión del navegador también cuenta, sin repetir a la persona", () => {
  const e = embudoDePopup({
    objetivo: "encuesta",
    eventos: { clics: [{ uid: "u1", ts: 10 }], conversiones: [{ uid: "u1", ts: 20 }, { uid: "u1", ts: 30 }] },
    completoEn: new Map([["u1", 20]]),
  });
  assert.deepEqual([e.cumplieron, e.empezaron], [1, 1]);
});

test("registro: solo las conversiones registradas", () => {
  const e = embudoDePopup({
    objetivo: "registro",
    eventos: { clics: [{ anonymousId: "x", ts: 1 }], conversiones: [{ uid: "nuevo", ts: 2 }] },
  });
  assert.deepEqual([e.tocaron, e.cumplieron, e.empezaron], [1, 1, null]);
});
