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

console.log(`pedidoDisenos: ${count} pruebas OK`);
