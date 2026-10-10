/**
 * Tests UNITARIOS de functions/misPedidosLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/misPedidosLogic.test.js
 */
const assert = require("assert");
const m = require("../misPedidosLogic");

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

const cuenta = (extra = {}) => ({
  uid: "u1",
  email: "ana@gmail.com",
  emailVerificado: true,
  vinculados: new Set(),
  ...extra,
});
const pedido = (extra = {}) => ({ id: "p1", _coleccion: "pedidos", dni: "12345678", ...extra });

check("ve el pedido que compró con su cuenta", () => {
  assert.strictEqual(m.motivoDeAcceso(pedido({ buyerUid: "u1" }), cuenta()), "cuenta");
  assert.strictEqual(m.motivoDeAcceso(pedido({ userId: "u1" }), cuenta()), "cuenta");
});

check("solo coincidir por DNI NO da acceso", () => {
  assert.strictEqual(m.motivoDeAcceso(pedido(), cuenta()), null);
  assert.strictEqual(m.motivoDeAcceso(pedido({ buyerUid: "otro" }), cuenta()), null);
});

check("el correo del pedido da acceso solo si la cuenta lo verificó", () => {
  const p = pedido({ clienteCorreo: "  Ana@Gmail.com " });
  assert.strictEqual(m.motivoDeAcceso(p, cuenta()), "correo");
  assert.strictEqual(m.motivoDeAcceso(p, cuenta({ emailVerificado: false })), null);
  assert.strictEqual(m.motivoDeAcceso(pedido({ correo: "otra@gmail.com" }), cuenta()), null);
});

check("vinculado por ruta o por clave de negocio", () => {
  assert.strictEqual(
    m.motivoDeAcceso(pedido(), cuenta({ vinculados: new Set(["pedidos/p1"]) })),
    "vinculado"
  );
  const espejo = { id: "x9", _coleccion: "wala_pedidos", numeroPedido: "PD-ABC" };
  assert.strictEqual(
    m.motivoDeAcceso(espejo, cuenta({ vinculados: new Set(["clave:PD-ABC"]) })),
    "vinculado"
  );
});

check("sin uid nunca hay acceso", () => {
  assert.strictEqual(m.motivoDeAcceso(pedido({ buyerUid: undefined }), { uid: "" }), null);
  assert.strictEqual(m.motivoDeAcceso(pedido({ buyerUid: undefined, userId: undefined }), null), null);
});

check("enmascara el correo", () => {
  assert.strictEqual(m.enmascararCorreo("juan.perez@gmail.com"), "j***@gmail.com");
  assert.strictEqual(m.enmascararCorreo("sinarroba"), null);
  assert.strictEqual(m.enmascararCorreo(""), null);
});

check("el resumen pendiente no lleva datos personales", () => {
  const r = m.resumenPendiente(
    pedido({
      clienteCorreo: "ana@gmail.com",
      clienteNombreCompleto: "Ana Pérez",
      direccion: "Av. Siempre Viva 123",
      productos: [{ nombre: "Polo" }],
      montoTotal: 99,
      telefono: "987654321",
      estadoGeneral: "En Impresión",
      createdAt: { toMillis: () => 1000 },
    }),
    cuenta({ emailVerificado: false })
  );
  assert.deepStrictEqual(Object.keys(r).sort(), ["fase", "fecha", "mismoCorreo", "pistaCorreo", "ref"]);
  assert.strictEqual(r.ref, "pedidos/p1");
  assert.strictEqual(r.fase, "produccion");
  assert.strictEqual(r.fecha, 1000);
  assert.strictEqual(r.pistaCorreo, "a***@gmail.com");
  assert.strictEqual(r.mismoCorreo, true);
  assert.ok(!JSON.stringify(r).includes("Ana Pérez"));
  assert.ok(!JSON.stringify(r).includes("987654321"));
});

check("clasifica: el espejo sigue a su pedido vivo visible y no se repite en pendientes", () => {
  const vivo = pedido({ id: "v1", buyerUid: "u1", numeroPedido: "PD-1" });
  const espejoDelVivo = { id: "PD-1", _coleccion: "wala_pedidos", numeroPedido: "PD-1", dni: "12345678" };
  const ajenoVivo = pedido({ id: "v2", numeroPedido: "PD-2" });
  const ajenoEspejo = { id: "PD-2", _coleccion: "wala_pedidos", numeroPedido: "PD-2", dni: "12345678" };
  const { visibles, pendientes } = m.clasificarPedidos([vivo, espejoDelVivo, ajenoVivo, ajenoEspejo], cuenta());
  assert.deepStrictEqual(visibles.map((p) => p.id).sort(), ["PD-1", "v1"]);
  assert.strictEqual(pendientes.length, 1);
  assert.strictEqual(pendientes[0].ref, "pedidos/v2");
});

