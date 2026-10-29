"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCartValidator } = require("../cartValidation");

class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const line = (productoId, cantidad = 1, extra = {}) => ({ productoId, cantidad, precio: 45, ...extra });

function fixture(products) {
  const calls = [];
  const read = async (...args) => {
    const options = args.pop();
    calls.push({ ids: args.map(ref => ref.id), options });
    // El consumidor no debe depender del orden de respuesta de getAll.
    return args.reverse().map(ref => ({
      id: ref.id, exists: !!products[ref.id], data: () => products[ref.id],
    }));
  };
  const db = { collection: () => ({ doc: id => ({ id }) }), getAll: read };
  return { db, calls, read, validate: createCartValidator({ db, HttpsError }) };
}

test("checkout batches unique catalog documents and projects only validation fields", async () => {
  const f = fixture({ a: { price: 45, inStock: 10 }, b: { price: 30, inStock: 2 } });
  await f.validate([line("a"), line("a", 2), line("b", 1, { precio: 30 })]);
  assert.deepEqual(f.calls, [{ ids: ["a", "b"], options: {
    fieldMask: ["price", "salePrice", "inStock", "visible", "deleted", "esPrendaBase", "prendaBase", "brandId"],
  } }]);
});

test("split cart lines cannot bypass the total stock check", async () => {
  const f = fixture({ a: { price: 45, inStock: 3 } });
  await assert.rejects(f.validate([line("a", 2), line("a", 2)]), /stock suficiente/);
});

test("transaction reads stay inside the transaction and refresh for each retry", async () => {
  const products = { a: { price: 45, inStock: 2 } };
  const f = fixture(products);
  f.db.getAll = () => { throw Error("nontransactional read"); };
  const transaction = { getAll: f.read };
  await f.validate([line("a")], transaction);
  products.a.inStock = 0;
  await assert.rejects(f.validate([line("a")], transaction), /stock suficiente/);
  assert.equal(f.calls.length, 2);
});

test("missing, hidden and soft-deleted products fail closed", async () => {
  for (const product of [undefined, { price: 45, visible: false }, { price: 45, deleted: true }]) {
    const f = fixture({ a: product });
    await assert.rejects(f.validate([line("a")]), err => err.code === "failed-precondition");
  }
});

test("catalog pricing, personalized prices and combo parent stock remain compatible", async () => {
  const f = fixture({ a: { price: 45, salePrice: "", inStock: 4 } });
  await f.validate({ item_1: line("a", 1, { esCombo: true }) });
  await assert.rejects(f.validate([line("a", 1, { precio: 40 })]), /precio.*cambió/);
  await f.validate([line("a", 1, { personalizado: true, precio: 60 })]);
  await assert.rejects(f.validate([line("a", 5, { personalizado: true })]), /stock suficiente/);
});

test("empty legacy carts do not issue an invalid empty getAll request", async () => {
  const f = fixture({});
  await f.validate([null, { producto: "legacy" }]);
  await f.validate(null);
  assert.equal(f.calls.length, 0);
});

test("subtotal uses server prices and never lets personalized lines go below catalog", async () => {
  const f = fixture({ a: { price: 45, inStock: 10 }, b: { price: 30, salePrice: 25, inStock: 10 } });
  const { subtotal } = await f.validate([
    line("a", 2),
    line("b", 1, { precio: 25 }),
    line("a", 1, { personalizado: true, precio: 60 }),
    line("a", 1, { personalizado: true, precio: 1 }),
    { productoId: "", cantidad: 1, precio: -50 },
  ]);
  assert.equal(subtotal, 90 + 25 + 60 + 45);
});

// Combos de Crear: una línea por pieza, que juntas suman el precio del combo.
const combo = { price: 150, salePrice: 135, esComboCrear: true, visible: false,
  comboCrear: { publicado: true, piezas: [{ prendaId: "polo" }, { prendaId: "polo" }] } };
const prendas = { polo: { price: 75, inStock: 10, esPrendaBase: true, prendaBase: { vistas: [] } } };
const pieza = (i, precio, extra = {}) => ({
  productoId: "polo", cantidad: 1, precio, personalizado: true, combo: "Pareja",
  comboCrear: { comboId: "pareja", grupo: 0, pieza: i, de: 2 }, ...extra,
});

test("combo pieces are charged together at the combo price", async () => {
  const f = fixture({ ...prendas, pareja: combo });
  const { subtotal } = await f.validate([pieza(0, 67.5), pieza(1, 67.5), line("polo", 1, { precio: 75, personalizado: true })]);
  assert.equal(subtotal, 210);
  assert.deepEqual(f.calls[1].ids, ["pareja"]);
});

