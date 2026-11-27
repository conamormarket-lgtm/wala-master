"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { CAMPAIGN_ID, BRAND_ID, START_MS, DAY_MS, planLumiBlackFriday, applyLumiBlackFriday } = require("../lumiBlackFridayLogic");
const { precioDeCatalogo } = require("../catalogPricing");
const product = (id, price, extra = {}) => ({ id, name: id, brandId: BRAND_ID, price, visible: true, ...extra });

function fakeDb(products, failId) {
  let data = new Map(products.map(p => [`productos_wala/${p.id}`, { ...p }]));
  let transactions = 0;
  const db = {
    collection: name => ({ doc: id => ({ path: `${name}/${id}` }), where: () => ({ query: name }) }),
    async runTransaction(fn) {
      transactions++;
      const pending = new Map(data);
      const result = await fn({
        async get(ref) {
          if (ref.query) return { docs: [...data].filter(([key]) => key.startsWith(ref.query + "/")).map(([key, value]) => ({ id: key.split("/")[1], data: () => value })) };
          return { exists: data.has(ref.path), data: () => data.get(ref.path) };
        },
        update(ref, value) {
          if (ref.path === `productos_wala/${failId}`) throw Error("Simulated failed write");
          pending.set(ref.path, { ...pending.get(ref.path), ...value });
        },
        set(ref, value) { pending.set(ref.path, value); },
      });
      data = pending;
      return result;
    },
  };
  return { db, get: key => data.get(key), transactions: () => transactions };
}
const apply = (mock, time = START_MS) => applyLumiBlackFriday({ db: mock.db, now: () => time, serverTimestamp: () => "SERVER_TIMESTAMP" });

test("discounts the effective price once and preserves cents and the S/30 exemption", () => {
  const plan = planLumiBlackFriday([product("cheap", 17.5), product("limit", 30), product("above", 30.01), product("sale", 89, { salePrice: 79.5 }), product("regular", 99, { salePrice: 0 })]);
  assert.deepEqual(plan.excluded.map(p => p.price), [17.5, 30]);
  assert.deepEqual(plan.changes.map(p => [p.before, p.after]), [[30.01, 22.01], [79.5, 71.5], [99, 91]]);
});
test("only includes active visible Lumi products", () => {
  const plan = planLumiBlackFriday([product("good", 89), product("other", 89, { brandId: "other" }), product("hidden", 89, { visible: false }), product("deleted", 89, { deleted: true }), product("inactive", 89, { active: false })]);
  assert.deepEqual(plan.changes.map(p => p.id), ["good"]);
});
test("does not execute before midnight Lima or outside November 27 2026", async () => {
  const mock = fakeDb([product("good", 89)]);
  for (const now of [START_MS - 1, START_MS + DAY_MS, START_MS + DAY_MS * 365]) assert.equal((await apply(mock, now)).status, "outside-window");
  assert.equal(mock.transactions(), 0);
  assert.equal(new Date(START_MS).toISOString(), "2026-11-27T05:00:00.000Z");
});
test("commits prices and audit at midnight; retry cannot subtract again", async () => {
  const mock = fakeDb([product("good", 89), product("cheap", 30)]);
  assert.equal((await apply(mock)).changedCount, 1);
  assert.equal(precioDeCatalogo(mock.get("productos_wala/good")), 81);
  assert.equal(mock.get("productos_wala/good").price, 89);
  assert.equal(precioDeCatalogo(mock.get("productos_wala/cheap")), 30);
  assert.equal(mock.get(`storeConfigLogs/${CAMPAIGN_ID}`).changes[0].before, 89);
  assert.equal(mock.get(`storeConfig/${CAMPAIGN_ID}`).status, "complete");
  assert.equal((await apply(mock)).status, "already-applied");
  assert.equal(precioDeCatalogo(mock.get("productos_wala/good")), 81);
});
test("an invalid catalog or failed transaction never marks the campaign complete", async () => {
  for (const mock of [fakeDb([]), fakeDb([product("bad", 0)]), fakeDb([product("one", 89), product("two", 99)], "two")]) {
    await assert.rejects(apply(mock));
    assert.equal(mock.get(`storeConfig/${CAMPAIGN_ID}`), undefined);
    assert.equal(mock.get(`storeConfigLogs/${CAMPAIGN_ID}`), undefined);
    if (mock.get("productos_wala/one")) assert.equal(precioDeCatalogo(mock.get("productos_wala/one")), 89);
  }
});
test("frontend timer uses the exact same server campaign and timestamp", async () => {
  const { LUMI_BLACK_FRIDAY } = await import("../../src/utils/lumiBlackFriday.mjs");
  assert.equal(LUMI_BLACK_FRIDAY.id, CAMPAIGN_ID);
  assert.equal(Date.parse(LUMI_BLACK_FRIDAY.startsAt), START_MS);
});
