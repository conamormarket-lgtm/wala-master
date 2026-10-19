import React from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { getFunctions, httpsCallable } from 'firebase/functions';

/*
 * Los botones de PayPal para pagar un ticket de sorteo (el sorteo del kit,
 * CAMPANAS.md). La misma pareja de funciones que usaba la página de antes:
 * createPaypalTicketSorteoSecure (el monto en dólares lo fija el servidor con
 * config/fx) y capturePaypalTicketSorteoSecure (revisa el dueño, el monto y
 * que esté COMPLETED antes de dar los tickets). Solo dibuja los botones del
 * SDK: el "Procesando…" y el error los muestra PagoPaypal del kit
 * (onProcesando, onError).
 *  - sorteoId · ticketId · onPagado() · onProcesando(bool) · onError(texto)
 */
const PaypalTicketSorteo = ({ sorteoId, ticketId, onPagado, onProcesando, onError }) => {
  // 'sb' o vacío: el sandbox oficial del SDK ('test'), como en el resto de la tienda.
  const clientId = (!process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID === 'sb')
    ? 'test'
    : process.env.REACT_APP_PAYPAL_CLIENT_ID;

  const createOrder = async () => {
    onError?.('');
    try {
      const res = await httpsCallable(getFunctions(), 'createPaypalTicketSorteoSecure')({ sorteoId, ticketId });
      const orderID = res?.data?.orderID;
      if (!orderID) throw new Error('No se pudo iniciar el pago con PayPal.');
      return orderID;
    } catch (err) {
      onError?.(err?.message || 'No se pudo iniciar el pago con PayPal.');
      throw err;
    }
  };

  const onApprove = async (data) => {
    onProcesando?.(true);
    try {
      const res = await httpsCallable(getFunctions(), 'capturePaypalTicketSorteoSecure')({ orderID: data.orderID, sorteoId, ticketId });
      if (!res?.data?.success || res?.data?.status !== 'COMPLETED') throw new Error('El servidor no confirmó el pago.');
      onPagado?.(res.data);
    } catch (err) {
      onError?.(`${err?.message || 'No se pudo completar el pago con PayPal.'} Guarda tu código de PayPal: ${data.orderID || '—'}.`);
    } finally {
      onProcesando?.(false);
    }
  };

  return (
    <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture' }}>
      <PayPalButtons
        createOrder={createOrder}
        onApprove={onApprove}
        onError={() => onError?.('No se pudo cargar PayPal o completar el pago. Inténtalo otra vez.')}
        style={{ layout: 'vertical', shape: 'rect', color: 'gold' }}
      />
    </PayPalScriptProvider>
  );
};

export default PaypalTicketSorteo;
