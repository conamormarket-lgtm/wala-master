import {
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const REFERRALS_COLLECTION = 'referrals';

// El link que abrió ESTE navegador. Lo escribe ReferralTracker y lo lee el
// checkout para mandarlo a prepareCheckoutPayment, que es quien decide si vale.
export const REFERRAL_STORAGE_KEY = 'wala_referral';
// Plazos (el servidor usa los mismos: functions/referidosLogic.js).
// Link de producto o de la tienda: 36 h desde que ESTA persona lo abrió.
export const VENTANA_REFERIDO_MS = 36 * 60 * 60 * 1000;
// Invitación aceptada (cuenta nueva): 30 días para su primera compra.
export const VENTANA_INVITACION_MS = 30 * 24 * 60 * 60 * 1000;
// Montos de la invitación a cuentas nuevas (los decide el servidor; acá solo
// para los textos).
export const BONO_BIENVENIDA_INVITACION = 10;
export const PREMIO_INVITACION = 15;

// Avisa a la página (AvisoInvitacion, checkout) que el link guardado cambió.
export const EVENTO_REFERIDO = 'wala:referido';
const avisarCambio = () => {
  try { window.dispatchEvent(new Event(EVENTO_REFERIDO)); } catch { /* sin window */ }
};

/** Hasta cuándo vale el link guardado (ms). */
export function venceReferido(data) {
  if (data?.invitacion === 'aceptada' && data.aceptadaMs) return data.aceptadaMs + VENTANA_INVITACION_MS;
  return (data?.timestamp || 0) + VENTANA_REFERIDO_MS;
}

/**
 * El link guardado si sigue vigente; si no, null:
 * { referrerCode, referralId, timestamp, tipo ('producto' | 'invitacion'),
 *   productId?, shareId?, nombre? (primer nombre de quien invitó),
 *   invitacion? ('aceptada' | 'no_aplica'), aceptadaMs?, bono? }
 */
export function leerReferidoGuardado() {
  try {
    const data = JSON.parse(localStorage.getItem(REFERRAL_STORAGE_KEY) || 'null');
    if (!data?.referralId || !(Date.now() < venceReferido(data))) return null;
    return data;
  } catch {
    return null;
  }
}

export function guardarReferido(data) {
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(data));
  } catch { /* modo privado: la compra sale sin referido */ }
  avisarCambio();
}

/** Tras una compra: cada link es una persona y una compra, no se reutiliza. */
export function olvidarReferido() {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch { /* nada que limpiar */ }
  avisarCambio();
}

/** Primer nombre de quien invitó (o null). Nunca lanza: el aviso es opcional. */
export async function getNombreInvitacion(referralId) {
  try {
    const res = await httpsCallable(getFunctions(), 'invitacionReferidoSecure')({ referralId });
    return res?.data?.nombre || null;
  } catch {
    return null;
  }
}

/**
 * Registra que esta persona abrió un link (registrarVisitaReferidoSecure).
 * Cada persona que entra cuenta aparte: su propio registro, sus 36 h y su
 * compra. Devuelve { id, nombre } o { id: null } (código que no existe, o el
 * dueño abriendo su propio link).
 */
export async function registrarVisita({ code, tipo, productId, shareId }) {
  try {
    const res = await httpsCallable(getFunctions(), 'registrarVisitaReferidoSecure')({
      code, tipo, productId: productId || null, shareId: shareId || null,
    });
    return res?.data || { id: null };
  } catch {
    return { id: null };
  }
}

/**
 * Quien llegó con un link de invitación ya tiene cuenta: el servidor revisa si
 * es nueva (DNI y teléfono sin cuentas ni compras anteriores) y le da el bono.
 * { aceptada, bono?, motivo?, pendiente? ('perfil') }.
 */
export async function aceptarInvitacion(referralId) {
  const res = await httpsCallable(getFunctions(), 'aceptarInvitacionSecure')({ referralId });
  return res?.data || { aceptada: false };
}

