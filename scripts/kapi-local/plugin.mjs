import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCatalog } from './catalog.mjs';
import { createAssistant, KapiError } from './assistant.mjs';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export function allowedRequest(req) {
  try {
    const host = new URL('http://' + req.headers.host);
    return LOOPBACK_HOSTS.has(host.hostname) && LOOPBACK_IPS.has(req.socket.remoteAddress)
      && (!req.headers.origin || req.headers.origin === host.origin)
      && (!req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']));
  } catch { return false; }
}
export async function readKey(file = path.join(os.homedir(), '.wala-kapi.env')) {
  try {
    const source = await fs.readFile(file, 'utf8');
    const key = source.replace(/^\uFEFF/, '').match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];
    return key?.startsWith('sk-') ? key : null;
  } catch { return null; }
}
export function kapiLocalPlugin({ projectId = 'sistema-gestion-3b225' } = {}) {
  return { name: 'kapi-private-local-api', apply: 'serve',
    configureServer(server) {
      const catalog = createCatalog({ projectId });
      const usageFile = path.join(os.homedir(), '.wala-kapi-usage.json');
      let usage, writing = Promise.resolve(), inFlight = false, arrivals = [];
      const charge = () => {
        const work = writing.then(async () => {
          const day = new Date().toISOString().slice(0, 10);
          if (!usage) {
            try { usage = JSON.parse(await fs.readFile(usageFile, 'utf8')); }
            catch (e) { if (e.code !== 'ENOENT') throw new KapiError('usage_file', 'No pude verificar el límite local de consultas.'); }
          }
          if (!usage || usage.day !== day) usage = { day, calls: 0 };
          if (!Number.isFinite(usage.calls) || usage.calls >= 200) throw new KapiError('daily_limit', 'Llegamos al límite de consultas de esta prueba por hoy.', 429);
          usage.calls++;
          await fs.writeFile(usageFile, JSON.stringify(usage), { mode: 0o600 });
        });
        writing = work.catch(() => {});
        return work;
      };
      const searchCacheFile = path.join(os.homedir(), '.wala-kapi-search-index.json');
      const assistant = createAssistant({ catalog, getKey: readKey, charge,
        loadSearchCache: async () => {
          if ((await fs.stat(searchCacheFile)).size > 12000000) return null;
          return JSON.parse(await fs.readFile(searchCacheFile, 'utf8'));
        },
        saveSearchCache: async data => {
          await fs.writeFile(searchCacheFile + '.tmp', JSON.stringify(data), { mode: 0o600 });
          await fs.rename(searchCacheFile + '.tmp', searchCacheFile);
        },
      });
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        // Vite serves arbitrary files in the workspace in DEV. Block accidental
        // copies of this private file even if they are created after startup.
        let decodedUrl;
        try { decodedUrl = decodeURIComponent(req.url || ''); } catch { decodedUrl = ''; }
        if (/wala-kapi\.env/i.test(decodedUrl)) { res.statusCode = 404; res.end(); return; }
        if (!pathname?.startsWith('/__kapi/')) return next();
        const send = (status, data) => { if (res.destroyed) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
        if (!allowedRequest(req)) return send(403, { error: 'Solo disponible desde esta página local.' });
        if (pathname === '/__kapi/health' && req.method === 'GET') return send(200, {
          configured: Boolean(await readKey()), provider: 'OpenAI', model: 'gpt-6-luna', catalog: catalog.status(), dailyCallLimit: 200,
        });
        const productMatch = pathname.match(/^\/__kapi\/product\/([\w-]{1,160})$/);
        if (productMatch && req.method === 'GET') {
          try {
            const product = await catalog.get(productMatch[1]);
            return product ? send(200, { product }) : send(404, { error: 'Este producto ya no está disponible.' });
          } catch { return send(503, { error: 'No pude cargar el producto. Inténtalo de nuevo.' }); }
        }
        if (pathname !== '/__kapi/chat' || req.method !== 'POST') return send(404, { error: 'No disponible.' });
        if (req.headers['x-kapi-local'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'Solicitud no válida.' });
        arrivals = arrivals.filter(at => Date.now() - at < 60000);
        if (inFlight || arrivals.length >= 12) return send(429, { error: 'Espera un momento antes de volver a escribir.' });
        inFlight = true; arrivals.push(Date.now());
        const controller = new AbortController();
        const cancel = () => controller.abort();
        res.on('close', cancel);
        const timeout = setTimeout(cancel, 60000);
        try {
          const chunks = []; let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > 12000) throw new KapiError('too_large', 'El mensaje es demasiado largo.', 413);
            chunks.push(chunk);
          }
          let body;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new KapiError('invalid_json', 'No pude leer el mensaje.', 400); }
          const result = await assistant.chat(body, controller.signal);
          send(200, result);
        } catch (e) {
          send(e instanceof KapiError ? e.status : 503, { code: e instanceof KapiError ? e.code : 'unavailable',
            error: e instanceof KapiError ? e.message : 'No pude terminar la consulta. Puedes intentarlo de nuevo o usar mis guías.' });
        } finally { clearTimeout(timeout); res.off('close', cancel); inFlight = false; }
      });
    },
  };
}
