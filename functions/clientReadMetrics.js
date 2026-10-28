/** Central ingestion only. Never imports or calls Firestore, Storage or a business permission lookup. */
const COUNTS = new Set([
  'readCalls', 'successfulReadCalls', 'failedReadCalls', 'snapshots', 'serverDocuments',
  'cacheDocuments', 'pendingWriteDocuments', 'unknownSourceDocuments', 'removedDocuments',
  'emptyQueryResults', 'missingDocumentResults', 'snapshotsWithoutDocumentChanges',
  'listenerAttaches', 'listenerCallbacks', 'sharedObserverCallbacks', 'listenerErrors',
  'initialSnapshots', 'updateSnapshots', 'initialServerDocuments', 'aggregationCalls', 'successfulAggregationCalls',
  'failedAggregationCalls', 'transactionCalls', 'transactionAttempts', 'committedTransactions',
  'failedTransactions', 'writeCalls', 'failedWriteCalls', 'acknowledgedWrites', 'acknowledgedDeletes',
]);
const DIMENSIONS = ['project', 'database', 'collection', 'operation', 'originScreen', 'activeScreen'];
const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(k => keys.includes(k));
const integer = (n, max = 100000000) => Number.isSafeInteger(n) && n >= 0 && n <= max;
function validateBatch(body, project, now) {
  if (!exactKeys(body, ['schema', 'app', 'device', 'session', 'batch', 'createdAt', 'dropped', 'rows']) || body.schema !== 1 || !['wala', 'sistema-gestion'].includes(body.app)) return null;
  if (!['device', 'session', 'batch'].every(k => typeof body[k] === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(body[k]))) return null;
  if (!Number.isSafeInteger(body.createdAt) || Math.abs(now - body.createdAt) > 86400000 || !integer(body.dropped)) return null;
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 40) return null;
  for (const row of body.rows) {
    if (!exactKeys(row, [...DIMENSIONS, 'minute', 'counts'])) return null;
    if (!DIMENSIONS.every(k => typeof row[k] === 'string' && /^[a-zA-Z0-9_().*:/-]{1,160}$/.test(row[k]))) return null;
    if (row.project !== project || !Number.isSafeInteger(row.minute) || row.minute % 60000 || Math.abs(now - row.minute) > 86400000) return null;
    if (!exactKeys(row.counts, [...COUNTS]) || !Object.keys(row.counts).length || !Object.values(row.counts).every(n => integer(n))) return null;
  }
  // Construct a fresh allowlisted object. Never log request headers, tokens, IPs or raw rejected bodies.
  return { schema: 1, app: body.app, device: body.device, session: body.session, batch: body.batch, createdAt: body.createdAt, dropped: body.dropped,
    rows: body.rows.map(row => Object.fromEntries([...DIMENSIONS, 'minute', 'counts'].map(k => [k, row[k]]))) };
}

function createMetricsHandler({ project, verifyToken, log, now = Date.now, extraPublicOrigins = [] }) {
  const publicOrigins = new Set(['https://wala.pe', 'https://www.wala.pe', 'https://portal-clientes-regala-con-amor.vercel.app', `https://${project}.web.app`, `https://${project}.firebaseapp.com`, ...extraPublicOrigins]);
  const rates = new Map(), seen = new Map();
  return async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    const origin = req.get('origin') || '';
    // Public storefront reports require an exact known origin. Other HTTPS origins require a project ID token.
    if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(origin)) return res.status(403).end();
    res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST'); res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.set('Access-Control-Max-Age', '3600'); return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).end();
    if (!String(req.get('content-type') || '').startsWith('application/json')) return res.status(415).end();
    const length = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || null));
    if (length > 49152) return res.status(413).end();
    const time = now(), bucket = Math.floor(time / 60000), key = req.ip || '(unknown)';
    // Per-instance abuse brake, not a distributed quota. Keys remain in memory and are never logged.
    if (rates.size >= 2000) for (const [k, value] of rates) if (value.bucket !== bucket) rates.delete(k);
    if (!rates.has(key) && rates.size >= 2000) return res.status(429).end();
    const rate = rates.get(key)?.bucket === bucket ? rates.get(key) : { bucket, count: 0 };
    rates.set(key, rate); if (++rate.count > 120) return res.status(429).end();
    const data = validateBatch(req.body, project, time);
    if (!data) return res.status(400).end();
    const bearer = String(req.get('authorization') || '').match(/^Bearer (.{1,8192})$/)?.[1];
    let authenticated = false;
    if (bearer) {
      try { await verifyToken(bearer); authenticated = true; } catch { return res.status(401).end(); }
    }
    if (!authenticated && (data.app !== 'wala' || !publicOrigins.has(origin))) return res.status(401).end();
    const dedupe = `${data.app}:${data.session}:${data.batch}`;
    if (seen.has(dedupe)) return res.status(204).end();
    try {
      log('firestore_client_reads_v1', { metric: 'firestore_client_reads_v1', authenticated, receivedAt: time, ...data });
      seen.set(dedupe, time);
      while (seen.size > 2000) seen.delete(seen.keys().next().value);
      return res.status(204).end();
    } catch { return res.status(503).end(); }
  };
}
module.exports = { validateBatch, createMetricsHandler };
