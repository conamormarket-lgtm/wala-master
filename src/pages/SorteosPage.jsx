// ── SorteosPage — Página pública del Módulo Sorteos (Build 1 + Build 2) ──────
// Móvil-first (el tráfico viene de lives en el teléfono). Muestra el sorteo
// activo con hero del premio, countdown, reglas de cómo ganar chances, gate de
// login, y el botón PARTICIPAR (gratis via callable). En Build 2 se añade el
// FLUJO REAL DE COMPRA DE TICKETS para sorteos tipo="pagado".
//
// PRINCIPIOS DE POCAS LECTURAS (regla dura):
//   - Contador en vivo = suma de shards (getContadorSorteo), refresco suave con
//     react-query refetchInterval (NO onSnapshot, NO escaneo de participantes).
//   - "Mi participación" = 1 doc por uid (getMiParticipacion), staleTime 30s.
//   - El estado del sorteo (contador/tickets) vive en Firestore, nunca en
//     localStorage.
//
// REGLAS DE DINERO (Build 2 — NO negociables):
//   - El precio del ticket lo fija SIEMPRE el servidor (precioTicket*cantidad):
//     comprarTicketSorteoSecure devuelve montoCentimos/metadata autoritativos y
//     el cliente los reenvía TAL CUAL. El total mostrado aquí es solo display.
//   - pagoConfirmado lo escribe SOLO el servidor (webhook Culqi / captura PayPal).
//   - Idempotente por pagoId (chargeId Culqi / captureId PayPal) en el backend.
//   - NO se duplica la lógica de montos de Culqi/PayPal: se reusan sus SDKs
//     (checkout-js / @paypal/react-paypal-js) y las callables del contrato.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalToast } from '../contexts/ToastContext';
import { getClientType } from '../services/analytics/tracker';
import { GlassCard, GlassButton, GlassPanel, Badge } from '../components/ui';
import {
  getSorteoActivo,
  getSorteoBySlug,
  getMiParticipacion,
  getContadorSorteo,
  participarGratis,
  comprarTicketSorteo,
  sumarChanceCompartir,
  claimRaffleReferral,
} from '../services/sorteos';
import styles from './SorteosPage.module.css';

// Imagen de reemplazo si falla la carga del hero/premio.
const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#2A2640"/><text x="50%" y="50%" fill="#C7C1D8" font-family="sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Sorteo Walá</text></svg>',
  );

