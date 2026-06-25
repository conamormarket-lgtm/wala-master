// ── Servicio de pedidos (Fase 3) ────────────────────────────────────────
// Crea un pedido con sub-pedidos por vendedor vía Cloud Function callable.
// El cliente NUNCA envía precios: la función recalcula todo server-side
// leyendo productos_wala/{productId}. Devuelve { error, data }.
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Crea un pedido con sus sub-pedidos (uno por vendedor).
 *
 * @param {Array<{ productId: string, qty: number }>} items - Líneas del carrito.
 *   Solo se envían productId y qty; los precios los recalcula el servidor.
 * @param {string} [shippingZoneId] - Zona de envío opcional (shippingZones/{id}).
 * @returns {Promise<{ error: string|null, data: { orderId, totals, subOrders }|null }>}
 */
export const createOrderWithSuborders = async (items, shippingZoneId) => {
  try {
    const payload = {
      items: (items || []).map((it) => ({
        productId: it.productId,
        qty: Number(it.qty) || 0,
      })),
    };
    if (shippingZoneId) payload.shippingZoneId = shippingZoneId;

    const callable = httpsCallable(getFunctions(), 'createOrderWithSubordersSecure');
    const res = await callable(payload);
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error al crear el pedido', data: null };
  }
};
