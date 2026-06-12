import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { updateDocument } from '../../services/firebase/firestore';

const PaypalEnlaceCheckout = ({ enlace, onSuccess }) => {
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const amountInUSD = Number(enlace.monto || enlace.montoUSD || 0).toFixed(2);

  // Si el .env dice 'sb' o está vacío, usamos 'test' que es el sandbox oficial del SDK
  const actualClientId = (!process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID === 'sb') 
    ? 'test' 
    : process.env.REACT_APP_PAYPAL_CLIENT_ID;

  const initialOptions = {
    clientId: actualClientId,
    currency: "USD",
    intent: "capture",
  };

  const createOrder = (data, actions) => {
    return actions.order.create({
      purchase_units: [
        {
          description: enlace.concepto || `Pago de enlace #${enlace.id}`,
          amount: {
            currency_code: "USD",
            value: amountInUSD,
          },
        },
      ],
    });
  };

  const onApprove = async (data, actions) => {
    try {
      setIsProcessing(true);
      const details = await actions.order.capture();
      
      // Marcar el enlace como pagado en la base de datos
      const updates = {
        estado: 'pagado',
        paypalOrderId: details.id,
        pagadoEn: new Date().toISOString()
      };

      const { error: updateError } = await updateDocument('enlaces_pago', enlace.id, updates);
      
      if (updateError) {
        throw new Error(updateError);
      }

      if (onSuccess) {
        onSuccess(details);
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
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Asegurando la transacción. Por favor, no cierres esta ventana.</p>
        </div>
      )}
    </div>
  );
};

export default PaypalEnlaceCheckout;
