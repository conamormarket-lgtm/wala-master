/**
 * Tests UNITARIOS de la lógica pura en functions/economyLogic.js.
 * Usa SOLO 'assert' y 'crypto' de Node (sin jest/mocha, sin firebase-admin).
 * Ejecutar:  node functions/test/economyLogic.test.js
 */
const assert = require("assert");
const crypto = require("crypto");
const eco = require("../economyLogic");

// Helpers de tiempo determinista.
const DAY_MS = 24 * 60 * 60 * 1000;
// Offset Lima = UTC-5  => limaNow(now) = new Date(now - 5h).
const FIVE_H_MS = 5 * 60 * 60 * 1000;

let count = 0;
function check(name, fn) {
  fn();
  count += 1;
  // Salida por caso (silenciosa salvo debug); descomentar para verlo:
  // console.log(`  ok - ${name}`);
}

function run() {
  // ────────────────────────────────────────────────────────────────────────
  // Constantes exportadas
  // ────────────────────────────────────────────────────────────────────────
  check("constantes con valores esperados", () => {
    assert.strictEqual(eco.KAPI_MONTHLY_CAP, 31);
    assert.strictEqual(eco.BALLSORT_REWARD, 2);
    assert.strictEqual(eco.STREAK_DATES_BONUS, 25);
    assert.strictEqual(eco.SURVEY_REWARD_MAX, 15);
    assert.strictEqual(eco.REWARD_COINS_PER_ORDER, 10);
  });

  // ────────────────────────────────────────────────────────────────────────
  // limaNow
  // ────────────────────────────────────────────────────────────────────────
  check("limaNow resta 5 horas exactas", () => {
    const now = Date.UTC(2026, 5, 24, 12, 0, 0); // 2026-06-24T12:00:00Z
    const d = eco.limaNow(now);
    assert.strictEqual(d.getTime(), now - FIVE_H_MS);
    // 12:00Z -> 07:00 en hora "Lima" representada como UTC del Date desplazado.
    assert.strictEqual(d.getUTCHours(), 7);
  });

  // ────────────────────────────────────────────────────────────────────────
  // limaTodayStr — determinismo + cruce de medianoche
  // ────────────────────────────────────────────────────────────────────────
  check("limaTodayStr determinista (misma entrada, misma salida)", () => {
    const now = Date.UTC(2026, 5, 24, 18, 30, 0);
    assert.strictEqual(eco.limaTodayStr(now), eco.limaTodayStr(now));
    assert.strictEqual(eco.limaTodayStr(now), "2026-06-24");
  });

  check("limaTodayStr: justo después de medianoche UTC sigue siendo el día anterior en Lima", () => {
    // 2026-06-24T02:00:00Z  -> Lima 2026-06-23T21:00 -> "2026-06-23"
    const now = Date.UTC(2026, 5, 24, 2, 0, 0);
    assert.strictEqual(eco.limaTodayStr(now), "2026-06-23");
  });

  check("limaTodayStr: medianoche Lima = 05:00 UTC cambia de día", () => {
    // 04:59:59Z -> Lima 23:59:59 del 23 -> "2026-06-23"
    const before = Date.UTC(2026, 5, 24, 4, 59, 59);
    assert.strictEqual(eco.limaTodayStr(before), "2026-06-23");
    // 05:00:00Z -> Lima 00:00:00 del 24 -> "2026-06-24"
    const after = Date.UTC(2026, 5, 24, 5, 0, 0);
    assert.strictEqual(eco.limaTodayStr(after), "2026-06-24");
  });

  check("limaTodayStr: tarde-noche en Lima sigue siendo el mismo día UTC del cálculo", () => {
    // 2026-06-25T03:00:00Z -> Lima 2026-06-24T22:00 -> "2026-06-24"
    const now = Date.UTC(2026, 5, 25, 3, 0, 0);
    assert.strictEqual(eco.limaTodayStr(now), "2026-06-24");
  });

  // ────────────────────────────────────────────────────────────────────────
  // limaWeekStartStr — inicio de semana = LUNES
  // ────────────────────────────────────────────────────────────────────────
  // 2026-06-22 es LUNES. Verifiquémoslo con un Date puro.
  check("fixture: 2026-06-22 es lunes (sanidad del calendario)", () => {
    assert.strictEqual(new Date(Date.UTC(2026, 5, 22)).getUTCDay(), 1); // 1 = lunes
    assert.strictEqual(new Date(Date.UTC(2026, 5, 21)).getUTCDay(), 0); // 0 = domingo
  });

  check("limaWeekStartStr: un LUNES conocido devuelve ese mismo lunes", () => {
    // Lunes 2026-06-22, mediodía Lima (17:00Z) -> semana empieza 2026-06-22
    const now = Date.UTC(2026, 5, 22, 17, 0, 0);
    assert.strictEqual(eco.limaWeekStartStr(now), "2026-06-22");
  });

  check("limaWeekStartStr: un MIÉRCOLES retrocede al lunes de su semana", () => {
    // Miércoles 2026-06-24, mediodía Lima -> lunes 2026-06-22
    const now = Date.UTC(2026, 5, 24, 17, 0, 0);
    assert.strictEqual(eco.limaWeekStartStr(now), "2026-06-22");
  });

  check("limaWeekStartStr: un DOMINGO pertenece a la semana que empezó el lunes anterior", () => {
    // Domingo 2026-06-21, mediodía Lima -> lunes 2026-06-15 (no el 22).
    const now = Date.UTC(2026, 5, 21, 17, 0, 0);
    assert.strictEqual(eco.limaWeekStartStr(now), "2026-06-15");
  });

  check("limaWeekStartStr: el resultado siempre cae en lunes", () => {
    // Recorremos 14 días consecutivos y comprobamos que el inicio es lunes.
    const base = Date.UTC(2026, 5, 1, 17, 0, 0); // mediodía Lima
    for (let i = 0; i < 14; i += 1) {
      const s = eco.limaWeekStartStr(base + i * DAY_MS);
      const d = new Date(s + "T00:00:00Z");
      assert.strictEqual(d.getUTCDay(), 1, `inicio de semana no es lunes: ${s}`);
    }
  });

  check("limaWeekStartStr: cruce de medianoche Lima cambia el lunes de referencia", () => {
    // Lunes 2026-06-22 00:30 Lima = 05:30Z -> semana 2026-06-22.
    const lunesLima = Date.UTC(2026, 5, 22, 5, 30, 0);
    assert.strictEqual(eco.limaWeekStartStr(lunesLima), "2026-06-22");
    // 30 min antes: domingo 2026-06-21 23:30 Lima = 04:30Z (lunes UTC) -> semana 2026-06-15.
    const domingoLima = Date.UTC(2026, 5, 22, 4, 30, 0);
    assert.strictEqual(eco.limaWeekStartStr(domingoLima), "2026-06-15");
  });

  check("limaWeekStartStr determinista", () => {
    const now = Date.UTC(2026, 5, 24, 17, 0, 0);
    assert.strictEqual(eco.limaWeekStartStr(now), eco.limaWeekStartStr(now));
  });

  // ────────────────────────────────────────────────────────────────────────
  // applyDebit
  // ────────────────────────────────────────────────────────────────────────
  check("applyDebit: débito exacto deja saldo correcto", () => {
    const res = eco.applyDebit({ monedas: 100 }, 40);
    assert.strictEqual(res.monedas, 60);
  });

  check("applyDebit: débito mayor al saldo no baja de 0", () => {
    const res = eco.applyDebit({ monedas: 10 }, 50);
    assert.strictEqual(res.monedas, 0);
  });

  check("applyDebit: sin campo monedas trata saldo como 0", () => {
    const res = eco.applyDebit({}, 5);
    assert.strictEqual(res.monedas, 0);
    assert.deepStrictEqual(res.monedasActivas, []);
  });

  check("applyDebit: sin monedasActivas devuelve array vacío", () => {
    const res = eco.applyDebit({ monedas: 30 }, 10);
    assert.strictEqual(res.monedas, 20);
    assert.deepStrictEqual(res.monedasActivas, []);
  });

  check("applyDebit FIFO: consume el primer lote por completo y deja el resto", () => {
    const userData = {
      monedas: 30,
      monedasActivas: [
        { amount: 10, exp: "A" },
        { amount: 20, exp: "B" },
      ],
    };
    const res = eco.applyDebit(userData, 10);
    assert.strictEqual(res.monedas, 20);
    // Lote A consumido por completo (eliminado), lote B intacto.
    assert.deepStrictEqual(res.monedasActivas, [{ amount: 20, exp: "B" }]);
  });

  check("applyDebit FIFO: consume varios lotes y deja uno parcial", () => {
    const userData = {
      monedas: 60,
      monedasActivas: [
        { amount: 10, exp: "A" },
        { amount: 20, exp: "B" },
        { amount: 30, exp: "C" },
      ],
    };
    // Debitar 25: A(10) entero + 15 de B -> B queda en 5, C intacto.
    const res = eco.applyDebit(userData, 25);
    assert.strictEqual(res.monedas, 35);
    assert.deepStrictEqual(res.monedasActivas, [
      { amount: 5, exp: "B" },
      { amount: 30, exp: "C" },
    ]);
  });

  check("applyDebit: débito que agota todos los lotes deja monedasActivas vacío", () => {
    const userData = {
      monedas: 30,
      monedasActivas: [
        { amount: 10, exp: "A" },
        { amount: 20, exp: "B" },
      ],
    };
    const res = eco.applyDebit(userData, 30);
    assert.strictEqual(res.monedas, 0);
    assert.deepStrictEqual(res.monedasActivas, []);
  });

  check("applyDebit: lote parcial exacto en el primer lote", () => {
    const userData = {
      monedas: 50,
      monedasActivas: [{ amount: 50, exp: "A" }],
    };
    const res = eco.applyDebit(userData, 20);
    assert.strictEqual(res.monedas, 30);
    assert.deepStrictEqual(res.monedasActivas, [{ amount: 30, exp: "A" }]);
  });

  check("applyDebit: NO muta el input original (monedas ni monedasActivas)", () => {
    const userData = {
      monedas: 60,
      monedasActivas: [
        { amount: 10, exp: "A" },
        { amount: 20, exp: "B" },
      ],
    };
    const snapshotMonedas = userData.monedas;
    const snapshotActivas = JSON.parse(JSON.stringify(userData.monedasActivas));
    const res = eco.applyDebit(userData, 25);
    // El input permanece intacto.
    assert.strictEqual(userData.monedas, snapshotMonedas);
    assert.deepStrictEqual(userData.monedasActivas, snapshotActivas);
    // Los objetos de lote no son los mismos por referencia (se clonaron).
    assert.notStrictEqual(res.monedasActivas[0], userData.monedasActivas[0]);
  });

  // ────────────────────────────────────────────────────────────────────────
  // randomPassword
  // ────────────────────────────────────────────────────────────────────────
  check("randomPassword: longitud >= 6 en muchas llamadas", () => {
    for (let i = 0; i < 50; i += 1) {
      const pw = eco.randomPassword();
      assert.ok(pw.length >= 6, `password demasiado corta: "${pw}" (len ${pw.length})`);
    }
  });

  check("randomPassword: incluye el sufijo de variedad Aa1!", () => {
    const pw = eco.randomPassword();
    assert.ok(pw.endsWith("Aa1!"), `no termina en Aa1!: "${pw}"`);
    // Variedad: minúscula, mayúscula, dígito y símbolo presentes.
    assert.ok(/[a-z]/.test(pw), "sin minúscula");
    assert.ok(/[A-Z]/.test(pw), "sin mayúscula");
    assert.ok(/[0-9]/.test(pw), "sin dígito");
    assert.ok(/[^a-zA-Z0-9]/.test(pw), "sin símbolo");
  });

  check("randomPassword: dos llamadas producen valores distintos", () => {
    const a = eco.randomPassword();
    const b = eco.randomPassword();
    assert.notStrictEqual(a, b);
  });

  // ────────────────────────────────────────────────────────────────────────
  // pickWeightedPrize
  // rand en [0,100), selección con rand <= acc; fallback = último.
  // ────────────────────────────────────────────────────────────────────────
  const prizes = [
    { id: "p1", probability: 20 },
    { id: "p2", probability: 30 },
    { id: "p3", probability: 50 },
  ];

  check("pickWeightedPrize: lista vacía -> null", () => {
    assert.strictEqual(eco.pickWeightedPrize([], 10), null);
  });

  check("pickWeightedPrize: no-array -> null", () => {
    assert.strictEqual(eco.pickWeightedPrize(null, 10), null);
    assert.strictEqual(eco.pickWeightedPrize(undefined, 10), null);
  });

  check("pickWeightedPrize: rand=0 cae en el primer premio (0 <= 20)", () => {
    assert.strictEqual(eco.pickWeightedPrize(prizes, 0).id, "p1");
  });

  check("pickWeightedPrize: rand en el límite de la primera prob (20) sigue siendo p1", () => {
    // acc tras p1 = 20; 20 <= 20 -> p1.
    assert.strictEqual(eco.pickWeightedPrize(prizes, 20).id, "p1");
  });

  check("pickWeightedPrize: justo encima del primer límite cae en p2", () => {
    // 20.0001 > 20 -> avanza; acc tras p2 = 50; 20.0001 <= 50 -> p2.
    assert.strictEqual(eco.pickWeightedPrize(prizes, 20.0001).id, "p2");
  });

  check("pickWeightedPrize: dentro del rango de p2", () => {
    assert.strictEqual(eco.pickWeightedPrize(prizes, 35).id, "p2");
  });

  check("pickWeightedPrize: dentro del rango de p3", () => {
    assert.strictEqual(eco.pickWeightedPrize(prizes, 80).id, "p3");
  });

  check("pickWeightedPrize: rand = suma total (100) cae en el último (100 <= 100)", () => {
    assert.strictEqual(eco.pickWeightedPrize(prizes, 100).id, "p3");
  });

  check("pickWeightedPrize: rand por encima de la suma -> fallback al último", () => {
    // 999 nunca es <= acc; el bucle termina sin break -> selected = último (p3).
    assert.strictEqual(eco.pickWeightedPrize(prizes, 999).id, "p3");
  });

  check("pickWeightedPrize: probabilidades ausentes/0 -> fallback al último", () => {
    const noProb = [{ id: "x" }, { id: "y" }];
    // acc se queda en 0; rand=10 nunca <= 0 -> fallback último ("y").
    assert.strictEqual(eco.pickWeightedPrize(noProb, 10).id, "y");
    // rand=0: 0 <= 0 -> primer premio ("x").
    assert.strictEqual(eco.pickWeightedPrize(noProb, 0).id, "x");
  });

  check("pickWeightedPrize: determinista para el mismo rand", () => {
    assert.strictEqual(
      eco.pickWeightedPrize(prizes, 35).id,
      eco.pickWeightedPrize(prizes, 35).id
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // verifyWebhookSignature — HMAC-SHA256, comparación en tiempo constante
  // ────────────────────────────────────────────────────────────────────────
  const secret = "mi-secreto-super-seguro";
  const rawBody = JSON.stringify({ event: "payment", id: 123 });
  const validSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  check("verifyWebhookSignature: firma válida -> true", () => {
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, validSig, secret), true);
  });

  check("verifyWebhookSignature: firma inválida (mismo largo) -> false", () => {
    // Mutamos un carácter manteniendo la longitud (hex válido).
    const lastChar = validSig.slice(-1);
    const repl = lastChar === "0" ? "1" : "0";
    const badSig = validSig.slice(0, -1) + repl;
    assert.strictEqual(badSig.length, validSig.length);
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, badSig, secret), false);
  });

  check("verifyWebhookSignature: firma vacía -> false (sin lanzar)", () => {
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, "", secret), false);
  });

  check("verifyWebhookSignature: providedSig null/undefined -> false (sin lanzar)", () => {
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, null, secret), false);
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, undefined, secret), false);
  });

  check("verifyWebhookSignature: secret vacío -> false", () => {
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, validSig, ""), false);
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, validSig, null), false);
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, validSig, undefined), false);
  });

  check("verifyWebhookSignature: tamaños distintos -> false (sin lanzar)", () => {
    // Firma demasiado corta y demasiado larga; no debe llamar a timingSafeEqual.
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, "abc", secret), false);
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, validSig + "deadbeef", secret), false);
  });

  check("verifyWebhookSignature: body distinto invalida la firma", () => {
    const otroBody = JSON.stringify({ event: "payment", id: 124 });
    assert.strictEqual(eco.verifyWebhookSignature(otroBody, validSig, secret), false);
  });

  check("verifyWebhookSignature: secret distinto invalida la firma", () => {
    assert.strictEqual(eco.verifyWebhookSignature(rawBody, validSig, "otro-secreto"), false);
  });
}

// ── Runner ──────────────────────────────────────────────────────────────────
try {
  run();
  console.log(`PASS ${count}/${count}`);
} catch (err) {
  console.error(`FAIL tras ${count} casos OK.`);
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}
