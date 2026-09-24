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
    fieldMask: ["price", "salePrice", "inStock", "visible", "deleted"],
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
