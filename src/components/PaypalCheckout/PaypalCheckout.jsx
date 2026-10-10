import React, { useState } from 'react';
import { trackPaypalPurchase } from '../../services/analytics/metaPixel.mjs';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { T } from '../../i18n/useTranslatedText';

// El cobro de PayPal lo hace SIEMPRE el servidor (createPaypalOrderSecure /
// capturePaypalOrderSecure): el monto USD lo calcula, la captura la valida y el
// pedido lo marca pagado. El navegador solo abre la ventana de PayPal. Antes, sin
// el flag VITE_PAYPAL_SERVER_SIDE, el navegador creaba la orden con el monto que
// quisiera, la capturaba y escribía el pedido como pagado.

/**
 * Checkout de PayPal (cobro internacional).
 *
 * PayPal SIEMPRE cobra en USD (no soporta COP/ARS/PEN). El monto USD final lo
 * calcula el componente padre a partir del total en PEN (con descuento ya
 * aplicado) y la tasa FX con margen, y lo pasa por la prop `amountUsd`.
 *
 * Props nuevas:
 * - amountUsd (number): USD final a cobrar (ya calculado por el padre).
 *     Si no viene, se cae al cálculo local con `conversionRate` (fallback que
 *     evita romper el flujo existente).
 * - localLabel (string): equivalente local SOLO informativo, p.ej.
 *     "$ 98,000 Pesos Colombianos". Se muestra como "(≈ ...)".
 * - webOrderId (string): id de la intención de pago o del pedido que se paga.
 *     Si no viene, se usa `pedido.id`.
 */
const PaypalCheckout = ({
  pedido,
  onSuccess,
  conversionRate = 3.8,
  amountUsd,
  localLabel,
  webOrderId,
}) => {
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tasa de conversión de respaldo para convertir la deuda en PEN a USD,
  // ya que PayPal generalmente usa USD para cuentas internacionales.
  // Configurable vía la prop opcional 'conversionRate' (default 3.8).
  // Se valida que sea un número positivo; si no, se usa 3.8 como respaldo.
  const CONVERSION_RATE = (Number(conversionRate) > 0) ? Number(conversionRate) : 3.8;
  const montoDeuda = Number(pedido.montoDeuda || 0);

  // Monto USD final a cobrar:
  // 1) Si el padre pasa `amountUsd` válido (> 0), ESE es el monto autoritativo
  //    (ya incluye la conversión PEN->USD con la tasa FX y el margen).
  // 2) Si no viene (o no es válido), caemos al cálculo local con la tasa de
  //    respaldo para no romper el flujo existente.
  const parsedAmountUsd = Number(amountUsd);
  const amountInUSD = (Number.isFinite(parsedAmountUsd) && parsedAmountUsd > 0)
    ? parsedAmountUsd.toFixed(2)
    : (montoDeuda / CONVERSION_RATE).toFixed(2);

  // Si el .env dice 'sb' o está vacío, usamos 'test' que es el sandbox oficial del SDK
  const actualClientId = (!process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID === 'sb')
    ? 'test'
    : process.env.REACT_APP_PAYPAL_CLIENT_ID;

  const initialOptions = {
    clientId: actualClientId,
    currency: "USD",
    intent: "capture",
  };

  // Referencia del pedido web usada por las Cloud Functions seguras para
  // recalcular el monto y validar la captura contra el pedido REAL.
  const targetWebOrderIdRef = webOrderId || pedido.id;

  const createOrder = () => {
    const createSecure = httpsCallable(getFunctions(), 'createPaypalOrderSecure');
    return createSecure({ pedidoId: targetWebOrderIdRef })
      .then((res) => {
        const orderID = res && res.data && res.data.orderID;
        if (!orderID) {
          throw new Error('La respuesta del servidor no incluyó el orderID de PayPal.');
        }
        // PayPalButtons espera que createOrder resuelva con el orderID (string).
        return orderID;
      })
      .catch((err) => {
        // Si el servidor no pudo crear la orden no se abre ningún cobro.
        console.error('createPaypalOrderSecure falló:', err);
        setError(
          err?.message ||
            'No se pudo iniciar el pago con PayPal de forma segura. Inténtalo más tarde o contacta a soporte.'
        );
        // Re-lanzar para que el SDK de PayPal aborte el flujo (no abre aprobador).
        throw err;
      });
  };

  const onApprove = async (data) => {
    try {
      setIsProcessing(true);
      // La captura y la marca de pagado las hace el servidor; el navegador solo
      // confía en lo que devuelve.
      const captureSecure = httpsCallable(getFunctions(), 'capturePaypalOrderSecure');
      const res = await captureSecure({ orderID: data.orderID, pedidoId: targetWebOrderIdRef });
      const cap = res && res.data;
      if (!cap || cap.success !== true || cap.status !== 'COMPLETED') {
        throw new Error('El servidor no confirmó el pago de PayPal.');
      }
      trackPaypalPurchase(cap, pedido, webOrderId);
      if (onSuccess) {
        onSuccess(cap);
      }
    } catch (err) {
      console.error("Error al procesar pago de PayPal:", err);
      setError(
        err?.message ||
          "No se pudo verificar el pago con el servidor. No vuelvas a pagar todavía; escríbenos si tienes dudas."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const onError = (err) => {
    console.error("PayPal Error:", err);
    setError("Ocurrió un error al cargar la pasarela de PayPal.");
  };

  if (montoDeuda <= 0) {
    return null; // Nada que cobrar
  }

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
      <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem', fontWeight: 500 }}>
        Transferencia Internacional
      </p>
      {/* PayPal cobra en USD. Mostramos el monto exacto a cobrar y, si el padre
          lo proporciona, el equivalente local solo como referencia informativa. */}
      <p style={{ textAlign: 'center', fontSize: '0.95rem', color: '#111', marginBottom: '1rem', fontWeight: 600 }}>
        Pagarás ${amountInUSD} USD
        {localLabel ? (
          <span style={{ display: 'block', fontSize: '0.8rem', color: '#888', fontWeight: 400, marginTop: '0.15rem' }}>
            (≈ {localLabel})
          </span>
        ) : null}
      </p>

      {error && (
        <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {Number(amountInUSD) < 1 ? (
        // PayPal rechaza órdenes < 1.00 USD: evitamos un error confuso y derivamos a WhatsApp.
        <div style={{ color: '#92400e', backgroundColor: '#fffbeb', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center' }}>
          El monto mínimo para pagar por PayPal es <strong>1.00 USD</strong>. Para este pedido, por favor coordina el pago por WhatsApp.
        </div>
      ) : (
        <div style={{ display: isProcessing ? 'none' : 'block' }}>
          <PayPalScriptProvider options={initialOptions}>
            <PayPalButtons
              createOrder={createOrder}
              onApprove={onApprove}
              onError={onError}
              style={{ layout: "vertical", shape: "rect" }}
            />
          </PayPalScriptProvider>
        </div>
      )}

      {isProcessing && (
        <div style={{ textAlign: 'center', color: '#3b82f6', padding: '1.5rem', background: '#eff6ff', borderRadius: '8px' }}>
          <strong>Procesando pago...</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}><T>Actualizando el pedido de forma segura. Por favor, no cierres esta ventana.</T></p>
        </div>
      )}
    </div>
  );
};

export default PaypalCheckout;
