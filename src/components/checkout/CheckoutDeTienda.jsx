import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import useInvitacionReferido from '../../hooks/useInvitacionReferido';
import { getMessage } from '../../services/messages';
import { getBrands } from '../../services/brands';
import { prepareCheckoutPayment, precalentarFunciones } from '../../services/checkoutPayment';
import { validarCupon } from '../../services/cupones';
import { detectCountry } from '../../services/geo';
import { getFx, penToUsd, penToLocal } from '../../services/fx';
import { obtenerDirecciones, agregarDireccion, actualizarDireccion } from '../../services/direcciones';
import { trackCheckoutStart, trackPurchaseComplete } from '../../services/analytics/tracker';
import {
  armarPedidoWeb, armarWhatsapp, aplicarEfectosDeCompra, completarPerfilDesdeCheckout, formatDeliveryDate, businessDaysUntil,
} from '../../services/pedidoCheckout';
import { esComboCrear, repartirPrecio } from '../../pages/Crear/comboCrear';
import { catalogoPorId, idsDeItemsIncompletos, muestraColor } from '../../utils/cartValidation';
import { costoEnvio, ENVIO_ESTANDAR, ENVIO_GRATIS_DESDE } from '../../constants/envio';
import { COUNTRIES } from '../../constants/countries';
import { getCurrency, formatMoney } from '../../constants/currencies';
import { DEPARTAMENTOS, getProvincias } from '../../constants/peruUbigeo';
import { lugarLegible, distritosSugeridos, esExtranjero } from '../../utils/ubicacionErp';
import { tieneCuenta, urlLogin } from '../../utils/rutaPrivada';
import { toDirectImageUrl, toThumbnailImageUrl } from '../../utils/imageUrl';
import CulqiCustomCheckout, { precargarCulqi } from '../CulqiCustomCheckout/CulqiCustomCheckout';
import { PaginaCheckout } from '../../componentes/kit/paginas/Checkout';
import { PagoTarjeta } from '../../componentes/kit/piezas/Pago';
import { htmlAbriendoWhatsApp } from '../../componentes/kit/piezas/AbriendoWhatsApp';
import { itemCarritoDesde, direccionDesdeFirestore } from '../../componentes/kit/adaptadores';

// PayPal (su SDK) baja solo si se paga desde otro país.
const PaypalCheckout = lazy(() => import('../PaypalCheckout/PaypalCheckout'));

/* ── Lo guardado en el navegador (las mismas claves que la página de antes) ── */
const DATOS_CHECKOUT_KEY = 'checkout_customer_info';
const BORRADOR_CHECKOUT = 'wala_checkout_borrador';
const leerJson = (almacen, clave, porDefecto) => {
  try {
    const d = JSON.parse(almacen.getItem(clave) || 'null');
    return d && typeof d === 'object' ? d : porDefecto;
  } catch {
    return porDefecto;
  }
};

/* Los campos del formulario de la tienda (Formik) ↔ los del kit. */
const direccionDesdeValores = (v = {}) => ({
  ...(v.customerName != null && { nombre: v.customerName }),
  ...(v.docType && { tipoDocumento: v.docType }),
  ...(v.dni != null && { documento: v.dni }),
  ...(v.phone != null && { telefono: v.phone }),
  ...(v.country && { pais: v.country }),
  ...(v.city && { ciudad: v.city }),
  ...(v.department != null && { departamento: v.department }),
  ...(v.province != null && { provincia: v.province }),
  ...(v.district != null && { distrito: v.district }),
  ...(v.address != null && { direccion: v.address }),
});
const valoresDesdeDireccion = (d = {}) => ({
  customerName: d.nombre || '',
  docType: d.tipoDocumento || 'DNI',
  dni: d.documento || '',
  phone: d.telefono || '',
  country: d.pais || 'PE',
  // Fuera del Perú la tienda dejaba la ciudad en 'Lima' (no se usa: manda el país).
  city: d.ciudad || 'Lima',
  department: d.departamento || '',
  province: d.provincia || '',
  district: d.distrito || '',
  address: d.direccion || '',
});

const PAISES = COUNTRIES.map((c) => ({ valor: c.code, texto: c.name, prefijo: c.dialCode }));
const prefijoDe = (pais) => COUNTRIES.find((c) => c.code === pais)?.dialCode || '+51';

