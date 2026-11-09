// Lógica pura de "Borrar mi cuenta" (functions/eliminarCuentaLogic.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../eliminarCuentaLogic");

const url = (ruta) => `https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/${encodeURIComponent(ruta)}?alt=media&token=t`;

test("solo valen { revisar: true } o { confirmar: true }", () => {
  assert.equal(L.tipoDeSolicitud({ revisar: true }), "revisar");
  assert.equal(L.tipoDeSolicitud({ confirmar: true }), "confirmar");
  for (const malo of [null, undefined, {}, [], "revisar", { revisar: "si" }, { confirmar: 1 },
    { revisar: true, confirmar: true }, { confirmar: true, origen: "app" }, { revisar: false }]) {
    assert.equal(L.tipoDeSolicitud(malo), null, JSON.stringify(malo));
  }
});

test("la sesión anónima no es una cuenta", () => {
  assert.equal(L.esSesionAnonima({ firebase: { sign_in_provider: "anonymous" } }), true);
  assert.equal(L.esSesionAnonima({ firebase: { sign_in_provider: "password" } }), false);
  assert.equal(L.esSesionAnonima({}), false);
});

test("hay que haber entrado hace menos de 5 minutos", () => {
  const ahora = 1_800_000_000_000;
  const s = (msAtras) => ({ auth_time: Math.floor((ahora - msAtras) / 1000) });
  assert.equal(L.sesionReciente(s(60 * 1000), ahora), true);
  assert.equal(L.sesionReciente(s(4 * 60 * 1000 + 59 * 1000), ahora), true);
  assert.equal(L.sesionReciente(s(5 * 60 * 1000 + 2000), ahora), false);
  assert.equal(L.sesionReciente({}, ahora), false);
  assert.equal(L.sesionReciente(null, ahora), false);
});

test("el origen sale del Origin: la app no lo manda (o es localhost), la web sí", () => {
  assert.equal(L.origenDeLlamada({}), "app");
  assert.equal(L.origenDeLlamada(undefined), "app");
  assert.equal(L.origenDeLlamada({ origin: "https://localhost" }), "app");
  assert.equal(L.origenDeLlamada({ origin: "capacitor://localhost" }), "app");
  assert.equal(L.origenDeLlamada({ origin: "https://wala.pe" }), "web");
});

test("el registro usa un HMAC con sal: nunca el uid en claro y estable para reintentar", () => {
  const a = L.hashDeCuenta("uid-123", "sal");
  assert.equal(a, L.hashDeCuenta("uid-123", "sal"));
  assert.notEqual(a, L.hashDeCuenta("uid-123", "otra"));
  assert.ok(!a.includes("uid-123"));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.throws(() => L.hashDeCuenta("uid", ""));
});

test("un pedido sin entregar ni anular es pendiente; uno entregado o anulado no", () => {
  const pend = L.pendientesDePedidos([
    { _coleccion: "pedidos", id: "a1", numeroPedido: "1234", estadoGeneral: "En Diseño", montoTotal: 50, montoAdelanto: 50 },
    { _coleccion: "pedidos", id: "a2", numeroPedido: "1235", estadoGeneral: "Finalizado", montoTotal: 80, montoAdelanto: 80 },
    { _coleccion: "pedidos", id: "a3", numeroPedido: "1236", estadoGeneral: "Anulado", montoTotal: 80 },
    { _coleccion: "pedidos", id: "a4", numeroPedido: "1237", estadoGeneral: "En Reparto", deletedAt: 5, montoTotal: 80 },
    { _coleccion: "wala_pedidos", id: "WEB-9", numeroPedido: "WEB-9", estadoWala: "entregado" },
    { _coleccion: "wala_pedidos", id: "WEB-8", numeroPedido: "WEB-8", estadoWala: "cancelado" },
    { _coleccion: "pedidos_web", id: "WEB-7", numeroPedido: "WEB-7" },
  ]);
  assert.deepEqual(pend, [
    { tipo: "pedido", texto: "Tu pedido #1234 todavía no se entrega." },
    { tipo: "pedido", texto: "Tu pedido #WEB-7 todavía no se entrega." },
  ]);
});

