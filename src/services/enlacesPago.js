/* =========================================================================
   enlacesPago — lectura de la colección "enlaces_pago" para el HISTORIAL
   -------------------------------------------------------------------------
   Módulo de servicio (solo LECTURA) para la sección de Historial + Analíticas
   de "Gestión de Pagos". Lee la colección "enlaces_pago" ordenada por
   createdAt desc con un LÍMITE (POCAS lecturas): la analítica se calcula en
   cliente sobre este único snapshot y se cachea con react-query (staleTime
   alto). Nada de localStorage para estado; nada de suscripciones en vivo.

   Esquema de cada documento (ver AdminGeneradorPagos.jsx):
     {
       concepto: string,
       moneda: "PEN" | "USD",
       monto: number,
       montoPEN?: number,          // por retrocompat cuando moneda === "PEN"
       montoUSD?: number,          // por retrocompat cuando moneda === "USD"
       estado: "pendiente" | "pagado",
       createdAt: Timestamp,       // sello de servidor (firestore.js)
       updatedAt?: Timestamp,
       pagadoEn?: Timestamp,       // cuando el pago se confirma
       culqiChargeId?: string,     // presente si pagó por Culqi (PEN)
       paypalOrderId?: string,     // presente si pagó por PayPal (USD)
     }
   ========================================================================= */

import { getCollection } from './firebase/firestore';

/**
 * Normaliza un valor de fecha de Firestore (Timestamp | Date | número | string)
 * a milisegundos epoch, o null si no se puede interpretar. Firestore devuelve
 * Timestamps con .toMillis()/.toDate(); toleramos también seconds/nanoseconds.
 * @param {*} ts
 * @returns {number|null}
 */
export function tsAMillis(ts) {
  if (ts == null) return null;
  // Timestamp de Firestore (SDK modular).
  if (typeof ts === 'object') {
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') {
      const d = ts.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
    }
    // Forma serializada { seconds, nanoseconds }.
    if (typeof ts.seconds === 'number') {
      return ts.seconds * 1000 + Math.round((ts.nanoseconds || 0) / 1e6);
    }
  }
  if (ts instanceof Date) {
    return Number.isNaN(ts.getTime()) ? null : ts.getTime();
  }
  const n = typeof ts === 'string' ? Date.parse(ts) : Number(ts);
  return Number.isNaN(n) ? null : n;
}

/**
 * Deriva el MÉTODO de cobro de un enlace de forma HONESTA:
 *  - Si hay culqiChargeId → 'culqi' (aunque falte moneda).
 *  - Si hay paypalOrderId → 'paypal'.
 *  - Si no hay identificador de pago, se infiere por la moneda del enlace
 *    (PEN → Culqi, USD → PayPal), que es la pasarela que se USARÁ al pagar.
 * @param {object} e enlace normalizado
 * @returns {'culqi'|'paypal'|'desconocido'}
 */
export function metodoDeEnlace(e) {
  if (e?.culqiChargeId) return 'culqi';
  if (e?.paypalOrderId) return 'paypal';
  if (e?.moneda === 'PEN') return 'culqi';
  if (e?.moneda === 'USD') return 'paypal';
  return 'desconocido';
}

/**
 * Normaliza un documento crudo de "enlaces_pago" a una forma estable y validada
 * que la UI puede consumir sin defensas repetidas. NO inventa datos: los campos
 * ausentes quedan en null (nunca ceros/estados engañosos).
 *
 * @param {object} raw documento con { id, ...data }
 * @returns {object}
 */
export function normalizarEnlace(raw) {
  const moneda = raw?.moneda === 'USD' ? 'USD' : raw?.moneda === 'PEN' ? 'PEN' : null;
  // Monto: prioriza `monto`; si falta, cae al específico por moneda (retrocompat).
  const montoNum = Number(
    raw?.monto ?? (moneda === 'USD' ? raw?.montoUSD : raw?.montoPEN),
  );
  const monto = Number.isFinite(montoNum) ? montoNum : null;

  const estado = raw?.estado === 'pagado' ? 'pagado' : 'pendiente';
  const createdMs = tsAMillis(raw?.createdAt);
  const pagadoMs = tsAMillis(raw?.pagadoEn);

  const base = {
    id: raw?.id,
    concepto: (raw?.concepto || '').trim(),
    moneda,
    monto,
    estado,
    createdMs,
    pagadoMs,
    culqiChargeId: raw?.culqiChargeId || null,
    paypalOrderId: raw?.paypalOrderId || null,
  };

  base.metodo = metodoDeEnlace(base);
  // Tiempo créado→pagado (ms), solo si está pagado y ambos sellos existen y son
  // coherentes (pagadoEn >= createdAt). Si no, null (sin números engañosos).
  base.tiempoPagoMs =
    estado === 'pagado' && createdMs != null && pagadoMs != null && pagadoMs >= createdMs
      ? pagadoMs - createdMs
      : null;

  return base;
}

/**
 * Lee TODOS los enlaces de pago generados, ordenados por createdAt desc, con
 * un límite duro (POCAS lecturas). Devuelve documentos NORMALIZADOS.
 *
 * @param {{ max?: number }} [opts]
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export async function getEnlacesPago({ max = 300 } = {}) {
  const { data, error } = await getCollection(
    'enlaces_pago',
    [],
    { field: 'createdAt', direction: 'desc' },
    max,
  );

  if (error) {
    return { data: [], error };
  }

  const enlaces = (Array.isArray(data) ? data : []).map(normalizarEnlace);
  return { data: enlaces, error: null };
}
