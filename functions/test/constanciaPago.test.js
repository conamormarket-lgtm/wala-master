"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../constanciaPago");
const erp = require("../erpCobranzaLogic");

test("medio de un cargo de Culqi: tarjeta con marca y últimos 4", () => {
  assert.deepEqual(
    c.medioDeCargoCulqi({ source: { id: "tkn_live_x", card_number: "411111******1111", iin: { card_brand: "Visa" } } }, "tkn_live_x"),
    { tipo: "tarjeta", marca: "Visa", ultimos: "1111" });
  // Sin datos de la tarjeta no se inventa nada.
  assert.deepEqual(c.medioDeCargoCulqi({}, "tkn_live_x"), { tipo: "tarjeta" });
});

test("medio de un cargo de Culqi: Yape por el token o por la fuente", () => {
  assert.deepEqual(c.medioDeCargoCulqi({ source: {} }, "ype_live_abc"), { tipo: "yape" });
  assert.deepEqual(c.medioDeCargoCulqi({ source: { id: "ype_test_1" } }), { tipo: "yape" });
  assert.deepEqual(c.medioDeCargoCulqi({ source: { type: "YAPE" } }), { tipo: "yape" });
});

test("texto del medio", () => {
  assert.equal(c.textoMedio("culqi", { tipo: "tarjeta", marca: "Visa", ultimos: "1111" }), "Visa •••• 1111");
  assert.equal(c.textoMedio("culqi", { tipo: "tarjeta" }), "Tarjeta");
  assert.equal(c.textoMedio("culqi", { tipo: "yape" }), "Yape");
  assert.equal(c.textoMedio("paypal", null), "PayPal");
});

test("fecha y hora de Lima", () => {
  assert.equal(c.fechaHoraLima(new Date("2026-10-23T22:35:00Z")), "23/10/2026, 17:35");
  assert.equal(c.fechaHoraLima("2026-10-01T03:10:00.000Z"), "30/09/2026, 22:10");
  assert.equal(c.fechaHoraLima("no es fecha"), "");
});

test("datos de la constancia: concepto, montos y pasarela", () => {
  const d = c.datosConstancia({
    numeroPedido: "012345", clienteNombre: " Ana ", montoPen: 120, metodo: "culqi",
    medio: { tipo: "yape" }, pagoId: "chr_live_1", fecha: new Date("2026-10-23T22:35:00Z"), sourceType: "restante",
  });
  assert.deepEqual(d, {
    pedido: "#012345", concepto: "Pago del saldo pendiente", monto: "S/ 120.00", montoUsd: null, cliente: "Ana",
    medio: "Yape", fecha: "23/10/2026, 17:35", operacion: "chr_live_1", pasarela: "Culqi",
  });
  const p = c.datosConstancia({ numeroPedido: "#9", montoPen: 85.5, montoUsd: 23.1, metodo: "paypal", pagoId: "8AB", fecha: new Date(), sourceType: "abono" });
  assert.equal(p.pedido, "#9");
  assert.equal(p.concepto, "Abono al saldo pendiente");
  assert.equal(p.montoUsd, "US$ 23.10");
  assert.equal(p.pasarela, "PayPal");
});

test("el SVG escapa lo que viene del pedido", () => {
  const svg = c.svgConstancia(c.datosConstancia({
    numeroPedido: "1", clienteNombre: "<script>&\"x\"", montoPen: 1, metodo: "culqi", pagoId: "chr", fecha: new Date(),
  }));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;&amp;&quot;x&quot;"));
});

test("la constancia sale como PNG", () => {
  const png = c.pngDeSvg(c.svgConstancia(c.datosConstancia({
    numeroPedido: "012345", clienteNombre: "Ana", montoPen: 120, metodo: "culqi",
    medio: { tipo: "tarjeta", marca: "Visa", ultimos: "1111" }, pagoId: "chr_live_1", fecha: new Date(), sourceType: "restante",
  })));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length > 20000);
});

test("ruta fija por cobro, en la carpeta de comprobantes del pedido", () => {
  assert.equal(c.rutaConstancia("012345", "culqi", "chr_live_Ab/1"), "comprobantes_pago/012345/constancia_culqi_chr_live_Ab_1.png");
});

