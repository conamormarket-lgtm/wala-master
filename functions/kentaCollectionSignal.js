/* Minimal collection signal from trigger snapshots. Never reads Firestore. */
const crypto = require('node:crypto');

function instantVersion(value) {
  if (value && Number.isSafeInteger(value.seconds) && Number.isInteger(value.nanoseconds)) {
    return (BigInt(value.seconds) * 1000000000n + BigInt(value.nanoseconds)).toString();
  }
  const match = /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(String(value || ''));
  if (!match) throw new Error('Missing stable source timestamp');
  const seconds = Date.parse(`${match[1]}Z`) / 1000;
  if (!Number.isSafeInteger(seconds)) throw new Error('Invalid source timestamp');
  return (BigInt(seconds) * 1000000000n + BigInt((match[2] || '').padEnd(9, '0'))).toString();
}

function projection(data, deleted) {
  const debt = data.deudaTotal;
  return {
    phone: typeof data.clienteContacto === 'string' || typeof data.clienteContacto === 'number'
      ? String(data.clienteContacto).slice(0, 40) : '',
    debt: ((typeof debt === 'number' && Number.isFinite(debt)) || typeof debt === 'string') && String(debt).length <= 64
      ? String(debt) : null,
    stage: typeof data.estadoGeneral === 'string' ? data.estadoGeneral.trim().slice(0, 120) : '',
    deleted: deleted || Boolean(data.deletedAt || data.deleted_at || data.eliminado),
    cancelled: data.anulado === true || /^anulad[oa]$/i.test(String(data.estadoGeneral || '').trim()),
  };
}

function buildSignal(change, context, config) {
  if (!config.owner) throw new Error('Missing explicit Walá ERP owner');
  const before = change.before.exists ? change.before.data() : null;
  const after = change.after.exists ? change.after.data() : null;
  const beforeOurs = before?.tenant_id === config.owner;
  const afterOurs = after?.tenant_id === config.owner;
  if (!beforeOurs && !afterOurs) return null;
  const order = projection(afterOurs ? after : before, !afterOurs);
  if (beforeOurs && afterOurs && JSON.stringify(projection(before, false)) === JSON.stringify(order)) return null;
  const version = instantVersion(change.after.exists ? change.after.updateTime : context.timestamp);
  if (!context.eventId || !context.params.pedidoId || context.params.pedidoId.length > 160) throw new Error('Invalid trigger identity');
  return {
    schema_version: 1, event: 'order.collection.changed', event_id: context.eventId, tenant: 'wala',
    source: { project: config.project, database: '(default)', collection: 'pedidos', owner: config.owner },
    order_id: context.params.pedidoId, version, order,
  };
}

async function deliver(signal, { url, secret, fetchImpl = fetch }) {
  if (!signal) return { status: 'irrelevant' };
  if (!secret || !url) throw new Error('Collection callback not configured');
  const body = JSON.stringify(signal), timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
  const response = await fetchImpl(url, {
    method: 'POST', body, signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', 'x-wala-timestamp': timestamp, 'x-wala-signature': signature },
  });
  if (!response.ok) throw new Error(`Collection callback HTTP ${response.status}`);
  const result = await response.json();
  if (result.ok !== true || typeof result.status !== 'string') throw new Error('Collection callback missing durable acknowledgment');
  return { status: result.status, payload_bytes: Buffer.byteLength(body), firestore_reads: 0 };
}

module.exports = { instantVersion, projection, buildSignal, deliver };
