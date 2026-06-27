// ─────────────────────────────────────────────────────────────────────────────
// Servicio de tipo de cambio (FX) para el checkout multi-moneda.
//
// FUENTE DE VERDAD: documento Firestore `config/fx`, que escribe una Cloud
// Function diaria leyendo una API FX gratuita. El frontend SOLO LEE este doc.
//
// Estructura esperada del documento config/fx:
//   {
//     penPerUsd: number,            // cuántos PEN equivalen a 1 USD (p.ej. 3.8)
//     margin:    number,            // margen de cobro FX, p.ej. 0.04 = 4%
//     localPerUsd: { ISO_MONEDA: number }, // tasas por CÓDIGO DE MONEDA (no país):
//                                   //   cuántas unidades de esa moneda = 1 USD
//                                   //   (p.ej. { COP: 4000, ARS: 950, EUR: 0.9 })
//     updatedAt: Timestamp          // marca de tiempo de la última actualización
//   }
//
// REGLA DE DINERO: NUNCA se modifican los totales/descuentos en PEN. El USD se
// calcula A PARTIR del total final en PEN (con el descuento ya aplicado).
//
// TOLERANCIA A FALLOS: si Firestore falla, se usa la caché de localStorage
// (válida por <24h); si tampoco hay caché válida, se usa un FALLBACK fijo. De
// este modo el checkout SIEMPRE puede cobrar, aunque sea con una tasa estimada.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from './firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getCurrency } from '../constants/currencies';

// Clave y ventana de validez de la caché en localStorage.
const FX_CACHE_KEY = 'wala_fx_cache';
const FX_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

// Fallback fijo: se usa solo si Firestore falla Y no hay caché válida (<24h).
// Garantiza que el checkout nunca se quede sin poder convertir/cobrar.
const FX_FALLBACK = {
  penPerUsd: 3.8,
  margin: 0.04,
  localPerUsd: {},
};

/**
 * Normaliza un objeto FX crudo (de Firestore o de caché) a la forma segura que
 * usa el resto del servicio. Tolerante a undefined / campos faltantes.
 * @param {object|null|undefined} raw
 * @returns {{penPerUsd:number, margin:number, localPerUsd:Object}}
 */
function normalizeFx(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};

  // penPerUsd debe ser un número finito y positivo; si no, fallback.
  const penPerUsd =
    typeof src.penPerUsd === 'number' && isFinite(src.penPerUsd) && src.penPerUsd > 0
      ? src.penPerUsd
      : FX_FALLBACK.penPerUsd;

  // margin debe ser un número finito >= 0; si no, fallback.
  const margin =
    typeof src.margin === 'number' && isFinite(src.margin) && src.margin >= 0
      ? src.margin
      : FX_FALLBACK.margin;

  // localPerUsd debe ser un objeto plano; si no, objeto vacío.
  const localPerUsd =
    src.localPerUsd && typeof src.localPerUsd === 'object' && !Array.isArray(src.localPerUsd)
      ? src.localPerUsd
      : {};

  return { penPerUsd, margin, localPerUsd };
}

/**
 * Lee la caché de localStorage. Devuelve el objeto FX normalizado si existe y
 * tiene menos de 24h; en caso contrario, null. Tolerante a entornos sin
 * localStorage (SSR, etc.) y a JSON corrupto.
 * @returns {{penPerUsd:number, margin:number, localPerUsd:Object}|null}
 */
function readCache() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const ts = typeof parsed?.timestamp === 'number' ? parsed.timestamp : 0;

    // Caché vencida (>=24h) -> se ignora.
    if (!ts || Date.now() - ts >= FX_CACHE_MAX_AGE_MS) return null;

    return normalizeFx(parsed.fx);
  } catch (e) {
    // JSON corrupto o acceso denegado: tratamos como si no hubiera caché.
    return null;
  }
}

/**
 * Guarda el objeto FX en localStorage con marca de tiempo. Silencioso ante
 * fallos (modo incógnito, cuota llena, etc.).
 * @param {{penPerUsd:number, margin:number, localPerUsd:Object}} fx
 */
function writeCache(fx) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      FX_CACHE_KEY,
      JSON.stringify({ fx, timestamp: Date.now() })
    );
  } catch (e) {
    // No es crítico: si no podemos cachear, el siguiente getFx volverá a leer
    // Firestore. No rompemos el checkout por esto.
  }
}

