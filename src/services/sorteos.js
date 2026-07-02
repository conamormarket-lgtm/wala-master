// ── Servicio de Sorteos (Módulo Sorteos, Build 1) ───────────────────────────
// Lecturas públicas del sorteo + wrapper de la Cloud Function callable
// `participarSorteoGratis` (contrato del Agente A). Sigue el molde de
// services/flashOffers.js (lecturas) y services/payments.js / ruleta.js
// (callables). Convención de retorno: { data, error }.
//
// FILOSOFÍA DE POCAS LECTURAS (regla dura del proyecto):
//   - La página NO escanea la subcolección de participantes.
//   - El contador en vivo se calcula sumando ~10 shards de la subcolección
//     `contador` (lectura pública barata), NO con onSnapshot ni escaneos.
//   - El estado "mi participación" es 1 solo doc por uid (idempotente).
import { getCollection, getDocument } from './firebase/firestore';
import { db } from './firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Colección raíz de sorteos.
const COLLECTION = 'sorteos';

// Número de shards del contador distribuido. DEBE coincidir con la constante
// del backend SORTEO_CONTADOR_SHARDS (functions/index.js:3281). Los shards son
// docs con id "0".."9"; alguno puede no existir todavía (cuenta 0).
export const SORTEO_CONTADOR_SHARDS = 10;

/**
 * Devuelve el sorteo activo más reciente (1 query barata).
 * Filtra estado == "activo" y ordena por createdAt desc; toma el primero.
 * Si no hay ninguno, devuelve { data: null, error: null }.
 *
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const getSorteoActivo = async () => {
  // Filtro de UN solo campo (estado=='activo') → NO requiere índice compuesto.
  // Normalmente hay 1 sorteo activo; si hubiera varios, se ordena en cliente por
  // createdAt (son poquísimos docs, barato) y se devuelve el más reciente.
  const { data, error } = await getCollection(
    COLLECTION,
    [{ field: 'estado', operator: '==', value: 'activo' }],
  );
  if (error) return { data: null, error };
  const ms = (t) => t?.toMillis?.() ?? t?.seconds ?? 0;
  const ordenados = [...(data || [])].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  return { data: ordenados[0] || null, error: null };
};

/**
 * Lee un sorteo por id.
 *
 * @param {string} id - sorteos/{id}
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const getSorteoById = async (id) => {
  if (!id) return { data: null, error: 'Falta el id del sorteo' };
  return await getDocument(COLLECTION, id);
};

/**
 * Lee la participación del usuario en un sorteo (1 solo doc, id = uid).
 * Idempotente: si no participa, devuelve { data: null, error: null }.
 *
 * @param {string} sorteoId
 * @param {string} uid
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const getMiParticipacion = async (sorteoId, uid) => {
  if (!sorteoId || !uid) return { data: null, error: null };
  const { data, error } = await getDocument(`${COLLECTION}/${sorteoId}/participantes`, uid);
  // getDocument devuelve error 'Documento no encontrado' si aún no participa:
  // eso NO es un error real para la UI, es simplemente "todavía no participa".
  if (error === 'Documento no encontrado') return { data: null, error: null };
  return { data: data || null, error: error || null };
};

/**
 * Contador en vivo: suma los ~10 shards de sorteos/{id}/contador (lectura
 * pública, pocas lecturas). Si un shard no existe, cuenta 0. Devuelve el total.
 * NO escanea la subcolección de participantes.
 *
 * @param {string} sorteoId
 * @returns {Promise<{ data: number, error: string|null }>}
 */
export const getContadorSorteo = async (sorteoId) => {
  if (!sorteoId) return { data: 0, error: null };
  if (!db) return { data: 0, error: null };
  try {
    // Leemos la subcolección completa de shards de una vez (a lo sumo N docs).
    const snap = await getDocs(collection(db, COLLECTION, sorteoId, 'contador'));
    let total = 0;
    snap.forEach((d) => {
      const c = d.data()?.count;
      if (typeof c === 'number') total += c;
    });
    return { data: total, error: null };
  } catch (e) {
    return { data: 0, error: e?.message || 'Error al leer el contador' };
  }
};

/**
 * Wrapper de la callable `participarSorteoGratis` (contrato Agente A).
 * El servidor toma el uid del token y el perfil server-side; el cliente solo
 * envía sorteoId y origenApp (getClientType()==='APP').
 *
 * Respuesta OK: { ok:true, yaParticipa:boolean, participacion:<doc> }.
 * Los errores de negocio llegan como HttpsError.message (ej. "completa tu perfil",
 * "debes entrar desde el app", "El sorteo no está activo", etc.).
 *
 * @param {string} sorteoId
 * @param {boolean} origenApp
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const participarGratis = async (sorteoId, origenApp = false) => {
  try {
    const callable = httpsCallable(getFunctions(), 'participarSorteoGratis');
    const res = await callable({ sorteoId, origenApp: !!origenApp });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo registrar la participación.' };
  }
};
