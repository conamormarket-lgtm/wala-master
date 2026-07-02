// ── PagoSuscripcion — botones de pago del flujo de SUSCRIPCIÓN (auto-débito) ──
// Reúne los dos métodos de cobro RECURRENTE del contrato del backend:
//   - CulqiSuscripcionButton (Perú): tokeniza la tarjeta con el mismo SDK
//     checkout-js que SorteosPage y llama crearSuscripcionCulqi con el tokenId.
//   - PaypalSuscripcionButtons (internacional): usa @paypal/react-paypal-js con
//     vault:true / intent:"subscription"; createSubscription→crearSuscripcionPaypal
//     y onApprove→confirmarSuscripcionPaypal.
//
// DIFERENCIA CLAVE con los tickets de SorteosPage: aquí el cobro es RECURRENTE
// (una suscripción), no un cargo único. El MONTO real lo pone SIEMPRE el servidor
// (plan.precioCentimos/plan.precioUsd); el cliente solo muestra el del plan y
// nunca lo reenvía como autoritativo. El consentimiento explícito de cobro
// recurrente se valida ANTES de montar estos botones (en el modal padre).
import React, { useEffect, useRef, useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { GlassButton } from '../../components/ui';
import {
  crearSuscripcionCulqi,
  crearSuscripcionPaypal,
  confirmarSuscripcionPaypal,
  formatoPrecioPen,
} from '../../services/suscripcionSorteos';
import styles from '../SuscripcionSorteoPage.module.css';

// ── Botón Culqi (Perú) — tokeniza y crea la suscripción con auto-débito ──────
// Reusa el patrón de CulqiTicketButton (SorteosPage.jsx:155): carga perezosa del
// script, instancia CulqiCheckout, y en el callback `culqi()` toma el token.id.
// La diferencia: en vez de processCulqiPayment (cargo único) llama a
// crearSuscripcionCulqi (suscripción con cobro recurrente server-side).
function CulqiSuscripcionButton({ campaignId, plan, email, datos, origenApp, onOk, onError }) {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const culqiRef = useRef(null);
  // Guard SÍNCRONO anti doble-suscripción (isProcessing es async).
  const processingRef = useRef(false);
  // Callbacks vía ref estable para no recrear la instancia de Culqi.
  const onOkRef = useRef(onOk);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onOkRef.current = onOk;
    onErrorRef.current = onError;
  }, [onOk, onError]);

  // Carga perezosa del script de Culqi (idéntico patrón a SorteosPage).
  useEffect(() => {
    const scriptId = 'culqi-js-v4';
    const checkAndSetReady = () => {
      if (window.CulqiCheckout) setIsReady(true);
      else setTimeout(checkAndSetReady, 200);
    };
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://js.culqi.com/checkout-js';
      script.async = true;
      script.onload = checkAndSetReady;
      document.body.appendChild(script);
    } else {
      checkAndSetReady();
    }
  }, []);

  // Construye la instancia de Culqi cuando el SDK está listo o cambia el plan.
  useEffect(() => {
    if (!isReady || !window.CulqiCheckout || !plan) return undefined;

    // El monto mostrado es SOLO referencial: el servidor cobra plan.precioCentimos.
    const amountInt = Number(plan.precioCentimos || 0);
    const publicKey = process.env.REACT_APP_CULQI_PUBLIC_KEY;
    if (!publicKey) {
      console.error('Culqi: Falta REACT_APP_CULQI_PUBLIC_KEY en .env');
      return undefined;
    }

    const config = {
      settings: {
        title: 'Suscripción - Walá',
        currency: 'PEN',
        amount: amountInt,
      },
      client: { email: email || '' },
      options: { lang: 'auto', installments: false, modal: true },
      appearance: { theme: 'default', menuType: 'sidebar' },
    };

    const culqiInstance = new window.CulqiCheckout(publicKey, config);
    culqiRef.current = culqiInstance;

    culqiInstance.culqi = async () => {
      if (culqiInstance.token) {
        if (processingRef.current) return; // evita doble suscripción
        processingRef.current = true;
        const tokenId = culqiInstance.token.id;
        culqiInstance.close();

        setIsProcessing(true);
        try {
          // El servidor pone el monto real (plan.precioCentimos) y crea la
          // suscripción con auto-débito. Solo enviamos tokenId + datos.
          const { data, error } = await crearSuscripcionCulqi({
            campaignId,
            planId: plan.id,
            tokenId,
            datos,
            origenApp,
          });
          if (error) {
            if (onErrorRef.current) onErrorRef.current(error);
          } else if (onOkRef.current) {
            onOkRef.current(data);
          }
        } catch (e) {
          if (onErrorRef.current) onErrorRef.current(e?.message || 'No se pudo crear la suscripción.');
        } finally {
          setIsProcessing(false);
          processingRef.current = false;
        }
      } else if (culqiInstance.error) {
        const msg = culqiInstance.error.user_message || 'El pago no pudo completarse.';
        culqiInstance.close();
        if (onErrorRef.current) onErrorRef.current(msg);
      }
    };
    return undefined;
    // onOk/onError se leen vía refs estables (no van en deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, plan, email, campaignId, datos, origenApp]);

  const handleOpen = () => {
    if (!isReady || !culqiRef.current) {
      if (onError) onError('El sistema de pagos aún no está listo. Espera unos segundos.');
      return;
    }
    if (isProcessing) return;
    culqiRef.current.open();
  };

  return (
    <GlassButton
      variant="primary"
      size="lg"
      fullWidth
      loading={isProcessing}
      disabled={!isReady || isProcessing}
      onClick={handleOpen}
      className={styles.btnCampana}
    >
      {isProcessing ? 'Creando tu suscripción…' : `💳 Suscribirme (${formatoPrecioPen(plan.precioCentimos)})`}
    </GlassButton>
  );
}

// ── Botones PayPal (internacional) — suscripción con vault ───────────────────
// Usa el MISMO SDK que SorteosPage pero con options { vault:true, intent:"subscription" }.
// createSubscription pide al servidor el subscriptionId (crearSuscripcionPaypal);
// onApprove lo confirma (confirmarSuscripcionPaypal). Si el backend responde
// pendiente=true, se avisa que se activará al confirmarse el primer cobro.
function PaypalSuscripcionButtons({ campaignId, plan, datos, onOk, onError, onPendiente }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const actualClientId =
    !process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID === 'sb'
      ? 'test'
      : process.env.REACT_APP_PAYPAL_CLIENT_ID;

  // vault + intent:"subscription" son OBLIGATORIOS para suscripciones PayPal.
  const initialOptions = {
    clientId: actualClientId,
    currency: 'USD',
    vault: true,
    intent: 'subscription',
  };

  // El servidor crea la subscription (recalcula el USD del plan) y devuelve su id.
  const createSubscription = () =>
    crearSuscripcionPaypal({ campaignId, planId: plan.id, datos }).then((r) => {
      if (r.error) throw new Error(r.error);
      const subId = r.data?.subscriptionId;
      if (!subId) throw new Error('El servidor no devolvió el subscriptionId de PayPal.');
      return subId;
    });

  // Tras aprobar, el servidor confirma la suscripción y activa la vigencia local.
  const onApprove = async (data) => {
    try {
      setIsProcessing(true);
      const { data: conf, error } = await confirmarSuscripcionPaypal({
        campaignId,
        planId: plan.id,
        subscriptionId: data.subscriptionID,
        datos,
      });
      if (error) {
        if (onError) onError(error);
        return;
      }
      // pendiente=true → aún no cobra el primer ciclo; se activará luego.
      if (conf?.pendiente) {
        if (onPendiente) onPendiente(conf);
      } else if (onOk) {
        onOk(conf);
      }
    } catch (err) {
      if (onError) onError(err?.message || 'No se pudo confirmar la suscripción de PayPal.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleError = () => {
    if (onError) onError('Ocurrió un error al cargar la pasarela de PayPal.');
  };

  return (
    <div className={styles.paypalWrap}>
      {isProcessing ? (
        <p>Confirmando tu suscripción… no cierres esta ventana.</p>
      ) : (
        <PayPalScriptProvider options={initialOptions}>
          <PayPalButtons
            createSubscription={createSubscription}
            onApprove={onApprove}
            onError={handleError}
            style={{ layout: 'vertical', shape: 'rect', label: 'subscribe' }}
          />
        </PayPalScriptProvider>
      )}
    </div>
  );
}

export { CulqiSuscripcionButton, PaypalSuscripcionButtons };
