"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { buildDailyDoc } = require("../analyticsAggregations");
const { armarVisitas, resumenVisitas } = require("../analyticsTraficoReal");
const { buildResultadosDelDia } = require("../analyticsResultados");

function fixture() {
  const reads = [];
  const writes = [];
  const db = { collection(name) {
    // Las cuentas admin (tráfico real): se resuelven al tiro, sin contar como lectura del día.
    if (name === "adminUsers") return { get: async () => ({ forEach() {} }) };
    if (name === "analytics_config") return { doc: () => ({ get: async () => ({ exists: false }), set: async () => {} }) };
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
      if (name === "firebase-admin") return { firestore: () => db, auth: () => ({ listUsers: async () => ({ users: [] }) }) };
      if (name === "firebase-admin/firestore") return { FieldValue: { serverTimestamp: () => "SERVER_TIME" } };
      if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_, fn) => fn };
      if (name === "firebase-functions") return { runWith: () => ({ https: { onCall: fn => fn } }) };
      return require(name.startsWith("./") ? `.${name}` : name);
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
  const events = [{ id: "event", type: "page_view", path: "/", clientType: "WEB", sessionId: "session" }];
  const sessions = [{ id: "session", clientType: "WEB", uid: "user", startedAtClientMs: 1 }];
  const pending = api.procesarDia(date);
  assert.deepEqual(reads.map(r => r.name), ["analytics_events", "analytics_sessions"]);
  reads[1].resolve(snapshot(sessions));
  reads[0].resolve(snapshot(events));
  await pending;
  assert.equal(writes.length, 1);
  const v = armarVisitas(events, sessions);
  const expected = { ...buildDailyDoc(date, v.events, v.representantes),
    ...api.buildDailyExtras(v.events, v.representantes),
    ...resumenVisitas(v.visitas),
    ...buildResultadosDelDia(events),
    personasIds: { app: [], web: ["user"] },
    traficoReal: { version: 2, sesionesRegistradas: 1, sesionesBot: 0, sesionesAdmin: 0, eventos: 0, dwellRecortados: 0, sinPaginas: 0, unidas: 0 },
    generatedAt: "SERVER_TIME" };
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
