// ── Servicio de pagos / split marketplace (Fase 3) ──────────────────────────
// Wrappers de las Cloud Functions callables del split de pago Mercado Pago:
//   - createCheckoutPreferenceSecure({ items, shippingZoneId })
//   - confirmPaymentSecure({ orderId })
// El cliente NUNCA envía precios: el servidor recalcula el carrito leyendo
// productos_wala / vendors / shippingZones y crea orders + subOrders.
// También expone getMyOrders(uid) que lee la colección 'orders' del comprador.
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getCollection } from './firebase/firestore';

/**
 * Crea la orden (status 'pending_payment') + subOrders y devuelve un init_point
 * de pago. En local/emulador (sin MERCADOPAGO_ACCESS_TOKEN) devuelve un init_point
 * simulado ('/pago-demo/:orderId') con simulated:true; en producción devuelve el
 * init_point real de Mercado Pago con simulated:false.
 *
 * @param {Array<{ productId: string, qty: number }>} items - Líneas del carrito.
 *   Solo se envían productId y qty; los precios los recalcula el servidor.
 * @param {string} [shippingZoneId] - Zona de envío opcional (shippingZones/{id}).
 * @returns {Promise<{ error: string|null, data: { orderId, init_point, simulated }|null }>}
 */
export const createCheckoutPreference = async (items, shippingZoneId) => {
  try {
    const payload = {
      items: (items || []).map((it) => ({
        productId: it.productId,
        qty: Number(it.qty) || 0,
      })),
    };
    if (shippingZoneId) payload.shippingZoneId = shippingZoneId;

    const callable = httpsCallable(getFunctions(), 'createCheckoutPreferenceSecure');
    const res = await callable(payload);
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error al crear la preferencia de pago', data: null };
  }
};

/**
 * Confirma el pago de una orden: la marca como 'paid' y genera los payouts
 * pendientes por vendedor. Idempotente (si ya estaba 'paid' no duplica payouts).
 * En producción esto lo dispara el webhook de Mercado Pago; en local sirve para
 * SIMULAR el pago aprobado desde la página demo.
 *
 * @param {string} orderId
 * @returns {Promise<{ error: string|null, data: { orderId, status, payoutsCreated, alreadyPaid }|null }>}
 */
export const confirmPayment = async (orderId) => {
  try {
    const callable = httpsCallable(getFunctions(), 'confirmPaymentSecure');
    const res = await callable({ orderId });
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error al confirmar el pago', data: null };
  }
};

/**
 * Lee los pedidos del comprador autenticado (orders where buyerUid == uid),
 * más recientes primero por createdAt.
 *
 * @param {string} uid
 * @returns {Promise<{ error: string|null, data: Array }>}
 */
export const getMyOrders = async (uid) => {
  if (!uid) return { error: 'Se requiere uid', data: [] };
  const { data, error } = await getCollection(
    'orders',
    [{ field: 'buyerUid', operator: '==', value: uid }],
    { field: 'createdAt', direction: 'desc' },
  );
  return { error: error || null, data: data || [] };
};