/**
 * Obtiene la configuración FX vigente.
 *
 * Estrategia (en orden):
 *   1. Intenta leer Firestore `config/fx`. Si funciona, normaliza, cachea en
 *      localStorage y devuelve.
 *   2. Si Firestore falla (o el doc no existe / db es null), usa la caché de
 *      localStorage si tiene <24h.
 *   3. Si tampoco hay caché válida, devuelve el FALLBACK fijo.
 *
 * SIEMPRE resuelve con un objeto FX usable: nunca lanza, nunca deja el checkout
 * sin poder cobrar.
 *
 * @returns {Promise<{penPerUsd:number, margin:number, localPerUsd:Object}>}
 */
export async function getFx() {
  // 1) Intentar Firestore.
  try {
    if (db) {
      const ref = doc(db, 'config', 'fx');
      const snap = await getDoc(ref);
      if (snap && snap.exists()) {
        const fx = normalizeFx(snap.data());
        writeCache(fx);
        return fx;
      }
      // El doc no existe: no es un error de red, pero tampoco hay tasa fresca.
      // Caemos a caché / fallback más abajo.
    }
  } catch (e) {
    // Error de red / permisos / offline: caemos a caché / fallback.
    // No relanzamos; el checkout debe poder continuar.
    // eslint-disable-next-line no-console
    console.warn('[fx] No se pudo leer config/fx de Firestore, usando caché o fallback:', e?.message || e);
  }

  // 2) Caché válida (<24h).
  const cached = readCache();
  if (cached) return cached;

  // 3) Fallback fijo.
  return { ...FX_FALLBACK, localPerUsd: { ...FX_FALLBACK.localPerUsd } };
}

/**
 * Convierte un monto en PEN a USD aplicando el margen de cobro FX.
 *
 *   usd = (penAmount / penPerUsd) * (1 + margin)
 *
 * Se redondea a 2 decimales (centavos). Tolerante a undefined: si `fx` o sus
 * campos faltan, usa el fallback para no romper el cobro.
 *
 * @param {number} penAmount  Total final en PEN (con descuento ya aplicado).
 * @param {{penPerUsd:number, margin:number}} [fx]
 * @returns {number} Monto en USD redondeado a 2 decimales (0 si la entrada es inválida).
 */
export function penToUsd(penAmount, fx) {
  const amount = typeof penAmount === 'number' && isFinite(penAmount) ? penAmount : 0;

  const penPerUsd =
    fx && typeof fx.penPerUsd === 'number' && isFinite(fx.penPerUsd) && fx.penPerUsd > 0
      ? fx.penPerUsd
      : FX_FALLBACK.penPerUsd;

  const margin =
    fx && typeof fx.margin === 'number' && isFinite(fx.margin) && fx.margin >= 0 && fx.margin <= 1
      ? fx.margin
      : FX_FALLBACK.margin; // defensa: margen fuera de [0,1] = misconfig → usa fallback

  const usd = (amount / penPerUsd) * (1 + margin);

  // Redondeo a 2 decimales evitando errores de coma flotante.
  return Math.round((usd + Number.EPSILON) * 100) / 100;
}

/**
 * Convierte un monto en PEN a la moneda local de un país, SOLO para mostrar
 * (display informativo). PayPal SIEMPRE cobra en USD; esto es texto al usuario.
 *
 *   localAmount = fx.localPerUsd[ISO] * (penAmount / penPerUsd)
 *
 * NO aplica el margen FX (es una estimación visual de la moneda local del
 * comprador, no el monto de cobro). Tolerante a undefined.
 *
 * @param {number} penAmount     Total final en PEN.
 * @param {string} countryCode   Código ISO del país (p.ej. 'CO', 'AR').
 * @param {{penPerUsd:number, localPerUsd:Object}} [fx]
 * @returns {number|null} Monto en moneda local, o null si no hay tasa para ese país.
 */
export function penToLocal(penAmount, countryCode, fx) {
  const amount = typeof penAmount === 'number' && isFinite(penAmount) ? penAmount : 0;

  const penPerUsd =
    fx && typeof fx.penPerUsd === 'number' && isFinite(fx.penPerUsd) && fx.penPerUsd > 0
      ? fx.penPerUsd
      : FX_FALLBACK.penPerUsd;

  // config/fx indexa localPerUsd por CÓDIGO DE MONEDA (COP, ARS, EUR…), NO por país.
  // Mapeamos país→moneda con getCurrency. Para PEN/USD no aplica un "equivalente local".
  const moneda = getCurrency(countryCode)?.iso || '';
  if (moneda === 'PEN' || moneda === 'USD') return null;
  const localPerUsd =
    fx && fx.localPerUsd && typeof fx.localPerUsd === 'object' ? fx.localPerUsd : {};

  const rate = localPerUsd[moneda];

  // Sin tasa para ese país -> null (el caller decide qué mostrar).
  if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) return null;

  const usd = amount / penPerUsd; // USD base (sin margen) para el display local.
  return rate * usd;
}

export default { getFx, penToUsd, penToLocal };
