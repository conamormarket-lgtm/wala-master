// ── Servicio de "Sorteo por Suscripción" ("No Hay Sin Suerte") ──────────────
// Lecturas públicas de la campaña + wrappers de las Cloud Functions callables del
// módulo backend "Sorteo por suscripción". Sigue el molde de services/sorteos.js
// (lecturas + CRUD admin) y respeta la FILOSOFÍA DE POCAS LECTURAS del proyecto:
//   - La página pública lee 1 doc de campaña + beneficios/ganadores (subcolecciones
//     cacheables) + la SUMA de ~10 shards del contador. NUNCA escanea suscriptores.
//   - "Mi suscripción" = 1 solo doc por uid.
//   - NADA de localStorage para estado (todo vive en la nube).
//
// Convención de retorno: { data, error } (igual que services/sorteos.js).
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

// Colección raíz de campañas de sorteo por suscripción.
const COLLECTION = 'sorteos_suscripcion';

// Número de shards del contador distribuido. DEBE coincidir con la constante del
// backend SUSCRIPCION_SHARDS (functions/index.js). Docs con id "0".."9".
export const SUSCRIPCION_SHARDS = 10;

// ── Helpers de presentación (slug + precio) ─────────────────────────────────

// Convierte un texto en slug URL-safe (minúsculas, sin acentos, guiones).
export const slugify = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-') // no alfanumérico → guion
    .replace(/(^-|-$)/g, '') // sin guiones sobrantes en los extremos
    .slice(0, 60);

// Formatea un precio en céntimos PEN (entero) como "S/ 12.34".
export const formatoPrecioPen = (centimos) => {
  const n = Number(centimos);
  if (!Number.isFinite(n)) return 'S/ 0.00';
  return `S/ ${(n / 100).toFixed(2)}`;
};

// Formatea un precio en USD (número) como "$ 12.34".
export const formatoPrecioUsd = (usd) => {
  const n = Number(usd);
  if (!Number.isFinite(n)) return '$ 0.00';
  return `$ ${n.toFixed(2)}`;
};