/** Link de invitación permanente de una cuenta (para gente sin cuenta todavía). */
export const linkInvitacion = (code) => `${window.location.origin}/invitar/${encodeURIComponent(code)}`;
/** Link de un producto con tu código: cualquiera que compre en 36 h te suma. */
export const linkProducto = (productId, code) =>
  `${window.location.origin}/producto/${productId}?ref=${encodeURIComponent(code)}`;

/**
 * Estimado de cuántas monedas gana el referente por un pedido de este monto:
 * 5% si es S/200 o menos, 10% si supera los S/200 (1 moneda = S/1).
 * Invitación aceptada: 15 o el %, lo que sea mayor.
 *
 * SOLO para mostrar un número antes de reclamar (AdminReferidos y
 * CuentaReferidosPage). El monto real que se paga lo decide el backend
 * (claimReferralSecure: premioReferido en functions/referidosLogic.js) a partir
 * del monto validado contra el ERP — nunca de este cálculo del cliente.
 */
export function estimateReferralReward(montoTotal, referido = null) {
  const monto = Number(montoTotal) || 0;
  if (monto <= 0) return 0;
  const tasa = monto > 200 ? 0.10 : 0.05;
  const porcentaje = Math.round(monto * tasa);
  return referido?.tipo === 'invitacion' && referido?.invitadoUid
    ? Math.max(PREMIO_INVITACION, porcentaje)
    : porcentaje;
}

// La compra ya NO la vincula el navegador (antes linkPurchaseToReferral escribía
// status/orderId/orderTotal en cualquier referido). Ahora el checkout manda el
// referralId a prepareCheckoutPayment y el servidor lo deja en el pedido y pasa
// el referido a 'purchased' al crearse el pedido.

/**
 * Lo que compró la persona referida: productos, monto y etapa del pedido, sin
 * datos suyos. Lo arma detalleReferidoSecure (functions/index.js).
 */
export async function getReferralOrderDetail(referralId) {
  const result = await httpsCallable(getFunctions(), 'detalleReferidoSecure')({ referralId });
  return result?.data || null;
}

/**
 * Obtiene todos los referidos para el panel del usuario
 */
export async function getReferralsByReferrer(referrerCode) {
  try {
    if (!referrerCode) return { data: [], error: null };
    
    const q = query(
      collection(db, REFERRALS_COLLECTION), 
      where('referrerCode', '==', referrerCode)
    );
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    // Ordenar manualmente porque orderBy requiere index en Firestore si combinamos con where
    .sort((a, b) => {
      const aTime = a.clickedAt?.toMillis() || a.createdAt?.toMillis() || 0;
      const bTime = b.clickedAt?.toMillis() || b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return { data, error: null };
  } catch (error) {
    return { data: [], error: error.message };
  }
}

/**
 * Reclama las monedas de un referido (Etapa 4 -> Finalizado/Reclamado)
 */
export async function claimReferralCoins(referralId) {
  // H-06: el reclamo (marcar 'claimed' + acreditar monedas) se hace server-side en
  // transacción (callable claimReferralSecure), validando propiedad y estado. Se
  // ignoran earnedCoins/currentMonedas que antes venían del cliente (falsificables).
  // El monto real (5%/10% del pedido según claimReferralSecure) viene en la
  // respuesta — se devuelve para que la UI muestre lo que de verdad se pagó,
  // no un estimado.
  try {
    const result = await httpsCallable(getFunctions(), 'claimReferralSecure')({ referralId });
    return { earned: result?.data?.earned ?? null, error: null };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Obtiene el ranking Top 10 del mes actual
 */
export async function getTopReferrersOfMonth() {
  // Lo arma rankingReferidosSecure: los registros de referidos llevan el nombre
  // de quien entró y su pedido, así que el navegador ya no lee los de otras
  // cuentas. Solo vuelve código, compras y monedas del mes.
  try {
    const res = await httpsCallable(getFunctions(), 'rankingReferidosSecure')({});
    return { data: res?.data?.top || [], error: null };
  } catch (error) {
    return { data: [], error: error.message };
  }
}
