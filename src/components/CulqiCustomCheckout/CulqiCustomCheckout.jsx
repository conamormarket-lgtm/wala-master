import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Lock } from 'lucide-react';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../services/firebase/config';
import { getOrCreateCulqi } from './culqiSingleton';
import { trackCulqiPurchase } from '../../services/analytics/metaPixel.mjs';
import styles from './CulqiCustomCheckout.module.css';

const CULQI_SCRIPT_ID = 'culqi-js-v4';

// Carga el SDK de Culqi una sola vez. El checkout lo llama apenas se abre la página
// para que, al llegar al paso de pago, el modal se abra sin esperar la descarga.
export function precargarCulqi() {
  if (typeof document === 'undefined' || document.getElementById(CULQI_SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = CULQI_SCRIPT_ID;
  script.src = 'https://js.culqi.com/checkout-js';
  script.async = true;
  document.body.appendChild(script);
}

// Recuerda a nivel de MÓDULO (sobrevive a remontes del componente) para qué
// combinación de pedido + reintento ya se auto-abrió el modal. Así, si el
// componente se re-monta (StrictMode en dev, re-render del padre, aparición de la
// tarjeta de recuperación al cerrar), el autoOpen NO vuelve a disparar el modal.
// El reintento explícito cambia `reopenKey` (= culqiKey) → nueva clave → reabre.
const autoOpenedFor = new Set();

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

// Con el modal abierto, la rueda del mouse desplazaba la página de fondo y el
// modal se iba con ella. Se bloquea el scroll mientras está abierto.
const bloquearScrollDeFondo = (bloquear) => {
  const html = document.documentElement;
  if (bloquear) {
    if (html.dataset.culqiOverflow == null) {
      html.dataset.culqiOverflow = html.style.overflow || '';
      html.style.overflow = 'hidden';
    }
  } else if (html.dataset.culqiOverflow != null) {
    html.style.overflow = html.dataset.culqiOverflow;
    delete html.dataset.culqiOverflow;
  }
};

const CulqiCustomCheckout = ({ pedido, enlace, onSuccess, onClose, onOpen, autoOpen = false, reopenKey = 0, buttonLabel, title: tituloModal }) => {
  const toast = useGlobalToast();
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Pantalla sobre la página mientras el servidor cobra ('cobrando') y justo después
  // del cobro ('aprobado'), hasta que el padre navegue.
  const [pantalla, setPantalla] = useState(null);
  const culqiRef = useRef(null);

  // Identidad ESTABLE del pedido (sobrevive a remontes): con ella reutilizamos la
  // misma instancia de Culqi y evitamos parpadeo/reapertura. `reopenKey` (=culqiKey
  // del checkout) distingue un REINTENTO explícito para permitir reabrir.
  const orderKey = String(pedido?.id || pedido?.numeroPedido || enlace?.id || 'anon');
  const openGuardKey = `${orderKey}::${reopenKey}`;
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
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
    onOpenRef.current = onOpen;
  }, [onSuccess, onClose, onOpen]);

  useEffect(() => {
    let timer = null;
    const checkAndSetReady = () => {
      if (window.CulqiCheckout) {
        setIsReady(true);
      } else {
        timer = setTimeout(checkAndSetReady, 100);
      }
    };
    precargarCulqi();
    checkAndSetReady();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !window.CulqiCheckout) return;

    const isEnlace = !!enlace;
    const title = tituloModal || (isEnlace ? 'Pago Seguro' : 'Pago de Saldo - Walá');
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
        // 'auto' toma el idioma del navegador y el modal salía en inglés.
        // La tienda vende en Perú: forzamos español siempre.
        lang: 'es',
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

    // Reutiliza la instancia si ya existe una para ESTE pedido (orderKey). Un
    // remonte del componente (StrictMode, re-render del padre, tarjeta de
    // recuperación) NO recrea el modal → sin parpadeo ni listener nuevo. Solo se
    // construye una instancia nueva cuando cambia el pedido.
    const culqiInstance = getOrCreateCulqi(orderKey, publicKey, config);
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
        bloquearScrollDeFondo(false);

        setIsProcessing(true);
        setPantalla('cobrando');
        let aprobado = false;

        try {
          // El enlace de /pago-rapido/:id es público y processCulqiPayment exige
          // sesión: quien lo abre sin cuenta entra como anónimo (igual que
          // LandingPaymentBlock). El servidor valida el enlace, su monto y su estado.
          if (enlace && auth && !auth.currentUser) {
            if (auth.authStateReady) await auth.authStateReady();
            if (!auth.currentUser) await signInAnonymously(auth);
          }
          const functions = getFunctions();
          const processCulqiPayment = httpsCallable(functions, 'processCulqiPayment');
          
          const result = await processCulqiPayment({
            tokenId: token,
            amount: amountInt,
            currency: currency,
            email: email,
            description: title,
            checkoutIntentId: pedido?.checkoutIntentId || '',
            metadata: {
              pedidoId: pedido?.id || '',
              checkoutIntentId: pedido?.checkoutIntentId || '',
              enlaceId: enlace?.id || ''
            }
          });

          if (result.data && result.data.success) {
            aprobado = true;
            setPantalla('aprobado');
            // Por si el padre no navega (p. ej. pago de saldo): no dejarla puesta.
            setTimeout(() => setPantalla(null), 5000);
            trackCulqiPurchase(result.data, currency, pedido);
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
          if (!aprobado) setPantalla(null);
          setIsProcessing(false);
          processingRef.current = false; // libera el guard (permite reintento si falló)
        }
        
      } else if (culqiInstance.error) {
         resolvedRef.current = true; // error manejado: cerrar el modal NO es abandono
         if (closePollRef.current) { clearInterval(closePollRef.current); closePollRef.current = null; }
         console.error("Error de Culqi:", culqiInstance.error);
         toast.error(culqiInstance.error.user_message || 'El pago no pudo completarse.');
         culqiInstance.close();
         bloquearScrollDeFondo(false);
      }
    };

    // Limpieza: SOLO paramos el watcher de cierre. NO destruimos la instancia:
    // se reutiliza entre remontes del mismo pedido (evita parpadeo). La instancia
    // anterior se cierra/limpia cuando cambia el pedido (getOrCreateCulqi llama a
    // destroyCulqi con sus listeners) o al cargar la página de nuevo.
    return () => {
      if (closePollRef.current) { clearInterval(closePollRef.current); closePollRef.current = null; }
    };
    // IMPORTANTE: onSuccess/onClose NO van en las deps (se leen vía refs estables).
    // Si estuvieran aquí, la instancia de Culqi se recrearía en cada render del
    // padre (arrows inline) y el modal "saltaría dos veces".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pedido, enlace, tituloModal]);

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
    bloquearScrollDeFondo(true);
    if (typeof onOpenRef.current === 'function') onOpenRef.current();
    startCloseWatch();
  };

  // Vigila el cierre del modal: desbloquea el scroll de fondo y, si el usuario lo
  // cerró SIN pagar (sin token ni error), dispara onClose UNA sola vez para ofrecer
  // terminar por WhatsApp. Corre aunque no haya onClose (el scroll se desbloquea
  // igual). Lee el callback vía ref estable para no depender de la identidad del
  // arrow inline del padre.
  const startCloseWatch = () => {
    resolvedRef.current = false;
    let sawModal = false;
    let goneTicks = 0;
    // Guard local: garantiza que onClose se dispare como MUCHO una vez por
    // ciclo de apertura, aunque el poller alcance a ejecutarse de más.
    let firedClose = false;
    if (closePollRef.current) clearInterval(closePollRef.current);
    let ticksSinModal = 0;
    closePollRef.current = setInterval(() => {
      // Re-bloquea en cada tick visible: al reabrir, Culqi oculta y muestra su
      // iframe un instante y ese parpadeo soltaba el scroll.
      if (isCulqiModalVisible()) { sawModal = true; goneTicks = 0; bloquearScrollDeFondo(true); return; }
      if (!sawModal) {
        // El modal aún no aparece; si no aparece en ~10 s (bloqueador, error del
        // SDK), se suelta el scroll y se deja de vigilar.
        ticksSinModal += 1;
        if (ticksSinModal >= 40) {
          clearInterval(closePollRef.current);
          closePollRef.current = null;
          bloquearScrollDeFondo(false);
        }
        return;
      }
      goneTicks += 1;
      bloquearScrollDeFondo(false);
      if (goneTicks >= 2) { // ~0,5 s sin el modal => se cerró
        clearInterval(closePollRef.current);
        closePollRef.current = null;
        if (!firedClose && !resolvedRef.current && !processingRef.current) {
          firedClose = true;
          if (typeof onCloseRef.current === 'function') onCloseRef.current();
        }
      }
    }, 250);
  };

  // Auto-abrir el checkout de Culqi cuando el padre lo solicite (UX Opción A).
  // Solo se dispara una vez (autoOpenedRef) y unicamente cuando el checkout
  // esta listo (isReady) y la instancia de Culqi ya fue construida (culqiRef).
  // No altera el flujo de token/charge/onSuccess existente: reutiliza handleOpenCheckout.
  useEffect(() => {
    // Guard a nivel de MÓDULO (no un ref por-montaje): un remonte accidental deja
    // autoOpenedRef en false, pero `autoOpenedFor` recuerda que ya se abrió para
    // este pedido+reintento y NO lo reabre. El reintento cambia reopenKey → nueva
    // clave → sí reabre.
    if (autoOpen && isReady && culqiRef.current && !autoOpenedFor.has(openGuardKey)) {
      autoOpenedFor.add(openGuardKey);
      autoOpenedRef.current = true;
      handleOpenCheckout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, isReady, openGuardKey]);

  // Limpia el watcher de cierre al desmontar el componente.
  useEffect(() => () => {
    if (closePollRef.current) clearInterval(closePollRef.current);
    bloquearScrollDeFondo(false);
  }, []);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.payButton}
        onClick={handleOpenCheckout}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <><span className={styles.spinner} aria-hidden="true" /> Procesando tu pago...</>
        ) : (
          <><CreditCard size={20} aria-hidden="true" /> {buttonLabel || 'Pagar con tarjeta'}</>
        )}
      </button>
      <p className={styles.secureNote}>
        <Lock size={13} aria-hidden="true" />
        Pago seguro con Culqi. Walá no guarda los datos de tu tarjeta.
      </p>
      {pantalla && typeof document !== 'undefined' && createPortal(
        <div className={styles.overlay} role="alertdialog" aria-live="assertive" aria-busy={pantalla === 'cobrando'}>
          <div className={styles.overlayCard}>
            <div className={styles.overlaySpinner} aria-hidden="true" />
            <p className={styles.overlayTitle}>
              {pantalla === 'cobrando' ? 'Confirmando tu pago…' : '¡Pago aprobado!'}
            </p>
            <p className={styles.overlayText}>
              {pantalla === 'cobrando'
                ? 'Estamos confirmando el cobro con tu banco. No cierres ni recargues esta página.'
                : 'Estamos registrando tu pedido. En un momento verás el detalle.'}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CulqiCustomCheckout;