// Devuelve un slug ÚNICO en la colección: si `base` ya existe en otra campaña,
// prueba base-2, base-3… hasta encontrar uno libre (pocos docs, barato).
const slugUnico = async (base, excluirId = null) => {
  const limpio = slugify(base) || 'sorteo';
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

// ── LECTURAS PÚBLICAS ────────────────────────────────────────────────────────

/**
 * Lee una campaña por su SLUG (ruta pública). Filtro de un solo campo → sin índice
 * compuesto. Devuelve la primera coincidencia (prioriza la activa más reciente).
 *
 * @param {string} slug
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const getCampaignBySlug = async (slug) => {
  const limpio = slugify(slug || '');
  if (!limpio) return { data: null, error: 'Falta el slug de la campaña' };
  const { data, error } = await getCollection(
    COLLECTION,
    [{ field: 'slug', operator: '==', value: limpio }],
  );
  if (error) return { data: null, error };
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
 * Lee una campaña por id (sorteos_suscripcion/{id}).
 *
 * @param {string} id
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const getCampaignById = async (id) => {
  if (!id) return { data: null, error: 'Falta el id de la campaña' };
  return await getDocument(COLLECTION, id);
};

/**
 * Lee la suscripción del usuario en una campaña (1 solo doc, id = uid).
 * Idempotente: si no está suscrito, devuelve { data: null, error: null }.
 *
 * @param {string} campaignId
 * @param {string} uid
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export const getMiSuscripcion = async (campaignId, uid) => {
  if (!campaignId || !uid) return { data: null, error: null };
  const { data, error } = await getDocument(`${COLLECTION}/${campaignId}/suscriptores`, uid);
  if (error === 'Documento no encontrado') return { data: null, error: null };
  return { data: data || null, error: error || null };
};

/**
 * Contador en vivo de suscriptores: suma los ~10 shards de
 * sorteos_suscripcion/{id}/contador (lectura pública barata). NO escanea la
 * subcolección de suscriptores.
 *
 * @param {string} campaignId
 * @returns {Promise<{ data: number, error: string|null }>}
 */
export const getContadorSuscriptores = async (campaignId) => {
  if (!campaignId) return { data: 0, error: null };
  if (!db) return { data: 0, error: null };
  try {
    const snap = await getDocs(collection(db, COLLECTION, campaignId, 'contador'));
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
 * Lee los beneficios (marcas/descuentos) de la campaña (lectura pública, cacheable).
 * Ordena por `orden` asc si existe.
 *
 * @param {string} campaignId
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export const getBeneficios = async (campaignId) => {
  if (!campaignId) return { data: [], error: 'Falta el id de la campaña' };
  const { data, error } = await getCollection(`${COLLECTION}/${campaignId}/beneficios`);
  if (error) return { data: [], error };
  const ordenados = [...(data || [])].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  return { data: ordenados, error: null };
};

/**
 * Lee la galería de ganadores anteriores (lectura pública, cacheable). Ordena por
 * `orden` asc; tope configurable.
 *
 * @param {string} campaignId
 * @param {number} [max=60]
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export const getGanadoresGaleria = async (campaignId, max = 60) => {
  if (!campaignId) return { data: [], error: 'Falta el id de la campaña' };
  if (!db) return { data: [], error: null };
  try {
    const ref = collection(db, COLLECTION, campaignId, 'ganadores_galeria');
    const snap = await getDocs(query(ref, limit(max)));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e?.message || 'Error al leer la galería de ganadores' };
  }
};

/**
 * Lee los recibos de cobro del usuario (sub-subcolección). Solo el dueño o admin
 * pueden leerlos (reglas de Firestore). Ordena por fecha desc.
 *
 * @param {string} campaignId
 * @param {string} uid
 * @param {number} [max=60]
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export const getRecibos = async (campaignId, uid, max = 60) => {
  if (!campaignId || !uid) return { data: [], error: null };
  if (!db) return { data: [], error: null };
  try {
    const ref = collection(db, COLLECTION, campaignId, 'suscriptores', uid, 'recibos');
    const snap = await getDocs(query(ref, orderBy('fecha', 'desc'), limit(max)));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e?.message || 'Error al leer los recibos' };
  }
};

// ── CRUD ADMIN: CAMPAÑAS ─────────────────────────────────────────────────────

/**
 * Lista TODAS las campañas (uso admin), de la más reciente a la más antigua.
 *
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export const getCampaigns = async () => {
  const { data, error } = await getCollection(COLLECTION);
  if (error) return { data: [], error };
  const ms = (t) => t?.toMillis?.() ?? t?.seconds ?? 0;
  const ordenados = [...(data || [])].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  return { data: ordenados, error: null };
};

/**
 * Normaliza el payload del formulario admin al CONTRATO del doc de campaña.
 * NUNCA se escribe contadorSuscriptores desde el cliente (lo mantienen los shards).
 *
 * @param {object} data - valores del formulario
 * @returns {object} documento listo para Firestore
 */
const construirDocCampana = (data) => {
  const estadosValidos = ['borrador', 'activo', 'cerrado'];
  const planes = Array.isArray(data.planes) ? data.planes : [];
  return {
    titulo: (data.titulo || '').trim(),
    slug: slugify(data.slug || data.titulo),
    descripcion: (data.descripcion || '').trim(),
    estado: estadosValidos.includes(data.estado) ? data.estado : 'borrador',
    heroImagenUrl: data.heroImagenUrl || '',
    logoUrl: data.logoUrl || '',
    colores: {
      primario: data.colores?.primario || '#111111',
      fondo: data.colores?.fondo || '#ffffff',
      texto: data.colores?.texto || '#111111',
      acento: data.colores?.acento || '#e60023',
    },
    numGanadores: Number(data.numGanadores) || 1,
    premios: (Array.isArray(data.premios) ? data.premios : []).map((p) => ({
      nombre: (p.nombre || '').trim(),
      imagenUrl: p.imagenUrl || '',
    })),
    // Los planes definen el MONTO autoritativo (precioCentimos/precioUsd) que el
    // backend usa server-side. chancesPorCiclo por defecto = meses si no se indica.
    planes: planes.map((p, i) => {
      const meses = Number(p.meses) || 1;
      return {
        id: p.id || `plan_${i}`,
        nombre: (p.nombre || '').trim(),
        intervalo: p.intervalo || 'mensual',
        meses,
        precioCentimos: Number(p.precioCentimos) || 0,
        precioUsd: Number(p.precioUsd) || 0,
        chancesPorCiclo: Number(p.chancesPorCiclo) || meses,
        beneficios: Array.isArray(p.beneficios) ? p.beneficios.filter(Boolean) : [],
        destacado: !!p.destacado,
        orden: Number(p.orden) || i,
      };
    }),
  };
};

/**
 * Crea una campaña con slug único derivado del título.
 *
 * @param {object} data - valores del formulario admin
 * @returns {Promise<{ id: string|null, error: string|null }>}
 */
export const createCampaign = async (data) => {
  const doc = construirDocCampana(data);
  doc.slug = await slugUnico(doc.slug || doc.titulo);
  return await createDocument(COLLECTION, doc);
};

/**
 * Actualiza una campaña existente (mantiene el slug único excluyendo su propio id).
 *
 * @param {string} id
 * @param {object} data - valores del formulario admin
 * @returns {Promise<{ error: string|null }>}
 */
export const updateCampaign = async (id, data) => {
  if (!id) return { error: 'Falta el id de la campaña' };
  const doc = construirDocCampana(data);
  doc.slug = await slugUnico(doc.slug || doc.titulo, id);
  return await updateDocument(COLLECTION, id, doc);
};

/**
 * Elimina una campaña (solo el doc raíz).
 *
 * @param {string} id
 * @returns {Promise<{ error: string|null }>}
 */
export const deleteCampaign = async (id) => {
  if (!id) return { error: 'Falta el id de la campaña' };
  return await deleteDocument(COLLECTION, id);
};

// ── CRUD ADMIN: BENEFICIOS ───────────────────────────────────────────────────

export const createBeneficio = async (campaignId, data) => {
  if (!campaignId) return { id: null, error: 'Falta el id de la campaña' };
  return await createDocument(`${COLLECTION}/${campaignId}/beneficios`, {
    marca: (data.marca || '').trim(),
    titulo: (data.titulo || '').trim(),
    descuento: (data.descuento || '').trim(),
    imagenUrl: data.imagenUrl || '',
    categoria: (data.categoria || '').trim(),
    ubicacion: (data.ubicacion || '').trim(),
    url: data.url || '',
    orden: Number(data.orden) || 0,
  });
};

export const updateBeneficio = async (campaignId, beneficioId, data) => {
  if (!campaignId || !beneficioId) return { error: 'Faltan ids' };
  return await updateDocument(`${COLLECTION}/${campaignId}/beneficios`, beneficioId, data);
};

export const deleteBeneficio = async (campaignId, beneficioId) => {
  if (!campaignId || !beneficioId) return { error: 'Faltan ids' };
  return await deleteDocument(`${COLLECTION}/${campaignId}/beneficios`, beneficioId);
};

// ── CRUD ADMIN: GALERÍA DE GANADORES ─────────────────────────────────────────

export const createGanadorGaleria = async (campaignId, data) => {
  if (!campaignId) return { id: null, error: 'Falta el id de la campaña' };
  return await createDocument(`${COLLECTION}/${campaignId}/ganadores_galeria`, {
    nombre: (data.nombre || '').trim(),
    premio: (data.premio || '').trim(),
    fotoUrl: data.fotoUrl || '',
    fecha: data.fecha || '',
    orden: Number(data.orden) || 0,
  });
};

export const updateGanadorGaleria = async (campaignId, gid, data) => {
  if (!campaignId || !gid) return { error: 'Faltan ids' };
  return await updateDocument(`${COLLECTION}/${campaignId}/ganadores_galeria`, gid, data);
};

export const deleteGanadorGaleria = async (campaignId, gid) => {
  if (!campaignId || !gid) return { error: 'Faltan ids' };
  return await deleteDocument(`${COLLECTION}/${campaignId}/ganadores_galeria`, gid);
};

// ── ADMIN: LISTADO DE SUSCRIPTORES (paginado, uso admin) ─────────────────────

/**
 * Lee la subcolección de suscriptores de una campaña (SOLO uso admin). Con tope
 * para no escanear colecciones grandes. NO se usa en la página pública.
 *
 * @param {string} campaignId
 * @param {number} [max=200]
 * @returns {Promise<{ data: object[], error: string|null }>}
 */
export const getSuscriptores = async (campaignId, max = 200) => {
  if (!campaignId) return { data: [], error: 'Falta el id de la campaña' };
  if (!db) return { data: [], error: null };
  try {
    const ref = collection(db, COLLECTION, campaignId, 'suscriptores');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e?.message || 'Error al leer los suscriptores' };
  }
};

// ── WRAPPERS DE CALLABLES (contrato del backend) ─────────────────────────────

/**
 * Wrapper de `crearSuscripcionCulqi`. El MONTO lo pone el servidor (plan.precioCentimos,
 * PEN); el cliente solo envía el tokenId de la tarjeta + datos del formulario.
 *
 * @param {{ campaignId:string, planId:string, tokenId:string, datos:object, origenApp?:boolean }} params
 * @returns {Promise<{ data:{ ok:boolean, estado:string, vigenciaHasta:string, subId:string, chargeId?:string }|null, error:string|null }>}
 */
export const crearSuscripcionCulqi = async ({ campaignId, planId, tokenId, datos = {}, origenApp = false }) => {
  try {
    const callable = httpsCallable(getFunctions(), 'crearSuscripcionCulqi');
    const res = await callable({ campaignId, planId, tokenId, datos, origenApp: !!origenApp });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo crear la suscripción.' };
  }
};

/**
 * Wrapper de `crearSuscripcionPaypal`. Devuelve subscriptionId + approveUrl para
 * redirigir al aprobador de PayPal. El MONTO lo pone el servidor (plan.precioUsd).
 *
 * @param {{ campaignId:string, planId:string, datos:object }} params
 * @returns {Promise<{ data:{ ok:boolean, subscriptionId:string, approveUrl:string|null }|null, error:string|null }>}
 */
export const crearSuscripcionPaypal = async ({ campaignId, planId, datos = {} }) => {
  try {
    const callable = httpsCallable(getFunctions(), 'crearSuscripcionPaypal');
    const res = await callable({ campaignId, planId, datos });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo crear la suscripción en PayPal.' };
  }
};

/**
 * Wrapper de `confirmarSuscripcionPaypal`. Tras aprobar en PayPal, confirma la
 * subscription y activa la suscripción local.
 *
 * @param {{ campaignId:string, planId:string, subscriptionId:string, datos:object }} params
 * @returns {Promise<{ data:{ ok:boolean, estado:string, vigenciaHasta:string, subId:string }|null, error:string|null }>}
 */
export const confirmarSuscripcionPaypal = async ({ campaignId, planId, subscriptionId, datos = {} }) => {
  try {
    const callable = httpsCallable(getFunctions(), 'confirmarSuscripcionPaypal');
    const res = await callable({ campaignId, planId, subscriptionId, datos });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo confirmar la suscripción de PayPal.' };
  }
};

/**
 * Wrapper de `cancelarSuscripcion`. El usuario cancela SU propia suscripción.
 *
 * @param {string} campaignId
 * @returns {Promise<{ data:{ ok:boolean, estado:string, vigenciaHasta:string|null }|null, error:string|null }>}
 */
export const cancelarSuscripcion = async (campaignId) => {
  if (!campaignId) return { data: null, error: 'Falta el id de la campaña' };
  try {
    const callable = httpsCallable(getFunctions(), 'cancelarSuscripcion');
    const res = await callable({ campaignId });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo cancelar la suscripción.' };
  }
};

/**
 * Wrapper de `decidirGanadoresSuscripcion` (SOLO admin). Sin `excluirUids` = cierre
 * normal (fija ganadores); con `excluirUids` = re-sorteo (arrayUnion).
 *
 * @param {{ campaignId:string, numGanadores?:number, excluirUids?:string[] }} params
 * @returns {Promise<{ data:{ ok:boolean, drawId:string, ganadores:object[], totalElegibles:number, seed:string, poolHash:string }|null, error:string|null }>}
 */
export const decidirGanadoresSuscripcion = async ({ campaignId, numGanadores, excluirUids }) => {
  if (!campaignId) return { data: null, error: 'Falta el id de la campaña' };
  try {
    const callable = httpsCallable(getFunctions(), 'decidirGanadoresSuscripcion');
    const payload = { campaignId };
    if (Number.isFinite(Number(numGanadores)) && Number(numGanadores) > 0) {
      payload.numGanadores = Math.floor(Number(numGanadores));
    }
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
 * Wrapper de `grantChancesSuscripcion` (SOLO admin). Ajusta las chances de un
 * suscriptor identificado por correo/telefono/dni (chances entero != 0, permite
 * negativo). El servidor recalcula chancesTotal de forma segura (clamp >= 0).
 *
 * @param {{ campaignId:string, correo?:string, telefono?:string, dni?:string, chances:number, motivo?:string }} params
 * @returns {Promise<{ data:{ ok:boolean, uid:string, chancesTotal:number }|null, error:string|null }>}
 */
export const grantChancesSuscripcion = async ({ campaignId, correo, telefono, dni, chances, motivo }) => {
  if (!campaignId) return { data: null, error: 'Falta el id de la campaña' };
  try {
    const callable = httpsCallable(getFunctions(), 'grantChancesSuscripcion');
    const payload = { campaignId, chances: Math.trunc(Number(chances) || 0) };
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
