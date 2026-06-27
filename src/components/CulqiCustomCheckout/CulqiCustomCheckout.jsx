import React, { useState, useEffect, useRef } from 'react';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Detecta si el modal de Culqi está visible (busca su iframe con 'culqi' en el src
// y tamaño real). Sirve para saber si el usuario lo cerró sin pagar (plan B WhatsApp).
const isCulqiModalVisible = () => {
  const frames = document.querySelectorAll('iframe');
  for (const f of frames) {
    const src = (f.getAttribute('src') || '').toLowerCase();
    if (src.includes('culqi')) {
      const r = f.getBoundingClientRect();
      if (r.width > 60 && r.height > 120) return true;
    }
  }
  return false;
};

const CulqiCustomCheckout = ({ pedido, enlace, onSuccess, onClose, autoOpen = false }) => {
  const toast = useGlobalToast();
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const culqiRef = useRef(null);
  // Guard para asegurar que el auto-abrir solo se dispare UNA vez (no en cada render).
  const autoOpenedRef = useRef(false);
  // Guard SÍNCRONO anti doble-cobro: isProcessing es estado (async) y no frena una
  // segunda invocación inmediata del callback de Culqi; este ref sí (se evalúa al instante).
  const processingRef = useRef(false);
  // Watcher para detectar que el usuario CERRÓ el modal de Culqi sin pagar.
  const resolvedRef = useRef(false); // true si hubo token (pago) o error manejado
  const closePollRef = useRef(null); // id del setInterval que vigila el cierre

  // ── Callbacks estables (anti doble-apertura) ───────────────────────────────
  // onSuccess/onClose llegan como arrows inline desde CheckoutPage: cambian de
  // identidad en CADA render del padre. Si los metiéramos en las deps del effect
  // que construye la instancia de Culqi, esa instancia se RE-CREARÍA en cada
  // render (provocando que el watcher/auto-open se disparen de nuevo y el modal
  // "salte dos veces"). Los guardamos en refs y los actualizamos en un effect
  // aparte, sin tocar la instancia. Así el handler `culqi` siempre invoca la
  // versión más reciente del callback sin recrear nada.
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  useEffect(() => {
    const scriptId = 'culqi-js-v4';
    
    const checkAndSetReady = () => {
      if (window.CulqiCheckout) {
        setIsReady(true);
      } else {
        setTimeout(checkAndSetReady, 200);
      }
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = 'culqi-js-v4';
      script.src = 'https://js.culqi.com/checkout-js';
      script.async = true;
      script.onload = checkAndSetReady;
      document.body.appendChild(script);
    } else {
      checkAndSetReady();
    }
  }, []);

  useEffect(() => {
    if (!isReady || !window.CulqiCheckout) return;

    const isEnlace = !!enlace;
    const title = isEnlace ? 'Pago Seguro' : 'Pago de Saldo - Walá';
    const currency = isEnlace ? (enlace.moneda || 'USD') : 'PEN';
    const amountFloat = isEnlace ? Number(enlace.monto || enlace.montoUSD || enlace.montoPEN || 0) : Number(pedido?.montoDeuda || 0);
    const amountInt = Math.round(amountFloat * 100);

    const publicKey = process.env.REACT_APP_CULQI_PUBLIC_KEY;

    if (!publicKey) {
      console.error("Culqi: Falta REACT_APP_CULQI_PUBLIC_KEY en .env");
      return;
    }

    if (amountInt < 100 && currency === 'USD') {
       console.warn("Monto demasiado bajo para Culqi USD");
    }
    if (amountInt < 300 && currency === 'PEN') {
       console.warn("Monto demasiado bajo para Culqi PEN");
    }

    const config = {
      settings: {
        title: title,
        currency: currency,
        amount: amountInt,
      },
      client: {
        email: isEnlace ? (enlace.email || '') : '',
      },
      options: {
        lang: 'auto',
        installments: false,
        modal: true,
      },
      appearance: {
        theme: 'default',
        hiddenCulqiLogo: false,
        hiddenBannerContent: false,
        hiddenBanner: false,
        hiddenToolBarAmount: false,
        menuType: 'sidebar',
      }
    };

    // Crear instancia aislada
    const culqiInstance = new window.CulqiCheckout(publicKey, config);
    culqiRef.current = culqiInstance;

    // Manejador de acciones (reemplaza a window.culqi = ...)
    culqiInstance.culqi = async () => {
      if (culqiInstance.token) {
        // Evita un SEGUNDO cargo si el callback se dispara dos veces (glitch/SDK/doble token).
        if (processingRef.current) return;
        processingRef.current = true;
        resolvedRef.current = true; // hubo pago: cerrar el modal NO es abandono
        if (closePollRef.current) { clearInterval(closePollRef.current); closePollRef.current = null; }
        const token = culqiInstance.token.id;
        const email = culqiInstance.token.email;
        culqiInstance.close();

        setIsProcessing(true);
        toast.info('Procesando pago seguro con Culqi...');

        try {
          const functions = getFunctions();
          const processCulqiPayment = httpsCallable(functions, 'processCulqiPayment');
          
          const result = await processCulqiPayment({
            tokenId: token,
            amount: amountInt,
            currency: currency,
            email: email,
            description: title,
            metadata: {
              pedidoId: pedido?.id || '',
              enlaceId: enlace?.id || ''
            }
          });

          if (result.data && result.data.success) {
            toast.success('¡Pago procesado exitosamente!');
            // Usa la versión más reciente del callback (ref estable): NO depende
            // de la identidad del arrow inline del padre, así que la instancia
            // de Culqi no se recrea ni el modal se reabre.
            if (onSuccessRef.current) onSuccessRef.current(result.data);
          } else {
            toast.error(result.data?.message || 'Error al procesar el pago en el servidor.');
          }
        } catch (error) {
          console.error("Error processCulqiPayment:", error);
          toast.error(error.message || 'Error de comunicación con el servidor.');
        } finally {
          setIsProcessing(false);
          processingRef.current = false; // libera el guard (permite reintento si falló)
        }
        
      } else if (culqiInstance.error) {
         resolvedRef.current = true; // error manejado: cerrar el modal NO es abandono
         if (closePollRef.current) { clearInterval(closePollRef.current); closePollRef.current = null; }
         console.error("Error de Culqi:", culqiInstance.error);
         toast.error(culqiInstance.error.user_message || 'El pago no pudo completarse.');
         culqiInstance.close();
      }
    };

    // Limpieza: si las deps reales cambian (isReady/pedido/enlace) y este effect
    // se vuelve a ejecutar, descartamos la instancia anterior y su watcher para
    // no dejar pollers huérfanos ni instancias duplicadas en memoria.
    return () => {
      if (closePollRef.current) { clearInterval(closePollRef.current); closePollRef.current = null; }
    };
    // IMPORTANTE: onSuccess/onClose NO van en las deps (se leen vía refs estables).
    // Si estuvieran aquí, la instancia de Culqi se recrearía en cada render del
    // padre (arrows inline) y el modal "saltaría dos veces".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pedido, enlace]);

  const handleOpenCheckout = () => {
    if (!isReady) {
      if (document.getElementById('culqi-js-v4')) {
        toast.error('El script de Culqi aún no carga o fue bloqueado por un ad-blocker.');
      } else {
        toast.error('Iniciando sistema de pagos...');
      }
      return;
    }

    if (!culqiRef.current) {
      if (!process.env.REACT_APP_CULQI_PUBLIC_KEY) {
        toast.error('Falta la llave REACT_APP_CULQI_PUBLIC_KEY en .env. ¡Debes reiniciar npm start!');
      } else if (!window.CulqiCheckout) {
        toast.error('El script de Culqi aún no carga. Espera unos segundos o recarga la página.');
      } else {
        toast.error('El sistema de pagos no está listo aún. Verifica tu conexión.');
      }
      return;
    }
    
    if (isProcessing) {
      toast.warning('Ya hay un pago procesándose.');
      return;
    }

    const isEnlace = !!enlace;
    const currency = isEnlace ? (enlace.moneda || 'USD') : 'PEN';
    const amountFloat = isEnlace ? Number(enlace.monto || enlace.montoUSD || enlace.montoPEN || 0) : Number(pedido?.montoDeuda || 0);

    if ((currency === 'USD' && amountFloat < 1) || (currency === 'PEN' && amountFloat < 3)) {
       toast.error(`El monto mínimo de Culqi es ${currency === 'USD' ? '$1.00 USD' : 'S/ 3.00 PEN'}`);
       return;
    }

    // Evita reabrir si ya hay un modal/watcher activo (doble click, re-render que
    // dispare el auto-open de nuevo, etc.): solo abrimos cuando NO hay poller vivo.
    if (closePollRef.current) return;

    // Marca que ya se abrió una vez en esta entrada al paso de pago: refuerza el
    // guard del auto-open para que NO se vuelva a disparar solo.
    autoOpenedRef.current = true;
    culqiRef.current.open();
    startCloseWatch();
  };

  // Vigila el cierre del modal: si el usuario lo abre y luego lo cierra SIN pagar
  // (sin token ni error), dispara onClose UNA sola vez para ofrecer terminar por
  // WhatsApp. Lee el callback vía ref estable (no por la prop directa) para no
  // depender de la identidad del arrow inline del padre.
  const startCloseWatch = () => {
    if (typeof onCloseRef.current !== 'function') return;
    resolvedRef.current = false;
    let sawModal = false;
    let goneTicks = 0;
    // Guard local: garantiza que onClose se dispare como MUCHO una vez por
    // ciclo de apertura, aunque el poller alcance a ejecutarse de más.
    let firedClose = false;
    if (closePollRef.current) clearInterval(closePollRef.current);
    closePollRef.current = setInterval(() => {
      if (isCulqiModalVisible()) { sawModal = true; goneTicks = 0; return; }
      if (!sawModal) return; // el modal aún no aparece
      goneTicks += 1;
      if (goneTicks >= 2) { // ~1.4s sin el modal => se cerró
        clearInterval(closePollRef.current);
        closePollRef.current = null;
        if (!firedClose && !resolvedRef.current && !processingRef.current) {
          firedClose = true;
          if (typeof onCloseRef.current === 'function') onCloseRef.current();
        }
      }
    }, 700);
  };

  // Auto-abrir el checkout de Culqi cuando el padre lo solicite (UX Opción A).
  // Solo se dispara una vez (autoOpenedRef) y unicamente cuando el checkout
  // esta listo (isReady) y la instancia de Culqi ya fue construida (culqiRef).
  // No altera el flujo de token/charge/onSuccess existente: reutiliza handleOpenCheckout.
  useEffect(() => {
    if (autoOpen && isReady && culqiRef.current && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      handleOpenCheckout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, isReady]);

  // Limpia el watcher de cierre al desmontar el componente.
  useEffect(() => () => {
    if (closePollRef.current) clearInterval(closePollRef.current);
  }, []);

  return (
    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      <button 
        onClick={handleOpenCheckout}
        style={{
          width: '100%',
          padding: '14px 20px',
          backgroundColor: '#5d2bb4',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '1.05rem',
          fontWeight: '600',
          cursor: isProcessing ? 'wait' : 'pointer',
          opacity: (!isReady || isProcessing) ? 0.7 : 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 6px -1px rgba(93, 43, 180, 0.2)'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>💳</span> 
        {isProcessing ? 'Procesando tu pago...' : 'Pagar con Tarjeta'}
      </button>
      <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', marginTop: '0.6rem', marginBottom: 0 }}>
        Pagos 100% seguros encriptados por Culqi.
      </p>
    </div>
  );
};

export default CulqiCustomCheckout;
