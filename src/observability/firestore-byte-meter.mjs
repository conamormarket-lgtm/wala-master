/** Document protobuf payload estimates, never invoice/network counters.
 * Reads the SDK's already-decoded proto; never calls data()/converters or makes
 * a request. Unknown SDK shapes fail open and increment coverage errors.
 * No document values, IDs or paths are returned or retained.
 */
export function createDocumentByteMeter() {
const encoder = new TextEncoder();
const utf8 = value => encoder.encode(String(value)).length;
function varint(value) {
  let n = BigInt(value || 0);
  if (n < 0) return 10;
  let size = 1;
  while (n >= BigInt(128)) { n >>= BigInt(7); size++; }
  return size;
}
const message = (tag, size) => varint(tag * 8 + 2) + varint(size) + size;
function timestamp(value) {
  if (typeof value === 'string') {
    const seconds = Math.floor(Date.parse(value) / 1000);
    const nanos = Number((value.match(/\.(\d+)/)?.[1] || '').padEnd(9, '0'));
    value = { seconds, nanos };
  }
  if (!value || !Number.isFinite(Number(value.seconds))) throw Error('timestamp');
  const nanos = value.nanos ?? value.nanoseconds ?? 0;
  return (Number(value.seconds) ? 1 + varint(value.seconds) : 0) + (nanos ? 1 + varint(nanos) : 0);
}
function documentProtoBytes(document) {
  let budget = 100000;
  function fields(values, tag = 1) {
    let size = 0;
    for (const [key, v] of Object.entries(values || {})) {
      size += message(tag, message(1, utf8(key)) + message(2, value(v)));
    }
    return size;
  }
  function value(v) {
    if (--budget < 0 || !v || typeof v !== 'object') throw Error('value');
    if ('nullValue' in v || 'booleanValue' in v) return 2;
    if ('integerValue' in v) return 1 + varint(v.integerValue);
    if ('doubleValue' in v) return 9;
    if ('stringValue' in v) return message(17, utf8(v.stringValue));
    if ('referenceValue' in v) return message(5, utf8(v.referenceValue));
    if ('bytesValue' in v) {
      const b = v.bytesValue;
      const size = typeof b === 'string' ? Math.floor(b.length * 3 / 4) - (b.endsWith('==') ? 2 : b.endsWith('=') ? 1 : 0) : b.byteLength;
      if (!Number.isInteger(size)) throw Error('bytes');
      return message(18, size);
    }
    if ('timestampValue' in v) return message(10, timestamp(v.timestampValue));
    if ('geoPointValue' in v) return message(8, (Number(v.geoPointValue.latitude) ? 9 : 0) + (Number(v.geoPointValue.longitude) ? 9 : 0));
    if ('mapValue' in v) return message(6, fields(v.mapValue.fields));
    if ('arrayValue' in v) return message(9, (v.arrayValue.values || []).reduce((n, child) => n + message(1, value(child)), 0));
    throw Error('unknown-value');
  }
  if (!document || !document.fields || typeof document.name !== 'string') throw Error('document');
  return message(1, utf8(document.name)) + fields(document.fields, 2)
    + (document.createTime ? message(3, timestamp(document.createTime)) : 0)
    + (document.updateTime ? message(4, timestamp(document.updateTime)) : 0);
}

return documentProtoBytes;
}
export const documentProtoBytes = createDocumentByteMeter();

export function snapshotByteCounts(snapshot, source, scope) {
  // Pending writes and cache payloads must never be attributed to network egress.
  if (source !== 'serverDocuments' && source !== 'cacheDocuments') return {};
  const prefix = source === 'serverDocuments' ? 'server' : 'cache';
  try {
    const raw = snapshot._document;
    const fields = raw?.data?.value?.mapValue?.fields;
    const path = snapshot.ref?.path;
    if (!fields || !path || !scope.project || !scope.database) throw Error('sdk-shape');
    const bytes = documentProtoBytes({
      name: `projects/${scope.project}/databases/${scope.database}/documents/${path}`,
      fields, createTime: raw.createTime?.timestamp, updateTime: raw.version?.timestamp,
    });
    return { [`${prefix}DocumentBytesEstimate`]: bytes, [`${prefix}ByteMeasuredDocuments`]: 1 };
  } catch { return { [`${prefix}ByteMeasurementErrors`]: 1 }; }
}

export function snapshotPayloadCounts(snap, listener, scope) {
  /** @type {Record<string, number>} */
  const counts = { byteMeterSnapshots: 1 };
  const source = doc => doc.metadata?.hasPendingWrites ? 'pendingWriteDocuments'
    : snap.metadata?.fromCache === true ? 'cacheDocuments'
      : snap.metadata?.fromCache === false ? 'serverDocuments' : 'unknownSourceDocuments';
  const measure = doc => {
    for (const [key, n] of Object.entries(snapshotByteCounts(doc, source(doc), scope))) counts[key] = (counts[key] || 0) + n;
  };
  try {
    if ('docs' in snap) {
      if (listener) {
        for (const change of snap.docChanges()) if (change.type !== 'removed') measure(change.doc);
      } else {
        for (const doc of snap.docs) measure(doc);
      }
    } else if (snap.exists?.()) measure(snap);
  } catch { counts.byteSnapshotErrors = 1; }
  return counts;
}