test("el saldo por pagar es el del ERP, aunque el pedido ya se entregó", () => {
  const pend = L.pendientesDePedidos([
    { _coleccion: "pedidos", id: "x", numeroPedido: "1234", estadoGeneral: "Finalizado", montoTotal: 100, montoAdelanto: 55 },
    { _coleccion: "pedidos", id: "y", numeroPedido: "1300", estadoGeneral: "Anulado", montoTotal: 100, montoAdelanto: 0 },
  ]);
  assert.deepEqual(pend, [{ tipo: "saldo", texto: "El pedido #1234 tiene un saldo de S/ 45.00 por pagar." }]);
});

test("el pedido aprobado manda sobre su copia web (otro número): no se repite ni lo bloquea la copia", () => {
  const pend = L.pendientesDePedidos([
    { _coleccion: "wala_pedidos", id: "WEB-1", numeroPedido: "WEB-1", estadoWala: "pagado" },
    { _coleccion: "pedidos", id: "erp1", numeroPedido: "5555", origenPedidoWebId: "WEB-1", estadoGeneral: "Finalizado", montoTotal: 10, montoAdelanto: 10 },
  ]);
  assert.deepEqual(pend, []);
  assert.equal(L.agruparPedidos([
    { _coleccion: "wala_pedidos", id: "WEB-2", numeroPedido: "WEB-2" },
    { _coleccion: "pedidos_web", id: "WEB-2", numeroPedido: "WEB-2" },
  ]).length, 1);
});

test("suscripción activa, pago en proceso y cuenta del equipo bloquean", () => {
  assert.deepEqual(L.pendientesDeSuscripciones([{ estado: "cancelado" }, { estado: "vencido" }]), []);
  assert.deepEqual(L.pendientesDeSuscripciones([{ estado: "activo" }, { estado: "activo" }]),
    [{ tipo: "suscripcion", texto: "Tienes activa la suscripción al sorteo. Cancélala antes de borrar tu cuenta." }]);

  const ahora = 1_800_000_000_000;
  assert.equal(L.pendientesDePagos({ intenciones: [{ status: "cobrando", cobroIniciadoAt: ahora - 60 * 1000 }] }, ahora)[0].tipo, "pedido");
  assert.deepEqual(L.pendientesDePagos({ intenciones: [{ status: "cobrando", cobroIniciadoAt: ahora - 11 * 60 * 1000 }] }, ahora), []);
  assert.deepEqual(L.pendientesDePagos({ cobros: [{ status: "libre" }] }, ahora), []);

  assert.equal(L.pendienteDeAdmin({ claimAdmin: true })[0].tipo, "admin");
  assert.equal(L.pendienteDeAdmin({ adminUser: true }).length, 1);
  assert.equal(L.pendienteDeAdmin({ permisosPanel: ["catalogo"] }).length, 1);
  assert.deepEqual(L.pendienteDeAdmin({ permisosPanel: [] }), []);
});

test("intenciones y tickets: se borra lo que no es registro de un cobro", () => {
  for (const s of ["prepared", "reemplazada", "vencida"]) assert.equal(L.intencionBorrable({ status: s }), true);
  for (const s of ["paid_order_created", "cobrando", undefined]) assert.equal(L.intencionBorrable({ status: s }), false);
  assert.equal(L.ticketBorrable({ pagoConfirmado: false }), true);
  assert.equal(L.ticketBorrable({}), true);
  assert.equal(L.ticketBorrable({ pagoConfirmado: true }), false);
});

