/** Passive, bounded counters. No Firebase imports, document contents or query values. */
export const COUNT_NAMES = new Set([
  'readCalls', 'successfulReadCalls', 'failedReadCalls', 'snapshots', 'serverDocuments',
  'cacheDocuments', 'pendingWriteDocuments', 'unknownSourceDocuments', 'removedDocuments',
  'emptyQueryResults', 'missingDocumentResults', 'snapshotsWithoutDocumentChanges',
  'listenerAttaches', 'listenerCallbacks', 'sharedObserverCallbacks', 'listenerErrors',
  'initialSnapshots', 'updateSnapshots', 'initialServerDocuments', 'aggregationCalls', 'successfulAggregationCalls',
  'failedAggregationCalls', 'transactionCalls', 'transactionAttempts', 'committedTransactions',
  'failedTransactions', 'writeCalls', 'failedWriteCalls', 'acknowledgedWrites', 'acknowledgedDeletes',
]);
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const safe = (value, fallback) => typeof value === 'string' && /^[a-zA-Z0-9_().*:/-]{1,160}$/.test(value) ? value : fallback;
export function routeScreen(path, templates) {
  const parts = String(path || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return templates.find(template => {
    const a = template.split('/'), b = parts.split('/');
    return a.length === b.length && a.every((part, i) => part.startsWith(':') || part === b[i]);
  }) || '/:other';
}

export function createReadRecorder({ app, screen = () => '/', now = Date.now, storage, sessionStorage, fetcher, schedule = globalThis.setTimeout || (() => undefined), cancel = globalThis.clearTimeout || (() => {}) } = {}) {
  const session = id();
  let device = id(), pending = new Map(), queue = [], dropped = 0, timer, busy = false;
  let endpoint = '', token = async () => null, failures = 0, sent = 0, lastError = null, enabled = false;
  let project = '';
  const storageKey = `firestore-read-batches-v1:${app}`;
  try {
    const saved = JSON.parse(storage?.getItem('firestore-read-device-v1') || 'null');
    if (saved && /^[a-zA-Z0-9-]{8,80}$/.test(saved.id) && saved.expires > now()) device = saved.id;
    else storage?.setItem('firestore-read-device-v1', JSON.stringify({ id: device, expires: now() + 30 * 86400000 }));
  } catch { /* Storage restrictions must never affect the app. */ }
  try {
    const saved = JSON.parse(sessionStorage?.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) queue = saved.filter(b => b?.app === app && Array.isArray(b.rows) && b.rows.length <= 40 && now() - b.createdAt < 86400000).slice(-8);
  } catch { /* No durable retry queue in this browser. */ }
  const currentScreen = () => { try { return safe(screen(), '/:other'); } catch { return '/:other'; } };
  function persist() {
    try { sessionStorage?.setItem(storageKey, JSON.stringify(queue)); } catch { /* best effort */ }
  }
  function arm(delay = 60000) {
    if (!enabled || timer || (!pending.size && !queue.length)) return;
    timer = schedule(() => { timer = null; void flush(); }, delay);
  }
  function observe(scope, operation, counts) {
    try {
      if (!enabled) return;
      const minute = Math.floor(now() / 60000) * 60000;
      const dims = {
        minute, project: safe(scope.project, '(unknown)'), database: safe(scope.database, '(unregistered)'),
        collection: safe(scope.collection, '(other)'), operation: safe(operation, '(unknown)'),
        originScreen: safe(scope.originScreen, currentScreen()), activeScreen: currentScreen(),
      };
      const key = JSON.stringify(dims);
      if (!pending.has(key) && pending.size >= 160) { dropped++; return; }
      const row = pending.get(key) || { ...dims, counts: {} };
      for (const [name, count] of Object.entries(counts)) {
        if (COUNT_NAMES.has(name) && Number.isSafeInteger(count) && count >= 0) row.counts[name] = Math.min(100000000, (row.counts[name] || 0) + count);
      }
      pending.set(key, row);
      arm();
    } catch { /* Diagnostics may never change a business result. */ }
  }
  function checkpoint() {
    const expired = queue.filter(b => now() - b.createdAt >= 86400000);
    if (expired.length) {
      dropped += expired.reduce((n,b) => n + b.rows.length, 0);
      queue = queue.filter(b => now() - b.createdAt < 86400000);
      persist();
    }
    if (!pending.size) return;
    const rows = [...pending.values()]; pending = new Map();
    while (rows.length) {
      const batch = { schema: 1, app, device, session, batch: id(), createdAt: now(), dropped, rows: rows.splice(0, 40) };
      // All serialized labels are ASCII. Leave space below the receiver/keepalive limit.
      while (JSON.stringify(batch).length > 48000 && batch.rows.length > 1) rows.unshift(batch.rows.pop());
      queue.push(batch);
    }
    while (queue.length > 8) { dropped += queue.shift().rows.length; }
    queue = queue.filter(b => now() - b.createdAt < 86400000);
    persist();
  }
  async function flush() {
    if (!enabled || busy) return;
    try {
      checkpoint();
      if (!queue.length) return;
      busy = true;
      const batch = queue[0];
      const controller = new AbortController();
      // Also bound token retrieval; a stalled Auth request must not stall diagnostics forever.
      let timeout;
      try {
        const result = await Promise.race([
          (async () => {
            const authToken = await token();
            if (controller.signal.aborted) throw new Error('timeout');
            return fetcher(endpoint, {
              method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
              headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
              body: JSON.stringify(batch), signal: controller.signal,
            });
          })(),
          new Promise((_, reject) => { timeout = schedule(() => { controller.abort(); reject(new Error('timeout')); }, 8000); }),
        ]);
        if (!result.ok) {
          // Malformed/oversize/stale data cannot recover by retrying forever.
          if ([400, 413, 415].includes(result.status)) {
            queue = queue.filter(b => b.batch !== batch.batch); dropped += batch.rows.length; persist();
          }
          throw new Error(`http-${result.status}`);
        }
        // A visibility checkpoint may have trimmed the queue while this request ran.
        const index = queue.findIndex(b => b.batch === batch.batch);
        if (index >= 0) queue.splice(index, 1);
        failures = 0; lastError = null; sent++; persist();
      } finally { cancel(timeout); }
    } catch (error) { failures++; lastError = String(error?.message || 'send-failed').slice(0, 40); }
    finally { busy = false; arm(Math.min(900000, 60000 * 2 ** Math.min(failures, 4))); }
  }
  return {
    observe, currentScreen, flush,
    checkpoint: () => { try { checkpoint(); } catch { /* best effort */ } },
    configure(options) {
      try {
        project = options.project || project;
        endpoint = options.endpoint || ''; token = options.token || token;
        enabled = options.enabled !== false && /^https:\/\/[a-z0-9-]+\.cloudfunctions\.net\/collectClientFirestoreReads$/.test(endpoint) && typeof fetcher === 'function';
        if (!enabled && timer) { cancel(timer); timer = null; }
        arm();
      } catch { enabled = false; }
    },
    async verifyConnection() {
      if (!enabled || !project) return { verified: false, reason: 'disabled-or-unconfigured' };
      const previous = sent;
      observe({ project, database: '(default)', collection: '(diagnostic)', originScreen: currentScreen() }, 'diagnostic.zeroReads', { readCalls: 0, serverDocuments: 0 });
      await flush();
      return { verified: sent > previous, ...this.status() };
    },
    status: () => ({ enabled, device, session, queuedBatches: queue.length, pendingRows: pending.size, dropped, sentBatches: sent, lastError }),
    snapshot: () => ({ app, device, session, pending: [...pending.values()].map(r => ({ ...r, counts: { ...r.counts } })), queued: queue.map(b => ({ ...b, rows: b.rows.map(r => ({ ...r, counts: { ...r.counts } })) })) }),
  };
}
