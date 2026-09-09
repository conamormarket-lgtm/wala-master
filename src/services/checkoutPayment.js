import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Guarda una intención privada de checkout. No crea nada en pedidos_web ni en el ERP;
 * únicamente permite que las pasarelas validen el monto y materialicen el pedido
 * después de confirmar el cobro.
 */
export async function prepareCheckoutPayment(orderPayload) {
  const prepare = httpsCallable(getFunctions(), 'prepareCheckoutPayment');
  const result = await prepare({ orderPayload });
  return result?.data || {};
}