test("combo pieces cannot lower the combo price or change its garments", async () => {
  const f = fixture({ ...prendas, otra: { price: 10, inStock: 5 }, pareja: combo });
  await assert.rejects(f.validate([pieza(0, 1), pieza(1, 1)]), /precio.*cambió/);
  await assert.rejects(f.validate([pieza(0, 67.5)]), /cambió/);
  await assert.rejects(f.validate([pieza(0, 67.5), pieza(1, 67.5, { productoId: "otra" })]), /cambió/);
  await assert.rejects(f.validate([pieza(0, 67.5), pieza(1, 67.5, { cantidad: 3 })]), /cambió/);
});

test("unpublished, deleted or missing combos are not sold", async () => {
  for (const c of [undefined, { ...combo, deleted: true }, { ...combo, comboCrear: { ...combo.comboCrear, publicado: false } }]) {
    const f = fixture({ ...prendas, pareja: c });
    await assert.rejects(f.validate([pieza(0, 67.5), pieza(1, 67.5)]), /disponible/);
  }
});

test("a Crear garment is only sold designed, even when it shows in the shop", async () => {
  const f = fixture({ polo: { ...prendas.polo, enTienda: true } });
  await assert.rejects(f.validate([line("polo", 1, { precio: 75 })]), /se compra personalizado/);
  await f.validate([line("polo", 1, { precio: 75, personalizado: true })]);
  await f.validate([line("polo", 1, { precio: 75, designId: "d1" })]);
});

// Pack de Yoryo: el reloj va tal cual (pieza fija) y la billetera se graba.
const pack = { price: 290, salePrice: 240, esComboCrear: true, visible: false,
  comboCrear: { publicado: true, piezas: [
    { prendaId: "reloj", fija: true, color: { id: "v1", nombre: "Acero Ónix" } }, { prendaId: "billetera" },
  ] } };
const delPack = { reloj: { price: 120, inStock: 2 }, billetera: { price: 120, inStock: 5, esPrendaBase: true, prendaBase: { vistas: [] } } };
const piezaPack = (i, extra = {}) => ({
  productoId: i === 0 ? "reloj" : "billetera", cantidad: 1, precio: 120, combo: "Ónix",
  ...(i === 0 ? { personalizado: false, color: "Acero Ónix" } : { personalizado: true, designId: "d1" }),
  comboCrear: { comboId: "pack", grupo: 0, pieza: i, de: 2 }, ...extra,
});

test("a fixed combo piece goes as is, in the admin's color", async () => {
  const f = fixture({ ...delPack, pack });
  const { subtotal } = await f.validate([piezaPack(0), piezaPack(1)]);
  assert.equal(subtotal, 240);
  await assert.rejects(f.validate([piezaPack(0, { color: "Oro Imperial" }), piezaPack(1)]), /cambió/);
  await assert.rejects(f.validate([piezaPack(0, { personalizado: true }), piezaPack(1)]), /cambió/);
  await assert.rejects(f.validate([piezaPack(0, { designId: "x" }), piezaPack(1)]), /cambió/);
  await assert.rejects(f.validate([piezaPack(0, { cantidad: 3 }), piezaPack(1, { cantidad: 3 })]), /stock suficiente/);
});

test("combo pieces still consume their garment stock", async () => {
  const f = fixture({ polo: { ...prendas.polo, inStock: 3 }, pareja: combo });
  await assert.rejects(f.validate([pieza(0, 67.5, { cantidad: 2 }), pieza(1, 67.5, { cantidad: 2 })]), /stock suficiente/);
});

test("coin cap uses each product's brand percentage (default half)", async () => {
  const f = fixture({
    a: { price: 100, inStock: 10, brandId: "m20" },
    b: { price: 45, inStock: 10 },
    c: { price: 30, inStock: 10, brandId: "m0" },
    d: { price: 10, inStock: 10, brandId: "sinConfig" },
    m20: { topeMonedasPct: 20 },
    m0: { topeMonedasPct: 0 },
    sinConfig: { name: "Marca" },
  });
  const r = await f.validate([
    line("a", 1, { precio: 100 }),
    line("b"),
    line("c", 1, { precio: 30 }),
    line("d", 1, { precio: 10 }),
  ]);
  // 20 % de 100 + 50 % de 45 + 0 % de 30 + 50 % de 10 = 20 + 22,5 + 0 + 5 → 47
  assert.equal(r.subtotal, 185);
  assert.equal(r.topeMonedas, 47);
  const brandRead = f.calls.find((c) => c.options.fieldMask.includes("topeMonedasPct"));
  assert.deepEqual(brandRead.ids.sort(), ["m0", "m20", "sinConfig"]);
});

test("carts without brands do not read brands and keep the half rule", async () => {
  const f = fixture({ a: { price: 45, inStock: 10 } });
  const r = await f.validate([line("a")]);
  assert.equal(r.topeMonedas, 22);
  assert.equal(f.calls.length, 1);
});
