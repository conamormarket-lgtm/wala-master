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

  await check("la plantilla del cupón: solo descuento o envío, con límites", () => {
    assert.deepStrictEqual(b.normalizarPlantillaCupon({ tipo: "descuento", descuentoPct: 15, topeDescuento: 20, vigenciaDias: 10 }),
      { tipo: "descuento", descuentoPct: 15, descuentoMonto: 0, topeDescuento: 20, vigenciaDias: 10 });
    assert.deepStrictEqual(b.normalizarPlantillaCupon({ tipo: "descuento", descuentoMonto: 10 }),
      { tipo: "descuento", descuentoPct: 0, descuentoMonto: 10, topeDescuento: 0, vigenciaDias: 15 });
    assert.strictEqual(b.normalizarPlantillaCupon({ tipo: "descuento", descuentoPct: 200 }).descuentoPct, b.LIMITES_CUPON.pct);
    assert.strictEqual(b.normalizarPlantillaCupon({ tipo: "descuento", descuentoMonto: 9999 }).descuentoMonto, b.LIMITES_CUPON.monto);
    assert.strictEqual(b.normalizarPlantillaCupon({ tipo: "envio_gratis", vigenciaDias: 400 }).vigenciaDias, 90);
    assert.strictEqual(b.normalizarPlantillaCupon({ tipo: "descuento" }), null, "sin valor no sirve");
    assert.strictEqual(b.normalizarPlantillaCupon({ tipo: "producto_gratis", productId: "x" }), null);
    assert.strictEqual(b.normalizarPlantillaCupon(null), null);
  });

  await check("el patrocinio: marca, cupón válido y cupo con tope", () => {
    const p = b.normalizarPatrocinio({ marcaId: "m1", marcaNombre: "Rosaditas", cupon: { tipo: "descuento", descuentoPct: 10 }, cupo: 50 });
    assert.strictEqual(p.cupo, 50);
    assert.strictEqual(p.activo, true);
    assert.strictEqual(b.normalizarPatrocinio({ marcaId: "m1", cupon: { tipo: "envio_gratis" }, cupo: 1e9 }).cupo, b.LIMITES_CUPON.cupo);
    assert.strictEqual(b.normalizarPatrocinio({ marcaId: "m1", cupon: { tipo: "envio_gratis" }, cupo: 0 }), null, "sin cupo no hay patrocinio");
    assert.strictEqual(b.normalizarPatrocinio({ cupon: { tipo: "envio_gratis" }, cupo: 5 }), null, "sin marca tampoco");
    assert.strictEqual(b.normalizarPatrocinio({ marcaId: "m1", cupon: { tipo: "descuento" }, cupo: 5 }), null);
  });

  await check("el texto del cupón dice qué y de qué marca", () => {
    assert.strictEqual(b.textoCupon({ tipo: "descuento", descuentoPct: 15, topeDescuento: 20 }, "Rosaditas"),
      "15 % de descuento en productos de Rosaditas (hasta S/ 20)");
    assert.strictEqual(b.textoCupon({ tipo: "descuento", descuentoPct: 0, descuentoMonto: 10 }, "Rosaditas"),
      "S/ 10 de descuento en productos de Rosaditas");
    assert.strictEqual(b.textoCupon({ tipo: "envio_gratis" }, null), "Envío gratis");
  });

  await check("el premio de cada puesto del ranking semanal", () => {
    const premios = [
      { desde: 1, hasta: 1, cupon: { tipo: "descuento", descuentoPct: 20 } },
      { desde: 2, hasta: 3, cupon: { tipo: "envio_gratis" } },
    ];
    assert.strictEqual(b.premioDePuesto(1, premios).descuentoPct, 20);
    assert.strictEqual(b.premioDePuesto(3, premios).tipo, "envio_gratis");
    assert.strictEqual(b.premioDePuesto(4, premios), null);
    assert.strictEqual(b.premioDePuesto(1, null), null);
  });

  await check("la semana anterior (la que se premia el lunes)", () => {
    assert.strictEqual(b.semanaAnterior("2026-10-26"), "2026-10-19");
    assert.strictEqual(b.semanaAnterior("2027-01-04"), "2026-12-28");
  });

  await check("las métricas de los jugadores: vuelven, siguen y dónde se traban", () => {
    let j = b.sumarJugador(null, "2026-10-01", 3);
    j = b.sumarJugador(j, "2026-10-01", 5);
    assert.deepStrictEqual(j, { primerDia: "2026-10-01", ultimoDia: "2026-10-01", dias: 1, nivelMax: 5 });
    j = b.sumarJugador(j, "2026-10-09", 4);
    assert.deepStrictEqual(j, { primerDia: "2026-10-01", ultimoDia: "2026-10-09", dias: 2, nivelMax: 5 });
    const m = b.metricasJugadores([
      j, // volvió y siguió 8 días; no juega hace 12 → trabado en el 5
      { primerDia: "2026-10-20", ultimoDia: "2026-10-20", dias: 1, nivelMax: 12 }, // empezó ayer
      { primerDia: "2026-10-21", ultimoDia: "2026-10-21", dias: 1, nivelMax: 2 }, // hoy: no cuenta
    ], "2026-10-21");
    assert.deepStrictEqual(m, { jugadores: 3, vuelven: { base: 2, cantidad: 1 }, siguen7: { base: 1, cantidad: 1 }, trabados: { 5: 1 } });
  });

  console.log(`bolitasLogic: ${count} pruebas OK`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
