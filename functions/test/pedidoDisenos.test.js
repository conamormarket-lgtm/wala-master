/**
 * Tests UNITARIOS de functions/pedidoDisenos.js (solo 'assert' de Node; la
 * parte que copia en Storage no se prueba aquí).
 * Ejecutar:  node functions/test/pedidoDisenos.test.js
 */
const assert = require("assert");
const d = require("../pedidoDisenos");
const { urlDescarga } = require("../comunidadLogic");

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

const B = "sistema-gestion-3b225.firebasestorage.app";
const url = (path) => urlDescarga(B, path, "t1");

check("destinoPedido quita designs/{uid}/ y crear/", () => {
  assert.strictEqual(d.destinoPedido("PD-12", "designs/u1/crear/archivos/1_a.png"), "pedidos/PD-12/archivos/1_a.png");
  assert.strictEqual(d.destinoPedido("PD-12", "designs/u1/previas/x.jpg"), "pedidos/PD-12/previas/x.jpg");
  assert.strictEqual(d.destinoPedido("PD/../12", "designs/u1/a.png"), "pedidos/PD12/a.png");
  assert.strictEqual(d.destinoPedido("PD-12", "designs/u1/../x.png"), null);
  assert.strictEqual(d.destinoPedido("", "designs/u1/a.png"), null);
});

check("urlsDelCliente encuentra las del comprador en todo el pedido y nada más", () => {
  const propia1 = url("designs/u1/crear/archivos/1.png");
  const propia2 = url("designs/u1/crear/previas/2.jpg");
  const ajena = url("designs/u2/crear/archivos/3.png");
  const comunidad = url("comunidad/p1/4.png");
  const payload = {
    productos: {
      item_0: { disenoVistas: { pecho: { archivoImpresion: propia1, imagenes: [propia2, ajena] } } },
      item_1: { subProductos: { subItem_0: { disenoFrente: { imagenes: [comunidad] } } } },
    },
    imageURLs: [propia1, "https://otro.com/x.png"],
  };
  const urls = [...d.urlsDelCliente(payload, "u1")].sort();
  assert.deepStrictEqual(urls, [propia1, propia2].sort());
});

check("cambiarUrls cambia en todos los niveles y respeta lo que no es objeto plano", () => {
  const fecha = new Date(0);
  const mapa = { a: "A", b: "B" };
  const out = d.cambiarUrls({ x: "a", y: ["b", "c"], z: { w: "a" }, f: fecha, n: 3 }, mapa);
  assert.deepStrictEqual(out, { x: "A", y: ["B", "c"], z: { w: "A" }, f: fecha, n: 3 });
  assert.strictEqual(out.f, fecha);
});

check("creacionesDelPedido: cada línea, cada pieza y su Mi combo, sin repetir", () => {
  const ids = d.creacionesDelPedido({
    productos: {
      item_0: { designId: "crea1" },
      item_1_0: { designId: "pieza1", comboCrear: { miComboId: "mio1" } },
      item_1_1: { designId: "pieza1", comboCrear: { miComboId: "mio1" } },
      item_2: { designId: "" },
      item_3: { designId: "../malo" },
    },
  });
  assert.deepStrictEqual(ids.sort(), ["crea1", "mio1", "pieza1"]);
});

// disenoCompartido es async: se prueba aparte y al final se imprime el total.
const fakeDb = (docs) => ({
  collection: () => ({ doc: (id) => ({ get: async () => ({ exists: !!docs[id], data: () => docs[id] }) }) }),
});
const P = (n) => `https://x/${n}.jpg`;

(async () => {
  const docs = {
    mio1: {
      tipo: "comboCrear", userId: "u1", enPedido: true, name: "Nuestro combo",
      piezas: [{ designId: "a", talla: "M" }, { designId: "b", talla: "L", frente: P("bf"), nombre: "Otra" }],
    },
    a: { userId: "u1", name: "Polo A", productName: "Polo clásico", color: { nombre: "Blanco", hex: "#fff" }, vistasPrevias: [{ url: P("af") }, { url: P("ae") }] },
    b: { userId: "u2", name: "Ajena" },
    suelta: { userId: "u1", enPedido: true, name: "Mi polera", productName: "Polera", variant: { size: "S" }, imagenConjunta: P("s") },
    borrador: { userId: "u1", name: "Sin comprar", vistasPrevias: [{ url: P("x") }] },
  };
  const db = fakeDb(docs);

  const combo = await d.disenoCompartido(db, ["mio1"]);
  assert.strictEqual(combo.titulo, "Nuestro combo");
  assert.deepStrictEqual(combo.piezas[0], {
    nombre: "Polo A", prenda: "Polo clásico", color: "Blanco", colorHex: "#fff", talla: "M", imagenes: [P("af"), P("ae")],
  });
  // Pieza de otra cuenta: solo lo que guardó el combo, nunca su documento.
  assert.deepStrictEqual(combo.piezas[1], { nombre: "Otra", prenda: "", color: "", colorHex: "", talla: "L", imagenes: [P("bf")] });
  count += 1;

  const suelta = await d.disenoCompartido(db, ["suelta", "borrador", "../x", "nada"]);
  assert.strictEqual(suelta.piezas.length, 1);
  assert.deepStrictEqual(suelta.piezas[0].imagenes, [P("s")]);
  assert.strictEqual(suelta.piezas[0].talla, "S");
  count += 1;

  console.log(`pedidoDisenos: ${count} pruebas OK`);
})().catch((e) => { console.error("FALLA: disenoCompartido"); console.error(e); process.exit(1); });
