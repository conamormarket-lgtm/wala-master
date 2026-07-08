import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../../../services/firebase/config';
import { getProduct } from '../../../../services/products';
import { createWebOrder } from '../../../../services/erp/firebase';
import { markWalaOrderPagado } from '../../../../services/walaOrders';
import { useAuth } from '../../../../contexts/AuthContext';
import CulqiCustomCheckout from '../../../../components/CulqiCustomCheckout';
import PaypalCheckout from '../../../../components/PaypalCheckout/PaypalCheckout';
import KapMessage from '../../../../components/common/KapMessage/KapMessage';
import CountrySelect from '../../../../components/intl/CountrySelect';
import PhoneIntlInput from '../../../../components/intl/PhoneIntlInput';
import { getDocTypesForCountry, FOREIGN_DOC_LABEL, isPeru } from '../../../../constants/documentTypes';
import { DEPARTAMENTOS, getProvincias, getDistritos, esEnvioLocal } from '../../../../constants/peruUbigeo';
import styles from './LandingPaymentBlock.module.css';

const LANDING_ACABADO_KEY = 'landing_matador_acabado';

const TRUST_ITEMS = [
  { icon: '🚚', text: 'Envío rápido' },
  { icon: '🔒', text: 'Pago seguro' },
  { icon: '↩️', text: 'Garantía 30 días' },
  { icon: '💬', text: 'Soporte WhatsApp' },
];

const GUEST_KEY = 'landing_checkout_customer_info';

const DEFAULT_MASCOT_PHRASES = [
  '¡Se ve más caro de lo que cuesta! 🔥',
  'Activado 2026 · tú también te lo mereces',
  'Últimas unidades · no lo pienses mucho',
  'Queda brutal con cualquier outfit 😮‍💨',
];

const emptyCustomer = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
    return {
      customerName: saved.customerName || '',
      phone: saved.phone || '',
      email: saved.email || '',
      dni: saved.dni || '',
      docType: saved.docType || 'DNI',
      country: saved.country || 'PE',
      address: saved.address || '',
      departamento: saved.departamento || 'Lima',
      provincia: saved.provincia || 'Lima',
      distrito: saved.distrito || '',
    };
  } catch {
    return {
      customerName: '',
      phone: '',
      email: '',
      dni: '',
      docType: 'DNI',
      country: 'PE',
      address: '',
      departamento: 'Lima',
      provincia: 'Lima',
      distrito: '',
    };
  }
};