const LUGARES = {
  departamentos: DEPARTAMENTOS,
  provincias: getProvincias,
  distritos: (d) => distritosSugeridos(valoresDesdeDireccion(d)),
  legible: (d) => lugarLegible(valoresDesdeDireccion(d)),
};

// El WhatsApp (los números y el texto): los cinco mensajes a la vez (antes, uno detrás de otro).
const leerWhatsappConfig = async () => {
  try {
    const [tienda, general, texto, principalMsg, multimarcaMsg] = await Promise.all([
      getMessage('whatsapp_number_tienda'), getMessage('whatsapp_number'), getMessage('whatsapp_text_tienda'),
      getMessage('whatsapp_number_principal'), getMessage('whatsapp_multimarca'),
    ]);
    const limpiar = (n) => {
      const x = String(n || '').replace(/[\s\-()+]/g, '');
      return x && !x.startsWith('51') && x.length <= 9 ? `51${x}` : x;
    };
    return {
      number: limpiar(tienda.data?.trim() || general.data?.trim()) || '51999999999',
      principalNumber: limpiar(principalMsg.data?.trim() || '+51924426791') || '51924426791',
      multimarca: multimarcaMsg.data?.trim().toLowerCase() === 'true',
      customText: texto.data || 'Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código {id}.',
    };
  } catch {
    return {
      number: '51999999999', principalNumber: '51924426791', multimarca: false,
      customText: 'Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código {id}.',
    };
  }
};

/** "Talla M · Color Negro" o las prendas de un combo (para el resumen). */
const varianteDe = (fila) => [
  ...fila.detalles.map((d) => `${d.etiqueta} ${d.valor}`),
  ...fila.piezas.map((p) => p.texto),
].join(' · ');

/**
 * El checkout con el kit (paso 6 de la migración): PaginaCheckout con los
 * datos y los cobros de la tienda. El pedido (el payload del ERP, los
 * WhatsApp) y lo que pasa después de comprar salen de services/pedidoCheckout.js,
 * los mismos que usa la página de antes. La tarjeta es la ventana de Culqi de
 * siempre con el botón del kit (renderBoton); PayPal, sus botones (soloBotones).
 * El interruptor pagosViejo (en CheckoutPage) vuelve a CheckoutViejo.jsx.
 */
