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
import {
  getCollection,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from './firebase/firestore';
import { db } from './firebase/config';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Colección raíz de sorteos.
const COLLECTION = 'sorteos';

// Convierte un texto en slug URL-safe (minúsculas, sin acentos, guiones).
// Se usa para derivar el slug del sorteo a partir del TÍTULO automáticamente.
export const slugifySorteo = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')      // no alfanumérico → guion
    .replace(/(^-|-$)/g, '')          // sin guiones sobrantes en los extremos
    .slice(0, 60);

// Devuelve un slug ÚNICO en la colección: si `base` ya existe en otro sorteo,
// prueba base-2, base-3… hasta encontrar uno libre (pocos docs, barato).
const slugUnicoSorteo = async (base, excluirId = null) => {
  const limpio = slugifySorteo(base) || 'sorteo';
  const { data } = await getCollection(COLLECTION);
  const usados = new Set(
    (data || [])
      .filter((s) => s.id !== excluirId && s.slug)
      .map((s) => String(s.slug).toLowerCase()),
  );
  if (!usados.has(limpio)) return limpio;
  let i = 2;
  while (usados.has(`${limpio}-${i}`)) i += 1;
  return `${limpio}-${i}`;
};

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
 * Lee un sorteo por su SLUG (para la ruta pública /sorteos/{slug}). Filtro de un
 * solo campo (slug=='...') → NO requiere índice compuesto. Devuelve el primero.
 *
 * @param {string} slug
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const getSorteoBySlug = async (slug) => {
  const limpio = slugifySorteo(slug || '');
  if (!limpio) return { data: null, error: 'Falta el slug del sorteo' };
  const { data, error } = await getCollection(
    COLLECTION,
    [{ field: 'slug', operator: '==', value: limpio }],
  );
  if (error) return { data: null, error };
  // Por si hubiera colisión histórica, prioriza el activo más reciente.
  const ms = (t) => t?.toMillis?.() ?? t?.seconds ?? 0;
  const ordenados = [...(data || [])].sort((a, b) => {
    const activoA = a.estado === 'activo' ? 1 : 0;
    const activoB = b.estado === 'activo' ? 1 : 0;
    if (activoA !== activoB) return activoB - activoA;
    return ms(b.createdAt) - ms(a.createdAt);
  });
  return { data: ordenados[0] || null, error: null };
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
export const participarGratis = async (sorteoId, origenApp = false, datos = {}) => {
  try {
    const callable = httpsCallable(getFunctions(), 'participarSorteoGratis');
    // `datos` = formulario público (nombres/apellidos/documento/teléfono/correo…).
    const res = await callable({ sorteoId, origenApp: !!origenApp, datos });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo registrar la participación.' };
  }
};

// ── CRUD ADMIN ──────────────────────────────────────────────────────────────
// Escrituras del panel admin. Las reglas de Firestore restringen estas
// operaciones al administrador (base compartida con el ERP). Sigue el molde de
// services/flashOffers.js. Convención de retorno de firebase/firestore:
//   createDocument → { id, error }; update/delete → { error }.

/**
 * Lista TODOS los sorteos (uso admin), del más reciente al más antiguo.
 * Ordena por createdAt desc en cliente (son pocos docs, barato) para no exigir
 * un índice compuesto. Convención de retorno: { data, error }.
 *
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export const getSorteos = async () => {
  const { data, error } = await getCollection(COLLECTION);
  if (error) return { data: [], error };
  const ms = (t) => t?.toMillis?.() ?? t?.seconds ?? 0;
  const ordenados = [...(data || [])].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  return { data: ordenados, error: null };
};

/**
 * Normaliza el payload del formulario admin al CONTRATO del doc sorteo.
 * El precioTicket solo tiene sentido si el tipo es "pagado"; en "gratis" se
 * fuerza a 0. NUNCA se escribe contadorParticipantes desde el cliente: lo
 * mantienen los shards del contador (Build 1).
 *
 * @param {object} data - valores del formulario
 * @returns {object} documento listo para Firestore
 */
const construirDocSorteo = (data) => {
  const tipo = data.tipo === 'pagado' ? 'pagado' : 'gratis';
  return {
    titulo: (data.titulo || '').trim(),
    // Slug del sorteo (para /sorteos/{slug}). Si el form trae uno, se respeta
    // (ya normalizado); si no, se deriva del título. La UNICIDAD la garantiza
    // createSorteo/updateSorteo con slugUnicoSorteo antes de escribir.
    slug: slugifySorteo(data.slug || data.titulo),
    descripcion: (data.descripcion || '').trim(),
    tipo,
    // El precio del ticket SIEMPRE se guarda en el doc del sorteo; es la única
    // fuente de verdad del cobro server-side. En sorteos gratis va en 0.
    precioTicket: tipo === 'pagado' ? Number(data.precioTicket) || 0 : 0,
    moneda: 'PEN',
    requisitoApp: data.requisitoApp || 'ninguno',
    numGanadores: Number(data.numGanadores) || 1,
    premio: {
      nombre: (data.premioNombre || '').trim(),
      imagenUrl: data.premioImagenUrl || '',
      valor: Number(data.premioValor) || 0,
    },
    heroImagenUrl: data.heroImagenUrl || '',
    fechaInicio: data.fechaInicio || '',
    fechaFin: data.fechaFin || '',
    estado: data.estado || 'borrador',
    chanceExtraCompartir: !!data.chanceExtraCompartir,
    chanceExtraReferido: !!data.chanceExtraReferido,
  };
};

/**
 * Crea un sorteo. createDocument añade createdAt/updatedAt (serverTimestamp).
 *
 * @param {object} data - valores del formulario admin
 * @returns {Promise<{ id: string|null, error: string|null }>}
 */
export const createSorteo = async (data) => {
  const doc = construirDocSorteo(data);
  // Slug ÚNICO derivado del título (o del slug editado). Se genera SIEMPRE al
  // crear para que /sorteos/{slug} funcione de una vez.
  doc.slug = await slugUnicoSorteo(doc.slug || doc.titulo);
  return await createDocument(COLLECTION, doc);
};

/**
 * Actualiza un sorteo existente. updateDocument añade updatedAt.
 *
 * @param {string} id
 * @param {object} data - valores del formulario admin
 * @returns {Promise<{ error: string|null }>}
 */
export const updateSorteo = async (id, data) => {
  if (!id) return { error: 'Falta el id del sorteo' };
  const doc = construirDocSorteo(data);
  // Mantiene el slug único (excluyendo este mismo sorteo). Si el título/slug no
  // cambió, slugUnicoSorteo devuelve el mismo valor.
  doc.slug = await slugUnicoSorteo(doc.slug || doc.titulo, id);
  return await updateDocument(COLLECTION, id, doc);
};

/**
 * Elimina un sorteo (solo el doc raíz).
 *
 * @param {string} id
 * @returns {Promise<{ error: string|null }>}
 */
export const deleteSorteo = async (id) => {
  if (!id) return { error: 'Falta el id del sorteo' };
  return await deleteDocument(COLLECTION, id);
};

/**
 * Lee la subcolección de participantes de un sorteo (SOLO uso admin).
 * Con límite/paginación básica para no escanear colecciones grandes: por
 * defecto 200 docs ordenados por createdAt desc. NO se usa en la página
 * pública (allí rige la filosofía de pocas lecturas).
 *
 * @param {string} sorteoId
 * @param {number} [max=200] - tope de documentos a leer
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export const getParticipantes = async (sorteoId, max = 200) => {
  if (!sorteoId) return { data: [], error: 'Falta el id del sorteo' };
  if (!db) return { data: [], error: null };
  try {
    const ref = collection(db, COLLECTION, sorteoId, 'participantes');
    // Ordena por createdAt desc con tope; si no hubiera índice/campo, Firestore
    // igual responde porque es una subcolección de un solo campo de orden.
    const q = query(ref, orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e?.message || 'Error al leer los participantes' };
  }
};

// ── WRAPPERS DE CALLABLES (contrato Agente A) ────────────────────────────────

/**
 * Wrapper de la callable `asignarTicketsManual` (Agente A). Permite al admin
 * asignar tickets a un participante identificado por correo, teléfono o DNI.
 * Si la CF aún no existe, el botón queda cableado a este nombre y devolverá el
 * error de la llamada.
 *
 * @param {{ sorteoId:string, correo?:string, telefono?:string, dni?:string, cantidad:number }} params
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const asignarTicketsManual = async ({ sorteoId, correo, telefono, dni, cantidad }) => {
  try {
    const callable = httpsCallable(getFunctions(), 'asignarTicketsManual');
    const payload = { sorteoId, cantidad: Number(cantidad) || 0 };
    // Solo se envían los identificadores presentes (correo / teléfono / DNI).
    if (correo) payload.correo = correo;
    if (telefono) payload.telefono = telefono;
    if (dni) payload.dni = dni;
    const res = await callable(payload);
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudieron asignar los tickets.' };
  }
};

/**
 * Wrapper de la callable `comprarTicketSorteoSecure` (Agente A). SOLO crea la
 * intención de compra (ticket con pagoConfirmado=false); NO cobra. El precio lo
 * calcula el servidor a partir del doc del sorteo (precioTicket*cantidad). El
 * cliente debe reenviar la `metadata` devuelta TAL CUAL al disparar el pago.
 *
 * @param {{ sorteoId:string, cantidad:number }} params
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const comprarTicketSorteo = async ({ sorteoId, cantidad, datos = {} }) => {
  try {
    const callable = httpsCallable(getFunctions(), 'comprarTicketSorteoSecure');
    // `datos` = formulario público; el servidor lo guarda en el ticket (no afecta
    // el MONTO, que se recalcula precioTicket*cantidad server-side).
    const res = await callable({ sorteoId, cantidad: Number(cantidad) || 1, datos });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo crear la intención de compra.' };
  }
};

// ── WRAPPERS DE CHANCES EXTRA (contrato Agente A, Build 3) ───────────────────
// Chances por acciones virales. La CF suma la chance server-side (el cliente
// NUNCA suma sus propias chances directamente) y es idempotente por lock, así
// que llamar dos veces no acredita de más.

/**
 * Wrapper de la callable `sumarChanceCompartir` (Agente A). Suma +1 chance por
 * compartir el sorteo, UNA sola vez por sorteo. La CF es idempotente: si ya se
 * reclamó, devuelve { ok:true, yaReclamado:true } sin acreditar de nuevo.
 *
 * @param {string} sorteoId
 * @returns {Promise<{ data: { ok:boolean, yaReclamado:boolean }|null, error: string|null }>}
 */
export const sumarChanceCompartir = async (sorteoId) => {
  if (!sorteoId) return { data: null, error: 'Falta el id del sorteo' };
  try {
    const callable = httpsCallable(getFunctions(), 'sumarChanceCompartir');
    const res = await callable({ sorteoId });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo sumar la chance por compartir.' };
  }
};

/**
 * Wrapper de la callable `claimRaffleReferralSecure` (Agente A). El REFERIDO
 * (quien entra con ?ref=CODE) acredita +1 chance al DUEÑO del refCode. La CF es
 * idempotente por lock, así que se puede llamar sin miedo a duplicar.
 *
 * @param {string} sorteoId
 * @param {string} refCode - código "KS-XXXXXX" del referente
 * @returns {Promise<{ data: { ok:boolean, acreditado:boolean }|null, error: string|null }>}
 */
export const claimRaffleReferral = async (sorteoId, refCode) => {
  if (!sorteoId || !refCode) return { data: null, error: 'Faltan datos del referido' };
  try {
    const callable = httpsCallable(getFunctions(), 'claimRaffleReferralSecure');
    const res = await callable({ sorteoId, refCode });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo acreditar el referido.' };
  }
};

// ── WRAPPERS ADMIN: GANADORES + CHANCES (contrato Agente A, Build 3) ──────────
// El sorteo real (RNG + elegibilidad) vive 100% server-side. El cliente admin
// SOLO dispara la llamada y muestra el resultado + la evidencia auditable; NUNCA
// decide ganadores ni recalcula chances por su cuenta.

/**
 * Wrapper de la callable `decidirGanadoresSorteo` (Agente A). SOLO admin.
 *
 * MODO CIERRE: sin `excluirUids` → cierra el sorteo y fija los ganadores.
 * MODO RE-SORTEO: con `excluirUids` (uids de ganadores previos) → vuelve a
 * sortear SIN re-cerrar, excluyendo a esos uids del pool.
 *
 * Respuesta OK del servidor:
 *   { ok:true, drawId, ganadores:[{uid,nombre,correo,telefono,pesoUsado}],
 *     totalElegibles, seed (hex de 64 chars) }.
 * El hash del pool y demás evidencia viajan dentro de `res.data` y se muestran
 * tal cual como prueba de que el sorteo es verificable server-side.
 *
 * @param {{ sorteoId:string, numGanadores?:number, excluirUids?:string[] }} params
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const decidirGanadoresSorteo = async ({ sorteoId, numGanadores, excluirUids }) => {
  if (!sorteoId) return { data: null, error: 'Falta el id del sorteo' };
  try {
    const callable = httpsCallable(getFunctions(), 'decidirGanadoresSorteo');
    const payload = { sorteoId };
    // Los opcionales solo se envían con valor; el servidor aplica sus defaults
    // (numGanadores = sorteo.numGanadores || 1) cuando se omiten.
    if (Number.isFinite(Number(numGanadores)) && Number(numGanadores) > 0) {
      payload.numGanadores = Math.floor(Number(numGanadores));
    }
    // La PRESENCIA de excluirUids activa el MODO RE-SORTEO en el backend.
    if (Array.isArray(excluirUids) && excluirUids.length > 0) {
      payload.excluirUids = excluirUids;
    }
    const res = await callable(payload);
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo decidir los ganadores.' };
  }
};

/**
 * Wrapper de la callable `grantRaffleChancesSecure` (Agente A). SOLO admin.
 * Ajusta las chances de un participante identificado por correo, teléfono o DNI
 * (al menos UNO requerido). `chances` es un entero != 0 y PUEDE ser NEGATIVO
 * (para restar). El servidor recalcula chancesTotal de forma segura.
 *
 * Respuesta OK del servidor: { ok:true, uid, chancesTotal }.
 * NO toca pagos ni montos: solo mueve chances.
 *
 * @param {{ sorteoId:string, correo?:string, telefono?:string, dni?:string, chances:number, motivo?:string }} params
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const grantRaffleChancesSecure = async ({ sorteoId, correo, telefono, dni, chances, motivo }) => {
  if (!sorteoId) return { data: null, error: 'Falta el id del sorteo' };
  try {
    const callable = httpsCallable(getFunctions(), 'grantRaffleChancesSecure');
    // chances se envía como entero (permite negativo); Math.trunc no redondea.
    const payload = { sorteoId, chances: Math.trunc(Number(chances) || 0) };
    // Solo se envían los identificadores presentes (correo / teléfono / DNI).
    if (correo) payload.correo = correo;
    if (telefono) payload.telefono = telefono;
    if (dni) payload.dni = dni;
    if (motivo) payload.motivo = motivo;
    const res = await callable(payload);
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudieron ajustar las chances.' };
  }
};