async function ensureAuthForPayment() {
  if (auth?.currentUser) return auth.currentUser;
  if (!auth) throw new Error('Auth no disponible. Recarga la página e intenta de nuevo.');
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/**
 * Checkout embebido estilo Balvi PDP — crea pedido real (pedidos_web) + Culqi/PayPal.
 */
const LandingPaymentBlock = ({ config = {} }) => {
  const { user, userProfile } = useAuth();
  const [concepto, setConcepto] = useState((config.concepto || 'Pago en línea').trim());
  const [montoPEN, setMontoPEN] = useState(Number(config.montoPEN) || 0);
  const [montoUSD, setMontoUSD] = useState(Number(config.montoUSD) || 0);
  const [productMeta, setProductMeta] = useState(null);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [phoneFull, setPhoneFull] = useState('');
  const [checkoutStep, setCheckoutStep] = useState('datos');
  const [paymentPedido, setPaymentPedido] = useState(null);
  const [activeGateway, setActiveGateway] = useState(null);
  const [culqiAutoOpen, setCulqiAutoOpen] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(!!config.productId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [pagoCompletado, setPagoCompletado] = useState(false);
  const [metodoPagado, setMetodoPagado] = useState(null);
  const [numeroPedidoOk, setNumeroPedidoOk] = useState('');
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' = pago completo · 'adelanto' = separa con S/10
  const [cardOpen, setCardOpen] = useState(false); // "Tarjeta o Yape" desplegado (contiene completo/adelanto)
  const [acabadoSel, setAcabadoSel] = useState('');
  const [acabadoImg, setAcabadoImg] = useState(''); // imagen del reloj elegido en el carrusel
  const [flashHint, setFlashHint] = useState(''); // aviso flotante "Completa tus datos…"
  const flashHintTimer = useRef(null);
  const [showExit, setShowExit] = useState(false); // popup de salida (exit-intent) // reloj/acabado elegido en el carrusel (label real, no "Matador")
  const paymentPedidoRef = useRef(null);

  const showPriceBlock = config.showPriceBlock !== false;
  // Si ya hay un título de sección (config.title), ocultamos el header interno de
  // la tarjeta para NO duplicar "Finaliza tu compra".
  const hideHeader = config.hideCheckoutHeader === true || Boolean((config.title || '').trim());
  const productId = config.productId || '';
  const peruOnly = config.peruOnly === true || config.landingSlug === 'reloj-matador-pro-2026';
  const showCulqi = config.showCulqi !== false;
  const showPayPal = !peruOnly && config.showPayPal !== false;
  const sectionTitle = config.title || '';
  const sectionSubtitle = config.subtitle || '';
  const precioOriginal = Number(config.precioOriginal) || 0;
  const offerBadge = config.offerBadge || '';
  const anchorId = config.anchorId || 'pagar-ahora';
  const stickyLabel = config.stickyCTA || 'Continuar al pago';

  const ahorro = precioOriginal > montoPEN ? precioOriginal - montoPEN : 0;
  const hasDiscount = precioOriginal > montoPEN;

  // ── Dos formas de pago ──────────────────────────────────────────────────
  // 'full'      → cobra el total ahora por Culqi.
  // 'adelanto'  → cobra solo un adelanto (por defecto S/10) online y el resto
  //               queda como saldo contra entrega. Culqi cobra `montoDeuda`.
  const allowAdelanto = config.allowAdelanto !== false; // habilitado por defecto
  const adelantoMonto = Math.max(3, Number(config.adelantoMonto) || 10); // Culqi mínimo S/3
  const effectiveMode = allowAdelanto ? paymentMode : 'full';
  const chargeAmount = effectiveMode === 'adelanto' ? Math.min(adelantoMonto, montoPEN) : montoPEN;
  const saldoPendiente = effectiveMode === 'adelanto' ? Math.max(0, montoPEN - chargeAmount) : 0;
  const isAdelanto = effectiveMode === 'adelanto';

  // ── Comprar por WhatsApp ────────────────────────────────────────────────
  // Número desde el config de la landing (config.whatsappNumber). Solo dígitos.
  const whatsappNumber = String(config.whatsappNumber || '').replace(/[^\d]/g, '');
  const showWhatsApp = whatsappNumber.length >= 8;
  const mascotPhrases = useMemo(() => {
    if (Array.isArray(config.mascotPhrases) && config.mascotPhrases.length > 0) {
      const cleaned = config.mascotPhrases.map((s) => String(s || '').trim()).filter(Boolean);
      if (cleaned.length > 0) return cleaned;
    }
    return DEFAULT_MASCOT_PHRASES;
  }, [config.mascotPhrases]);

  const [mascotPhraseIndex, setMascotPhraseIndex] = useState(0);
  const mascotMessage = mascotPhrases[mascotPhraseIndex] || DEFAULT_MASCOT_PHRASES[0];

  useEffect(() => {
    if (pagoCompletado) return undefined;
    if (!mascotPhrases || mascotPhrases.length <= 1) return undefined;
    const id = setInterval(() => {
      setMascotPhraseIndex((i) => (i + 1) % mascotPhrases.length);
    }, 3200);
    return () => clearInterval(id);
  }, [pagoCompletado, mascotPhrases.length]);

  useEffect(() => {
    if (!peruOnly) return;
    setCustomer((prev) => (prev.country === 'PE' ? prev : { ...prev, country: 'PE' }));
  }, [peruOnly]);

  // Reloj elegido en el carrusel (ConversionFold). Se lee de localStorage y se
  // mantiene en vivo con el evento 'landing-acabado-change' para mostrar el
  // modelo real en "TU PEDIDO" (no el genérico "Matador").
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(LANDING_ACABADO_KEY);
        if (raw) {
          const p = JSON.parse(raw) || {};
          setAcabadoSel(p.label || '');
          setAcabadoImg(p.imageUrl || '');
        }
      } catch { /* ignore */ }
    };
    read();
    const onChange = (e) => {
      setAcabadoSel(e?.detail?.label || '');
      setAcabadoImg(e?.detail?.imageUrl || '');
    };
    window.addEventListener('landing-acabado-change', onChange);
    return () => window.removeEventListener('landing-acabado-change', onChange);
  }, []);

  useEffect(() => {
    if (!user && !userProfile) return;
    setCustomer((prev) => ({
      ...prev,
      customerName: prev.customerName || userProfile?.displayName || user?.displayName || '',
      phone: prev.phone || userProfile?.phone || '',
      email: prev.email || user?.email || userProfile?.email || '',
      dni: prev.dni || userProfile?.dni || '',
    }));
  }, [user, userProfile]);

  useEffect(() => {
    let mounted = true;
    const loadProduct = async () => {
      if (!productId) {
        setLoadingProduct(false);
        return;
      }
      const { data } = await getProduct(productId);
      if (!mounted) return;
      if (data) {
        setProductMeta(data);
        const price = Number(data.salePrice ?? data.price ?? data.precio ?? 0);
        if (price > 0 && !config.montoPEN) setMontoPEN(price);
        if (!config.concepto && data.name) setConcepto(String(data.name).trim());
      }
      setLoadingProduct(false);
    };
    loadProduct();
    return () => { mounted = false; };
  }, [productId, config.montoPEN, config.concepto]);

  useEffect(() => {
    if (config.montoPEN) setMontoPEN(Number(config.montoPEN));
    if (config.montoUSD) setMontoUSD(Number(config.montoUSD));
    if (config.concepto) setConcepto(String(config.concepto).trim());
  }, [config.montoPEN, config.montoUSD, config.concepto]);

  const resolvedUSD = montoUSD > 0
    ? montoUSD
    : (montoPEN > 0 ? Math.max(1, Math.round((montoPEN / 3.75) * 100) / 100) : 0);

  const updateField = (field, value) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  // Documento: si es DNI, solo números y máx 8 dígitos. CE/Pasaporte: libre.
  const updateDni = (value) => {
    setCustomer((prev) => {
      const next = prev.docType === 'DNI'
        ? String(value).replace(/\D/g, '').slice(0, 8)
        : value;
      return { ...prev, dni: next };
    });
  };

  // ── Cascada de ubicación (departamento → provincia → distrito) ────────────
  const provinciasOpts = getProvincias(customer.departamento);
  const distritosOpts = getDistritos(customer.departamento, customer.provincia);

  const handleDepartamentoChange = (dep) => {
    const provs = getProvincias(dep);
    const nextProv = provs.includes(customer.provincia) ? customer.provincia : (provs[0] || '');
    setCustomer((prev) => ({ ...prev, departamento: dep, provincia: nextProv, distrito: '' }));
  };

  const handleProvinciaChange = (prov) => {
    setCustomer((prev) => ({ ...prev, provincia: prov, distrito: '' }));
  };

  const validateCustomer = () => {
    const name = String(customer.customerName || '').trim();
    const phone = String(customer.phone || '').trim();
    const email = String(customer.email || '').trim();
    const dni = String(customer.dni || '').trim();
    const departamento = String(customer.departamento || '').trim();
    const provincia = String(customer.provincia || '').trim();
    const distrito = String(customer.distrito || '').trim();
    const address = String(customer.address || '').trim();
    if (name.length < 3) return 'Ingresa tu nombre completo.';
    if (!customer.country) return 'Selecciona tu país.';
    if (customer.docType === 'DNI') {
      if (!/^\d{8}$/.test(dni)) return 'El DNI debe tener 8 dígitos.';
    } else if (dni.length < 3) {
      return 'Ingresa un documento válido.';
    }
    // Teléfono peruano (+51): exactamente 9 dígitos. Otros países: mínimo 6.
    const esTelPeru = String(phoneFull || '').startsWith('+51') || isPeru(customer.country);
    if (esTelPeru) {
      if (!/^\d{9}$/.test(phone)) return 'El teléfono peruano debe tener 9 dígitos.';
    } else if (phone.length < 6) {
      return 'Ingresa un teléfono válido.';
    }
    if (!email || !email.includes('@')) return 'Ingresa un correo válido.';
    if (!departamento) return 'Selecciona tu departamento.';
    if (!provincia) return 'Selecciona tu provincia.';
    if (!distrito) return 'Selecciona tu distrito.';
    if (!address || address.length < 5) return 'Ingresa tu dirección exacta de entrega.';
    return null;
  };

  const isCustomerComplete = () => validateCustomer() === null;

  const preparePedido = async (authUser = null) => {
    if (paymentPedido) return paymentPedido;

    const validationError = validateCustomer();
    if (validationError) throw new Error(validationError);
    if (!montoPEN || montoPEN <= 0) throw new Error('Configura un monto válido para el pago.');

    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(customer));
      localStorage.setItem('checkout_customer_info', JSON.stringify(customer));
    } catch { /* ignore */ }

    const parts = String(customer.customerName).trim().split(/\s+/);
    const clienteNombre = parts[0] || '';
    const clienteApellidos = parts.slice(1).join(' ') || parts[0] || '';
    const dni = String(customer.dni).trim();
    const phone = String(customer.phone).trim();
    const phoneIntl = phoneFull || phone;
    const email = String(customer.email).trim();
    const address = String(customer.address || '').trim();
    const departamento = String(customer.departamento || 'Lima').trim();
    const provincia = String(customer.provincia || '').trim();
    const distrito = String(customer.distrito || '').trim();
    const envioLocal = esEnvioLocal(departamento, provincia);
    const provinciaFlag = envioLocal ? 'No' : 'Sí';
    const country = peruOnly ? 'PE' : (customer.country || 'PE');
    const esPeru = isPeru(country);
    const tipoDocumento = esPeru ? (customer.docType || 'DNI') : FOREIGN_DOC_LABEL;
    let acabadoLabel = '';
    try {
      const raw = localStorage.getItem(LANDING_ACABADO_KEY);
      if (raw) acabadoLabel = JSON.parse(raw)?.label || '';
    } catch { /* ignore */ }
    const notas = [];
    if (acabadoLabel) notas.push(`Acabado elegido: ${acabadoLabel}`);
    if (isAdelanto) {
      notas.push(`Adelanto S/ ${chargeAmount.toFixed(2)} pagado online · saldo S/ ${saldoPendiente.toFixed(2)} contra entrega`);
    }
    const pseudoOrderId = `PD-${Date.now().toString(36).toUpperCase()}`;
    const productName = productMeta?.name || concepto;
    const imageUrl = productMeta?.mainImage || productMeta?.images?.[0] || '';
    const buyerUid = authUser?.uid || user?.uid || auth?.currentUser?.uid || '';

    const webOrderPayload = {
      numeroPedido: pseudoOrderId,
      dni,
      country,
      phoneIntl,
      clienteNombre,
      clienteApellidos,
      clienteNombreCompleto: String(customer.customerName).trim(),
      clienteNumeroDocumento: dni,
      clienteTipoDocumento: tipoDocumento,
      clienteContacto: phone,
      clienteCorreo: email,
      clienteDepartamento: departamento,
      clienteProvinciaNombre: provincia,
      clienteDistrito: distrito,
      clienteProvincia: provinciaFlag,
      envioNombres: clienteNombre,
      envioApellidos: clienteApellidos,
      envioContacto: phone,
      envioNumeroDocumento: dni,
      envioTipoDocumento: tipoDocumento,
      envioDireccion: address,
      envioDistrito: distrito,
      envioDepartamento: departamento,
      envioProvinciaNombre: provincia,
      envioProvincia: provinciaFlag,
      canalVenta: 'Portal Web',
      web: true,
      activador: 'portal_web',
      vendedor: 'Portal Web',
      origen: 'landing_page',
      landingSlug: config.landingSlug || '',
      observación: notas.join(' · '),
      modalidadPago: isAdelanto ? 'adelanto' : 'completo',
      montoTotal: montoPEN,
      montoAdelanto: isAdelanto ? chargeAmount : 0,
      montoPendiente: isAdelanto ? saldoPendiente : montoPEN,
      costoEnvio: 0,
      estadoGeneral: 'Nuevo',
      status: 'Nuevo',
      prendas: `${productName}${acabadoLabel ? ` (${acabadoLabel})` : ''} x1`,
      cantidad: 1,
      productos: {
        item_0: {
          productoId: productId || '',
          producto: productName,
          brandId: productMeta?.brandId || null,
          urlImagen: imageUrl,
          cantidad: 1,
          talla: '',
          color: acabadoLabel || '',
          precio: montoPEN,
          subtotal: montoPEN,
          personalizado: false,
        },
      },
      portalPseudoOrderId: pseudoOrderId,
      ...(buyerUid && { userId: buyerUid }),
    };

    const { id, error: webErr } = await createWebOrder(webOrderPayload);
    if (webErr || !id) {
      throw new Error(webErr || 'No se pudo registrar el pedido. Intenta de nuevo.');
    }

    const pedido = {
      id,
      pedidoWebId: id,
      numeroPedido: pseudoOrderId,
      montoDeuda: chargeAmount, // Culqi cobra el total o solo el adelanto según la modalidad
      esPeru: true,
      country: 'PE',
    };
    setPaymentPedido(pedido);
    paymentPedidoRef.current = pedido;
    setNumeroPedidoOk(pseudoOrderId);
    setCheckoutStep('pago');
    return pedido;
  };

  const handleConfirmDatos = async () => {
    setError(null);
    const validationError = validateCustomer();
    if (validationError) {
      setError(validationError);
      return;
    }
    setCreating(true);
    try {
      const authUser = await ensureAuthForPayment();
      await preparePedido(authUser);
    } catch (err) {
      setError(err.message || 'No pudimos registrar tu pedido. Intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const handlePagoExitoso = (details, metodo) => {
    const pedido = paymentPedidoRef.current;
    if (pedido) {
      markWalaOrderPagado({
        numeroPedido: pedido.numeroPedido,
        pedidoWebId: pedido.pedidoWebId || pedido.id,
        metodoPago: metodo,
        montoPagado: Number(pedido.montoDeuda) || montoPEN,
      }).catch(() => {});
    }
    setPagoCompletado(true);
    setMetodoPagado(metodo);
    setActiveGateway(null);
    setCulqiAutoOpen(false);
    document.documentElement.classList.remove('landing-has-sticky');
  };

  // Aviso flotante temporal + scroll al formulario (cuando faltan datos).
  const showFlashHint = (msg = 'Completa tus datos para continuar') => {
    setFlashHint(msg);
    if (flashHintTimer.current) clearTimeout(flashHintTimer.current);
    flashHintTimer.current = setTimeout(() => setFlashHint(''), 3500);
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  useEffect(() => () => { if (flashHintTimer.current) clearTimeout(flashHintTimer.current); }, []);

  // ── Exit-intent: mostrar el popup SOLO al intentar salir (retroceder o, en
  // desktop, sacar el cursor por arriba). NO debe salir mientras se navega.
  useEffect(() => {
    if (!showWhatsApp || pagoCompletado) return undefined;
    const isTouch = typeof window !== 'undefined'
      && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);

    // 1) Botón ATRÁS / retroceder (compu y celular): interceptamos con un estado
    //    guardián y mostramos el popup en vez de abandonar la página.
    window.history.pushState({ lpExit: true }, '');
    const onPop = () => {
      setShowExit(true);
      window.history.pushState({ lpExit: true }, '');
    };
    window.addEventListener('popstate', onPop);

    // 2) Desktop SOLAMENTE: exit-intent real (cursor sale del documento por arriba)
    //    y una sola vez. En táctil NO se registra: los toques generan mouseout
    //    sintéticos con clientY=0 que hacían saltar el popup a cada rato.
    let mouseFired = false;
    const onMouseOut = (e) => {
      if (mouseFired) return;
      if (e.relatedTarget || (e.clientY || 1) > 0) return; // no salió por arriba del documento
      mouseFired = true;
      setShowExit(true);
    };
    if (!isTouch) document.addEventListener('mouseout', onMouseOut);

    // 3) Recargar / cerrar pestaña (compu): aviso nativo "¿Salir del sitio?".
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('popstate', onPop);
      if (!isTouch) document.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWhatsApp, pagoCompletado]);

  const handleExitWhatsApp = () => {
    setShowExit(false);
    handleComprarWhatsApp();
  };

  // Acción "Tarjeta o Yape": si faltan datos avisa; si no, registra y va al pago.
  const handlePayCard = () => {
    if (!isCustomerComplete()) { showFlashHint(); return; }
    handleConfirmDatos();
  };

  const handleWhatsAppClick = () => {
    if (!isCustomerComplete()) { showFlashHint(); return; }
    handleComprarWhatsApp();
  };

  const handleComprarWhatsApp = () => {
    if (!showWhatsApp) return;
    // Emojis por codigo (String.fromCodePoint) para que NUNCA se corrompan.
    const CHK = String.fromCodePoint(0x2705);   // ✅ check verde
    const CART = String.fromCodePoint(0x1F6D2); // 🛒 carrito
    const modelo = acabadoSel || concepto;
    const modoPago = isAdelanto
      ? `Adelanto S/ ${chargeAmount.toFixed(2)} (saldo S/ ${saldoPendiente.toFixed(2)} contra entrega)`
      : `Pago completo S/ ${montoPEN.toFixed(2)}`;
    const c = customer;
    const lineas = [
      `${CART} *Nuevo pedido* — quiero comprar este reloj:`,
      `${CHK} Modelo: ${modelo}`,
      `${CHK} Precio: S/ ${montoPEN.toFixed(2)}`,
      `${CHK} Forma de pago: ${modoPago}`,
    ];
    if (String(c.customerName || '').trim()) lineas.push(`${CHK} Nombre: ${c.customerName}`);
    if (String(c.dni || '').trim()) lineas.push(`${CHK} Documento: ${`${c.docType || ''} ${c.dni}`.trim()}`);
    if (String(c.phone || '').trim()) lineas.push(`${CHK} Telefono: ${phoneFull || c.phone}`);
    if (String(c.distrito || '').trim()) lineas.push(`${CHK} Envio: ${c.departamento || ''} / ${c.provincia || ''} / ${c.distrito}`);
    if (String(c.address || '').trim()) lineas.push(`${CHK} Direccion: ${c.address}`);
    const msg = encodeURIComponent(lineas.join('\n'));
    window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, '_blank', 'noopener');
  };

  const handleStartCulqi = async () => {
    if (!paymentPedido) {
      setError('Primero completa tus datos de entrega.');
      return;
    }
    setError(null);
    setActiveGateway('culqi');
    setCulqiAutoOpen(true);
  };

  const handleStartPayPal = async () => {
    if (!paymentPedido) {
      setError('Primero completa tus datos de entrega.');
      return;
    }
    setError(null);
    setActiveGateway('paypal');
  };

  const scrollToCheckout = () => {
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStickyClick = () => {
    scrollToCheckout();
    if (checkoutStep === 'datos' && !isCustomerComplete()) {
      showFlashHint();
      return;
    }
    if (checkoutStep === 'datos' && isCustomerComplete()) {
      handleConfirmDatos();
    }
  };

  useEffect(() => {
    if (!pagoCompletado) {
      document.documentElement.classList.add('landing-has-sticky');
    }
    return () => document.documentElement.classList.remove('landing-has-sticky');
  }, [pagoCompletado]);

  if (loadingProduct) {
    return (
      <div className={styles.wrapper}>
        <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem 1rem' }}>Cargando checkout...</p>
      </div>
    );
  }

  if (peruOnly ? !montoPEN : (!montoPEN && !resolvedUSD)) {
    return (
      <div className={styles.wrapper}>
        <p style={{ textAlign: 'center', color: '#ef4444', padding: '2rem 1rem' }}>
          Configura el monto del pago en el editor de la landing.
        </p>
      </div>
    );
  }

  const formLocked = !!paymentPedido || creating;

  return (
    <div className={styles.root} id={anchorId}>
      {(sectionTitle || sectionSubtitle) && (
        <div className={styles.sectionHeading} style={{ color: config.titleColor || 'inherit' }}>
          {sectionTitle && <h2>{sectionTitle}</h2>}
          {sectionSubtitle && <p>{sectionSubtitle}</p>}
        </div>
      )}

      <div className={styles.wrapper}>
        {showPriceBlock && (
          <div className={styles.priceBlock}>
            {offerBadge && <span className={styles.offerBadge}>{offerBadge}</span>}
            <div className={styles.priceRow}>
              <span className={styles.priceMain}>S/ {montoPEN.toFixed(2)}</span>
              {precioOriginal > montoPEN && (
                <span className={styles.priceCompare}>S/ {precioOriginal.toFixed(2)}</span>
              )}
            </div>
            {ahorro > 0 && (
              <span className={styles.priceSaving}>Ahorras S/ {ahorro.toFixed(2)} hoy</span>
            )}
          </div>
        )}

        <div className={styles.card}>
          {pagoCompletado ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✅</div>
              <h3 className={styles.successTitle}>{isAdelanto ? '¡Adelanto confirmado!' : '¡Pago exitoso!'}</h3>
              <p className={styles.successText}>
                Tu pedido
                {numeroPedidoOk ? <> <strong>{numeroPedidoOk}</strong></> : null}
                {' '}quedó registrado.{' '}
                {isAdelanto ? (
                  <>
                    Pagaste <strong>S/ {chargeAmount.toFixed(2)}</strong> de adelanto y el saldo de{' '}
                    <strong>S/ {saldoPendiente.toFixed(2)}</strong> lo abonas al recibir tu pedido.
                  </>
                ) : (
                  <>
                    Pago de{' '}
                    <strong>
                      {metodoPagado === 'paypal' && !peruOnly
                        ? `$${resolvedUSD.toFixed(2)} USD`
                        : `S/ ${montoPEN.toFixed(2)}`}
                    </strong>{' '}
                    recibido.
                  </>
                )}
                {' '}Te contactaremos pronto con los detalles de envío.
              </p>
            </div>
          ) : (
            <>
              {!hideHeader && (
                <div className={styles.header}>
                  <h3 className={styles.title}>Finaliza tu compra</h3>
                  <p className={styles.subtitle}>
                    {peruOnly ? 'Tarjeta o Yape — pago en soles' : 'Tarjeta, Yape o PayPal — 100% seguro'}
                  </p>
                </div>
              )}

              <div className={styles.summary}>
                <p className={styles.conceptLabel}>Tu pedido</p>
                <div className={styles.productRow}>
                  {acabadoImg && (
                    <img
                      className={styles.productThumb}
                      src={acabadoImg}
                      alt={acabadoSel || 'Reloj elegido'}
                      loading="lazy"
                    />
                  )}
                  <div className={styles.productInfo}>
                    <p className={styles.concept}>{acabadoSel || concepto}</p>
                    {acabadoSel && (
                      <p className={styles.conceptHint}>Modelo elegido en el carrusel</p>
                    )}
                  </div>
                </div>
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={styles.totalAmount}>
                    S/ {montoPEN.toFixed(2)}
                    <span className={styles.totalCurrency}> PEN</span>
                    {showPayPal && resolvedUSD > 0 && (
                      <span className={styles.usdHint}>≈ ${resolvedUSD.toFixed(2)} USD</span>
                    )}
                    {hasDiscount && (
                      <span className={styles.discountInline}>
                        <span className={styles.discountBefore}>Antes: S/ {precioOriginal.toFixed(2)}</span>
                        <span className={styles.discountSave}>Ahorras S/ {ahorro.toFixed(2)}</span>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <form
                className={styles.customerForm}
                autoComplete="on"
                onSubmit={(e) => e.preventDefault()}
              >
                <p className={styles.formLabel}>Datos de entrega</p>
                <p className={styles.stepHint}>
                  {checkoutStep === 'datos'
                    ? 'Completa todos los campos para continuar al pago.'
                    : 'Pedido registrado. Elige cómo quieres pagar.'}
                </p>

                <label className={styles.fieldLabel} htmlFor="landing-country">País *</label>
                {peruOnly ? (
                  <div className={styles.peruBadge}>🇵🇪 Perú — envío nacional</div>
                ) : (
                  <CountrySelect
                    value={customer.country}
                    onChange={(code) => updateField('country', code)}
                    disabled={formLocked}
                  />
                )}

                <label className={styles.fieldLabel} htmlFor="landing-name">Nombre completo *</label>
                <input
                  id="landing-name"
                  name="name"
                  className={styles.input}
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={customer.customerName}
                  disabled={formLocked}
                  onChange={(e) => updateField('customerName', e.target.value)}
                  autoComplete="name"
                />

                <div className={`${styles.formRow} ${styles.formRowStack}`}>
                  <div>
                    <label className={styles.fieldLabel} htmlFor="landing-dni">
                      {isPeru(customer.country) ? 'Documento *' : `${FOREIGN_DOC_LABEL} *`}
                    </label>
                    {isPeru(customer.country) ? (
                      <div className={styles.docRow}>
                        <select
                          id="landing-doc-type"
                          className={`${styles.input} ${styles.selectInput}`}
                          value={customer.docType}
                          disabled={formLocked}
                          onChange={(e) => {
                            const dt = e.target.value;
                            setCustomer((prev) => ({
                              ...prev,
                              docType: dt,
                              // al cambiar a DNI, re-sanea el valor a 8 dígitos numéricos
                              dni: dt === 'DNI'
                                ? String(prev.dni || '').replace(/\D/g, '').slice(0, 8)
                                : prev.dni,
                            }));
                          }}
                          aria-label="Tipo de documento"
                        >
                          {(getDocTypesForCountry(customer.country) || []).map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <input
                          id="landing-dni"
                          name="documento"
                          className={styles.input}
                          type="text"
                          inputMode={customer.docType === 'DNI' ? 'numeric' : 'text'}
                          placeholder={customer.docType === 'DNI' ? '8 dígitos' : 'Número'}
                          value={customer.dni}
                          disabled={formLocked}
                          onChange={(e) => updateDni(e.target.value)}
                          {...(customer.docType === 'DNI' ? { maxLength: 8 } : {})}
                          autoComplete="on"
                        />
                      </div>
                    ) : (
                      <input
                        id="landing-dni"
                        name="documento"
                        className={styles.input}
                        type="text"
                        placeholder={FOREIGN_DOC_LABEL}
                        value={customer.dni}
                        disabled={formLocked}
                        onChange={(e) => updateField('dni', e.target.value)}
                        autoComplete="on"
                      />
                    )}
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Teléfono *</label>
                    <PhoneIntlInput
                      countryCode={customer.country}
                      value={customer.phone}
                      onChange={({ localNumber, full }) => {
                        updateField('phone', localNumber);
                        setPhoneFull(full);
                      }}
                      disabled={formLocked}
                    />
                  </div>
                </div>

                <label className={styles.fieldLabel} htmlFor="landing-email">Email *</label>
                <input
                  id="landing-email"
                  name="email"
                  className={styles.input}
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={customer.email}
                  disabled={formLocked}
                  onChange={(e) => updateField('email', e.target.value)}
                  autoComplete="email"
                />

                <div className={styles.formRow}>
                  <div>
                    <label className={styles.fieldLabel} htmlFor="landing-departamento">Departamento *</label>
                    <select
                      id="landing-departamento"
                      name="departamento"
                      autoComplete="address-level1"
                      className={`${styles.input} ${styles.selectInput}`}
                      value={customer.departamento}
                      disabled={formLocked}
                      onChange={(e) => handleDepartamentoChange(e.target.value)}
                    >
                      {DEPARTAMENTOS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.fieldLabel} htmlFor="landing-provincia">Provincia *</label>
                    <select
                      id="landing-provincia"
                      name="provincia"
                      autoComplete="address-level2"
                      className={`${styles.input} ${styles.selectInput}`}
                      value={customer.provincia}
                      disabled={formLocked}
                      onChange={(e) => handleProvinciaChange(e.target.value)}
                    >
                      {provinciasOpts.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className={styles.fieldLabel} htmlFor="landing-distrito">Distrito *</label>
                <select
                  id="landing-distrito"
                  name="distrito"
                  autoComplete="address-level3"
                  className={`${styles.input} ${styles.selectInput}`}
                  value={customer.distrito}
                  disabled={formLocked}
                  onChange={(e) => updateField('distrito', e.target.value)}
                >
                  <option value="">Selecciona tu distrito…</option>
                  {distritosOpts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <label className={styles.fieldLabel} htmlFor="landing-address">Dirección exacta *</label>
                <input
                  id="landing-address"
                  name="address"
                  className={styles.input}
                  type="text"
                  placeholder="Avenida, Calle, Nro, Dpto, Referencia"
                  value={customer.address}
                  disabled={formLocked}
                  onChange={(e) => updateField('address', e.target.value)}
                  autoComplete="street-address"
                />

                {checkoutStep === 'datos' && (
                  <div className={styles.payChannels}>
                    <label className={styles.fieldLabel}>¿Cómo quieres pagar? *</label>

                    {/* ── Botón principal 1: Tarjeta o Yape (contiene pago completo/adelanto) ── */}
                    <button
                      type="button"
                      className={`${styles.channelBtn} ${cardOpen ? styles.channelBtnActive : ''}`}
                      onClick={() => setCardOpen((o) => !o)}
                      aria-expanded={cardOpen}
                    >
                      <span className={styles.channelIcon} aria-hidden="true">💳</span>
                      <span className={styles.channelBody}>
                        <span className={styles.channelTitle}>Tarjeta o Yape</span>
                        <span className={styles.channelSub}>Paga online, 100% seguro</span>
                      </span>
                      <span className={styles.channelChevron} aria-hidden="true">{cardOpen ? '▲' : '▼'}</span>
                    </button>

                    {cardOpen && (
                      <div className={styles.cardOptions}>
                        {allowAdelanto && (
                          <div className={styles.payModeGroup} role="radiogroup" aria-label="Forma de pago">
                            <button
                              type="button"
                              role="radio"
                              aria-checked={!isAdelanto}
                              className={`${styles.payModeCard} ${!isAdelanto ? styles.payModeActive : ''}`}
                              onClick={() => setPaymentMode('full')}
                            >
                              <span className={styles.payModeRadio} aria-hidden="true" />
                              <span className={styles.payModeBody}>
                                <span className={styles.payModeTitle}>Pago completo</span>
                                <span className={styles.payModeDesc}>Paga todo ahora</span>
                              </span>
                              <span className={styles.payModeAmount}>S/ {montoPEN.toFixed(2)}</span>
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isAdelanto}
                              className={`${styles.payModeCard} ${isAdelanto ? styles.payModeActive : ''}`}
                              onClick={() => setPaymentMode('adelanto')}
                            >
                              <span className={styles.payModeRadio} aria-hidden="true" />
                              <span className={styles.payModeBody}>
                                <span className={styles.payModeTitle}>Adelanto S/ {adelantoMonto.toFixed(2)}</span>
                                <span className={styles.payModeDesc}>
                                  Sepáralo con S/ {adelantoMonto.toFixed(2)} · paga S/ {Math.max(0, montoPEN - adelantoMonto).toFixed(2)} al recibir
                                </span>
                              </span>
                              <span className={styles.payModeAmount}>S/ {adelantoMonto.toFixed(2)}</span>
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          className={styles.confirmBtn}
                          onClick={handlePayCard}
                          disabled={creating}
                        >
                          {creating
                            ? 'Registrando pedido…'
                            : isAdelanto
                              ? `Pagar adelanto S/ ${chargeAmount.toFixed(2)}`
                              : `Pagar S/ ${montoPEN.toFixed(2)}`}
                        </button>
                      </div>
                    )}

                    {/* ── Botón principal 2: Comprar por WhatsApp ── */}
                    {showWhatsApp && (
                      <>
                        <button
                          type="button"
                          className={styles.whatsappBtn}
                          onClick={handleWhatsAppClick}
                        >
                          <span className={styles.waIcon} aria-hidden="true">💬</span>
                          Comprar por WhatsApp
                        </button>
                        <p className={styles.waHint}>
                          {isCustomerComplete()
                            ? 'Enviamos por chat el reloj elegido y tus datos para coordinar.'
                            : 'Completa tus datos para enviar tu pedido por WhatsApp.'}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </form>

              {error && <div className={styles.error}>{error}</div>}

              {checkoutStep === 'pago' && (
              <div className={styles.methods}>
                {showCulqi && (
                  <>
                    {activeGateway === 'culqi' && paymentPedido ? (
                      <CulqiCustomCheckout
                        pedido={paymentPedido}
                        autoOpen={culqiAutoOpen}
                        onSuccess={(data) => handlePagoExitoso(data, 'culqi')}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.culqiBtn}
                        onClick={handleStartCulqi}
                        disabled={creating || chargeAmount < 3}
                      >
                        <span className={styles.btnIcon}>💳</span>
                        <span className={styles.btnLabel}>
                          {isAdelanto ? `Pagar adelanto S/ ${chargeAmount.toFixed(2)}` : `Pagar S/ ${chargeAmount.toFixed(2)}`}
                          <small>
                            {isAdelanto
                              ? `Saldo S/ ${saldoPendiente.toFixed(2)} contra entrega`
                              : 'Tarjeta débito/crédito · Yape'}
                          </small>
                        </span>
                      </button>
                    )}
                    <p className={styles.note}>Encriptado por Culqi · PCI compliant</p>
                  </>
                )}

                {showCulqi && showPayPal && (
                  <div className={styles.divider}>o paga en dólares</div>
                )}

                {showPayPal && (
                  <>
                    {activeGateway === 'paypal' && paymentPedido ? (
                      <PaypalCheckout
                        pedido={paymentPedido}
                        amountUsd={resolvedUSD}
                        webOrderId={paymentPedido.id}
                        onSuccess={(details) => handlePagoExitoso(details, 'paypal')}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.paypalBtn}
                        onClick={handleStartPayPal}
                        disabled={creating || resolvedUSD < 1}
                      >
                        <span className={styles.btnIcon}>🅿️</span>
                        <span className={styles.btnLabel}>
                          Pagar ${resolvedUSD.toFixed(2)} USD
                          <small>PayPal internacional</small>
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
              )}

              <div className={styles.trustRow}>
                {TRUST_ITEMS.map((item) => (
                  <div key={item.text} className={styles.trustItem}>
                    <span className={styles.trustIcon}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {!pagoCompletado && (
        <>
          {/* Portal a <body>: la barra sticky vive fuera del <section overflow:hidden>
              de la landing, así queda fija al viewport de verdad y NO la tapan las
              secciones siguientes (FAQ, "Últimas unidades"). */}
          {typeof document !== 'undefined' && createPortal(
            <div className={styles.stickyBar}>
              <div className={styles.stickyPrice}>
                <span className={styles.stickyPriceMain}>S/ {montoPEN.toFixed(2)}</span>
                {precioOriginal > montoPEN && (
                  <span className={styles.stickyPriceCompare}>S/ {precioOriginal.toFixed(2)}</span>
                )}
                {hasDiscount && (
                  <span className={styles.stickyPriceSaving}>Ahorras S/ {ahorro.toFixed(2)}</span>
                )}
              </div>
              <button type="button" className={styles.stickyBtn} onClick={handleStickyClick}>
                {checkoutStep === 'datos' ? 'Completar mis datos' : stickyLabel}
              </button>
            </div>,
            document.body,
          )}
          <div className={styles.stickySpacer} aria-hidden="true" />

          {/* Aviso flotante "Completa tus datos para continuar" (portal a body). */}
          {typeof document !== 'undefined' && flashHint && createPortal(
            <div className={styles.flashHint} role="alert">
              <span className={styles.flashHintIcon} aria-hidden="true">👆</span>
              {flashHint}
            </div>,
            document.body,
          )}

          {config.showMascotBubble === true && mascotMessage && (
            <div className={styles.mascotComment} aria-live="polite">
              <KapMessage message={mascotMessage} bubbleOnly className={styles.mascotBubble} />
            </div>
          )}
        </>
      )}

      {/* ── Exit-intent popup "¿Ya te vas, K-CHERO?" ── */}
      {typeof document !== 'undefined' && showExit && createPortal(
        <div className={styles.exitOverlay} onClick={() => setShowExit(false)} role="dialog" aria-modal="true">
          <div className={styles.exitModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.exitClose} onClick={() => setShowExit(false)} aria-label="Cerrar">✕</button>
            <h3 className={styles.exitTitle}>¿Ya te vas, K-CHERO? 😏</h3>
            <p className={styles.exitText}>
              Tu reloj todavía te está esperando. Sigue tu compra por WhatsApp y asegura tu oferta antes de que termine.
            </p>
            <button type="button" className={styles.exitWhatsapp} onClick={handleExitWhatsApp}>
              <span className={styles.waIcon} aria-hidden="true">💬</span>
              Seguir compra por WhatsApp
            </button>
            <button type="button" className={styles.exitSecondary} onClick={() => setShowExit(false)}>
              Seguir viendo modelos
            </button>
            <p className={styles.exitProof}>+2.400 clientes ya lo eligieron · Oferta por tiempo limitado</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default LandingPaymentBlock;
