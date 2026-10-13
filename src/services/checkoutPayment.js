import { getFunctions, httpsCallable } from 'firebase/functions';
import { leerReferidoGuardado } from './referrals';

/**
 * Guarda una intención privada de checkout. No crea nada en pedidos_web ni en el ERP;
 * únicamente permite que las pasarelas validen el monto y materialicen el pedido
 * después de confirmar el cobro.
 */
export async function prepareCheckoutPayment(orderPayload) {
  const prepare = httpsCallable(getFunctions(), 'prepareCheckoutPayment');
  // El enlace de referido que abrió este navegador (si sigue vigente). El
  // servidor lo valida y, si vale, lo deja en el pedido: así la compra queda
  // vinculada aunque se haga desde una landing o por WhatsApp.
  const referralId = leerReferidoGuardado()?.referralId || null;
  const result = await prepare({ orderPayload, referralId });
  return result?.data || {};
}

const precalentadas = new Set();

/**
 * Despierta las funciones del servidor que el cliente va a usar en un momento
 * (una por sesión de página). Sin esto, la primera llamada tarda 4-5 s de arranque
 * justo cuando el cliente confirma o paga. Nunca lanza.
 */
export function precalentarFunciones(nombres) {
  for (const nombre of nombres) {
    if (precalentadas.has(nombre)) continue;
    precalentadas.add(nombre);
    httpsCallable(getFunctions(), nombre)({ precalentar: true }).catch(() => {
      precalentadas.delete(nombre);
    });
  }
}