export default function CheckoutDeTienda() {
  const { items, getTotalPrice, clearSelectedItems } = useCart();
  const { user, userProfile, loading: authLoading, updateUserProfile, freezeMonedas, activeMainCoins } = useAuth();
  const toast = useGlobalToast();
  const invitacion = useInvitacionReferido();
  const sesion = tieneCuenta(user);

  // Lo que se paga: los elegidos. Al preparar el pago se congela la lista (el
  // carrito puede cambiar después: al terminar se quitan los pagados).
  const [preparado, setPreparado] = useState(null);
  const elegidos = useMemo(() => items.filter((i) => i.selected !== false), [items]);
  const itemsCompra = preparado?.selectedItemsSnapshot || elegidos;
  const catalogo = useMemo(() => catalogoPorId(), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const filas = useMemo(() => itemsCompra.map((item) => {
    const fila = itemCarritoDesde(item, { catalogo });
    return {
      id: fila.id,
      imagen: toThumbnailImageUrl(toDirectImageUrl(fila.imagen)) || fila.imagen,
      nombre: fila.nombre,
      variante: varianteDe(fila),
      precio: fila.precio,
      cantidad: fila.cantidad,
    };
  }), [itemsCompra, catalogo]);
  const incompletos = useMemo(() => {
    const ids = idsDeItemsIncompletos(elegidos, catalogo);
    return elegidos.filter((i) => ids.has(i.id)).map((i) => i.productName);
  }, [elegidos, catalogo]);

  /* ── Lo guardado: el borrador (al volver de iniciar sesión) y los datos de la compra anterior ── */
  const [borrador] = useState(() => leerJson(sessionStorage, BORRADOR_CHECKOUT, {}));
  const [datosGuardados] = useState(() => leerJson(localStorage, DATOS_CHECKOUT_KEY, {}));
  useEffect(() => { try { sessionStorage.removeItem(BORRADOR_CHECKOUT); } catch { /* sin almacenamiento */ } }, []);
  const correoCuenta = String(user?.email || '').trim().toLowerCase();
  const datosSonDeLaCuenta = Boolean(user?.uid) && (
    datosGuardados.uid === user.uid
    || (!datosGuardados.uid && Boolean(correoCuenta) && String(datosGuardados.email || '').trim().toLowerCase() === correoCuenta)
  );
  // Datos que no son de esta cuenta ni los pidió recordar un invitado: se borran (equipo compartido).
  useEffect(() => {
    if (authLoading || !Object.keys(datosGuardados).length) return;
    if (datosGuardados.recordar || datosSonDeLaCuenta) return;
    try { localStorage.removeItem(DATOS_CHECKOUT_KEY); } catch { /* no-op */ }
  }, [authLoading, datosSonDeLaCuenta, datosGuardados]);

  /* ── Libreta de direcciones ── */
  const [direcciones, setDirecciones] = useState(null);
  useEffect(() => {
    if (!user?.uid || !sesion) { setDirecciones([]); return undefined; }
    let vivo = true;
    obtenerDirecciones(user.uid)
      .then((lista) => { if (vivo) setDirecciones(lista); })
      .catch((e) => { console.warn('No se pudieron cargar las direcciones:', e); if (vivo) setDirecciones([]); });
    return () => { vivo = false; };
  }, [user?.uid, sesion]);

  /* ── País detectado (si ni el perfil ni lo guardado lo dicen) ── */
  const [paisSugerido, setPaisSugerido] = useState();
  const geoRef = useRef(false);
  useEffect(() => {
    if (geoRef.current || authLoading) return;
    geoRef.current = true;
    if (userProfile?.country || datosGuardados.country) return;
    let activo = true;
    detectCountry().then((d) => { if (activo && d?.code) setPaisSugerido(d.code); }).catch(() => { /* queda Perú */ });
    return () => { activo = false; };
  }, [authLoading, userProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Lo que se lee de Firestore ── */
  const { data: marcas } = useQuery({ queryKey: ['brands'], queryFn: async () => (await getBrands()).data || [], staleTime: 300_000 });
  const { data: whatsappConfig } = useQuery({ queryKey: ['whatsapp-config-checkout'], queryFn: leerWhatsappConfig, staleTime: 300_000 });
  // La tasa de cambio solo hace falta fuera del Perú: se pide cuando el navegador queda libre.
  const [conFx, setConFx] = useState(false);
  useEffect(() => {
    const fn = () => setConFx(true);
    const id = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 4000 }) : window.setTimeout(fn, 2000);
    return () => (typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);
  const { data: fx } = useQuery({ queryKey: ['fx'], queryFn: getFx, enabled: conFx, staleTime: 600_000 });

  /* ── Al entrar: Culqi y la función que prepara el pago, calientes ── */
  useEffect(() => {
    precargarCulqi();
    precalentarFunciones(['prepareCheckoutPayment']);
  }, []);

  /* ── Analítica ── */
  const analyticsUserCtx = useMemo(
    () => (user?.uid ? { uid: user.uid, email: user.email, displayName: user.displayName } : {}),
    [user?.uid, user?.email, user?.displayName],
  );
  const inicioRef = useRef(false);
  useEffect(() => {
    if (inicioRef.current || !items.length) return;
    inicioRef.current = true;
    trackCheckoutStart({
      totalCents: Math.round((getTotalPrice() || 0) * 100),
      itemsCount: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
      currency: 'PEN',
    }, analyticsUserCtx).catch(() => {});
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const compraRef = useRef(false);
  const emitirCompra = useCallback((metodo, datos) => {
    if (compraRef.current || !datos) return;
    compraRef.current = true;
    const snapshot = datos.selectedItemsSnapshot || [];
    trackPurchaseComplete({
      orderId: datos.id || null,
      total: datos.montoDeuda,
      totalCents: Math.round((datos.montoDeuda || 0) * 100),
      itemsCount: snapshot.reduce((acc, i) => acc + (i.quantity || 1), 0),
      items: snapshot.map((i) => ({
        productId: i.productId,
        qty: i.quantity || 1,
        price: i.customization?.finalPrice || i.price || 0,
        ...(i.categoryId && { categoryId: i.categoryId }),
        ...(i.lineaProducto && { lineaProducto: i.lineaProducto }),
        ...((i.lineId ?? i.lineaProducto) && { lineId: i.lineId ?? i.lineaProducto }),
      })),
      method: metodo,
      currency: 'PEN',
    }, analyticsUserCtx).catch(() => {});
  }, [analyticsUserCtx]);

  /* ── El regalo de una lista (/regalar): fecha, ocasión, para quién ── */
  const giftRegistryItem = items.find((i) => i.isWishlistGift && i.deliveryDate);
  const registryDeliveryDate = giftRegistryItem?.deliveryDate || '';
  const registryEventLabel = giftRegistryItem?.deliveryEventLabel || '';
  const entrega = useMemo(() => {
    if (!registryDeliveryDate) return undefined;
    const dias = businessDaysUntil(registryDeliveryDate);
    return {
      fecha: formatDeliveryDate(registryDeliveryDate),
      ocasion: registryEventLabel || undefined,
      destinatario: giftRegistryItem?.deliveryRecipient || '',
      aviso: dias != null && dias < 7
        ? `La fecha está muy cerca (faltan unos ${dias} días hábiles): la preparación y el envío toman de 7 a 30, así que podría no llegar a tiempo. Puedes continuar igual.`
        : undefined,
    };
  }, [registryDeliveryDate, registryEventLabel, giftRegistryItem?.deliveryRecipient]);

  /* ── Lo que el servidor valora del carrito (para el cupón) ── */
  const itemsParaCupon = () => elegidos.flatMap((it) => {
    if (esComboCrear(it)) {
      const piezas = it.customization.piezas || [];
      const precios = repartirPrecio(it.customization?.finalPrice || it.price || 0, piezas.length);
      return piezas.map((p, k) => ({ productId: p.prendaId || '', qty: it.quantity || 1, precio: precios[k], personalizado: true }));
    }
    return [{
      productId: it.productId || '',
      qty: it.quantity || 1,
      precio: it.customization?.finalPrice || it.price || 0,
      personalizado: !!(it.customization?.finalPrice),
    }];
  });
  const cuponRef = useRef(null);
  const alCupon = async (codigo, ctx) => {
    const res = await validarCupon(codigo, { subtotal: ctx.subtotal, subtotalProductos: ctx.subtotalProductos, envio: ctx.envio, items: itemsParaCupon() });
    if (!res.success) throw new Error(res.error || 'Este cupón no es válido.');
    // Un cupón que no resta nada en este carrito no se aplica: se consumiría para nada.
    if (!res.descuento) throw new Error(res.aviso || 'Este cupón no descuenta nada en este carrito.');
    const cupon = {
      codigo, descuento: res.descuento, envioGratis: res.envioGratis,
      texto: res.cupon?.texto || res.cupon?.titulo || '', aviso: res.aviso || '',
    };
    cuponRef.current = cupon;
    return cupon;
  };

  /* ── Preparar el pago (aún no hay pedido) ── */
  const alPreparar = async (datos) => {
    if (!elegidos.length) throw new Error('Selecciona al menos un producto para pagar.');
    const d = datos.direccion || {};
    const extranjero = esExtranjero(d.pais);
    const values = {
      ...valoresDesdeDireccion(d),
      email: datos.correo || '',
      isGiftMode: Boolean(datos.regalo),
      giftRecipientName: datos.regalo?.destinatario || '',
      giftMessage: datos.regalo?.mensaje || '',
      giftSticker: datos.regalo?.sticker || 'kapi-love',
      deliveryDate: registryDeliveryDate,
    };
    // Los montos, con las reglas de la página de antes (el servidor los vuelve a valorar).
    const subtotal = getTotalPrice();
    const discount = datos.monedas || 0;
    const cupon = datos.cupon && cuponRef.current?.codigo === datos.cupon ? cuponRef.current : null;
    const cuponAplicado = cupon ? { code: cupon.codigo, descuento: cupon.descuento, envioGratis: cupon.envioGratis } : null;
    const cuponEnvioGratis = Boolean(cupon?.envioGratis);
    const descuentoCupon = cuponEnvioGratis ? 0 : (cupon?.descuento || 0);
    const shipping = cuponEnvioGratis ? 0 : costoEnvio(subtotal);
    const total = Math.max(0, subtotal - discount - descuentoCupon) + shipping;
    // El teléfono con el código del país: fuera del Perú (en el Perú, el número tal cual, como antes).
    const phoneFull = extranjero ? `${prefijoDe(d.pais)}${values.phone}` : '';

    const { pseudoOrderId, esPeru, webOrderPayload } = armarPedidoWeb({
      values, phoneFull, selectedItems: elegidos, discount, shipping, total, cuponAplicado, descuentoCupon, cuponEnvioGratis,
      user, registryEventLabel, giftRegistryItem, muestraColor: (item) => muestraColor(item, catalogo),
    });

    let checkoutIntentId = null;
    try {
      const prepared = await prepareCheckoutPayment(webOrderPayload);
      checkoutIntentId = prepared.intentId;
    } catch (err) {
      console.warn('No se pudo preparar el pago:', err);
      // El servidor dice exactamente qué cambió (un precio, algo agotado).
      throw new Error(err?.code === 'functions/failed-precondition' && err?.message ? err.message : 'No pudimos preparar el pago. Intenta nuevamente.');
    }

    const { waLink, waGroups } = armarWhatsapp({
      values, selectedItems: elegidos, subtotal, discount, shipping, total, cuponAplicado, descuentoCupon, esPeru, pseudoOrderId,
      whatsappConfig, brandsList: marcas, registryEventLabel,
    });

    // Lo guardado para la próxima vez (con cuenta, atado a su uid) y la libreta.
    const savedInfo = {
      customerName: values.customerName, dni: values.dni, docType: values.docType, phone: values.phone,
      address: values.address, district: values.district, city: values.city,
      department: values.city === 'Provincias' && !extranjero ? values.department : '',
      province: values.city === 'Provincias' || extranjero ? values.province : '',
      email: values.email,
    };
    try {
      if (user?.uid) {
        localStorage.setItem(DATOS_CHECKOUT_KEY, JSON.stringify({ ...savedInfo, uid: user.uid }));
        if (datos.guardar) {
          const campos = { ...savedInfo, country: values.country };
          (d.id ? actualizarDireccion(user.uid, d.id, campos) : agregarDireccion(user.uid, campos))
            .then((lista) => setDirecciones(lista))
            .catch((e) => console.warn('No se pudo guardar la dirección:', e));
        }
      }
    } catch { /* sin localStorage (modo privado): no se recuerda */ }

    // Completa el perfil con lo que falte (por detrás).
    if (user && updateUserProfile && !userProfile?._perfilNoCargado) {
      completarPerfilDesdeCheckout({ userProfile, updateUserProfile, values });
    }

    whatsappRef.current = null;
    efectosRef.current = false;
    setTarjetaFallo(false);
    setPaypal({ procesando: false, error: '' });
    setPreparado({
      id: checkoutIntentId || pseudoOrderId,
      numeroPedido: pseudoOrderId,
      pedidoWebId: null,
      checkoutIntentId,
      webOrderPayload,
      selectedItemsSnapshot: elegidos,
      customerName: values.customerName,
      subtotal,
      discount,
      couponCode: cuponAplicado?.code || null,
      montoDeuda: total,
      waLink,
      waGroups,
      esPeru,
      country: values.country,
      // Vuelto a preparar porque cambiaron las monedas ya en el pago: la ventana de
      // Culqi no se abre sola otra vez (ya se abrió al llegar al pago).
      sinAbrir: datos.motivo === 'monedas',
    });
    return { numero: pseudoOrderId };
  };

  /* ── Después de comprar ── */
  const efectosRef = useRef(false);
  const aplicarEfectos = async (pedidoWebId, metodo, datos) => {
    if (efectosRef.current || !datos) return;
    efectosRef.current = true;
    await aplicarEfectosDeCompra({ datos, pedidoWebId, user, freezeMonedas, toast });
    emitirCompra(metodo, datos);
  };

  // El pedido por WhatsApp lo crea el servidor desde la intención ya validada (una sola vez).
  const whatsappRef = useRef(null);
  const asegurarPedidoWhatsApp = (datos) => {
    if (datos.pedidoWebId) return Promise.resolve(datos.pedidoWebId);
    if (!whatsappRef.current) {
      whatsappRef.current = (async () => {
        const res = await httpsCallable(getFunctions(), 'crearSolicitudWhatsappSecure')({ intentId: datos.checkoutIntentId });
        const id = res?.data?.id;
        if (!id) throw new Error('No se recibió el id del pedido.');
        setPreparado((p) => (p ? { ...p, pedidoWebId: id } : p));
        await aplicarEfectos(id, 'whatsapp', datos);
        return id;
      })().catch((e) => {
        whatsappRef.current = null;
        console.error('No se pudo crear el pedido de WhatsApp:', e);
        throw new Error('No pudimos crear tu pedido. No se abrió WhatsApp; inténtalo nuevamente.');
      });
    }
    return whatsappRef.current;
  };

  // La pestaña de WhatsApp se abre en el clic (si no, el navegador la bloquea)
  // con la pantalla de "Creando tu pedido…" del kit, mientras el servidor crea el pedido.
  const alWhatsApp = async (marcaId) => {
    const datos = preparado;
    if (!datos) return;
    const grupos = datos.waGroups || [];
    const grupo = marcaId != null ? grupos[Number(marcaId)] : (grupos.length === 1 ? grupos[0] : null);
    const popup = window.open('', '_blank');
    try {
      if (popup) {
        popup.document.open();
        popup.document.write(htmlAbriendoWhatsApp({ origen: window.location.origin, marca: grupo?.label }));
        popup.document.close();
      }
    } catch { /* ventana de otro origen: se ignora */ }
    try {
      await asegurarPedidoWhatsApp(datos);
    } catch (e) {
      if (popup) popup.close();
      throw e;
    }
    const link = grupo ? grupo.link : datos.waLink;
    if (popup) popup.location.href = link; else window.open(link, '_blank');
  };

  // Tarjeta o PayPal: el pedido pagado lo crea el servidor al confirmar el cobro.
  const [listo, setListo] = useState(null);
  const terminarPasarela = async (metodo, resultado = {}) => {
    const datos = preparado;
    if (!datos) return;
    const pedidoWebId = resultado.pedidoWebId || datos.numeroPedido;
    if (!resultado.pedidoWebId) {
      toast.info('Tu pago fue aprobado. Estamos registrando tu pedido: aparecerá en «Mis pedidos» en unos minutos.');
    }
    setPreparado((p) => (p ? { ...p, pedidoWebId } : p));
    await aplicarEfectos(pedidoWebId, metodo, datos);
    setListo({ metodo: metodo === 'culqi' ? 'tarjeta' : metodo, numero: datos.numeroPedido });
  };

  // Al mostrar "listo": se quitan del carrito los pagados (los "no comprar esta vez" se quedan).
  const limpioRef = useRef(false);
  const alListo = () => {
    if (limpioRef.current) return;
    limpioRef.current = true;
    clearSelectedItems();
  };

  // Al llegar al pago: despertar las funciones que se usan desde ahí.
  const alPaso = (n) => {
    if (n !== 1 || !preparado) return;
    precalentarFunciones(preparado.esPeru
      ? ['processCulqiPayment', 'crearSolicitudWhatsappSecure']
      : ['createPaypalOrderSecure', 'capturePaypalOrderSecure', 'crearSolicitudWhatsappSecure']);
  };

  const [tarjetaFallo, setTarjetaFallo] = useState(false);
  const [paypal, setPaypal] = useState({ procesando: false, error: '' });

  /* ── Sin cuenta: guardar lo llenado antes de ir a entrar (vuelve con ?redirect=) ── */
  const alEntrar = (ruta, datos = {}) => {
    try {
      const v = { ...valoresDesdeDireccion(datos.direccion || {}), email: datos.correo || '' };
      const r = datos.regalo || {};
      const borradorNuevo = Object.fromEntries(Object.entries({
        ...v, isGiftMode: Boolean(r.activo), giftRecipientName: r.destinatario, giftMessage: r.mensaje, giftSticker: r.sticker,
      }).filter(([, x]) => x !== '' && x != null));
      sessionStorage.setItem(BORRADOR_CHECKOUT, JSON.stringify(borradorNuevo));
    } catch { /* sin almacenamiento: igual se va a entrar */ }
  };

  /* ── Props de la página ── */
  const perfil = {
    nombre: userProfile?.displayName || user?.displayName || '',
    tipoDocumento: userProfile?.docType || 'DNI',
    documento: userProfile?.dni || '',
    telefono: userProfile?.phone || '',
    email: user?.email || userProfile?.email || '',
    pais: userProfile?.country || undefined,
  };
  // Lo ya llenado: el borrador gana; si no, lo de la compra anterior (de esta
  // cuenta, o lo que un invitado pidió recordar) cuando no hay libreta.
  const inicial = useMemo(() => {
    const propios = datosSonDeLaCuenta || datosGuardados.recordar ? datosGuardados : {};
    const deBorrador = direccionDesdeValores(borrador);
    if (Object.keys(borrador).length) {
      return {
        direccion: deBorrador,
        correo: borrador.email,
        regalo: borrador.isGiftMode != null ? { activo: borrador.isGiftMode, destinatario: borrador.giftRecipientName, mensaje: borrador.giftMessage, sticker: borrador.giftSticker } : undefined,
      };
    }
    if (direcciones?.length || !Object.keys(propios).length) return {};
    return { direccion: direccionDesdeValores(propios), correo: propios.email };
  }, [borrador, direcciones, datosSonDeLaCuenta, datosGuardados]);

  const cargando = authLoading || direcciones === null || (sesion && !userProfile);
  const vacio = items.length > 0 && !elegidos.length
    ? { titulo: 'No elegiste nada para pagar', texto: 'Vuelve al carrito y marca lo que quieres comprar esta vez.', boton: 'Ir al carrito', url: '/carrito' }
    : undefined;

  const pago = preparado ? {
    onWhatsApp: alWhatsApp,
    marcas: (preparado.waGroups || []).length > 1 ? preparado.waGroups.map((g, i) => ({ id: String(i), nombre: g.label, cantidad: g.count })) : [],
    usd: (total) => penToUsd(total, fx),
    local: (total, pais) => {
      const monto = penToLocal(total, pais, fx);
      return monto != null ? formatMoney(monto, getCurrency(pais)) : null;
    },
    tarjetaFallo,
    paypal,
    botonTarjeta: preparado.esPeru ? (
      <CulqiCustomCheckout
        pedido={preparado}
        autoOpen={!preparado.sinAbrir}
        title="Compra en Walá"
        onSuccess={(r) => terminarPasarela('culqi', r)}
        onOpen={() => setTarjetaFallo(false)}
        onClose={() => setTarjetaFallo(true)}
        renderBoton={({ abrir, procesando }) => <PagoTarjeta monto={Number(preparado.montoDeuda || 0)} procesando={procesando} onPagar={abrir} />}
      />
    ) : undefined,
    botonesPaypal: !preparado.esPeru ? (
      <Suspense fallback={null}>
        <PaypalCheckout
          soloBotones
          pedido={preparado}
          amountUsd={penToUsd(preparado.montoDeuda, fx)}
          webOrderId={preparado.checkoutIntentId}
          onProcesando={(procesando) => setPaypal((p) => ({ ...p, procesando }))}
          onError={(error) => setPaypal((p) => ({ ...p, error }))}
          onSuccess={(r) => terminarPasarela('paypal', r)}
        />
      </Suspense>
    ) : undefined,
  } : { usd: (total) => penToUsd(total, fx), local: (total, pais) => {
    const monto = penToLocal(total, pais, fx);
    return monto != null ? formatMoney(monto, getCurrency(pais)) : null;
  } };

  return (
    <PaginaCheckout
      // Se monta de nuevo al terminar de cargar: su estado inicial (la libreta,
      // "guardar", quien recibe) sale de la sesión y de las direcciones ya leídas.
      key={cargando ? 'cargando' : 'listo'}
      estado={cargando ? 'cargando' : undefined}
      items={filas}
      incompletos={incompletos}
      sesion={sesion}
      perfil={perfil}
      direcciones={(direcciones || []).map(direccionDesdeFirestore)}
      lugares={LUGARES}
      paises={PAISES}
      reglas="checkout"
      inicial={inicial}
      paisSugerido={paisSugerido}
      envio={{ costo: ENVIO_ESTANDAR, gratisDesde: ENVIO_GRATIS_DESDE }}
      monedas={{ saldo: sesion ? activeMainCoins || 0 : 0, cargando: authLoading || (Boolean(user) && !userProfile) }}
      onCupon={alCupon}
      onPreparar={alPreparar}
      pago={pago}
      listo={listo}
      onListo={alListo}
      onPaso={alPaso}
      entrega={entrega}
      invitacion={invitacion ? { nombre: invitacion.nombre, aceptada: invitacion.tipo === 'invitacion' && invitacion.invitacion === 'aceptada' } : undefined}
      urlLogin={urlLogin('/checkout')}
      urlRegistro={`/registro?redirect=${encodeURIComponent('/checkout')}`}
      onEntrar={alEntrar}
      vacio={vacio}
    />
  );
}
