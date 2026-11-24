/**
 * Tests UNITARIOS de functions/primeraCompraLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/primeraCompraLogic.test.js
 */
const assert = require("assert");
const p = require("../primeraCompraLogic");

let count = 0;
function check(name, fn) {
  try {
    fn();
    count += 1;
  } catch (e) {
    console.error("FALLA:", name);
    throw e;
  }
}

const HORA = p.HORA_MS;
const DIA = p.DIA_MS;
const LANZAMIENTO = Date.parse("2026-11-15T05:00:00Z");
const ts = (ms) => ({ toMillis: () => ms });
const config = p.normalizarConfig({
  activa: true,
  desde: ts(LANZAMIENTO),
  marcas: { lumi: { margenPct: 25, saldoPct: 10 }, daida: { margenPct: 20, saldoPct: 10 } },
  costos: { "lumi-serum": 45 },
});

check("config: valores por defecto y marcas", () => {
  const d = p.normalizarConfig({});
  assert.strictEqual(d.activa, false);
  assert.strictEqual(d.horas, 168);
  assert.strictEqual(d.premio, 10);
  assert.strictEqual(config.desdeMs, LANZAMIENTO);
  assert.deepStrictEqual(config.marcas.lumi, { margenPct: 25, saldoPct: 10 });
  assert.strictEqual(p.normalizarConfig({ marcas: { x: { saldoPct: 150 } } }).marcas.x.saldoPct, 100);
  assert.strictEqual(p.normalizarConfig({ costos: { a: "x", b: 3 } }).costos.a, undefined);
});

check("inicio: solo cuentas nuevas, reales y sin compras", () => {
  const base = { config, creadaMs: LANZAMIENTO + HORA };
  assert.strictEqual(p.puedeIniciarFase(base).puede, true);
  assert.strictEqual(p.puedeIniciarFase({ ...base, config: { ...config, activa: false } }).motivo, "promo_apagada");
  assert.strictEqual(p.puedeIniciarFase({ ...base, creadaMs: LANZAMIENTO - 1000 }).motivo, "cuenta_anterior");
  // La creación viene sin milisegundos: el mismo segundo del lanzamiento cuenta.
  assert.strictEqual(p.puedeIniciarFase({ ...base, creadaMs: LANZAMIENTO - 400 }).puede, true);
  assert.strictEqual(p.puedeIniciarFase({ ...base, anonima: true }).motivo, "anonima");
  assert.strictEqual(p.puedeIniciarFase({ ...base, origen: "erp_auto" }).motivo, "cliente_previo");
  assert.strictEqual(p.puedeIniciarFase({ ...base, tieneCompras: true }).motivo, "cliente_previo");
});

check("fase: 168 h exactas; en el límite ya terminó", () => {
  const inicio = LANZAMIENTO + HORA;
  const estado = { estado: "activa", venceAt: ts(p.venceDesde(inicio, config)) };
  assert.strictEqual(p.faseActiva(estado, inicio + 167 * HORA), true);
  assert.strictEqual(p.faseActiva(estado, inicio + 168 * HORA), false);
  assert.strictEqual(p.faseActiva({ ...estado, estado: "usada" }, inicio), false);
  assert.strictEqual(p.faseActiva(null, inicio), false);
});

check("fase: un pedido reservado antes del vencimiento se respeta", () => {
  const vence = LANZAMIENTO + 168 * HORA;
  const estado = { estado: "activa", venceAt: ts(vence), reserva: { intentId: "PD-1", monto: 30 } };
  assert.strictEqual(p.faseActiva(estado, vence + 5 * 60 * 1000, { intentId: "PD-1" }), true);
  assert.strictEqual(p.faseActiva(estado, vence + 5 * 60 * 1000, { intentId: "PD-2" }), false);
});

check("reinicio de monedas: protegido en la fase y 7 días después", () => {
  const vence = LANZAMIENTO + 168 * HORA;
  const activa = { estado: "activa", venceAt: ts(vence) };
  assert.strictEqual(p.protegidoDelReinicio(activa, vence - HORA, config), true);
  assert.strictEqual(p.protegidoDelReinicio(activa, vence + 6 * DIA, config), true);
  assert.strictEqual(p.protegidoDelReinicio(activa, vence + 7 * DIA, config), false);
  const usada = { estado: "usada", venceAt: ts(vence), cerradaAt: ts(vence - 3 * DIA) };
  assert.strictEqual(p.protegidoDelReinicio(usada, vence + 3 * DIA, config), true);
  assert.strictEqual(p.protegidoDelReinicio(usada, vence + 5 * DIA, config), false);
  assert.strictEqual(p.protegidoDelReinicio({ estado: "no_aplica" }, vence, config), false);
});

