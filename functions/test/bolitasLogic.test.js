/**
 * Tests UNITARIOS de functions/bolitasLogic.js (Las Bolitas de Kapi).
 * Usa SOLO 'assert' de Node (sin firebase-admin).
 * Ejecutar:  node functions/test/bolitasLogic.test.js
 *
 * Lo que se protege: el servidor solo acepta partidas que resuelven el nivel
 * de verdad (con el mismo motor que el celular), el reto solo el día que toca,
 * el ranking no muestra correos ni apellidos completos y ordena bien.
 */
const assert = require("assert");
const b = require("../bolitasLogic");

let count = 0;
async function check(name, fn) {
  try {
    await fn();
  } catch (e) {
    console.error("✖ " + name);
    throw e;
  }
  count += 1;
}

const HOY = "2026-10-21";

async function run() {
  const motor = await import("../bolitasMotor.mjs");

  await check("una partida que resuelve el nivel pasa", async () => {
    const lv = motor.nivel(12);
    const r = await b.comprobarPartidaBolitas({ modo: "nivel", nivel: 12, movimientos: lv.solucion }, HOY);
    assert.deepStrictEqual(r, { modo: "nivel", nivel: 12, movimientos: lv.solucion.length, tubos: 0 });
  });

  await check("el reto solo vale el día que toca", async () => {
    const reto = motor.retoDelDia(HOY);
    const r = await b.comprobarPartidaBolitas({ modo: "reto", fecha: HOY, movimientos: reto.solucion }, HOY);
    assert.strictEqual(r.fecha, HOY);
    await assert.rejects(
      b.comprobarPartidaBolitas({ modo: "reto", fecha: "2026-10-20", movimientos: motor.retoDelDia("2026-10-20").solucion }, HOY),
      (e) => e.codigo === "failed-precondition"
    );
  });

  await check("las trampas y los datos mal armados no pasan", async () => {
    const lv = motor.nivel(12);
    const casos = [
      [{ modo: "nivel", nivel: 12, movimientos: lv.solucion.slice(0, -1) }, "failed-precondition"],
      [{ modo: "nivel", nivel: 13, movimientos: lv.solucion }, "failed-precondition"],
      [{ modo: "nivel", nivel: 0, movimientos: lv.solucion }, "invalid-argument"],
      [{ modo: "nivel", nivel: "12", movimientos: lv.solucion }, "invalid-argument"],
      [{ modo: "nivel", nivel: 12, movimientos: "todo" }, "invalid-argument"],
      [{ modo: "nivel", nivel: 12, movimientos: lv.solucion, tubos: 99 }, "invalid-argument"],
      [{ modo: "reto", movimientos: lv.solucion }, "invalid-argument"],
      [{ movimientos: lv.solucion }, "invalid-argument"],
      [null, "invalid-argument"],
    ];
    for (const [data, codigo] of casos) {
      await assert.rejects(b.comprobarPartidaBolitas(data, HOY), (e) => e.codigo === codigo, JSON.stringify(data).slice(0, 60));
    }
  });

  await check("la semana es la del motor (el lunes)", async () => {
    assert.strictEqual(await b.semanaBolitas(HOY), "2026-10-19");
  });

  await check("nombrePublico: nombre e inicial, nunca el correo", () => {
    assert.strictEqual(b.nombrePublico({ displayName: "lucía ramos pérez" }), "Lucía R.");
    assert.strictEqual(b.nombrePublico({ nombres: "Diego", apellidos: "Paredes" }), "Diego P.");
    assert.strictEqual(b.nombrePublico({ displayName: "Camila" }), "Camila");
    assert.strictEqual(b.nombrePublico({ displayName: "ana@correo.com" }), null);
    assert.strictEqual(b.nombrePublico({ displayName: "ana@correo.com", nombre: "Ana Torres" }), "Ana T.");
    assert.strictEqual(b.nombrePublico({}), null);
    assert.strictEqual(b.nombrePublico(null), null);
  });

  await check("el ranking del día: menos movimientos y, empatados, quien llegó antes", () => {
    const r = b.ordenarRankingDia([
      { uid: "a", movimientos: 40, hecho: 3 },
      { uid: "b", movimientos: 35, hecho: 9 },
      { uid: "c", movimientos: 35, hecho: 2 },
    ]);
    assert.deepStrictEqual(r.map((f) => f.uid), ["c", "b", "a"]);
  });

  await check("la semana: más retos y, empatados, menos movimientos en total", () => {
    const r = b.ordenarRankingSemana([
      { uid: "a", completados: 3, total: 120 },
      { uid: "b", completados: 4, total: 200 },
      { uid: "c", completados: 3, total: 100 },
    ]);
    assert.deepStrictEqual(r.map((f) => f.uid), ["b", "c", "a"]);
  });

  await check("sumar un reto a la semana guarda el mejor de cada día", () => {
    let s = b.sumarRetoASemana(null, "2026-10-19", 40);
    s = b.sumarRetoASemana(s, "2026-10-20", 30);
    s = b.sumarRetoASemana(s, "2026-10-20", 35);
    s = b.sumarRetoASemana(s, "2026-10-20", 28);
    assert.deepStrictEqual(s, { dias: { "2026-10-19": 40, "2026-10-20": 28 }, completados: 2, total: 68 });
  });

  console.log(`bolitasLogic: ${count} pruebas OK`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
