import React, { useState, useEffect, useRef } from 'react';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

const CulqiCustomCheckout = ({ pedido, enlace, onSuccess }) => {
  const toast = useGlobalToast();
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const culqiRef = useRef(null);

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
            if (onSuccess) onSuccess(result.data);
          } else {
            toast.error(result.data?.message || 'Error al procesar el pago en el servidor.');
          }
        } catch (error) {
          console.error("Error processCulqiPayment:", error);
          toast.error(error.message || 'Error de comunicación con el servidor.');
        } finally {
          setIsProcessing(false);
        }
        
      } else if (culqiInstance.error) {
         console.error("Error de Culqi:", culqiInstance.error);
         toast.error(culqiInstance.error.user_message || 'El pago no pudo completarse.');
         culqiInstance.close();
      }
    };

  }, [isReady, pedido, enlace, onSuccess]);

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

    culqiRef.current.open();
  };

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