// Convierte un Timestamp de Firestore (o Date/número) a milisegundos.
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Cuenta regresiva sencilla hacia una fecha objetivo (en ms). Se actualiza cada
// segundo con un intervalo local (NO toca Firestore). Devuelve texto legible.
function useCountdown(targetMs) {
  const [now, setNow] = useState(() => Date.now());
  React.useEffect(() => {
    if (!targetMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!targetMs) return { texto: '', terminado: false };
  const diff = targetMs - now;
  if (diff <= 0) return { texto: 'Finalizado', terminado: true };

  const dias = Math.floor(diff / 86400000);
  const horas = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const segs = Math.floor((diff % 60000) / 1000);
  const partes = [];
  if (dias > 0) partes.push(`${dias}d`);
  partes.push(`${String(horas).padStart(2, '0')}h`);
  partes.push(`${String(mins).padStart(2, '0')}m`);
  partes.push(`${String(segs).padStart(2, '0')}s`);
  return { texto: partes.join(' '), terminado: false };
}

// Imagen con fallback a placeholder si el src falla.
function ImagenConFallback({ src, alt, className }) {
  const [error, setError] = useState(false);
  return (
    <img
      className={className}
      src={error || !src ? PLACEHOLDER_IMG : src}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

// ── Confeti de celebración (CSS puro, sin dependencias) ──────────────────────
// Se muestra cuando el usuario actual GANÓ el sorteo. No existe RuletaPage con
// confeti CSS reutilizable (usa un evento global de monedas), así que aquí se
// hace una animación CSS ligera: N partículas con retardos/posiciones aleatorias
// que caen una sola vez. `pointer-events:none` para no bloquear la interacción.
const CONFETI_COLORES = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

function Confeti({ activo }) {
  // Genera las partículas una sola vez (posición/color/retardo aleatorios) para
  // que no cambien en cada render mientras dura la animación.
  const particulas = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.6}s`,
      duration: `${1.8 + Math.random() * 1.4}s`,
      color: CONFETI_COLORES[i % CONFETI_COLORES.length],
      size: `${6 + Math.round(Math.random() * 6)}px`,
    }));
  }, []);

  if (!activo) return null;
  return (
    <div className={styles.confeti} aria-hidden="true">
      {particulas.map((p) => (
        <span
          key={p.id}
          className={styles.confetiPieza}
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

// ── Botón Culqi para tickets de sorteo ───────────────────────────────────────
// Reusa el MISMO SDK (checkout-js) y la MISMA callable processCulqiPayment que
// CulqiCustomCheckout, sin duplicar lógica de montos: el `amount` que se envía es
// solo referencial (el servidor RECALCULA precioTicket*cantidad para metadata
// tipo:"sorteo" y aborta si no cuadra). Lo que casa el cobro con el ticket es la
// `metadata` devuelta por comprarTicketSorteoSecure, que se reenvía TAL CUAL.
//
// Props:
//   intento  = { montoCentimos, monto, moneda, metadata } (de la CF)
//   email    = correo del comprador (Culqi lo exige)
//   onPaid   = callback tras confirmar el cargo server-side
//   onError  = callback en error de negocio/red
function CulqiTicketButton({ intento, email, onPaid, onError }) {
  const toast = useGlobalToast();
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const culqiRef = useRef(null);
  // Guard SÍNCRONO anti doble-cobro (isProcessing es async y no frena una
  // segunda invocación inmediata del callback de Culqi; este ref sí).
  const processingRef = useRef(false);
  // Callbacks vía ref estable: no recrean la instancia de Culqi en cada render.
  const onPaidRef = useRef(onPaid);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onPaidRef.current = onPaid;
    onErrorRef.current = onError;
  }, [onPaid, onError]);

  // Carga perezosa del script de Culqi (idéntico patrón a CulqiCustomCheckout).
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

  // Construye la instancia de Culqi cuando el SDK está listo o cambia el intento.
  useEffect(() => {
    if (!isReady || !window.CulqiCheckout || !intento) return undefined;

    // Monto SOLO referencial para el modal: el servidor recalcula el autoritativo.
    const currency = intento.moneda || 'PEN';
    const amountInt = Number(intento.montoCentimos || 0);

    const publicKey = process.env.REACT_APP_CULQI_PUBLIC_KEY;
    if (!publicKey) {
      console.error('Culqi: Falta REACT_APP_CULQI_PUBLIC_KEY en .env');
      return undefined;
    }

    const config = {
      settings: {
        title: 'Ticket de Sorteo - Walá',
        currency,
        amount: amountInt,
      },
      client: { email: email || '' },
      options: { lang: 'auto', installments: false, modal: true },
      appearance: {
        theme: 'default',
        hiddenCulqiLogo: false,
        hiddenBannerContent: false,
        hiddenBanner: false,
        hiddenToolBarAmount: false,
        menuType: 'sidebar',
      },
    };

    const culqiInstance = new window.CulqiCheckout(publicKey, config);
    culqiRef.current = culqiInstance;

    culqiInstance.culqi = async () => {
      if (culqiInstance.token) {
        // Evita un SEGUNDO cargo si el callback se dispara dos veces.
        if (processingRef.current) return;
        processingRef.current = true;
        const token = culqiInstance.token.id;
        const tokenEmail = culqiInstance.token.email;
        culqiInstance.close();

        setIsProcessing(true);
        toast.info('Procesando pago seguro con Culqi...');
        try {
          const processCulqiPayment = httpsCallable(getFunctions(), 'processCulqiPayment');
          const result = await processCulqiPayment({
            tokenId: token,
            // `amount` es referencial: el servidor recalcula para sorteos.
            amount: amountInt,
            currency,
            email: tokenEmail || email,
            description: 'Ticket(s) de sorteo Walá',
            // CLAVE: la metadata (tipo:"sorteo", sorteoId, ticketId, uid) casa el
            // cargo con el ticket y activa el recálculo/confirmación server-side.
            metadata: intento.metadata,
          });
          if (result.data && result.data.success) {
            toast.success('¡Pago procesado exitosamente! 🎟️');
            if (onPaidRef.current) onPaidRef.current(result.data);
          } else {
            const msg = result.data?.message || 'Error al procesar el pago en el servidor.';
            toast.error(msg);
            if (onErrorRef.current) onErrorRef.current(msg);
          }
        } catch (error) {
          console.error('Error processCulqiPayment (sorteo):', error);
          const msg = error?.message || 'Error de comunicación con el servidor.';
          toast.error(msg);
          if (onErrorRef.current) onErrorRef.current(msg);
        } finally {
          setIsProcessing(false);
          processingRef.current = false; // libera el guard (permite reintento)
        }
      } else if (culqiInstance.error) {
        console.error('Error de Culqi:', culqiInstance.error);
        const msg = culqiInstance.error.user_message || 'El pago no pudo completarse.';
        toast.error(msg);
        culqiInstance.close();
        if (onErrorRef.current) onErrorRef.current(msg);
      }
    };
    return undefined;
    // onPaid/onError NO van en deps (se leen vía refs estables).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, intento, email]);

  const handleOpen = () => {
    if (!isReady || !culqiRef.current) {
      toast.error('El sistema de pagos aún no está listo. Espera unos segundos.');
      return;
    }
    if (isProcessing) {
      toast.warning('Ya hay un pago procesándose.');
      return;
    }
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
    >
      {isProcessing ? 'Procesando tu pago…' : '💳 Pagar con tarjeta (Culqi)'}
    </GlassButton>
  );
}

// ── Botones PayPal para tickets de sorteo ────────────────────────────────────
// Usa el MISMO SDK (@paypal/react-paypal-js) que PaypalCheckout, pero con las
// callables DEDICADAS del contrato de sorteos (createPaypalTicketSorteoSecure /
// capturePaypalTicketSorteoSecure): el monto USD lo calcula/valida el SERVIDOR y
// el ticket se marca pagado solo cuando la captura devuelve COMPLETED.
//
// Props:
//   sorteoId, ticketId = del intento (comprarTicketSorteoSecure)
//   onPaid   = callback tras captura confirmada
//   onError  = callback en error
function PaypalTicketButtons({ sorteoId, ticketId, onPaid, onError }) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Si el .env dice 'sb' o está vacío, usamos 'test' (sandbox oficial del SDK),
  // idéntico a PaypalCheckout para no divergir en configuración.
  const actualClientId =
    !process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID === 'sb'
      ? 'test'
      : process.env.REACT_APP_PAYPAL_CLIENT_ID;

  const initialOptions = { clientId: actualClientId, currency: 'USD', intent: 'capture' };

  // Crea la orden en el SERVIDOR (recalcula el USD del ticket real). Devolvemos
  // el orderID para que el SDK de PayPal abra esa orden ya creada server-side.
  const createOrder = () => {
    const createSecure = httpsCallable(getFunctions(), 'createPaypalTicketSorteoSecure');
    return createSecure({ sorteoId, ticketId })
      .then((res) => {
        const orderID = res && res.data && res.data.orderID;
        if (!orderID) throw new Error('El servidor no devolvió el orderID de PayPal.');
        return orderID;
      })
      .catch((err) => {
        console.error('createPaypalTicketSorteoSecure falló:', err);
        const msg = err?.message || 'No se pudo iniciar el pago con PayPal. Inténtalo más tarde.';
        if (onError) onError(msg);
        throw err; // aborta el flujo del SDK (no abre aprobador)
      });
  };

  // La captura y el marcado del ticket como pagado los hace el SERVIDOR: el front
  // NO captura ni escribe nada; solo confía en lo que devuelve la CF.
  const onApprove = async (data) => {
    try {
      setIsProcessing(true);
      const captureSecure = httpsCallable(getFunctions(), 'capturePaypalTicketSorteoSecure');
      const res = await captureSecure({ orderID: data.orderID, sorteoId, ticketId });
      const cap = res && res.data;
      if (!cap || cap.success !== true || cap.status !== 'COMPLETED') {
        throw new Error('El servidor no confirmó el pago de PayPal.');
      }
      if (onPaid) onPaid(cap);
    } catch (err) {
      console.error('capturePaypalTicketSorteoSecure falló:', err);
      const msg = err?.message || 'No se pudo verificar el pago con el servidor. No se realizó ningún cargo confirmado.';
      if (onError) onError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleError = (err) => {
    console.error('PayPal Error (sorteo):', err);
    if (onError) onError('Ocurrió un error al cargar la pasarela de PayPal.');
  };

  return (
    <div className={styles.paypalWrap}>
      {isProcessing ? (
        <div className={styles.payProcessing}>
          <strong>Procesando pago…</strong>
          <p>Verificando de forma segura. Por favor, no cierres esta ventana.</p>
        </div>
      ) : (
        <PayPalScriptProvider options={initialOptions}>
          <PayPalButtons
            createOrder={createOrder}
            onApprove={onApprove}
            onError={handleError}
            style={{ layout: 'vertical', shape: 'rect' }}
          />
        </PayPalScriptProvider>
      )}
    </div>
  );
}

// ── Formulario de datos del participante (modal) ─────────────────────────────
// Se muestra al pulsar "Participar" (gratis o pagado). Capta los datos de
// contacto que el sorteo necesita para contactar al ganador (nombre, apellidos,
// documento, teléfono, correo) + país/fecha. En sorteos PAGADOS incluye el
// selector de cantidad y el total (solo display; el monto real lo recalcula el
// servidor). Prefill desde el perfil si existe. onSubmit(datos, cantidad).
const TIPOS_DOC = ['DNI', 'CE', 'Pasaporte', 'RUC', 'Otro'];

function FormularioDatosSorteo({ esPagado, precioTicket, moneda, initial, enviando, onSubmit, onCancel }) {
  const [f, setF] = useState(initial);
  const [cantidad, setCantidad] = useState(1);
  const [err, setErr] = useState('');

  const set = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setErr('');
    // Mínimos para contactar al ganador (el servidor los revalida).
    if (!f.nombres.trim() || !f.telefono.trim() || !f.numeroDocumento.trim()) {
      setErr('Completa tu nombre, teléfono y número de documento.');
      return;
    }
    onSubmit(
      {
        nombres: f.nombres.trim(),
        apellidos: f.apellidos.trim(),
        tipoDocumento: f.tipoDocumento,
        numeroDocumento: f.numeroDocumento.trim(),
        fechaNacimiento: f.fechaNacimiento,
        pais: (f.pais || '').trim(),
        telefono: f.telefono.trim(),
        correo: (f.correo || '').trim(),
      },
      cantidad,
    );
  };

  const total = (Number(precioTicket || 0) * cantidad).toFixed(2);

  return (
    <div className={styles.modalBackdrop} onClick={enviando ? undefined : onCancel}>
      <div className={styles.modalForm} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className={styles.modalFormTitle}>Completa tus datos para participar</h2>
        <p className={styles.modalFormSub}>
          {esPagado
            ? 'Con estos datos generamos tu ticket y te contactamos si ganas.'
            : 'Con estos datos validamos tu participación y te contactamos si ganas.'}
        </p>
        <form onSubmit={submit} className={styles.formGrid}>
          <div className={styles.formRow2}>
            <label className={styles.formField}>
              <span>Nombres *</span>
              <input className={styles.formInput} value={f.nombres} onChange={set('nombres')} required />
            </label>
            <label className={styles.formField}>
              <span>Apellidos</span>
              <input className={styles.formInput} value={f.apellidos} onChange={set('apellidos')} />
            </label>
          </div>
          <div className={styles.formRow2}>
            <label className={styles.formField}>
              <span>Tipo de documento</span>
              <select className={styles.formInput} value={f.tipoDocumento} onChange={set('tipoDocumento')}>
                {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className={styles.formField}>
              <span>N.º de documento *</span>
              <input className={styles.formInput} value={f.numeroDocumento} onChange={set('numeroDocumento')} required />
            </label>
          </div>
          <div className={styles.formRow2}>
            <label className={styles.formField}>
              <span>Teléfono / celular *</span>
              <input className={styles.formInput} value={f.telefono} onChange={set('telefono')} inputMode="tel" required />
            </label>
            <label className={styles.formField}>
              <span>Correo</span>
              <input className={styles.formInput} type="email" value={f.correo} onChange={set('correo')} />
            </label>
          </div>
          <div className={styles.formRow2}>
            <label className={styles.formField}>
              <span>País</span>
              <input className={styles.formInput} value={f.pais} onChange={set('pais')} />
            </label>
            <label className={styles.formField}>
              <span>Fecha de nacimiento</span>
              <input className={styles.formInput} type="date" value={f.fechaNacimiento} onChange={set('fechaNacimiento')} />
            </label>
          </div>

          {esPagado && (
            <div className={styles.formPago}>
              <div className={styles.cantidadRow}>
                <span className={styles.cantidadLabel}>Cantidad de tickets</span>
                <div className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    disabled={cantidad <= 1 || enviando}
                    aria-label="Quitar un ticket"
                  >
                    −
                  </button>
                  <span className={styles.stepperValue} aria-live="polite">{cantidad}</span>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => setCantidad((c) => Math.min(99, c + 1))}
                    disabled={enviando}
                    aria-label="Agregar un ticket"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className={styles.totalRow}>
                <span>Total</span>
                <strong className={styles.totalValue}>{moneda} {total}</strong>
              </div>
            </div>
          )}

          {err && <p className={styles.errorBox}>{err}</p>}

          <div className={styles.modalActions}>
            <GlassButton type="button" variant="ghost" size="md" onClick={onCancel} disabled={enviando}>
              Cancelar
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="md" loading={enviando} disabled={enviando}>
              {enviando ? 'Enviando…' : (esPagado ? 'Continuar al pago' : 'Participar')}
            </GlassButton>
          </div>
        </form>
      </div>
    </div>
  );
}

const SorteosPage = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const toast = useGlobalToast();
  // Slug opcional de la ruta /sorteos/:slug (si no hay, se carga el activo).
  const { slug } = useParams();

  // origenApp: detecta si venimos del app (Capacitor) o de la web. tracker.js:50.
  const origenApp = useMemo(() => getClientType() === 'APP', []);

  const [accionError, setAccionError] = useState('');
  const [participando, setParticipando] = useState(false);
  // Formulario de datos abierto (se pide SIEMPRE al participar/comprar).
  const [formAbierto, setFormAbierto] = useState(false);

  // ── Chances virales (Build 3): compartir + referido ────────────────────────
  const [searchParams] = useSearchParams();
  const refCodeUrl = searchParams.get('ref') || '';       // ?ref=KS-XXXXXX
  const [compartiendo, setCompartiendo] = useState(false); // en curso: sumarChanceCompartir
  const [yaCompartio, setYaCompartio] = useState(false);   // botón deshabilitado si ya reclamó
  const [copiado, setCopiado] = useState(false);           // feedback "¡Copiado!" del enlace referido
  // Guard: solo intentamos acreditar el referido UNA vez por montaje (la CF ya
  // es idempotente por lock, pero evitamos llamadas repetidas del efecto).
  const referidoIntentadoRef = useRef(false);

  // ── Estado del flujo de compra de tickets (sorteos pagados) ────────────────
  const [intento, setIntento] = useState(null);        // respuesta de comprarTicketSorteoSecure
  const [metodo, setMetodo] = useState(null);          // 'culqi' | 'paypal' (elegido tras preparar)

  // 1) Sorteo: por SLUG si la ruta lo trae (/sorteos/:slug), o el activo más
  //    reciente (/sorteos). 1 query barata; staleTime 30s.
  const {
    data: sorteo,
    isLoading: cargandoSorteo,
    error: errorSorteo,
  } = useQuery({
    queryKey: ['sorteo', slug || '__activo__'],
    queryFn: async () => {
      const { data, error } = slug ? await getSorteoBySlug(slug) : await getSorteoActivo();
      if (error) throw new Error(error);
      return data; // puede ser null si no hay sorteo
    },
    staleTime: 30000,
  });

  const sorteoId = sorteo?.id || null;

  // 2) Mi participación (1 doc, id=uid). Solo si hay usuario y sorteo.
  const { data: miParticipacion } = useQuery({
    queryKey: ['mi-participacion', sorteoId, user?.uid],
    queryFn: async () => {
      const { data, error } = await getMiParticipacion(sorteoId, user.uid);
      if (error) throw new Error(error);
      return data; // null si aún no participa
    },
    enabled: !!sorteoId && !!user?.uid,
    staleTime: 30000,
  });

  // 3) Contador en vivo (suma de shards). Refresco suave cada 20s, sin onSnapshot.
  const { data: contador } = useQuery({
    queryKey: ['contador-sorteo', sorteoId],
    queryFn: async () => {
      const { data } = await getContadorSorteo(sorteoId);
      return data;
    },
    enabled: !!sorteoId,
    staleTime: 20000,
    refetchInterval: 20000,
  });

  // Total mostrado: prioriza la suma de shards; cae al denormalizado aprox.
  const totalParticipantes =
    typeof contador === 'number' ? contador : sorteo?.contadorParticipantes || 0;

  const fechaFinMs = useMemo(() => toMillis(sorteo?.fechaFin), [sorteo?.fechaFin]);
  // La fecha es SOLO informativa (cuenta regresiva): no bloquea la participación.
  const { texto: countdown } = useCountdown(fechaFinMs);

  const yaParticipa = !!miParticipacion;
  const esGratis = sorteo?.tipo === 'gratis';
  const esPagado = sorteo?.tipo === 'pagado';
  const requiereApp = sorteo?.requisitoApp === 'obligatorio';
  const bloqueadoPorApp = requiereApp && !origenApp;

  // Precio del ticket SOLO para display (el server recalcula el autoritativo).
  const precioTicket = Number(sorteo?.precioTicket || 0);
  const monedaSorteo = sorteo?.moneda || 'PEN';

  // Correo del comprador (Culqi lo exige): perfil → auth → vacío.
  const emailComprador = userProfile?.email || user?.email || '';

  // Prefill del formulario de datos desde el perfil (si existe). El displayName
  // se parte en nombres/apellidos (primera palabra = nombres, resto = apellidos).
  const initialForm = useMemo(() => {
    const dn = String(userProfile?.displayName || user?.displayName || '').trim();
    const partes = dn ? dn.split(/\s+/) : [];
    const nombres = partes.length ? partes[0] : '';
    const apellidos = partes.length > 1 ? partes.slice(1).join(' ') : '';
    return {
      nombres,
      apellidos,
      tipoDocumento: userProfile?.documentType || 'DNI',
      numeroDocumento: userProfile?.dni || '',
      fechaNacimiento: '',
      pais: userProfile?.country || 'PE',
      telefono: userProfile?.phone || '',
      correo: userProfile?.email || user?.email || '',
    };
  }, [userProfile, user]);

  // ── Chances virales: enlaces y estado derivado (Build 3) ───────────────────
  // Código de referido del usuario (KS-XXXXXX). El backend acredita +1 chance al
  // dueño de este código por cada persona que participe con su enlace.
  const miRefCode = userProfile?.referralCode || '';

  // URL base de la página del sorteo (SorteosPage vive en /sorteos y carga el
  // sorteo activo; no lleva id en la ruta). Se usa para compartir y referir.
  const urlSorteo = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/sorteos`;
  }, []);

  // Enlace de referido del usuario = URL del sorteo + ?ref={miRefCode}.
  const enlaceReferido = useMemo(
    () => (miRefCode ? `${urlSorteo}?ref=${encodeURIComponent(miRefCode)}` : urlSorteo),
    [urlSorteo, miRefCode],
  );

  // Refresca los datos server-side tras participar (mi participación + contador).
  const refrescarTrasParticipar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mi-participacion', sorteoId, user?.uid] });
    queryClient.invalidateQueries({ queryKey: ['contador-sorteo', sorteoId] });
  }, [queryClient, sorteoId, user?.uid]);

  // Abre el formulario de datos (se piden SIEMPRE al participar/comprar).
  const abrirFormulario = useCallback(() => {
    setAccionError('');
    setIntento(null);
    setMetodo(null);
    setFormAbierto(true);
  }, []);

  // Envío del formulario. GRATIS → participa directo con los datos. PAGADO →
  // crea la intención de compra con los datos y muestra el método de pago.
  const handleSubmitFormulario = useCallback(async (datos, cantidadForm) => {
    setAccionError('');
    if (!sorteoId) return;
    setParticipando(true);

    // ── Sorteo PAGADO: crear la intención con los datos → mostrar el pago ──
    if (sorteo?.tipo === 'pagado') {
      const { data, error } = await comprarTicketSorteo({
        sorteoId,
        cantidad: Number(cantidadForm) || 1,
        datos,
      });
      setParticipando(false);
      if (error) {
        setAccionError(error);
        return;
      }
      if (!data?.ok || !data?.ticketId || !data?.metadata) {
        setAccionError('No se pudo preparar la compra. Inténtalo de nuevo.');
        return;
      }
      setIntento(data); // dispara la vista de métodos de pago
      setFormAbierto(false);
      return;
    }

    // ── Sorteo GRATIS: participar directo con los datos ──
    const { data, error } = await participarGratis(sorteoId, origenApp, datos);
    setParticipando(false);
    if (error) {
      setAccionError(error);
      return;
    }
    if (data?.ok) {
      setFormAbierto(false);
      refrescarTrasParticipar();
      toast.success('¡Ya estás participando! 🎉');
    }
  }, [sorteoId, sorteo, origenApp, refrescarTrasParticipar, toast]);

  // Handler COMPARTIR: usa navigator.share (móvil) o copia el enlace; luego
  // llama a la CF para acreditar +1 chance (una sola vez por sorteo). El servidor
  // es la única fuente de verdad: el cliente NUNCA suma su propia chance.
  const handleCompartir = useCallback(async () => {
    setAccionError('');
    if (!sorteoId || compartiendo || yaCompartio) return;

    // Enlace a compartir: si el usuario tiene refCode, comparte SU enlace de
    // referido (así también gana chances por referidos); si no, la URL simple.
    const url = miRefCode ? enlaceReferido : urlSorteo;
    const premio = sorteo?.premio?.nombre || sorteo?.titulo || 'este sorteo';
    const shareData = {
      title: 'Sorteo Walá',
      text: `¡Estoy participando para ganar ${premio} en Walá! Participa tú también:`,
      url,
    };

    // Intento de compartir nativo; si no está disponible o el usuario cancela,
    // caemos a copiar el enlace. NINGUNA de las dos ramas debe frenar la chance:
    // el objetivo (difundir) se cumplió al abrir el diálogo o copiar.
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace copiado. ¡Compártelo!');
      }
    } catch (e) {
      // AbortError = el usuario cerró el diálogo nativo: no es un fallo real y no
      // debe bloquear el reclamo de la chance.
      if (e?.name !== 'AbortError') {
        // Fallback final: si share falló por otra razón, intentamos copiar.
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            toast.success('Enlace copiado. ¡Compártelo!');
          }
        } catch {
          /* sin clipboard: seguimos igual y reclamamos la chance */
        }
      }
    }

    // Acredita la chance server-side (idempotente: si ya se reclamó, no duplica).
    setCompartiendo(true);
    const { data, error } = await sumarChanceCompartir(sorteoId);
    setCompartiendo(false);

    if (error) {
      setAccionError(error);
      return;
    }
    if (data?.ok) {
      setYaCompartio(true);
      if (!data.yaReclamado) toast.success('¡+1 chance por compartir! 🎉');
      refrescarTrasParticipar(); // refresca "Tus chances: N"
    }
  }, [
    sorteoId,
    compartiendo,
    yaCompartio,
    miRefCode,
    enlaceReferido,
    urlSorteo,
    sorteo,
    toast,
    refrescarTrasParticipar,
  ]);

  // Handler COPIAR ENLACE de referido (botón junto al enlace mostrado).
  const handleCopiarReferido = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(enlaceReferido);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar. Copia el enlace manualmente.');
    }
  }, [enlaceReferido, toast]);

  // Éxito de pago (Culqi o PayPal): refresca mi participación/contador para ver
  // los tickets, cierra el flujo y avisa. La CACHÉ vive en react-query (nube),
  // NUNCA en localStorage.
  const handlePagoConfirmado = useCallback(() => {
    setIntento(null);
    setMetodo(null);
    refrescarTrasParticipar();
    toast.success('¡Tus tickets ya están registrados! 🎉');
  }, [refrescarTrasParticipar, toast]);

  // Error de pago: muestra el mensaje pero MANTIENE el intento vivo para reintentar
  // (el mismo ticket puede pagarse de nuevo; el backend es idempotente por pagoId).
  const handlePagoError = useCallback((msg) => {
    setAccionError(msg || 'El pago no pudo completarse. Inténtalo de nuevo.');
  }, []);

  // Cancelar el flujo de pago y volver al selector de cantidad.
  const cancelarCompra = useCallback(() => {
    setIntento(null);
    setMetodo(null);
    setAccionError('');
  }, []);

  // ── Reclamo del referido al entrar con ?ref=CODE ───────────────────────────
  // Cuando el usuario YA participa (recién o de antes) y llegó con un ?ref=CODE
  // válido en la URL, acreditamos +1 chance al DUEÑO del código. La CF es
  // idempotente por lock; el ref local solo evita re-llamar en cada render.
  // No se acredita si el código es el propio (el backend igual lo rechazaría).
  useEffect(() => {
    if (!sorteoId || !user?.uid || !yaParticipa) return;
    if (!refCodeUrl) return;
    if (referidoIntentadoRef.current) return;
    // Evita autoacreditarse con su propio enlace.
    if (miRefCode && refCodeUrl.toUpperCase() === miRefCode.toUpperCase()) {
      referidoIntentadoRef.current = true;
      return;
    }
    referidoIntentadoRef.current = true;
    (async () => {
      const { data } = await claimRaffleReferral(sorteoId, refCodeUrl);
      // Si se acreditó al referente, su "chances" cambian (no las nuestras),
      // pero refrescamos por si el backend también nos devuelve algo.
      if (data?.ok && data?.acreditado) {
        refrescarTrasParticipar();
      }
    })();
  }, [sorteoId, user?.uid, yaParticipa, refCodeUrl, miRefCode, refrescarTrasParticipar]);

  // ── Estados de carga / error / vacío ─────────────────────────────────────
  if (cargandoSorteo) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBox}>Cargando sorteos…</div>
      </div>
    );
  }

  if (errorSorteo) {
    return (
      <div className={styles.page}>
        <GlassCard variant="soft" padding="lg" className={styles.stateBox}>
          <p className={styles.stateText}>No pudimos cargar los sorteos ahora.</p>
        </GlassCard>
      </div>
    );
  }

  if (!sorteo) {
    return (
      <div className={styles.page}>
        <GlassCard variant="soft" padding="lg" className={styles.stateBox}>
          <div className={styles.emptyEmoji} aria-hidden="true">🎁</div>
          <h1 className={styles.emptyTitle}>Pronto habrá sorteos</h1>
          <p className={styles.stateText}>
            Aún no hay un sorteo activo. ¡Vuelve pronto para participar y ganar!
          </p>
        </GlassCard>
      </div>
    );
  }

  const premioNombre = sorteo.premio?.nombre || sorteo.titulo || 'un gran premio';
  const heroSrc = sorteo.heroImagenUrl || sorteo.premio?.imagenUrl;

  // Sorteo cerrado = SOLO cuando el admin lo cierra (estado "cerrado"), NUNCA por
  // la fecha: la cuenta regresiva es informativa. Así una fecha ya pasada no
  // bloquea la participación (el admin decide cuándo cerrar y decidir ganadores).
  const cerrado = sorteo.estado === 'cerrado';

  // Ganadores oficiales (los escribe SOLO el servidor en decidirGanadoresSorteo).
  const ganadores = Array.isArray(sorteo.ganadores) ? sorteo.ganadores : [];
  const hayGanadores = ganadores.length > 0;
  // Solo revelamos cuando el sorteo está CERRADO y hay ganadores publicados.
  const revelarGanadores = sorteo.estado === 'cerrado' && hayGanadores;
  // ¿El usuario actual es uno de los ganadores? (por uid del token).
  const soyGanador = !!user?.uid && ganadores.some((g) => g?.uid === user.uid);

  // Tickets pagados del usuario (para el estado "Tus tickets pagados: N").
  const ticketsPagados = miParticipacion?.ticketsPagados ?? 0;

  // Muestra los botones/enlaces de chances virales solo si el usuario participa,
  // el sorteo sigue abierto, y el admin activó la mecánica correspondiente.
  const mostrarCompartir = user && yaParticipa && !cerrado && sorteo.chanceExtraCompartir;
  const mostrarReferido =
    user && yaParticipa && !cerrado && sorteo.chanceExtraReferido && !!miRefCode;

  return (
    <div className={styles.page}>
      {/* CONFETI: solo si el usuario actual GANÓ y el sorteo revela ganadores. */}
      <Confeti activo={revelarGanadores && soyGanador} />

      {/* HERO ---------------------------------------------------------------- */}
      <section className={styles.hero}>
        <div className={styles.heroImgWrap}>
          <ImagenConFallback src={heroSrc} alt={premioNombre} className={styles.heroImg} />
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroBadges}>
            <Badge tone="violet" variant="solid">
              {esGratis ? 'GRATIS' : `${monedaSorteo} ${precioTicket} / ticket`}
            </Badge>
            {sorteo.numGanadores > 1 && (
              <Badge tone="neutral" variant="soft">
                {sorteo.numGanadores} ganadores
              </Badge>
            )}
          </div>
          <h1 className={styles.heroTitle}>GANA: {premioNombre}</h1>
          {sorteo.descripcion && <p className={styles.heroDesc}>{sorteo.descripcion}</p>}

          {/* Countdown a fechaFin */}
          {!cerrado && countdown && (
            <div className={styles.countdown}>
              <span className={styles.countdownLabel}>Termina en</span>
              <span className={styles.countdownValue}>{countdown}</span>
            </div>
          )}
          {cerrado && (
            <Badge tone="danger" variant="soft" className={styles.cerradoBadge}>
              Sorteo cerrado
            </Badge>
          )}

          {/* Contador en vivo (suma de shards) */}
          <p className={styles.contador}>
            <span aria-hidden="true">👥</span> {totalParticipantes.toLocaleString('es-PE')} personas ya participan
          </p>
        </div>
      </section>

      {/* Estado del usuario (si ya participa) -------------------------------- */}
      {user && yaParticipa && (
        <GlassPanel variant="solid" padding="md" className={styles.miEstado}>
          {esPagado ? (
            <span>🎟️ Tus tickets pagados: {ticketsPagados}</span>
          ) : (
            <span>🎟️ Tus tickets: {miParticipacion.ticketsPagados ?? miParticipacion.tickets ?? 0}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>⭐ Chances: {miParticipacion.chancesTotal ?? miParticipacion.chancesBase ?? 1}</span>
          <span aria-hidden="true">·</span>
          <span className={styles.participandoOk}>Participando ✓</span>
        </GlassPanel>
      )}

      {/* Chances virales: compartir + enlace de referido (solo si participa) -- */}
      {(mostrarCompartir || mostrarReferido) && (
        <GlassCard
          variant="soft"
          padding="md"
          title="Suma más chances"
          className={styles.viral}
        >
          {mostrarCompartir && (
            <div className={styles.viralBloque}>
              <p className={styles.viralTexto}>
                Comparte este sorteo y gana <strong>+1 chance</strong> (una sola vez).
              </p>
              <GlassButton
                variant="primary"
                size="md"
                fullWidth
                loading={compartiendo}
                disabled={compartiendo || yaCompartio}
                onClick={handleCompartir}
              >
                {yaCompartio
                  ? '¡Chance por compartir reclamada! ✓'
                  : '📢 Compartir y ganar +1 chance'}
              </GlassButton>
            </div>
          )}

          {mostrarReferido && (
            <div className={styles.viralBloque}>
              <p className={styles.viralTexto}>
                Tu enlace de invitación: ganas <strong>+1 chance</strong> por cada persona
                que participe con él.
              </p>
              <div className={styles.refRow}>
                <input
                  className={styles.refInput}
                  type="text"
                  value={enlaceReferido}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  aria-label="Tu enlace de referido"
                />
                <GlassButton
                  variant={copiado ? 'glass' : 'primary'}
                  size="md"
                  onClick={handleCopiarReferido}
                >
                  {copiado ? '¡Copiado! ✓' : 'Copiar'}
                </GlassButton>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Reglas: cómo ganar chances ------------------------------------------ */}
      <GlassCard
        variant="soft"
        padding="md"
        title="Cómo ganar más chances"
        className={styles.reglas}
      >
        <ul className={styles.reglasList}>
          {esPagado ? (
            <li>Cada ticket pagado suma 1 chance para el sorteo.</li>
          ) : (
            <li>Participar te da 1 chance base.</li>
          )}
          {sorteo.requisitoApp === 'chanceExtra' && (
            <li>Entrar desde el <strong>app de Walá</strong> te da 1 chance extra.</li>
          )}
          {sorteo.chanceExtraCompartir && (
            <li>Compartir el sorteo te suma <strong>+1 chance</strong> (una vez).</li>
          )}
          {sorteo.chanceExtraReferido && (
            <li>Ganas <strong>+1 chance</strong> por cada amigo que participe con tu enlace.</li>
          )}
          {requiereApp && (
            <li>Este sorteo requiere participar <strong>desde el app</strong>.</li>
          )}
        </ul>
      </GlassCard>

      {/* REVELACIÓN DEL GANADOR: solo con estado="cerrado" y ganadores oficiales */}
      {revelarGanadores && (
        <GlassCard
          variant="soft"
          padding="lg"
          className={`${styles.ganadores} ${soyGanador ? styles.ganadoresYoGane : ''}`}
        >
          <h2 className={styles.ganadoresTitulo}>
            🏆 {ganadores.length > 1 ? 'Ganadores' : 'Ganador'}
          </h2>

          {/* Mensaje destacado si el usuario actual ganó. */}
          {soyGanador && (
            <div className={styles.yoGaneBanner}>
              <span className={styles.yoGaneEmoji} aria-hidden="true">🎉</span>
              <strong>¡FELICIDADES, GANASTE!</strong>
              <span className={styles.yoGaneSub}>Pronto nos contactaremos contigo para tu premio.</span>
            </div>
          )}

          <ul className={styles.ganadoresList}>
            {ganadores.map((g, i) => {
              const esYo = !!user?.uid && g?.uid === user.uid;
              return (
                <li
                  key={g?.uid || g?.nombre || i}
                  className={esYo ? styles.ganadorYo : undefined}
                >
                  🏆 {g?.nombre || 'Ganador'}
                  {esYo && <span className={styles.ganadorTuBadge}> (¡tú!)</span>}
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}

      {/* Zona de acción ------------------------------------------------------ */}
      <section className={styles.accion}>
        {accionError && <div className={styles.errorBox}>{accionError}</div>}

        {/* Gate de login: si no hay usuario, invitar a iniciar sesión. */}
        {!user ? (
          <GlassCard variant="soft" padding="md" className={styles.loginGate}>
            <p className={styles.loginPrompt}>Inicia sesión en Walá para participar</p>
            <GlassButton
              as={Link}
              to="/login"
              state={{ from: '/sorteos' }}
              variant="primary"
              size="lg"
              fullWidth
            >
              Iniciar sesión
            </GlassButton>
          </GlassCard>
        ) : cerrado ? (
          <GlassButton variant="glass" size="lg" fullWidth disabled>
            Sorteo cerrado
          </GlassButton>
        ) : bloqueadoPorApp ? (
          // requisitoApp == 'obligatorio' y no venimos del app.
          <>
            <p className={styles.appHint}>Este sorteo solo está disponible desde el app.</p>
            <GlassButton as={Link} to="/descargar" variant="primary" size="lg" fullWidth>
              Descargar app
            </GlassButton>
          </>
        ) : esPagado && intento ? (
          // ── Intención creada → métodos de pago (aparece tras llenar los datos) ──
          <GlassCard variant="soft" padding="md" className={styles.pagoCard}>
            <div className={styles.pagoResumen}>
              <span>
                {intento.cantidad} ticket{intento.cantidad > 1 ? 's' : ''}
              </span>
              <strong>
                {intento.moneda || monedaSorteo}{' '}
                {Number(intento.monto ?? (intento.montoCentimos || 0) / 100).toFixed(2)}
              </strong>
            </div>
            <p className={styles.pagoNota}>
              El monto lo confirma el servidor. Elige cómo pagar:
            </p>

            {!metodo && (
              <div className={styles.pagoMetodos}>
                <GlassButton variant="primary" size="lg" fullWidth onClick={() => setMetodo('culqi')}>
                  💳 Pagar con tarjeta
                </GlassButton>
                <GlassButton variant="ghost" size="lg" fullWidth onClick={() => setMetodo('paypal')}>
                  🅿️ Pagar con PayPal
                </GlassButton>
              </div>
            )}

            {metodo === 'culqi' && (
              <CulqiTicketButton
                intento={intento}
                email={emailComprador}
                onPaid={handlePagoConfirmado}
                onError={handlePagoError}
              />
            )}

            {metodo === 'paypal' && (
              <PaypalTicketButtons
                sorteoId={intento.sorteoId}
                ticketId={intento.ticketId}
                onPaid={handlePagoConfirmado}
                onError={handlePagoError}
              />
            )}

            <button type="button" className={styles.linkCancelar} onClick={cancelarCompra}>
              Cancelar
            </button>
          </GlassCard>
        ) : esGratis && yaParticipa ? (
          <GlassButton variant="glass" size="lg" fullWidth disabled>
            Ya estás participando ✓
          </GlassButton>
        ) : (
          // Botón que ABRE el formulario de datos (SIEMPRE se piden al participar).
          <>
            {esPagado && (
              <p className={styles.precioHint}>
                {monedaSorteo} {precioTicket.toFixed(2)} por ticket
              </p>
            )}
            <GlassButton
              variant="primary"
              size="lg"
              fullWidth
              loading={participando}
              disabled={participando}
              onClick={abrirFormulario}
            >
              {esGratis
                ? '¡Participar gratis!'
                : (yaParticipa ? 'Comprar más tickets' : '¡Quiero participar!')}
            </GlassButton>
          </>
        )}
      </section>

      {/* MODAL: formulario de datos (se piden SIEMPRE al participar/comprar) --- */}
      {formAbierto && (
        <FormularioDatosSorteo
          esPagado={esPagado}
          precioTicket={precioTicket}
          moneda={monedaSorteo}
          initial={initialForm}
          enviando={participando}
          onSubmit={handleSubmitFormulario}
          onCancel={() => { if (!participando) setFormAbierto(false); }}
        />
      )}
    </div>
  );
};

export default SorteosPage;