test("id del movimiento: el mismo de siempre para el mismo cobro", () => {
  const a = erp.txIdPagoOnline("pedidos", "012345", "culqi", "chr_1");
  assert.match(a, /^cobro_[0-9a-f]{64}$/);
  assert.equal(a, erp.txIdPagoOnline("pedidos", "012345", "culqi", "chr_1"));
  // El que ya usaban los movimientos registrados (antes vivía en index.js).
  const huella = JSON.stringify(["pedidos", "012345", "pasarela", "culqi", "chr_1"]);
  assert.equal(a, `cobro_${require("crypto").createHash("sha256").update(huella).digest("hex")}`);
  assert.notEqual(a, erp.txIdPagoOnline("pedidos", "012345", "culqi", "chr_2"));
});

test("el pago online guarda el medio en la pasarela y lo nombra en el historial", () => {
  const pedido = { numeroPedido: "1", montoTotal: 100, montoAdelanto: 20, cobranza: {}, tipoEnvio: "agencia" };
  const r = erp.planificarPagoOnline(pedido, {
    pedidoId: "1", coleccion: "pedidos", montoPagado: 80, metodo: "culqi", medio: { tipo: "yape" }, pagoId: "chr_1",
    txId: "cobro_x", accountId: null, autoHabilitar: true, now: new Date("2026-10-23T22:35:00Z"),
  });
  assert.deepEqual(r.movimiento.pasarela, { metodo: "culqi", id: "chr_1", medio: "yape" });
  assert.match(r.updates.historialModificaciones.at(-1).detalle, /Yape vía Culqi chr_1/);
  // Sin medio, la pasarela queda como antes (sin campos undefined).
  const s = erp.planificarPagoOnline(pedido, {
    pedidoId: "1", coleccion: "pedidos", montoPagado: 80, metodo: "culqi", pagoId: "chr_1",
    txId: "cobro_x", accountId: null, autoHabilitar: true,
  });
  assert.deepEqual(s.movimiento.pasarela, { metodo: "culqi", id: "chr_1" });
});

// ── asegurarConstancia con una base y un Storage en memoria ──────────────────
function baseFalsa(docs) {
  const datos = new Map(Object.entries(docs));
  const ref = (ruta) => ({
    ruta,
    get: async () => ({ exists: datos.has(ruta), data: () => structuredClone(datos.get(ruta)) }),
  });
  const aplicarUpdate = (ruta, campos) => {
    const actual = structuredClone(datos.get(ruta));
    for (const [k, v] of Object.entries(campos)) {
      const partes = k.split(".");
      let o = actual;
      partes.slice(0, -1).forEach((p) => { o[p] = o[p] || {}; o = o[p]; });
      o[partes.at(-1)] = v;
    }
    datos.set(ruta, actual);
  };
  return {
    datos,
    collection: (c) => ({ doc: (id) => ref(`${c}/${id}`) }),
    runTransaction: async (fn) => fn({
      get: (r) => r.get(),
      update: (r, campos) => aplicarUpdate(r.ruta, campos),
      set: (r, valor) => datos.set(r.ruta, valor),
    }),
  };
}

function bucketFalso() {
  const archivos = new Map();
  return {
    name: "sistema-gestion-3b225.firebasestorage.app",
    archivos,
    file: (ruta) => ({
      save: async (bytes, opciones) => {
        if (archivos.has(ruta)) throw Object.assign(new Error("existe"), { code: 412 });
        archivos.set(ruta, { bytes, meta: opciones.metadata.metadata });
      },
      getMetadata: async () => [{ metadata: archivos.get(ruta).meta }],
      download: async () => [archivos.get(ruta).bytes],
    }),
  };
}

const FieldValueFalso = { serverTimestamp: () => "AHORA" };