check("saldo: solo cuentan los premios disponibles; pendientes aparte", () => {
  const s = p.saldoDesdePremios([
    { estado: "disponible", monto: 10 }, { estado: "disponible", monto: 10 },
    { estado: "pendiente", monto: 10 }, { estado: "revertido", monto: 10 }, { estado: "no_elegible", monto: 0 },
  ]);
  assert.deepStrictEqual(s, { disponible: 20, pendiente: 10 });
});

check("tope: 100% en las propias, 10% en Lumi y Daida", () => {
  assert.strictEqual(p.topeSaldo([{ importe: 50, brandId: "propia" }], config), 50);
  assert.strictEqual(p.topeSaldo([{ importe: 80, brandId: "lumi" }], config), 8);
  assert.strictEqual(p.topeSaldo([{ importe: 50 }, { importe: 79, brandId: "lumi" }], config), 57.9);
});

check("saldo aplicable: solo productos, nunca deja el pedido en S/ 0", () => {
  // Producto de S/ 50 + S/ 15 de envío: el saldo cubre los S/ 50 y se paga el envío.
  assert.strictEqual(p.saldoAplicable({ disponible: 50, tope: 50, subtotal: 50, envio: 15, config }), 50);
  assert.strictEqual(p.totalConSaldo({ subtotal: 50, saldo: 50, envio: 15 }), 15);
  // Con más saldo que productos, sobra (y vence).
  assert.strictEqual(p.saldoAplicable({ disponible: 70, tope: 50, subtotal: 50, envio: 15, config }), 50);
  // Envío gratis (más de S/ 200) y saldo de sobra: deja S/ 1.
  assert.strictEqual(p.saldoAplicable({ disponible: 300, tope: 250, subtotal: 250, envio: 0, config }), 249);
  assert.strictEqual(p.totalConSaldo({ subtotal: 250, saldo: 249, envio: 0 }), 1);
  // El tope de la marca manda.
  assert.strictEqual(p.saldoAplicable({ disponible: 50, tope: 8, subtotal: 80, envio: 15, config }), 8);
  assert.strictEqual(p.saldoAplicable({ disponible: 0, tope: 50, subtotal: 50, envio: 15, config }), 0);
});

check("margen: costo real si existe; si no, el de la marca", () => {
  assert.ok(Math.abs(p.margenDeLinea({ importe: 50, brandId: "propia" }, config) - 0.6667) < 1e-9);
  assert.strictEqual(p.margenDeLinea({ importe: 100, brandId: "lumi" }, config), 0.25);
  // Costo 45 por unidad, 2 unidades a 79 = 158 → (158 - 90) / 158
  assert.ok(Math.abs(p.margenDeLinea({ productId: "lumi-serum", brandId: "lumi", importe: 158, cantidad: 2 }, config) - 68 / 158) < 1e-9);
});

check("premio: S/ 50 en una marca propia cumple", () => {
  const r = p.evaluarPremio({ lineas: [{ importe: 50, brandId: "propia" }], cobrado: 65, config });
  assert.strictEqual(r.elegible, true);
  assert.strictEqual(r.neto, 50);
  // 50 × 0,6667 − 65 × 4% − 5 = 33,335 − 2,6 − 5
  assert.strictEqual(r.contribucion, 25.74);
});

check("premio: S/ 50 en Lumi no alcanza; dice cuánto falta", () => {
  const r = p.evaluarPremio({ lineas: [{ importe: 50, brandId: "lumi" }], cobrado: 65, config });
  assert.strictEqual(r.elegible, false);
  assert.strictEqual(r.motivo, "margen");
  assert.ok(r.falta > 0);
  const mas = p.evaluarPremio({ lineas: [{ importe: 50 + r.falta, brandId: "lumi" }], cobrado: 65 + r.falta, config });
  assert.strictEqual(mas.elegible, true);
});

check("premio: el mínimo es en productos pagados con dinero", () => {
  const r = p.evaluarPremio({ lineas: [{ importe: 60, brandId: "propia" }], descuentos: 15, cobrado: 60, config });
  assert.strictEqual(r.elegible, false);
  assert.strictEqual(r.motivo, "minimo");
  assert.strictEqual(r.falta, 5);
});

check("premio: sin invitación o con saldo propio, nada", () => {
  const lineas = [{ importe: 80, brandId: "propia" }];
  assert.strictEqual(p.evaluarPremio({ lineas, cobrado: 95, config, esInvitacion: false }).motivo, "no_invitacion");
  assert.strictEqual(p.evaluarPremio({ lineas, cobrado: 15, config, usoSaldo: true }).motivo, "con_saldo");
  assert.ok(p.textoMotivo("minimo"));
});

console.log(`primeraCompraLogic: ${count} pruebas OK`);
