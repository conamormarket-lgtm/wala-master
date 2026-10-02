/**
 * Tests UNITARIOS de functions/fechasLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/fechasLogic.test.js
 */
const assert = require("assert");
const f = require("../fechasLogic");

const persona = (name, events) => ({ id: name, name, events });
const ev = (id, date, extra = {}) => ({ id, type: "Cumpleaños", date, ...extra });

let count = 0;
function check(name, fn) { fn(); count += 1; }

check("paga 5 por fecha nueva válida", () => {
  const r = f.calcularRecompensaFechas({
    giftRecipients: [persona("Ana", [ev("a1", "1990-05-10"), ev("a2", "2015-02-14")])],
  });
  assert.strictEqual(r.reward, 10);
  assert.deepStrictEqual(r.rewardedIds, ["a1", "a2"]);
  assert.strictEqual(r.total, 10);
});

check("no paga dos veces la misma fecha", () => {
  const r = f.calcularRecompensaFechas({
    giftRecipients: [persona("Ana", [ev("a1", "1990-05-10"), ev("a2", "2015-02-14")])],
    datesRewardedIds: ["a1"],
    datesRewardTotal: 5,
  });
  assert.strictEqual(r.reward, 5);
  assert.strictEqual(r.total, 10);
});

check("ignora fechas vacías, mal formadas y personas sin nombre", () => {
  const r = f.calcularRecompensaFechas({
    giftRecipients: [
      persona("Ana", [ev("a1", ""), ev("a2", "10/05/1990"), ev("a3", "1990-13-01")]),
      persona("  ", [ev("b1", "1990-05-10")]),
    ],
  });
  assert.strictEqual(r.reward, 0);
});

check("respeta el tope de por vida", () => {
  const events = Array.from({ length: 20 }, (_, i) => ev(`e${i}`, "2000-01-01"));
  const r = f.calcularRecompensaFechas({ giftRecipients: [persona("Ana", events)] });
  assert.strictEqual(r.reward, f.DATES_REWARD_CAP);
  const r2 = f.calcularRecompensaFechas({
    giftRecipients: [persona("Ana", events)],
    datesRewardedIds: r.rewardedIds,
    datesRewardTotal: r.total,
  });
  assert.strictEqual(r2.reward, 0);
});

check("borrar y recrear no salta el tope", () => {
  const r = f.calcularRecompensaFechas({
    giftRecipients: [persona("Ana", [ev("nuevo", "2000-01-01")])],
    datesRewardedIds: ["viejo"],
    datesRewardTotal: f.DATES_REWARD_CAP,
  });
  assert.strictEqual(r.reward, 0);
});

check("usuario de la encuesta vieja: sus 3 primeras fechas ya están pagadas", () => {
  const events = [1, 2, 3, 4, 5].map((i) => ev(`e${i}`, "2000-01-01"));
  const r = f.calcularRecompensaFechas({
    giftRecipients: [persona("Ana", events)],
    surveyRewardClaimed: true,
  });
  assert.strictEqual(r.reward, 10);
  assert.strictEqual(r.total, 25);
});

check("si datesRewardedIds ya existe, no aplica la regla vieja", () => {
  const r = f.calcularRecompensaFechas({
    giftRecipients: [persona("Ana", [ev("e1", "2000-01-01")])],
    surveyRewardClaimed: true,
    datesRewardedIds: [],
  });
  assert.strictEqual(r.reward, 5);
});

check("diasHastaProxima", () => {
  assert.strictEqual(f.diasHastaProxima("1990-10-09", "2026-10-02"), 7);
  assert.strictEqual(f.diasHastaProxima("1990-10-02", "2026-10-02"), 0);
  assert.strictEqual(f.diasHastaProxima("1990-10-01", "2026-10-02"), 364);
  assert.strictEqual(f.diasHastaProxima("2000-01-01", "2026-12-31"), 1);
  // 29-feb en año no bisiesto cae el 28.
  assert.strictEqual(f.diasHastaProxima("2000-02-29", "2027-02-27"), 1);
  assert.strictEqual(f.diasHastaProxima("basura", "2026-10-02"), null);
});

check("recordatoriosDeHoy avisa a 7 y 1 día, y no repite", () => {
  const recs = [persona("Ana", [
    ev("a1", "1990-10-09"),
    ev("a2", "2010-10-03", { type: "Fecha Especial", customName: "Graduación" }),
    ev("a3", "2010-10-20"),
  ])];
  const hoy = "2026-10-02";
  const r = f.recordatoriosDeHoy(recs, hoy, {});
  assert.deepStrictEqual(r.map((x) => x.key), ["a1|2026|7", "a2|2026|1"]);
  assert.ok(r[1].titulo.includes("Graduación"));
  assert.ok(r[1].titulo.includes("mañana"));
  const r2 = f.recordatoriosDeHoy(recs, hoy, { "a1|2026|7": true });
  assert.deepStrictEqual(r2.map((x) => x.key), ["a2|2026|1"]);
});

console.log(`fechasLogic: ${count} casos OK`);
