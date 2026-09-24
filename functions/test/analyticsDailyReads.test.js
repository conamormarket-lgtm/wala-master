"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { buildDailyDoc } = require("../analyticsAggregations");

function fixture() {
  const reads = [];
  const writes = [];
  const db = { collection(name) {
    const query = {
      where: () => query, orderBy: () => query, limit: () => query,
      startAfter: () => query,
      get: () => new Promise((resolve, reject) => reads.push({ name, resolve, reject })),
      doc: id => ({ set: async data => writes.push({ name, id, data }) }),
    };
    return query;
  } };
  const output = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../analyticsDaily"), "utf8"), {
    exports: output, console,
    require(name) {
      if (name === "firebase-admin") return { firestore: () => db };
      if (name === "firebase-admin/firestore") return { FieldValue: { serverTimestamp: () => "SERVER_TIME" } };
      if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_, fn) => fn };
      if (name === "firebase-functions") return { runWith: () => ({ https: { onCall: fn => fn } }) };
      return require(name === "./analyticsAggregations" ? "../analyticsAggregations" : name);
    },
  });
  return { api: output._internals, reads, writes };
}

function snapshot(rows) {
  return { empty: rows.length === 0, size: rows.length,
    docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) };
}

test("daily aggregation starts both reads together and preserves persisted metrics", async () => {
  const { api, reads, writes } = fixture();
  const date = "2026-09-24";
  const events = [{ id: "event", type: "page_view", path: "/", clientType: "WEB" }];
  const sessions = [{ id: "session", clientType: "WEB", uid: "user" }];
  const pending = api.procesarDia(date);
  assert.deepEqual(reads.map(r => r.name), ["analytics_events", "analytics_sessions"]);
  reads[1].resolve(snapshot(sessions));
  reads[0].resolve(snapshot(events));
  await pending;
  assert.equal(writes.length, 1);
  const expected = { ...buildDailyDoc(date, events, sessions),
    ...api.buildDailyExtras(events, sessions), generatedAt: "SERVER_TIME" };
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].data)), JSON.parse(JSON.stringify(expected)));
});

test("daily aggregation never writes a partial day when either source fails", async () => {
  const { api, reads, writes } = fixture();
  const pending = api.procesarDia("2026-09-24");
  reads[0].resolve(snapshot([]));
  reads[1].reject(Error("unavailable"));
  await assert.rejects(pending, /unavailable/);
  assert.equal(writes.length, 0);
});