test("asegurarConstancia: pega la imagen en el pago del pedido y en el movimiento", async () => {
  const txId = erp.txIdPagoOnline("pedidos", "P1", "culqi", "chr_1");
  const db = baseFalsa({
    [`fp_transactions/${txId}`]: { amount: 80, sourceType: "restante", createdAt: "2026-10-23T22:35:00.000Z" },
    "pedidos/P1": {
      numeroPedido: "012345", clienteNombre: "Ana",
      cobranza: { historialPagos: [{ monto: 20 }, { monto: 80, paymentId: txId, timestamp: "2026-10-23T22:35:00.000Z" }] },
    },
  });
  const bucket = bucketFalso();
  const pago = { metodo: "culqi", id: "chr_1", montoPen: 80, medio: { tipo: "yape" } };
  const url = await c.asegurarConstancia({ db, bucket, FieldValue: FieldValueFalso, coleccion: "pedidos", pedidoId: "P1", pago, txId });

  const ruta = "comprobantes_pago/012345/constancia_culqi_chr_1.png";
  assert.ok(url.startsWith(`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=`));
  const mov = db.datos.get(`fp_transactions/${txId}`);
  assert.equal(mov.comprobanteUrl, url);
  assert.equal(mov.comprobantePath, ruta);
  assert.equal(mov.comprobanteHashes.length, 1);
  const [otro, pago2] = db.datos.get("pedidos/P1").cobranza.historialPagos;
  assert.deepEqual(otro, { monto: 20 }); // los demás pagos no se tocan
  assert.equal(pago2.comprobanteUrl, url);
  assert.deepEqual(pago2.comprobanteHashes, mov.comprobanteHashes);
  assert.equal([...db.datos.keys()].filter((k) => k.startsWith("cobranzaPaymentKeys/")).length, 1);

  // Segunda vez (el webhook): no sube otra ni cambia nada.
  const otraVez = await c.asegurarConstancia({ db, bucket, FieldValue: FieldValueFalso, coleccion: "pedidos", pedidoId: "P1", pago, txId });
  assert.equal(otraVez, url);
  assert.equal(bucket.archivos.size, 1);
});

test("asegurarConstancia: si otro ya subió la imagen, usa esa y su token", async () => {
  const txId = erp.txIdPagoOnline("pedidos", "P2", "paypal", "CAP1");
  const db = baseFalsa({
    [`fp_transactions/${txId}`]: { amount: 50, sourceType: "abono" },
    "pedidos/P2": { numeroPedido: "7", cobranza: { historialPagos: [{ monto: 50, paymentId: txId }] } },
  });
  const bucket = bucketFalso();
  bucket.archivos.set("comprobantes_pago/7/constancia_paypal_CAP1.png", { bytes: Buffer.from("png de antes"), meta: { firebaseStorageDownloadTokens: "tok-previo" } });
  const url = await c.asegurarConstancia({ db, bucket, FieldValue: FieldValueFalso, coleccion: "pedidos", pedidoId: "P2", pago: { metodo: "paypal", id: "CAP1", montoPen: 50, montoUsd: 13.5 }, txId });
  assert.ok(url.endsWith("token=tok-previo"));
  const hash = require("crypto").createHash("sha256").update(Buffer.from("png de antes")).digest("hex");
  assert.deepEqual(db.datos.get(`fp_transactions/${txId}`).comprobanteHashes, [hash]);
});

test("asegurarConstancia: pedido web → comprobantesPago; sin movimiento no hace nada", async () => {
  const txId = erp.txIdPagoOnline("pedidos_web", "W1", "culqi", "chr_9");
  const db = baseFalsa({
    [`fp_transactions/${txId}`]: { amount: 30, sourceType: "adelanto" },
    "pedidos_web/W1": { clienteNombre: "Luis", clienteApellidos: "Paz", comprobantesPago: [] },
  });
  const bucket = bucketFalso();
  const url = await c.asegurarConstancia({ db, bucket, FieldValue: FieldValueFalso, coleccion: "pedidos_web", pedidoId: "W1", pago: { metodo: "culqi", id: "chr_9", montoPen: 30 }, txId });
  const [comp] = db.datos.get("pedidos_web/W1").comprobantesPago;
  assert.equal(comp.url, url);
  assert.equal(comp.fullPath, "comprobantes_pago/W1/constancia_culqi_chr_9.png");
  assert.equal([...db.datos.keys()].filter((k) => k.startsWith("cobranzaPaymentKeys/")).length, 0);

  const vacia = baseFalsa({ "pedidos/P3": { numeroPedido: "3" } });
  assert.equal(await c.asegurarConstancia({ db: vacia, bucket, FieldValue: FieldValueFalso, coleccion: "pedidos", pedidoId: "P3", pago: { metodo: "culqi", id: "x" }, txId: "cobro_x" }), null);
});
