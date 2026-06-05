import React, { useState, useEffect } from 'react';
import { updateOrderInERP } from '../../services/erp/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const CulqiCheckout = ({ pedido, onSuccess }) => {
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCulqiLoaded, setIsCulqiLoaded] = useState(false);

  const montoDeuda = Number(pedido?.montoDeuda || 0);

  // Llave pública de prueba por defecto
  const publicKey = process.env.REACT_APP_CULQI_PUBLIC_KEY || 'pk_test_dummy_key'; 

  useEffect(() => {
    const scriptId = 'culqi-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://checkout.culqi.com/js/v4';
      script.async = true;
      script.onload = () => {
        setIsCulqiLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setIsCulqiLoaded(true);
    }

    // Callback global de Culqi
    window.culqi = async () => {
      if (window.Culqi.token) {
        setIsProcessing(true);
        const token = window.Culqi.token.id;
        const email = window.Culqi.token.email;
        // Cerrar el modal explícitamente en v4
        if (window.Culqi.close) window.Culqi.close();
        await procesarPagoBackend(token, email);
      } else if (window.Culqi.error) {
        setIsProcessing(false);
        setError(window.Culqi.error.user_message);
      } else {
        // Modal cerrado sin acción
        setIsProcessing(false);
      }
    };

    return () => {
      window.culqi = undefined;
    };
  }, [pedido?.id]);

  const abrirCulqi = () => {
    if (!publicKey || publicKey === 'pk_test_dummy_key' || publicKey.includes('tu_llave_publica') || publicKey === 'pk_test_aqui_tu_llave_publica') {
      setError("⚠️ Falta configurar la Llave Pública de Culqi en el archivo .env. Si ya la pusiste, DEBES reiniciar el servidor local (apaga la terminal y vuelve a correr npm run dev / npm start).");
      return;
    }

    if (!isCulqiLoaded || !window.Culqi) {
      setError("El sistema de pagos aún no ha cargado. Intenta en un segundo.");
      return;
    }

    setError(null);

    const amountCents = Math.round(montoDeuda * 100);
    if (amountCents < 300) {
      setError("⚠️ Culqi requiere un monto mínimo de S/ 3.00 PEN para procesar tarjetas por políticas bancarias. Este pedido no alcanza el monto mínimo.");
      return;
    }

    window.Culqi.publicKey = publicKey;
    window.Culqi.settings({
      title: 'Walá Pedidos',
      currency: 'PEN',
      description: `Pago de deuda - Pedido #${pedido.id}`,
      amount: amountCents, 
    });

    console.log("Abriendo Culqi de forma síncrona (PEN):", amountCents);
    window.Culqi.open();
  };

  const procesarPagoBackend = async (tokenId, email) => {
    try {
      setError(null);
      
      const functions = getFunctions();
      const processPaymentFn = httpsCallable(functions, 'processCulqiPayment');
      
      const response = await processPaymentFn({
        amount: montoDeuda,
        currency_code: 'PEN',
        email: email,
        source_id: tokenId,
        order_id: pedido.id
      });

      const { charge_id } = response.data;

      const historialAnterior = Array.isArray(pedido.historialPagos) ? pedido.historialPagos : [];
      const nuevoPago = {
        fecha: new Date().toLocaleDateString('es-PE'),
        hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        monto: montoDeuda.toString(),
        metodo: 'Tarjeta (Culqi)',
        culqiChargeId: charge_id,
        estado: 'Aprobado',
        nota: `Pagado con Tarjeta (ID: ${charge_id})`
      };

      const newHistorial = [...historialAnterior, nuevoPago];

      const updates = {
        montoDeuda: 0,
        conDeuda: false,
        historialPagos: newHistorial,
      };

      const { error: updateError } = await updateOrderInERP(pedido.id, updates);
      
      if (updateError) {
        throw new Error(updateError);
      }

      if (onSuccess) {
        onSuccess({ id: charge_id });
      }
    } catch (err) {
      console.error("Error al procesar pago de Culqi en Backend:", err);
      // Extraemos el mensaje de Firebase Functions HttpsError si existe
      const msg = err.message || "Hubo un error al procesar la tarjeta.";
      setError(`No se pudo procesar el pago: ${msg}`);
      setIsProcessing(false);
    }
  };

  if (montoDeuda <= 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
      <p style={{ textAlign: 'center', fontSize: '0.95rem', color: '#374151', marginBottom: '1rem', fontWeight: 600 }}>
        Pagar online de forma segura con Tarjeta
      </p>
      
      {error && (
        <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={abrirCulqi}
          disabled={isProcessing}
          style={{
            backgroundColor: '#7C3AED',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            width: '100%',
            opacity: isProcessing ? 0.7 : 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.2)'
          }}
        >
          {isProcessing ? 'Procesando...' : `💳 Pagar S/ ${montoDeuda.toFixed(2)}`}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', opacity: 0.7 }}>
        {/* Visa */}
        <svg viewBox="0 0 38 12" height="16" fill="#1434CB">
          <path d="M15.26 0l-2.4 11.54h3.9l2.4-11.54m18.57 11.23c-1.07.41-2.76.78-4.63.78-5.11 0-8.7-2.61-8.72-6.35-.02-2.76 2.5-4.29 4.41-5.21 1.95-.94 2.62-1.54 2.62-2.38-.02-1.28-1.56-1.85-3.01-1.85-1.74 0-2.7.35-3.8.84l-.53.25-.56-3.38a12.8 12.8 0 0 1 4.2-.72c5.38 0 8.92 2.55 8.94 6.16.02 2.06-1.35 3.39-4.27 4.77-1.76.88-2.83 1.45-2.83 2.33 0 .86 1.1 1.76 2.92 1.76 1.48 0 2.57-.27 3.55-.68l.45-.21zM11.29 8.16L8.52 1.54c-.23-.58-.8-.88-1.39-.88H.15L0 .38c.67.14 1.43.34 1.93.57.8.36 1.05.65 1.34 1.73l2.25 8.86h4.08l6.17-11.54H11.8l-1.03 2.6m-2.48.3l-1.22 3.23h3.5l-1.42-3.82c-.31-.83-.57-1.58-.86-2.45v3.04z" />
        </svg>
        {/* Mastercard */}
        <svg viewBox="0 0 32 20" height="16">
          <circle cx="10" cy="10" r="10" fill="#EB001B"/>
          <circle cx="22" cy="10" r="10" fill="#F79E1B"/>
          <path d="M16 18c2.4-1.8 4-4.7 4-8s-1.6-6.2-4-8c-2.4 1.8-4 4.7-4 8s1.6 6.2 4 8z" fill="#FF5F00"/>
        </svg>
        {/* Amex */}
        <svg viewBox="0 0 32 20" height="16" fill="#006FCF">
          <rect width="32" height="20" rx="2" />
          <path fill="#fff" d="M12.4 12.6l-2-4.8h1.2l1 2.7.9-2.7h1.2l-2.1 4.8zm3.3 0v-4.8h3v1h-1.8v.8h1.6v1h-1.6v2h1.9v1zm5.1 0l-1.4-2-1.3 2h-1.4l2-2.7-1.9-2.1h1.5l1.2 1.7 1.1-1.7h1.4l-1.8 2.2 1.9 2.6zm-17.2 0h-1.3v-4.8h1.8c1.3 0 2 .6 2 1.7 0 .8-.5 1.4-1.2 1.6l1.3 1.5h-1.3L5.4 11h-.8v1.6zm0-2.4h.6c.6 0 .9-.2.9-.7 0-.5-.3-.7-.9-.7h-.6v1.4z"/>
        </svg>
      </div>

      {isProcessing && !error && (
        <div style={{ marginTop: '1rem', textAlign: 'center', color: '#7C3AED', padding: '1rem', background: '#F5F3FF', borderRadius: '8px' }}>
          <strong>Validando transacción...</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>No cierres esta ventana.</p>
        </div>
      )}
    </div>
  );
};

export default CulqiCheckout;
