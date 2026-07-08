import React, { useEffect, useRef, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../../../services/firebase/config';
import { getProduct } from '../../../../services/products';
import { createWebOrder } from '../../../../services/erp/firebase';
import { markWalaOrderPagado } from '../../../../services/walaOrders';
import { useAuth } from '../../../../contexts/AuthContext';
import CulqiCustomCheckout from '../../../../components/CulqiCustomCheckout';
import PaypalCheckout from '../../../../components/PaypalCheckout/PaypalCheckout';
import styles from './LandingPaymentBlock.module.css';

const TRUST_ITEMS = [
  { icon: '🚚', text: 'Envío rápido' },
  { icon: '🔒', text: 'Pago seguro' },
  { icon: '↩️', text: 'Garantía 30 días' },
  { icon: '💬', text: 'Soporte WhatsApp' },
];

const GUEST_KEY = 'landing_checkout_customer_info';

const emptyCustomer = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
    return {
      customerName: saved.customerName || '',
      phone: saved.phone || '',
      email: saved.email || '',
      dni: saved.dni || '',
      address: saved.address || '',
      district: saved.district || 'Lima',
      city: saved.city || 'Lima',
    };
  } catch {
    return {
      customerName: '',
      phone: '',
      email: '',
      dni: '',
      address: '',
      district: 'Lima',
      city: 'Lima',
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
  const [paymentPedido, setPaymentPedido] = useState(null);
  const [activeGateway, setActiveGateway] = useState(null);
  const [culqiAutoOpen, setCulqiAutoOpen] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(!!config.productId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [pagoCompletado, setPagoCompletado] = useState(false);
  const [metodoPagado, setMetodoPagado] = useState(null);
  const [numeroPedidoOk, setNumeroPedidoOk] = useState('');
  const paymentPedidoRef = useRef(null);

  const showPriceBlock = config.showPriceBlock !== false;
  const hideHeader = config.hideCheckoutHeader === true;
  const showCulqi = config.showCulqi !== false;
  const showPayPal = config.showPayPal !== false;
  const sectionTitle = config.title || '';
  const sectionSubtitle = config.subtitle || '';
  const precioOriginal = Number(config.precioOriginal) || 0;
  const offerBadge = config.offerBadge || '';
  const anchorId = config.anchorId || 'pagar-ahora';
  const stickyLabel = config.stickyCTA || 'Comprar ahora';
  const productId = config.productId || '';

  const ahorro = precioOriginal > montoPEN ? precioOriginal - montoPEN : 0;

  useEffect(() => {
    if (!user && !userProfile) return;
    setCustomer((prev) => ({
      customerName: prev.customerName || userProfile?.displayName || user?.displayName || '',
      phone: prev.phone || userProfile?.phone || '',
      email: prev.email || user?.email || userProfile?.email || '',
      dni: prev.dni || userProfile?.dni || '',
      address: prev.address || '',
      district: prev.district || 'Lima',
      city: prev.city || 'Lima',
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

  const validateCustomer = () => {
    const name = String(customer.customerName || '').trim();
    const phone = String(customer.phone || '').trim();
    const email = String(customer.email || '').trim();
    const dni = String(customer.dni || '').trim();
    if (name.length < 3) return 'Ingresa tu nombre completo.';
    if (phone.length < 6) return 'Ingresa un teléfono válido.';
    if (!email || !email.includes('@')) return 'Ingresa un correo válido.';
    if (dni.length < 6) return 'Ingresa tu DNI / documento.';
    return null;
  };

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
    const email = String(customer.email).trim();
    const address = String(customer.address || '').trim() || 'Por confirmar';
    const city = String(customer.city || 'Lima').trim();
    const district = String(customer.district || city).trim();
    const pseudoOrderId = `PD-${Date.now().toString(36).toUpperCase()}`;
    const productName = productMeta?.name || concepto;
    const imageUrl = productMeta?.mainImage || productMeta?.images?.[0] || '';
    const buyerUid = authUser?.uid || user?.uid || auth?.currentUser?.uid || '';

    const webOrderPayload = {
      numeroPedido: pseudoOrderId,
      dni,
      country: 'PE',
      clienteNombre,
      clienteApellidos,
      clienteNombreCompleto: String(customer.customerName).trim(),
      clienteNumeroDocumento: dni,
      clienteTipoDocumento: 'DNI',
      clienteContacto: phone,
      clienteCorreo: email,
      clienteDepartamento: city,
      clienteDistrito: district,
      clienteProvincia: city === 'Lima' || city === 'Callao' ? 'No' : 'Sí',
      envioNombres: clienteNombre,
      envioApellidos: clienteApellidos,
      envioContacto: phone,
      envioNumeroDocumento: dni,
      envioTipoDocumento: 'DNI',
      envioDireccion: address,
      envioDistrito: district,
      envioDepartamento: city,
      canalVenta: 'Portal Web',
      web: true,
      activador: 'portal_web',
      vendedor: 'Portal Web',
      origen: 'landing_page',
      landingSlug: config.landingSlug || '',
      montoTotal: montoPEN,
      montoAdelanto: 0,
      montoPendiente: montoPEN,
      costoEnvio: 0,
      estadoGeneral: 'Nuevo',
      status: 'Nuevo',
      prendas: `${productName} x1`,
      cantidad: 1,
      productos: {
        item_0: {
          productoId: productId || '',
          producto: productName,
          brandId: productMeta?.brandId || null,
          urlImagen: imageUrl,
          cantidad: 1,
          talla: '',
          color: '',
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
      montoDeuda: montoPEN,
      esPeru: true,
      country: 'PE',
    };
    setPaymentPedido(pedido);
    paymentPedidoRef.current = pedido;
    setNumeroPedidoOk(pseudoOrderId);
    return pedido;
  };

  const handlePagoExitoso = (details, metodo) => {
    const pedido = paymentPedidoRef.current;
    if (pedido) {
      markWalaOrderPagado({
        numeroPedido: pedido.numeroPedido,
        pedidoWebId: pedido.pedidoWebId || pedido.id,
        metodoPago: metodo,
        montoPagado: montoPEN,
      }).catch(() => {});
    }
    setPagoCompletado(true);
    setMetodoPagado(metodo);
    setActiveGateway(null);
    setCulqiAutoOpen(false);
    document.documentElement.classList.remove('landing-has-sticky');
  };

  const handleStartCulqi = async () => {
    setError(null);
    setCreating(true);
    try {
      const authUser = await ensureAuthForPayment();
      await preparePedido(authUser);
      setActiveGateway('culqi');
      setCulqiAutoOpen(true);
    } catch (err) {
      setError(err.message || 'Error al preparar el pago con Culqi.');
    } finally {
      setCreating(false);
    }
  };

  const handleStartPayPal = async () => {
    setError(null);
    setCreating(true);
    try {
      const authUser = await ensureAuthForPayment();
      await preparePedido(authUser);
      setActiveGateway('paypal');
    } catch (err) {
      setError(err.message || 'Error al preparar el pago con PayPal.');
    } finally {
      setCreating(false);
    }
  };

  const scrollToCheckout = () => {
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStickyClick = () => {
    scrollToCheckout();
    setTimeout(() => handleStartCulqi(), 400);
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

  if (!montoPEN && !resolvedUSD) {
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
              <h3 className={styles.successTitle}>¡Pago exitoso!</h3>
              <p className={styles.successText}>
                Tu pedido
                {numeroPedidoOk ? <> <strong>{numeroPedidoOk}</strong></> : null}
                {' '}por{' '}
                <strong>
                  {metodoPagado === 'paypal'
                    ? `$${resolvedUSD.toFixed(2)} USD`
                    : `S/ ${montoPEN.toFixed(2)}`}
                </strong>{' '}
                quedó registrado. Te contactaremos pronto con los detalles de envío.
              </p>
            </div>
          ) : (
            <>
              {!hideHeader && (
                <div className={styles.header}>
                  <h3 className={styles.title}>Finaliza tu compra</h3>
                  <p className={styles.subtitle}>Tarjeta, Yape o PayPal — 100% seguro</p>
                </div>
              )}

              <div className={styles.summary}>
                <p className={styles.conceptLabel}>Tu pedido</p>
                <p className={styles.concept}>{concepto}</p>
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={styles.totalAmount}>
                    S/ {montoPEN.toFixed(2)}
                    <span className={styles.totalCurrency}> PEN</span>
                    {showPayPal && resolvedUSD > 0 && (
                      <span className={styles.usdHint}>≈ ${resolvedUSD.toFixed(2)} USD</span>
                    )}
                  </span>
                </div>
              </div>

              <div className={styles.customerForm}>
                <p className={styles.formLabel}>Datos de entrega</p>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Nombre completo *"
                  value={customer.customerName}
                  disabled={formLocked}
                  onChange={(e) => updateField('customerName', e.target.value)}
                  autoComplete="name"
                />
                <div className={styles.formRow}>
                  <input
                    className={styles.input}
                    type="tel"
                    placeholder="Teléfono / WhatsApp *"
                    value={customer.phone}
                    disabled={formLocked}
                    onChange={(e) => updateField('phone', e.target.value)}
                    autoComplete="tel"
                  />
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="DNI *"
                    value={customer.dni}
                    disabled={formLocked}
                    onChange={(e) => updateField('dni', e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="Correo electrónico *"
                  value={customer.email}
                  disabled={formLocked}
                  onChange={(e) => updateField('email', e.target.value)}
                  autoComplete="email"
                />
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Dirección de entrega (opcional)"
                  value={customer.address}
                  disabled={formLocked}
                  onChange={(e) => updateField('address', e.target.value)}
                  autoComplete="street-address"
                />
              </div>

              {error && <div className={styles.error}>{error}</div>}

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
                        disabled={creating || montoPEN < 3}
                      >
                        <span className={styles.btnIcon}>💳</span>
                        <span className={styles.btnLabel}>
                          Pagar S/ {montoPEN.toFixed(2)}
                          <small>Tarjeta débito/crédito · Yape</small>
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
          <div className={styles.stickyBar}>
            <div className={styles.stickyPrice}>
              <span className={styles.stickyPriceMain}>S/ {montoPEN.toFixed(2)}</span>
              {precioOriginal > montoPEN && (
                <span className={styles.stickyPriceCompare}>S/ {precioOriginal.toFixed(2)}</span>
              )}
            </div>
            <button type="button" className={styles.stickyBtn} onClick={handleStickyClick}>
              {stickyLabel}
            </button>
          </div>
          <div className={styles.stickySpacer} aria-hidden="true" />
        </>
      )}
    </div>
  );
};

export default LandingPaymentBlock;