check("clasifica: pedido web aprobado por el ERP (número nuevo) no repite la copia de Walá", () => {
  const aprobado = pedido({ id: "12001", buyerUid: "u1", numeroPedido: "12001", origenPedidoWebId: "PD-9", portalPseudoOrderId: "PD-9" });
  const espejo = { id: "PD-9", _coleccion: "wala_pedidos", numeroPedido: "PD-9", pedidoWebId: "PD-9", buyerUid: "u1" };
  const otroEspejo = { id: "PD-8", _coleccion: "wala_pedidos", numeroPedido: "PD-8", buyerUid: "u1" };
  const { visibles } = m.clasificarPedidos([aprobado, espejo, otroEspejo], cuenta());
  assert.deepStrictEqual(visibles.map((p) => p.id).sort(), ["12001", "PD-8"]);
  // Si el aprobado NO se ve completo (solo coincide por DNI), la copia se queda.
  const ajeno = pedido({ id: "12002", numeroPedido: "12002", origenPedidoWebId: "PD-7" });
  const espejo7 = { id: "PD-7", _coleccion: "wala_pedidos", numeroPedido: "PD-7", buyerUid: "u1" };
  assert.deepStrictEqual(m.clasificarPedidos([ajeno, espejo7], cuenta()).visibles.map((p) => p.id), ["PD-7"]);
});

check("pendientes ordenados del más reciente al más antiguo", () => {
  const { pendientes } = m.clasificarPedidos(
    [
      pedido({ id: "a", numeroPedido: "A", createdAt: { toMillis: () => 10 } }),
      pedido({ id: "b", numeroPedido: "B", createdAt: { toMillis: () => 30 } }),
      pedido({ id: "c", numeroPedido: "C", createdAt: { toMillis: () => 20 } }),
    ],
    cuenta()
  );
  assert.deepStrictEqual(pendientes.map((p) => p.ref), ["pedidos/b", "pedidos/c", "pedidos/a"]);
});

check("prueba de vínculo: número de pedido Y teléfono", () => {
  const p = pedido({ numeroPedido: "PD-K3X9", clienteContacto: "+51 987 654 321" });
  assert.strictEqual(m.pruebaDeVinculo(p, { numeroPedido: "#pd-k3x9", telefono: "987654321" }), true);
  assert.strictEqual(m.pruebaDeVinculo(p, { numeroPedido: "PD-K3X9", telefono: "51987654321" }), true);
  assert.strictEqual(m.pruebaDeVinculo(p, { numeroPedido: "PD-K3X9", telefono: "987654000" }), false);
  assert.strictEqual(m.pruebaDeVinculo(p, { numeroPedido: "PD-OTRO", telefono: "987654321" }), false);
  assert.strictEqual(m.pruebaDeVinculo(p, { numeroPedido: "PD-K3X9" }), false);
  assert.strictEqual(m.pruebaDeVinculo(p, { telefono: "987654321" }), false);
  assert.strictEqual(m.pruebaDeVinculo(pedido({ numeroPedido: "PD-K3X9" }), { numeroPedido: "PD-K3X9", telefono: "987654321" }), false);
});

check("serializa fechas y quita funciones", () => {
  const ts = { toMillis: () => 1234, seconds: 1 };
  const out = m.serializarParaCliente({ a: ts, b: [{ c: ts }], d: () => 1, e: "x", f: null, g: new Date(5) });
  assert.deepStrictEqual(out, { a: { __ts: 1234 }, b: [{ c: { __ts: 1234 } }], e: "x", f: null, g: { __ts: 5 } });
});

check("limita los intentos de vínculo por hora", () => {
  let estado = null;
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) {
    const r = m.evaluarIntentos(estado, t0 + i);
    assert.strictEqual(r.permitido, true);
    estado = r.siguiente;
  }
  const bloqueado = m.evaluarIntentos(estado, t0 + 10);
  assert.strictEqual(bloqueado.permitido, false);
  assert.ok(bloqueado.esperaMs > 0);
  const despues = m.evaluarIntentos(estado, t0 + 60 * 60 * 1000);
  assert.strictEqual(despues.permitido, true);
  assert.strictEqual(despues.siguiente.n, 1);
});

console.log(`misPedidosLogic: ${count} tests OK`);
