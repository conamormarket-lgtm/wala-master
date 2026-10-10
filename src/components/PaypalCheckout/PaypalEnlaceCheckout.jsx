import React, { useState } from 'react';
import { trackPaypalPurchase } from '../../services/analytics/metaPixel.mjs';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { T } from '../../i18n/useTranslatedText';

const INTERNATIONAL_ADVANCE_TYPE = 'tiktok_live_international_advance';

const PaypalEnlaceCheckout = ({ enlace, onSuccess }) => {
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const usesSecureInternationalAdvance = enlace.tipo === INTERNATIONAL_ADVANCE_TYPE;

  // Si el .env dice 'sb' o está vacío, usamos 'test' que es el sandbox oficial del SDK
  const actualClientId = (!process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID === 'sb') 
    ? 'test' 
    : process.env.REACT_APP_PAYPAL_CLIENT_ID;

  const initialOptions = {
    clientId: actualClientId,
    currency: "USD",
    intent: "capture",
  };

  // Monto, captura y marca de pagado: siempre en el servidor. El adelanto
  // internacional (Kenta) tiene sus propias funciones; el resto de enlaces en
  // dólares, las de enlace genérico.
  const fnCrear = usesSecureInternationalAdvance ? 'createPaypalInternationalAdvanceOrder' : 'createPaypalEnlaceOrderSecure';
  const fnCapturar = usesSecureInternationalAdvance ? 'capturePaypalInternationalAdvanceOrder' : 'capturePaypalEnlaceOrderSecure';

  const createOrder = () => {
    const createSecure = httpsCallable(getFunctions(), fnCrear);
    return createSecure({ linkId: enlace.id }).then((result) => {
      const orderID = result?.data?.orderID;
      if (!orderID) throw new Error('No se pudo obtener la orden de pago segura.');
      return orderID;
    }).catch((err) => {
      setError(err?.message || 'No se pudo iniciar el pago seguro.');
      throw err;
    });
  };

  const onApprove = async (data) => {
    try {
      setIsProcessing(true);
      const captureSecure = httpsCallable(getFunctions(), fnCapturar);
      const result = await captureSecure({ linkId: enlace.id, orderID: data.orderID });
      const capture = result?.data;
      if (!capture?.success || capture?.status !== 'COMPLETED') {
        throw new Error('El servidor no confirmó el pago.');
      }
      trackPaypalPurchase(capture);
      if (onSuccess) {
        onSuccess({ ...capture, id: capture.captureId || data.orderID });
      }
    } catch (err) {
      console.error("Error detallado al procesar pago de PayPal:", err);
      // Mostramos el mensaje exacto del error para poder diagnosticarlo
      setError(`Error del sistema: ${err.message}. Por favor guarda tu ID de PayPal: ${data.orderID || 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const onError = (err) => {
    console.error("PayPal Error:", err);
    setError("Ocurrió un error al cargar la pasarela de PayPal o al procesar tu pago.");
  };

  return (
    <div style={{ marginTop: '1.5rem', width: '100%' }}>
      {error && (
        <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ display: isProcessing ? 'none' : 'block' }}>
        <PayPalScriptProvider options={initialOptions}>
          <PayPalButtons 
            createOrder={createOrder}
            onApprove={onApprove}
            onError={onError}
            style={{ layout: "vertical", shape: "rect", color: "gold" }}
          />
        </PayPalScriptProvider>
      </div>

      {isProcessing && (
        <div style={{ textAlign: 'center', color: '#3b82f6', padding: '1.5rem', background: '#eff6ff', borderRadius: '8px' }}>
          <strong>Procesando pago...</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}><T>Asegurando la transacción. Por favor, no cierres esta ventana.</T></p>
        </div>
      )}
    </div>
  );
};

export default PaypalEnlaceCheckout;
