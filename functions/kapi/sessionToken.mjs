import { randomBytes, hkdfSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';

const keyFor = secret => Buffer.from(hkdfSync('sha256', secret, '', 'wala-kapi-session-v1', 32));
export function sealSession(state, secret, now = Date.now()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  cipher.setAAD(Buffer.from('wala-kapi-v1'));
  const payload = deflateSync(JSON.stringify({ ...state, expires: now + 3600000 }));
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function openSession(token, secret, now = Date.now()) {
  if (token == null) return null;
  try {
    if (typeof token !== 'string' || token.length > 50000 || !/^[\w-]+$/.test(token)) throw Error();
    const bytes = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from('wala-kapi-v1')); decipher.setAuthTag(bytes.subarray(12, 28));
    const decoded = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    const state = JSON.parse(inflateSync(decoded, { maxOutputLength: 100000 }).toString());
    if (state.expires <= now || state.expires > now + 3600000 || !/^[a-f0-9-]{36}$/.test(state.id)
      || !Array.isArray(state.session?.messages) || state.session.messages.length > 12) throw Error();
    return state;
  } catch { throw Object.assign(Error('Tu conversación venció. Escribe de nuevo para comenzar otra.'), { status: 410, code: 'session_expired' }); }
}