test("referidos: lo mío se borra; de otros se quita solo mi rastro", () => {
  const B = L.BORRAR_CAMPO;
  assert.deepEqual(L.accionReferido({ referrerCode: "ANA1", status: "clicked", visitanteUid: "otro" }, "yo", "ANA1"), { tipo: "borrar" });
  assert.deepEqual(L.accionReferido({ referrerCode: "ANA1", invitadoUid: "otro" }, "yo", "ANA1"),
    { tipo: "actualizar", cambios: { referrerCode: B, linkId: B, referenteEliminado: true } });
  assert.deepEqual(L.accionReferido({ referrerCode: "LUIS", visitanteUid: "yo", visitanteNombre: "Ana" }, "yo", "ANA1"),
    { tipo: "actualizar", cambios: { visitanteUid: B, visitanteNombre: B, visitanteEliminado: true } });
  assert.deepEqual(L.accionReferido({ referrerCode: "LUIS", invitadoUid: "yo", visitanteUid: "yo" }, "yo", "ANA1"),
    { tipo: "actualizar", cambios: { visitanteUid: B, visitanteNombre: B, invitadoUid: B, visitanteEliminado: true } });
  assert.deepEqual(L.accionReferido({ referrerCode: "LUIS", invitacionRechazada: { uid: "yo" } }, "yo", ""),
    { tipo: "actualizar", cambios: { invitacionRechazada: B, visitanteEliminado: true } });
  assert.equal(L.accionReferido({ referrerCode: "LUIS", visitanteUid: "otro" }, "yo", "ANA1"), null);
  // Sin código propio, un doc ajeno con referrerCode vacío no se toma por mío.
  assert.equal(L.accionReferido({ referrerCode: "" }, "yo", ""), null);
});

test("archivos: carpetas propias, fotos de opiniones y los que un pedido nombra quedan protegidos", () => {
  assert.deepEqual(L.carpetasDeCuenta("u1"), ["users/u1/", "gift_recipients/u1/", "designs/u1/"]);
  const pedidos = [{ productos: { a: { urlImagenPersonalizada: url("designs/u1/crear/archivos/1.png") } },
    otro: [url("designs/u2/x.png"), url("pedidos/P1/archivos/1.png")], createdAt: { toMillis: () => 1 } }];
  assert.deepEqual([...L.rutasProtegidas(pedidos, "u1")], ["designs/u1/crear/archivos/1.png"]);
  assert.deepEqual(L.archivosDeOpinion({ imageUrls: [url("product_reviews/p1/1_a.jpg"), url("users/otro/a.jpg"), "https://x.com/a.jpg"] }),
    ["product_reviews/p1/1_a.jpg"]);
  assert.equal(L.rutaPropia(url("users/u1/../u2/a.jpg"), ["users/u1/"]), null);
});

test("el inventario no borra nada que la ley pide conservar", () => {
  const borra = new Set(L.BORRAR.map((b) => b.coleccion));
  for (const c of ["pedidos", "pedidos_web", "wala_pedidos", "orders", "subOrders", "suscripcionCharges", "libro_reclamaciones",
    "culqiCharges", "paypal_ordenes", "cobros_en_curso", "pagos_anomalias", "enlaces_pago", "fp_transactions", "payouts"]) {
    assert.equal(borra.has(c), false, c);
  }
  // Toda entrada dice por qué y cómo encontrar los docs.
  for (const b of L.BORRAR) {
    assert.ok(b.porque, b.coleccion);
    assert.ok(Boolean(b.doc) !== Boolean(b.campo), b.coleccion);
  }
  // Las intenciones solo con filtro (las cobradas se quedan).
  assert.equal(L.BORRAR.find((b) => b.coleccion === "checkout_payment_intents").filtro, L.intencionBorrable);
});

test("el registro de auditoría lleva solo números y el origen", () => {
  assert.deepEqual(L.resumenAuditoria({ origen: "web", borrados: { designs: 3, wishlists: 0, x: "2" }, archivos: 4, culqiPendiente: 1 }),
    { origen: "web", borrados: { designs: 3, x: 2 }, archivos: 4, culqiPendiente: true });
  assert.equal(L.resumenAuditoria({ origen: "otra cosa" }).origen, "app");
});
