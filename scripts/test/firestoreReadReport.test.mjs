import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../firestore-read-report.mjs';
test('central report deduplicates cross-instance retries and groups exact minute/app/screen/collection', () => {
  const batch = { metric:'firestore_client_reads_v1', app:'wala', session:'a', device:'d', batch:'b', dropped:2,
    rows:[{ minute:60000, database:'(default)', collection:'pedidos', originScreen:'/admin', counts:{serverDocuments:12250} },
      { minute:120000, database:'(default)', collection:'pedidos', originScreen:'/admin', counts:{serverDocuments:1} }] };
  const result = summarize([{jsonPayload:batch},{jsonPayload:batch}],{by:['minute','app','device','collection'],from:60000,to:120000});
  assert.equal(result.rows.length,1); assert.equal(result.rows[0].counts.serverDocuments,12250);
  assert.equal(result.duplicateBatchesIgnored,1); assert.equal(result.excludedRows,1);
  assert.equal(result.rows[0].minute,'1970-01-01T00:01:00.000Z');
  assert.equal(result.maximumReportedDroppedRows,2);
});
