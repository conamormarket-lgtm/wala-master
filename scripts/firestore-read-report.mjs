// Summarize an export from Cloud Logging. No Firebase SDK, credentials or network.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const DIMENSIONS = new Set(['minute', 'app', 'device', 'session', 'database', 'collection', 'operation', 'originScreen', 'activeScreen']);
export function summarize(entries, { by = ['app', 'database', 'originScreen', 'collection'], from = -Infinity, to = Infinity } = {}) {
  if (!by.length || by.some(k => !DIMENSIONS.has(k))) throw Error('Invalid grouping dimension');
  const batches = new Set(), rows = new Map(), devices = new Set();
  let duplicates = 0, excluded = 0, dropped = 0;
  for (const entry of entries) {
    const batch = entry.jsonPayload || entry;
    if (batch.metric !== 'firestore_client_reads_v1' || !Array.isArray(batch.rows)) continue;
    const id = `${batch.app}:${batch.session}:${batch.batch}`;
    if (batches.has(id)) { duplicates++; continue; }
    batches.add(id); devices.add(`${batch.app}:${batch.device}`);
    // Cumulative loss counter per page: report its maximum, never sum it as reads.
    dropped = Math.max(dropped, batch.dropped || 0);
    for (const row of batch.rows) {
      if (row.minute < from || row.minute >= to) { excluded++; continue; }
      const dimensions = Object.fromEntries(by.map(k => [k, k === 'minute' ? new Date(row.minute).toISOString() : row[k] ?? batch[k]]));
      const key = JSON.stringify(dimensions);
      const target = rows.get(key) || { ...dimensions, counts: {} };
      for (const [name, value] of Object.entries(row.counts || {})) if (Number.isFinite(value) && value >= 0) target.counts[name] = (target.counts[name] || 0) + value;
      rows.set(key, target);
    }
  }
  return { warning: 'SDK observations, not billable reads. IDs identify browser profiles per app, not people or physical computers. Uninstrumented versions, backend/Admin SDK and server-side rule/index reads are excluded.',
    batches: batches.size, duplicateBatchesIgnored: duplicates, browserProfiles: devices.size, excludedRows: excluded, maximumReportedDroppedRows: dropped,
    rows: [...rows.values()].sort((a,b) => (b.counts.serverDocuments || 0) - (a.counts.serverDocuments || 0) || (b.counts.initialServerDocuments || 0) - (a.counts.initialServerDocuments || 0)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), file = args[0];
  if (!file || file.startsWith('--')) throw Error('Usage: node scripts/firestore-read-report.mjs logs.json [--by app,device,originScreen,collection] [--from ISO] [--to ISO] [--json]');
  const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i+1]; };
  const parseTime = (value, fallback) => { if (!value) return fallback; const n = Date.parse(value); if (!Number.isFinite(n)) throw Error('Invalid ISO date'); return n; };
  const entries = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  if (!Array.isArray(entries)) throw Error('Expected a Cloud Logging JSON array');
  const result = summarize(entries, { by: option('--by')?.split(','), from: parseTime(option('--from'), -Infinity), to: parseTime(option('--to'), Infinity) });
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(result.warning);
    console.log(`Batches: ${result.batches}; browser profiles: ${result.browserProfiles}; duplicate retries excluded: ${result.duplicateBatchesIgnored}; maximum reported dropped rows: ${result.maximumReportedDroppedRows}`);
    console.table(result.rows.slice(0,50).map(({ counts, ...dimensions }) => ({ ...dimensions,
      serverDocuments: counts.serverDocuments || 0, initialServerDocuments: counts.initialServerDocuments || 0,
      cacheDocuments: counts.cacheDocuments || 0, readCalls: counts.readCalls || 0, listeners: counts.listenerAttaches || 0, aggregations: counts.aggregationCalls || 0,
    })));
  }
}
