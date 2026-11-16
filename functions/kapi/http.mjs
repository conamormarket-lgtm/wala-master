import { createHmac } from 'node:crypto';
import { createAssistant, validInput, KapiError } from './assistant.mjs';
import { createCatalog } from './catalog.mjs';
import { sealSession, openSession } from './sessionToken.mjs';

export const ALLOWED_ORIGINS = new Set(['https://www.wala.pe', 'https://wala.pe']);
export function createBudgetStore(db, secret) {
  const consume = async (id, windowMs, limit) => db.runTransaction(async tx => {
    const ref = db.collection('kapi_server').doc(id);
    const current = (await tx.get(ref)).data(); const window = Math.floor(Date.now() / windowMs);
    const count = current?.window === window ? current.count : 0;
    if (!Number.isInteger(count) || count >= limit) throw new KapiError('rate_limit', 'Por ahora llegamos al límite de consultas. Puedes seguir explorando la tienda.', 429);
    tx.set(ref, { window, count: count + 1 });
  });
  return {
    // Fixed buckets bound storage and never save the IP. Occasional collisions
    // share a limit; all instances also obey the same daily provider budget.
    message: ip => consume('visitor-' + createHmac('sha256', secret).update(ip).digest('hex').slice(0, 3), 60000, 8),
    provider: () => consume('provider-daily', 86400000, 200),
  };
}

export function createPublicHandler({ getKey, budgetFor, catalog = createCatalog({ projectId: 'sistema-gestion-3b225' }), loadCache, saveCache, assistantFactory = createAssistant }) {
  return async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'Origen no permitido.' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kapi-Client');
      return res.status(204).end();
    }
    const route = req.path?.replace(/\/$/, '') || '/';
    if (req.method === 'GET' && route === '/health') return res.json({ configured: Boolean(getKey()), provider: 'OpenAI' });
    if (req.method !== 'POST' || route !== '/chat') return res.status(404).json({ error: 'No disponible.' });
    if (!origin || req.headers['x-kapi-client'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) return res.status(403).json({ error: 'Solicitud no válida.' });
    if ((req.rawBody?.length || Buffer.byteLength(JSON.stringify(req.body || {}))) > 60000) return res.status(413).json({ error: 'El mensaje es demasiado largo.' });
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60000);
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const key = getKey();
      if (!key) throw new KapiError('configuration', 'No puedo conversar ahora. Puedes seguir usando mis guías.');
      const input = validInput(req.body);
      const initialSession = openSession(req.body.sessionToken, key);
      if (input.sessionId && initialSession?.id !== input.sessionId) throw Object.assign(Error('Empecemos una conversación nueva. Vuelve a escribir tu mensaje.'), { status: 410, code: 'session_expired' });
      const budget = budgetFor(key);
      await budget.message(req.ip || req.socket?.remoteAddress || 'unknown');
      let saved;
      const assistant = assistantFactory({ catalog, getKey: async () => key, charge: budget.provider,
        loadSearchCache: loadCache, saveSearchCache: saveCache, initialSession,
        onSession: (id, session) => { saved = { id, session: { ...session, busy: false } }; } });
      const reply = await assistant.chat(input, controller.signal);
      const { usage, model, catalog: catalogInfo, ...publicReply } = reply;
      if (!res.destroyed) res.json({ ...publicReply, sessionToken: saved ? sealSession(saved, key) : null });
    } catch (error) {
      if (!res.destroyed) res.status(error.status || 503).json({ code: error.code || 'unavailable',
        error: error instanceof KapiError || error.code === 'session_expired' ? error.message : 'No pude responder ahora. Inténtalo de nuevo en un momento.' });
    } finally { clearTimeout(timeout); res.off('close', cancel); }
  };
}
