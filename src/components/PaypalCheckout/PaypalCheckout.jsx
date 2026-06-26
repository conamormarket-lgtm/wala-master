import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateOrderInERP, erpDb } from '../../services/erp/firebase';

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
 * - webOrderId (string): id del documento en la colección `pedidos_web`.
 *     Se usa para actualizar el pedido tras el pago. Si no viene, se cae a
 *     `pedido.id`.
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
        monto: montoDeuda.toString(), // Guardamos el monto original en la moneda local (PEN)
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

      // IMPORTANTE: el cobro YA fue capturado por PayPal en este punto.
      // El pedido del checkout vive en la colección 'pedidos_web' (NO en
      // 'pedidos'), por lo que actualizamos ahí usando el id correcto.
      // Preferimos `webOrderId` (id real del documento en pedidos_web); si no
      // viene, caemos a `pedido.id`. Un fallo aquí NO debe romper la
      // experiencia de pago: lo registramos y continuamos para que onSuccess
      // siempre se ejecute (el cobro ya está hecho).
      const targetWebOrderId = webOrderId || pedido.id;
      try {
        if (erpDb && targetWebOrderId) {
          // Escribimos directamente en 'pedidos_web' por el id del pedido web.
          const webDocRef = doc(erpDb, 'pedidos_web', String(targetWebOrderId));
          await updateDoc(webDocRef, {
            ...updates,
            updatedAt: serverTimestamp(),
          });
        } else if (targetWebOrderId) {
          // Respaldo: si por alguna razón no hay instancia de Firestore web,
          // intentamos el helper del ERP para no perder el registro.
          const { error: updateError } = await updateOrderInERP(targetWebOrderId, updates);
          if (updateError) {
            throw new Error(updateError);
          }
        }
      } catch (erpErr) {
        console.error("PayPal: el cobro se capturó pero falló la actualización del pedido en 'pedidos_web':", erpErr);
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
