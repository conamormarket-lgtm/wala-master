import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { updateOrderInERP } from '../../services/erp/firebase';

const PaypalCheckout = ({ pedido, onSuccess }) => {
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tasa de conversión de ejemplo para convertir la deuda en PEN a USD,
  // ya que PayPal generalmente usa USD para cuentas internacionales
  const CONVERSION_RATE = 3.8; 
  const montoDeuda = Number(pedido.montoDeuda || 0);
  const amountInUSD = (montoDeuda / CONVERSION_RATE).toFixed(2);

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
          description: `Pago del pedido #${pedido.id}`,
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
      
      // Actualizar el pedido en la base de datos
      const historialAnterior = Array.isArray(pedido.historialPagos) ? pedido.historialPagos : [];
      const nuevoPago = {
        fecha: new Date().toLocaleDateString('es-PE'),
        hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        monto: montoDeuda.toString(), // Guardamos el monto original en la moneda local
        metodo: 'PayPal',
        paypalOrderId: details.id,
        estado: 'Aprobado',
        nota: `Pagado en USD: $${amountInUSD}`
      };

      const newHistorial = [...historialAnterior, nuevoPago];

      const updates = {
        montoDeuda: 0,
        conDeuda: false,
        historialPagos: newHistorial,
        // Si tienes otros campos de estado relacionados con el pago, se pueden agregar aquí
      };

      const { error: updateError } = await updateOrderInERP(pedido.id, updates);
      
      if (updateError) {
        throw new Error(updateError);
      }

      if (onSuccess) {
        onSuccess(details);
      }
    } catch (err) {
      console.error("Error al procesar pago de PayPal:", err);
      setError("Hubo un error al procesar o guardar el pago. Por favor contacta a soporte.");
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
      <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666', marginBottom: '1rem', fontWeight: 500 }}>
        Transferencia Internacional (~${amountInUSD} USD)
      </p>
      
      {error && (
        <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: isProcessing ? 'none' : 'block' }}>
        <PayPalScriptProvider options={initialOptions}>
          <PayPalButtons 
            fundingSource="paypal"
            createOrder={createOrder}
            onApprove={onApprove}
            onError={onError}
            style={{ layout: "vertical", shape: "rect" }}
          />
        </PayPalScriptProvider>
      </div>

      {isProcessing && (
        <div style={{ textAlign: 'center', color: '#3b82f6', padding: '1.5rem', background: '#eff6ff', borderRadius: '8px' }}>
          <strong>Procesando pago...</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Actualizando el pedido de forma segura. Por favor, no cierres esta ventana.</p>
        </div>
      )}
    </div>
  );
};

export default PaypalCheckout;
