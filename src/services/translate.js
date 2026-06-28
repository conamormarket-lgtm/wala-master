// ──────────────────────────────────────────────────────────────────────────────
// translate.js — Motor de traducción de contenido DINÁMICO (GRATIS) para Walá
//
// Traduce texto en tiempo de ejecución (nombres de producto, descripciones, etc.)
// usando instancias PÚBLICAS de Lingva, un proxy gratuito de Google Translate con
// CORS habilitado. No requiere API key ni dependencias externas.
//
// Principios de diseño:
//   - El idioma ORIGEN del contenido siempre es español ('es').
//   - TOLERANTE A FALLOS: si la red o todas las instancias fallan, devuelve el
//     texto ORIGINAL. Nunca lanza una excepción hacia el llamador.
//   - Caché en localStorage para no repetir peticiones (ahorra red y latencia).
//   - Sólo se cachean traducciones EXITOSAS (nunca el fallback al original).
// ──────────────────────────────────────────────────────────────────────────────

// Idiomas a los que sabemos traducir (deben coincidir con los soportados por la UI).
// 'es' es el origen, por lo que no se traduce a sí mismo.
const SUPPORTED_TARGETS = ['en', 'pt'];

// Instancias públicas de Lingva probadas en orden. Si una falla (caída, rate-limit,
// CORS, timeout), se intenta la siguiente. Se pueden agregar/quitar libremente.
const LINGVA_INSTANCES = [
  'https://lingva.ml',
  'https://translate.plausibility.cloud',
  'https://lingva.garudalinux.org',
];

// Tiempo máximo de espera por instancia antes de abortar e ir a la siguiente.
const TIMEOUT_MS = 5000;

// Prefijo de las claves de caché en localStorage.
const CACHE_PREFIX = 'wala_tr_';

// ── Utilidades ────────────────────────────────────────────────────────────────

// Hash simple y determinista (variante de djb2) para construir claves de caché
// cortas a partir del texto. No necesita ser criptográfico; sólo evitar colisiones
// razonablemente y producir una clave compacta.
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    // h * 33 + charCode, manteniendo el resultado en 32 bits.
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  // Se devuelve en base36 sin signo para una clave más corta.
  return (h >>> 0).toString(36);
}

// Construye la clave de caché para un texto/idioma destino concretos.
function cacheKey(text, target) {
  return CACHE_PREFIX + target + '_' + hash(text);
}

// Lee una traducción cacheada (o null). Tolerante a localStorage no disponible.
function readCache(text, target) {
  try {
    return window.localStorage.getItem(cacheKey(text, target));
  } catch {
    // Modo privado o storage lleno: simplemente no hay caché.
    return null;
  }
}

// Guarda una traducción en caché. Silencioso ante errores de storage.
function writeCache(text, target, translation) {
  try {
    window.localStorage.setItem(cacheKey(text, target), translation);
  } catch {
    // Si no se puede escribir (cuota, modo privado), seguimos sin cachear.
  }
}

// Realiza una petición GET a una instancia de Lingva con timeout vía AbortController.
// Devuelve la traducción (string) o null si esa instancia falla por cualquier motivo.
async function fetchFromInstance(inst, target, text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Endpoint Lingva: /api/v1/{origen}/{destino}/{texto}
    const url = `${inst}/api/v1/es/${target}/${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    // La traducción viene en data.translation; validamos que sea un string usable.
    if (data && typeof data.translation === 'string' && data.translation.length) {
      return data.translation;
    }
    return null;
  } catch {
    // Timeout (abort), error de red, CORS o JSON inválido: esta instancia falló.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

// Traduce `text` de español al idioma `target`.
//   - Si no hay texto, o el destino es 'es' / no soportado: devuelve `text` igual.
//   - Si hay caché: la devuelve sin red.
//   - Si no: prueba las instancias de Lingva en orden; la primera que responda gana.
//   - Si todas fallan: devuelve el texto ORIGINAL (nunca lanza).
export async function translateText(text, target) {
  // Sin texto o destino igual al origen / no soportado: nada que traducir.
  if (!text || target === 'es' || !SUPPORTED_TARGETS.includes(target)) {
    return text;
  }

  // 1) Caché: si ya lo tradujimos antes, evitamos la red.
  const cached = readCache(text, target);
  if (cached !== null) return cached;

  // 2) Red: probamos instancias en orden hasta que una responda con éxito.
  for (const inst of LINGVA_INSTANCES) {
    const translation = await fetchFromInstance(inst, target, text);
    if (translation !== null) {
      // Sólo cacheamos traducciones exitosas.
      writeCache(text, target, translation);
      return translation;
    }
  }

  // 3) Fallback tolerante a fallos: devolvemos el original sin cachearlo.
  return text;
}

// Traduce muchos textos a la vez con un límite de concurrencia para no saturar
// las instancias públicas. Devuelve un array de traducciones en el mismo orden.
// Igual de tolerante a fallos: cada texto cae a su original si no se puede traducir.
export async function translateMany(texts, target, concurrency = 4) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  // Atajo: si el destino es el origen o no está soportado, devolvemos los originales.
  if (target === 'es' || !SUPPORTED_TARGETS.includes(target)) {
    return texts.slice();
  }

  const results = new Array(texts.length);
  let nextIndex = 0;

  // Worker que va tomando índices pendientes hasta agotar la lista. Lanzamos
  // `concurrency` workers en paralelo: así nunca hay más de N peticiones a la vez.
  async function worker() {
    while (nextIndex < texts.length) {
      const i = nextIndex++;
      results[i] = await translateText(texts[i], target);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrency, texts.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

export default translateText;
