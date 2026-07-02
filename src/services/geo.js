// ── Detección de país por IP (internacionalización, aditivo) ─────────────
// Detecta el país del visitante vía ipwho.is (sin API key) y lo cachea en
// localStorage por 24h. Si la detección falla, SIEMPRE devuelve Perú ('PE')
// como fallback seguro: el flujo peruano nunca debe romperse.
//
// API del contrato:
//   detectCountry(): Promise<{ code, name, dialCode }>
//
// 'code' es el ISO 3166-1 alpha-2 en mayúsculas (p.ej. 'PE', 'US', 'MX').

import { countryByCode } from '../constants/countries';

const CACHE_KEY = 'wala_geo_country';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Fallback innegociable: si algo falla, el país es Perú.
const FALLBACK = { code: 'PE', name: 'Perú', dialCode: '+51' };

// Normaliza cualquier resultado a la forma { code, name, dialCode }.
// Prefiere los datos canónicos de COUNTRIES (dialCode/name consistentes con
// el resto de la app) y cae al fallback si el código no está soportado.
function normalize(code, fallbackName, fallbackDial) {
  const upper = (code || '').toUpperCase();
  const known = upper ? countryByCode(upper) : null;
  if (known) {
    return { code: known.code, name: known.name, dialCode: known.dialCode };
  }
  if (upper) {
    return {
      code: upper,
      name: fallbackName || upper,
      dialCode: fallbackDial || FALLBACK.dialCode,
    };
  }
  return { ...FALLBACK };
}

// Lee la caché si existe y no expiró. Devuelve null si no hay o está vencida.
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.code || !parsed.ts) return null;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return { code: parsed.code, name: parsed.name, dialCode: parsed.dialCode };
  } catch {
    return null;
  }
}

// Persiste el resultado con timestamp. Silencioso ante errores de storage.
function writeCache(country) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...country, ts: Date.now() })
    );
  } catch {
    /* localStorage no disponible: ignorar, no es crítico */
  }
}

// Lectura SÍNCRONA de la caché de país (para la analítica: enriquecer la
// sesión sin bloquear el render ni esperar red). Devuelve { code, name,
// dialCode } si hay caché vigente o null si no hay/expiró. Importante: la
// caché SOLO se escribe tras una detección IP exitosa (el fallback PE nunca
// se cachea), así que un hit de caché siempre equivale a fuente "ip".
export function getCachedCountry() {
  return readCache();
}

// Detecta el país del visitante. Cachea 24h en localStorage. Fallback = PE.
// El resultado incluye `source` EXPLÍCITO ('ip' | 'fallback') para que la
// analítica no tenga que inferir la fuente de la presencia de caché (que puede
// fallar en modo privado/WebView aunque la detección IP haya sido exitosa).
export async function detectCountry() {
  // 1) Caché válida (solo se escribe tras detección IP exitosa → fuente 'ip')
  const cached = readCache();
  if (cached) return { ...cached, source: 'ip' };

  // 2) Detección por IP
  try {
    const res = await fetch('https://ipwho.is/');
    if (!res.ok) throw new Error('geo http ' + res.status);
    const data = await res.json();
    // ipwho.is devuelve { success, country_code, country, calling_code, ... }
    if (data && data.success !== false && data.country_code) {
      const dial = data.calling_code ? `+${String(data.calling_code).replace(/^\+/, '')}` : null;
      const country = normalize(data.country_code, data.country, dial);
      writeCache(country);
      return { ...country, source: 'ip' };
    }
    throw new Error('geo sin country_code');
  } catch {
    // 3) Fallback seguro a Perú (no se cachea: reintentar en la próxima carga)
    return { ...FALLBACK, source: 'fallback' };
  }
}

export default detectCountry;
