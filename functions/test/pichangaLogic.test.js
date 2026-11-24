// Lógica del servidor de La Pichanga de Walito: node --test functions/test/pichangaLogic.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const p = require("../pichangaLogic");
const { ARCHIVOS, encabezado } = require("../../scripts/generar-motor-pichanga");

const HOY = "2026-11-09";

test("las copias del servidor están al día (npm run gen:motor-pichanga)", () => {
  for (const archivo of ARCHIVOS) {
    const origen = fs.readFileSync(path.join(__dirname, "..", "..", "src", "componentes", "kit", "piezas", archivo), "utf8").replace(/\r\n/g, "\n");
    const copia = fs.readFileSync(path.join(__dirname, "..", archivo), "utf8").replace(/\r\n/g, "\n");
    assert.equal(copia, encabezado(archivo) + origen, `${archivo} quedó vieja: corre npm run gen:motor-pichanga`);
  }
});

const espera = async (promesa, codigo) => {
  await assert.rejects(promesa, (e) => e.codigo === codigo);
};

test("una partida ganada se comprueba (nivel y reto de hoy)", async () => {
  const { SOLUCIONES_PICHANGA } = await import("../pichangaSoluciones.mjs");
  const { indiceRetoDe } = await import("../pichangaNiveles.mjs");
  const nivel = await p.comprobarPartidaPichanga({ modo: "nivel", nivel: 20, tiros: SOLUCIONES_PICHANGA[20].tiros }, HOY);
  assert.deepEqual(nivel, { modo: "nivel", nivel: 20, toques: 3, goles: 3, estrellas: 3, par: 3 });
  const sol = SOLUCIONES_PICHANGA[`r${indiceRetoDe(HOY)}`];
  const reto = await p.comprobarPartidaPichanga({ modo: "reto", fecha: HOY, tiros: sol.tiros, extras: 0 }, HOY);
  assert.equal(reto.modo, "reto");
  assert.equal(reto.toques, sol.par);
});

test("las partidas que no valen se rechazan", async () => {
  const { SOLUCIONES_PICHANGA } = await import("../pichangaSoluciones.mjs");
  const gol = SOLUCIONES_PICHANGA[1].tiros;
  await espera(p.comprobarPartidaPichanga({ modo: "nivel", nivel: 99, tiros: gol }, HOY), "invalid-argument");
  await espera(p.comprobarPartidaPichanga({ modo: "nivel", nivel: 1, tiros: [] }, HOY), "invalid-argument");
  await espera(p.comprobarPartidaPichanga({ modo: "nivel", nivel: 1, tiros: [[0, 1.5, -100]] }, HOY), "invalid-argument");
  await espera(p.comprobarPartidaPichanga({ modo: "nivel", nivel: 1, tiros: gol, extras: 99 }, HOY), "invalid-argument");
  await espera(p.comprobarPartidaPichanga({ modo: "nivel", nivel: 1, tiros: [...gol, ...gol] }, HOY), "invalid-argument");
  await espera(p.comprobarPartidaPichanga({ modo: "nivel", nivel: 1, tiros: [[0, 0, 20]] }, HOY), "failed-precondition");
  await espera(p.comprobarPartidaPichanga({ modo: "reto", fecha: "2026-11-08", tiros: gol }, HOY), "failed-precondition");
  await espera(p.comprobarPartidaPichanga({ tiros: gol }, HOY), "invalid-argument");
});

test("la semana del reto: el mejor de cada día", () => {
  let s = p.sumarRetoASemana(null, "2026-11-09", 3);
  s = p.sumarRetoASemana(s, "2026-11-09", 2);
  s = p.sumarRetoASemana(s, "2026-11-10", 4);
  assert.deepEqual(s, { dias: { "2026-11-09": 2, "2026-11-10": 4 }, completados: 2, total: 6 });
});

test("los goles del mes: cada nivel una vez por día", () => {
  let m = p.sumarGolesMes(null, "2026-11", HOY, "n3", 1);
  assert.equal(m.goles, 1);
  assert.equal(p.sumarGolesMes(m, "2026-11", HOY, "n3", 1), null);
  m = p.sumarGolesMes(m, "2026-11", HOY, "reto", 1);
  m = p.sumarGolesMes(m, "2026-11", "2026-11-10", "n3", 1);
  assert.equal(m.goles, 3);
  assert.deepEqual(m.contados, { fecha: "2026-11-10", claves: ["n3"] });
  // Otro mes empieza de cero.
  assert.equal(p.sumarGolesMes(m, "2026-12", "2026-12-01", "n3", 3).goles, 3);
});

test("los órdenes de los rankings", () => {
  assert.deepEqual(p.ordenarRetoDia([{ uid: "a", toques: 3, hecho: 1 }, { uid: "b", toques: 2, hecho: 5 }, { uid: "c", toques: 2, hecho: 2 }]).map((f) => f.uid), ["c", "b", "a"]);
  assert.deepEqual(p.ordenarRetoSemana([{ uid: "a", completados: 2, total: 6 }, { uid: "b", completados: 3, total: 9 }, { uid: "c", completados: 2, total: 5 }]).map((f) => f.uid), ["b", "c", "a"]);
  assert.deepEqual(p.ordenarGoleadores([{ uid: "a", goles: 0 }, { uid: "b", goles: 4, hecho: 9 }, { uid: "c", goles: 4, hecho: 3 }]).map((f) => f.uid), ["c", "b"]);
});

test("el progreso se une sin perder lo ganado y se acota", async () => {
  const u = await p.unirProgresoPichanga({ nivel: 3, estrellas: { 1: 3 }, actualizado: 5 }, { nivel: 9, estrellas: { 1: 1, 8: 2 }, actualizado: 2 });
  assert.equal(u.nivel, 9);
  assert.deepEqual(u.estrellas, { 1: 3, 8: 2 });
  await espera(p.unirProgresoPichanga("hola", null), "invalid-argument");
  await espera(p.unirProgresoPichanga({ vistos: Array(5000).fill("conos") }, null), "invalid-argument");
  assert.equal(await p.limpiarProgresoPichanga(null), null);
});
