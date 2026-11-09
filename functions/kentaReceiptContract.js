"use strict";
const crypto = require('node:crypto');
const { normalizarOperacion } = require('./erpCobranzaLogic');
const { instantVersion } = require('./kentaCollectionSignal');
const MAX_BYTES = 5 * 1024 * 1024;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
class ReceiptError extends Error {
  constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
}
function requireThat(value, code, status = 400) { if (!value) throw new ReceiptError(code, status); }
function phone(value) {
  let n = String(value || '').replace(/\D/g, '');
  if (n.length === 9 && n.startsWith('9')) n = '51' + n;
  return n;
}
function authenticate(req, secret, now = Date.now()) {
  requireThat(secret, 'receipt_integration_not_configured', 503);
  const timestamp = String(req.get('x-wala-timestamp') || '');
  const signature = String(req.get('x-wala-signature') || '');
  requireThat(/^\d{10}$/.test(timestamp) && Math.abs(now / 1000 - Number(timestamp)) <= 300, 'invalid_signature', 401);
  requireThat(Buffer.isBuffer(req.rawBody) && req.rawBody.length <= MAX_BYTES * 1.4 + 16384, 'invalid_body', 413);
  requireThat(/^[a-f0-9]{64}$/.test(signature), 'invalid_signature', 401);
  const expected = crypto.createHmac('sha256', secret).update(timestamp + '.').update(req.rawBody).digest();
  requireThat(crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expected), 'invalid_signature', 401);
}
function parse(input, config, now = new Date()) {
  const b = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  requireThat(config.owner === 'con-amor' && config.lineKeys?.length, 'receipt_integration_not_configured', 503);
  requireThat(b.tenant === 'wala' && b.sourceTenant === config.owner && config.lineKeys.includes(b.lineKey), 'scope_not_allowed', 403);
  requireThat(['accounts', 'preview', 'confirm', 'status'].includes(b.action), 'invalid_action');
  if (b.action === 'accounts') return { action: b.action };
  requireThat(/^kenta:wala:\d{1,20}$/.test(b.receiptKey || ''), 'invalid_receipt_key');
  if (b.action === 'status') return { action: b.action, receiptKey: b.receiptKey };
  requireThat(typeof b.orderId === 'string' && /^[\w-]{1,160}$/.test(b.orderId), 'invalid_order');
  requireThat(typeof b.amount === 'string' && /^\d{1,7}(\.\d{1,2})?$/.test(b.amount) && Number(b.amount) > 0 && b.currency === 'PEN', 'invalid_amount');
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(b.paymentDate || '') && !Number.isNaN(Date.parse(b.paymentDate + 'T12:00:00Z')) && new Date(b.paymentDate + 'T12:00:00Z').toISOString().slice(0,10) === b.paymentDate, 'invalid_payment_date');
  const today = new Date(now.getTime() - 5 * 3600000).toISOString().slice(0,10);
  requireThat(b.paymentDate <= today, 'future_payment_date');
  const operation = normalizarOperacion(b.operationNumber);
  requireThat(/^[A-Z0-9]{3,80}$/.test(operation), 'invalid_operation');
  requireThat(typeof b.accountId === 'string' && /^[\w-]{1,160}$/.test(b.accountId), 'invalid_account');
  requireThat(/^\d{9,15}$/.test(phone(b.customerPhone)), 'invalid_phone');
  requireThat(Number.isSafeInteger(b.actor?.kentaUserId) && b.actor.kentaUserId > 0 && typeof b.actor.name === 'string' && b.actor.name.trim().length > 0 && b.actor.name.length <= 120, 'human_actor_required');
  requireThat(/^[a-f0-9]{64}$/.test(b.original?.sha256 || ''), 'original_hash_required');
  requireThat(['image/jpeg','image/png','image/webp','application/pdf'].includes(b.original?.mime), 'unsupported_original');
  requireThat(b.action !== 'confirm' || /^\d{16,22}$/.test(b.expectedOrderVersion || ''), 'expected_order_version_required');
  const result = { action: b.action, receiptKey: b.receiptKey, orderId: b.orderId, customerPhone: phone(b.customerPhone),
    amount: Number(b.amount), paymentDate: b.paymentDate, operationNumber: operation, accountId: b.accountId,
    actor: { kentaUserId: b.actor.kentaUserId, name: b.actor.name.trim(), email: String(b.actor.email || '').slice(0,200) },
    sha256: b.original.sha256, mime: b.original.mime, expectedOrderVersion: b.expectedOrderVersion || null,
    lineKey: b.lineKey };
  result.fingerprint = hash(JSON.stringify([result.receiptKey,result.orderId,result.customerPhone,result.amount,result.paymentDate,operation,result.accountId,result.sha256,result.mime]));
  if (b.action === 'confirm') {
    requireThat(typeof b.original.base64 === 'string' && b.original.base64.length <= Math.ceil(MAX_BYTES/3)*4 && /^[A-Za-z0-9+/]*={0,2}$/.test(b.original.base64), 'invalid_original');
    result.bytes = Buffer.from(b.original.base64, 'base64');
    requireThat(result.bytes.length > 4 && result.bytes.length <= MAX_BYTES && hash(result.bytes) === result.sha256, 'original_hash_mismatch');
    const bytes = result.bytes;
    const good = result.mime === 'image/jpeg' ? bytes.subarray(0,3).equals(Buffer.from([255,216,255]))
      : result.mime === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : result.mime === 'image/webp' ? bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
          : bytes.toString('ascii',0,5) === '%PDF-';
    requireThat(good, 'original_mime_mismatch');
  }
  return result;
}
function orderVersion(snap) { return instantVersion(snap.updateTime); }
module.exports = { MAX_BYTES, ReceiptError, requireThat, hash, phone, authenticate, parse, orderVersion };
