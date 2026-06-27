import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalToast } from '../contexts/ToastContext';
import { useQuery } from '@tanstack/react-query';
import { getMessage } from '../services/messages';
import { linkPurchaseToReferral } from '../services/referrals';
import { createWebOrder } from '../services/erp/firebase';
import { markItemAsGifted } from '../services/wishlist';
import { validateDNI } from '../utils/helpers';
import { detectCountry } from '../services/geo';
import { trackCheckoutStart, trackPurchaseComplete } from '../services/analytics/tracker';
import CountrySelect from '../components/intl/CountrySelect';
import PhoneIntlInput from '../components/intl/PhoneIntlInput';
import Button from '../components/common/Button';
import CulqiCustomCheckout from '../components/CulqiCustomCheckout/CulqiCustomCheckout';
import PaypalCheckout from '../components/PaypalCheckout/PaypalCheckout';
// ── Internacionalización de cobro (aditivo) ───────────────────────────────────
// getFx/penToUsd/penToLocal: tasa de cambio (config/fx + fallback en cascada).
// getCurrency/formatMoney: catálogo de moneda local y formateo del resumen.
// NO alteran los totales/descuentos en PEN; el USD se deriva del total final PEN.
import { getFx, penToUsd, penToLocal } from '../services/fx';
import { getCurrency, formatMoney } from '../constants/currencies';
// Design System "Aurora Violeta Serena": superficies de vidrio y CTAs premium.
// Uso SOLO presentacional (aditivo); no altera lógica de compra/pago/totales.
import { GlassCard, GlassButton, Badge, AuroraBackground } from '../components/ui';
import styles from './CheckoutPage.module.css';

// Reutilizamos el mini componente de la moneda KapiSol para darle branding
const KapiSolCoinMini = () => (
  <div style={{ width: '24px', height: '24px', perspective: '500px', display: 'inline-block', flexShrink: 0 }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', animation: 'floatSpin 6s infinite' }}>
      <div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', borderRadius: '50%', background: 'linear-gradient(135deg, #FFDF00, #DAA520)', border: '2px solid #B8860B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 100 100" style={{ width: '60%', height: '60%' }}>
          <path d="M20,60 Q20,30 50,30 Q80,30 80,60 Q80,80 65,90 Q50,95 35,90 Q20,80 20,60 Z" fill="#6B4423" />
          <circle cx="35" cy="55" r="4" fill="#000" />
          <circle cx="65" cy="55" r="4" fill="#000" />
          <path d="M45,70 Q50,75 55,70" stroke="#000" strokeWidth="3" fill="none" />
        </svg>
      </div>
      <div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', borderRadius: '50%', background: 'linear-gradient(135deg, #FFDF00, #DAA520)', border: '2px solid #B8860B', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotateY(180deg)' }}>
        <svg viewBox="0 0 100 100" style={{ width: '60%', height: '60%' }}>
          <path d="M20,70 L30,40 L45,60 L60,30 L80,70 Z" fill="#8B6508" stroke="#4A3600" strokeWidth="2" />
          <path d="M20,70 L80,70 L80,80 L20,80 Z" fill="#6B4423" />
        </svg>
      </div>
    </div>
    <style>{`@keyframes floatSpin { 0%, 100% { transform: rotateY(0deg); } 50% { transform: rotateY(180deg); } }`}</style>
  </div>
);

const validationSchema = Yup.object({
  customerName: Yup.string().required('Nombre requerido'),
  country: Yup.string().required('País requerido'),
  // DNI condicional: si el país es Perú se aplica la validación estricta de DNI (8 dígitos);
  // para cualquier otro país el documento es texto libre (solo requerido).
  // Documento: se acepta cualquier tipo (DNI/CE/RUC/pasaporte/doc extranjero).
  // Solo requerido y con un mínimo razonable; el tipo exacto se interpreta en el ERP.
  dni: Yup.string()
    .required('Documento requerido')
    .min(3, 'Documento inválido (mínimo 3 caracteres)'),
  phone: Yup.string().required('Teléfono requerido'),
  address: Yup.string().required('Dirección requerida'),
  district: Yup.string().required('Distrito requerido'),
  city: Yup.string().required('Ciudad requerida'),
  email: Yup.string().email('Email inválido').required('Email requerido'),
  isGiftMode: Yup.boolean(),
  giftRecipientName: Yup.string().when('isGiftMode', {
    is: true,
    then: () => Yup.string().required('Nombre del destinatario requerido')
  }),
  giftMessage: Yup.string().when('isGiftMode', {
    is: true,
    then: () => Yup.string().max(200, 'Máximo 200 caracteres').required('Mensaje requerido')
  }),
  giftSticker: Yup.string(),
  // ── Fecha de entrega del regalo (Feature B "Mis fechas especiales") ──────────
  // ADITIVO y OPCIONAL: la página pública /regalar/:referralCode escribe esta fecha
  // en el ítem del carrito y aquí solo se muestra/persiste. NO bloquea el checkout
  // ni altera pago/totales/validación del documento.
  deliveryDate: Yup.string()
});

const CheckoutPage = () => {
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
  const { items, getTotalPrice, clearSelectedItems } = useCart();
  const { user, userProfile, updateUserProfile, freezeMonedas, activeMainCoins } = useAuth();
  const toast = useGlobalToast();

  // ── Selección de compra ───────────────────────────────────────────────────
  // Solo los items seleccionados (selected !== false) se cobran y entran en el
  // pedido/WhatsApp/analytics. Los "no comprar esta vez" quedan en el carrito.
  // getTotalPrice() ya viene filtrado por el contexto, por lo que el MONTO no se
  // toca aquí; selectedItems se usa SOLO para armar el detalle del pedido.
  const selectedItems = items.filter((i) => i.selected !== false);
  // Si no hay ningún item seleccionado, no se puede pagar.
  const hasSelectedItems = selectedItems.length > 0;

  const [processing, setProcessing] = useState(false);
  const [useCoinsToggle, setUseCoinsToggle] = useState(false);
  const [paymentStepData, setPaymentStepData] = useState(null);
  // Teléfono internacional: guardamos el número en formato completo (dialCode + número local).
  const [phoneFull, setPhoneFull] = useState('');
  // Marca si el usuario tocó manualmente el selector de país (para no pisar su elección con la autodetección).
  const countryTouchedRef = useRef(false);
  
  const subtotal = getTotalPrice();
  const monedasCount = activeMainCoins || 0;
  
  // Calcular límite de monedas (50% del subtotal como máximo)
  const maxCoinsAllowed = Math.floor(subtotal / 2);
  const availableCoins = Math.min(monedasCount, maxCoinsAllowed);
  const canUseCoins = monedasCount > 0 && availableCoins > 0;
  
  // Calcular descuentos
  const discount = (canUseCoins && useCoinsToggle) ? availableCoins : 0;
  
  const subtotalWithDiscount = Math.max(0, subtotal - discount);
  const shipping = subtotalWithDiscount > 100 ? 0 : 15;
  const total = subtotalWithDiscount + shipping;

  // ── FX: tasa de cambio para mostrar moneda local y cobrar en USD ────────────
  // Se carga una vez al montar con getFx() (Firestore -> caché -> fallback).
  // NUNCA bloquea el checkout: si falla, getFx ya devuelve el fallback interno.
  const [fx, setFx] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getFx();
        if (active) setFx(data);
      } catch (e) {
        // getFx no lanza, pero por seguridad: dejamos fx en null y los helpers
        // (penToUsd/penToLocal) aplican su fallback interno. Nunca bloqueamos.
        console.warn('No se pudo cargar la tasa FX:', e);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleToggleCoins = () => {
    setUseCoinsToggle(!useCoinsToggle);
  };
  
  // Config WhatsApp

  const { data: whatsappConfig } = useQuery({
    queryKey: ['whatsapp-config-tienda'],
    queryFn: async () => {
      try {
        const tiendaNum = await getMessage('whatsapp_number_tienda');
        const fallbackNum = await getMessage('whatsapp_number');
        const textTienda = await getMessage('whatsapp_text_tienda');

        let num = tiendaNum.data?.trim() || fallbackNum.data?.trim() || '';
        let cleanText = textTienda.data || 'Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código {id}.';
// eslint-disable-next-line no-useless-escape

        // eslint-disable-next-line no-useless-escape
        let clean = num.replace(/[\s\-\(\)\+]/g, '');
        if (clean && !clean.startsWith('51') && clean.length <= 9) {
          clean = `51${clean}`;
        }
        return {
          number: clean || '51999999999',
          customText: cleanText
        };
      } catch (e) {
        return {
          number: '51999999999',
          customText: 'Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código {id}.'
        };
      }
    }
  });

  const guestSavedInfo = JSON.parse(localStorage.getItem('checkout_customer_info') || '{}');

  // ── Contexto de regalo "Mis fechas especiales" (Feature B) ───────────────────
  // El checkout YA consume el contexto de regalo de la wishlist pública EXCLUSIVAMENTE
  // desde los ítems del carrito (items[]): los flags isWishlistGift / wishlistUserCode
  // que escribe WishlistPublic.jsx (productMock) viajan en el cartItem.
  // Aquí EXTENDEMOS ese MISMO mecanismo de forma ADITIVA: si la página /regalar/:referralCode
  // escribió en el ítem una fecha de entrega (deliveryDate) + el destinatario (deliveryRecipient)
  // + la etiqueta del evento (deliveryEventLabel), los leemos del PRIMER ítem que los traiga.
  // No se inventan datos: si el carrito no trae estos campos, el flujo normal queda intacto.
  const giftRegistryItem = items.find(
    (i) => i.isWishlistGift && i.deliveryDate
  );
  // Fecha de entrega elegida en la página de regalo (formato 'YYYY-MM-DD') o cadena vacía.
  const registryDeliveryDate = giftRegistryItem?.deliveryDate || '';
  // Destinatario (el dueño de la wishlist) y etiqueta humana del evento, si vinieron del registro.
  const registryRecipient = giftRegistryItem?.deliveryRecipient || '';
  const registryEventLabel = giftRegistryItem?.deliveryEventLabel || '';
  // Hay contexto de regalo programado cuando llegó una fecha de entrega desde /regalar/:code.
  const hasScheduledGift = !!registryDeliveryDate;

  // ── Formateo legible de la fecha de entrega (solo display, no afecta lógica) ──
  // Se parsea 'YYYY-MM-DD' como fecha local (evita el corrimiento por zona horaria de new Date(str)).
  const formatDeliveryDate = (isoDate) => {
    if (!isoDate) return '';
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    try {
      return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return isoDate;
    }
  };

  // ── Días hábiles (lun-vie) entre hoy y la fecha de entrega ───────────────────
  // Sirve solo para AVISAR (no bloquear) si la fecha está dentro de la ventana 7-30
  // días hábiles que ya maneja el checkout. Cálculo aproximado y defensivo.
  const businessDaysUntil = (isoDate) => {
    if (!isoDate) return null;
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return null;
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    if (target <= today) return 0;
    let count = 0;
    const cursor = new Date(today);
    while (cursor < target) {
      cursor.setDate(cursor.getDate() + 1);
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) count += 1; // excluye domingo (0) y sábado (6)
    }
    return count;
  };

  // Aviso si la fecha elegida está demasiado cerca (menos de 7 días hábiles).
  // Solo informativo: NO impide confirmar el pedido.
  const deliveryBusinessDays = hasScheduledGift ? businessDaysUntil(registryDeliveryDate) : null;
  const deliveryTooSoon = deliveryBusinessDays != null && deliveryBusinessDays < 7;

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      customerName: userProfile?.displayName || user?.displayName || guestSavedInfo.customerName || '',
      // País: prefill desde el perfil del usuario o lo guardado como invitado; default Perú ('PE').
      country: userProfile?.country || guestSavedInfo.country || 'PE',
      dni: userProfile?.dni || guestSavedInfo.dni || '',
      phone: userProfile?.phone || guestSavedInfo.phone || '',
      address: guestSavedInfo.address || '',
      district: guestSavedInfo.district || '',
      city: guestSavedInfo.city || 'Lima',
      email: user?.email || guestSavedInfo.email || '',
      // ── Preselección de Modo Regalo para "Mis fechas especiales" (ADITIVO) ──
      // Si el carrito trae una fecha de entrega del registro (/regalar/:code),
      // se activa el Modo Regalo y se prefija el destinatario (el dueño de la lista).
      // En el flujo normal todo queda en false/'' como hasta ahora.
      isGiftMode: hasScheduledGift ? true : false,
      giftRecipientName: registryRecipient || '',
      giftMessage: '',
      giftSticker: 'kapi-love',
      // Fecha de entrega programada (ISO 'YYYY-MM-DD'); vacía en el flujo normal.
      deliveryDate: registryDeliveryDate
    },
    validationSchema,
    onSubmit: async (values) => {

      // GUARD (dinero): no se puede generar un pedido sin items seleccionados.
      if (selectedItems.length === 0) {
        toast.error('Selecciona al menos un producto para pagar.');
        return;
      }

      setProcessing(true);

      try {
        const pseudoOrderId = `PD-${Date.now().toString(36).toUpperCase()}`;

        // ── País / tipo de documento ──────────────────────────────────────
        // esPeru = true cuando el país es 'PE' o no está definido (default seguro).
        const esPeru = values.country === 'PE' || !values.country;
        const tipoDocumento = esPeru ? 'DNI' : 'OTRO';
        // Teléfono internacional en formato completo (dialCode + número); fallback al phone local.
        const phoneIntl = phoneFull || values.phone;

        // ── Separar nombre en partes (nombre / apellidos) ─────────────────
        const nameParts = values.customerName.trim().split(/\s+/);
        const clienteNombre = nameParts[0] || values.customerName;
        const clienteApellidos = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // ── Construir string de prendas (resumen de ítems del carrito) ─────
        // Solo los items seleccionados ("comprar esta vez") entran en el pedido.
        const prendasStr = selectedItems
          .map((item) => {
            if (item.isComboProduct) {
              // Para combos: listar cada sub-producto con su talla y color
              const comboVariantSelections = item.comboVariantSelections || {};
              const comboItemCustomization = item.customization?.comboItemCustomization || [];
              const subResumen = (item.comboItems || []).map((subItem, subIdx) => {
                const varSel = comboVariantSelections[subIdx] || comboItemCustomization[subIdx]?.variant || {};
                const talla = varSel.size ? `(${varSel.size})` : '';
                const color = varSel.color ? `/${varSel.color}` : '';
                const nombre = subItem.productName || subItem.name || `Producto ${subIdx + 1}`;
                return `${nombre}${color} ${talla}`;
              }).join(' + ');
              return `[COMBO] ${item.productName}: ${subResumen} x${item.quantity}`;
            }
            const talla = item.variant?.size ? `(${item.variant.size})` : '';
            const color = item.variant?.color ? `/${item.variant.color}` : '';
            return `${item.productName}${color} ${talla} x${item.quantity}`.trim();
          })
          .join(' - ');

        // ── Construir mapa de productos (estructura ERP: productos) ────────
        // Para combos: incluye sub-productos, tallas, colores y diseños por vista (frente/espalda)
        const productosMap = {};
        selectedItems.forEach((item, idx) => {
          const precioItem = item.customization?.finalPrice || item.price || 0;
          const subtotalItem = precioItem * (item.quantity || 1);

          if (item.isComboProduct) {
            // ── Extraer datos por sub-producto del combo ──────────────────
            const comboVariantSelections = item.comboVariantSelections || {};
            const comboItemCustomization = item.customization?.comboItemCustomization || [];
            // Datos completos del sub-producto cargados desde Firestore (contiene nombre, imágenes, vistas)
            const comboSubProductsData = item.comboSubProductsData || {};

            const subProductos = {};
            (item.comboItems || []).forEach((subItem, subIdx) => {
              const varSel =
                comboVariantSelections[subIdx] ||
                comboItemCustomization[subIdx]?.variant ||
                {};
              const colorKey = varSel.color || 'default';
              const colorKeyLower = colorKey.trim().toLowerCase();
              const itemLayers = comboItemCustomization[subIdx]?.layersByView || {};
              // Datos completos del sub-producto (si se agregó desde la página del producto)
              const subProductData = comboSubProductsData[subIdx] || comboSubProductsData[String(subIdx)];

              // Nombre real del sub-producto (desde datos cargados o fallback al config del admin)
              const productName =
                subProductData?.name ||
                subItem.productName ||
                subItem.name ||
                `Producto ${subIdx + 1}`;

              // Clasificar capas del editor: frente vs espalda
              const frenteKey = `combo-view-${subIdx}-${colorKey}`;
              const espaldaKey = `combo-view-${subIdx}-${colorKey}-back`;

              const extraerInfoCapas = (layers) => {
                if (!Array.isArray(layers) || layers.length === 0) return null;
                return {
                  cantidadCapas: layers.length,
                  imagenes: layers
                    .filter((l) => l.type === 'image' && l.src)
                    .map((l) => l.src),
                  textos: layers
                    .filter((l) => l.type === 'text' && l.text)
                    .map((l) => l.text),
                };
              };

              const frenteLayers = itemLayers[frenteKey];
              const espaldaLayers = itemLayers[espaldaKey];
              const tieneDiseno = !!(frenteLayers?.length || espaldaLayers?.length);

              // Renders pre-generados por el editor (imagen renderizada con diseño + producto)
              // Estructura: item.customization.comboItemRenderedPreviews[subIdx] = { frente, espalda }
              const renderedPreviews = item.customization?.comboItemRenderedPreviews?.[subIdx] || null;

              // Si no hay capas del editor, extraer imágenes base del producto por color seleccionado
              let disenoFrenteData = null;
              let disenoEspaldaData = null;

              if (tieneDiseno) {
                // Usuario usó el editor: preferir el render visual final sobre los srcs de capas crudas
                const frenteImgRender = renderedPreviews?.frente || null;
                const espaldaImgRender = renderedPreviews?.espalda || null;

                if (frenteLayers?.length > 0) {
                  const capasInfo = extraerInfoCapas(frenteLayers);
                  disenoFrenteData = {
                    ...capasInfo,
                    // Si hay render visual, lo ponemos como primera imagen (la más importante para el ERP)
                    imagenes: frenteImgRender
                      ? [frenteImgRender, ...capasInfo.imagenes]
                      : capasInfo.imagenes,
                  };
                }
                if (espaldaLayers?.length > 0) {
                  const capasInfo = extraerInfoCapas(espaldaLayers);
                  disenoEspaldaData = {
                    ...capasInfo,
                    imagenes: espaldaImgRender
                      ? [espaldaImgRender, ...capasInfo.imagenes]
                      : capasInfo.imagenes,
                  };
                }
              } else if (subProductData) {
                // Buscar la vista frontal del sub-producto (por viewId del admin o la primera disponible)
                const frontView =
                  subProductData.customizationViews?.find((v) => v.id === subItem.viewId) ||
                  subProductData.customizationViews?.[0];

                if (frontView) {
                  // Matching de color case-insensitive (igual que hace el editor)
                  const imgsByColor = frontView.imagesByColor || {};
                  const matchedFrontKey = Object.keys(imgsByColor).find(
                    (k) => k.trim().toLowerCase() === colorKeyLower
                  );
                  const frontImgUrl =
                    (matchedFrontKey && imgsByColor[matchedFrontKey]) ||
                    imgsByColor.default ||
                    subProductData.variants?.find(
                      (v) => v.name?.trim().toLowerCase() === colorKeyLower
                    )?.imageUrl ||
                    subProductData.mainImage ||
                    '';

                  if (frontImgUrl) {
                    disenoFrenteData = {
                      cantidadCapas: 0,
                      imagenes: [frontImgUrl],
                      textos: [],
                      esImagenBase: true, // distingue imagen de producto vs diseño del cliente
                    };
                  }

                  // Vista de espalda (si el producto tiene backSide)
                  if (frontView.hasBackSide && frontView.backSide) {
                    const backImgsByColor = frontView.backSide.imagesByColor || {};
                    const matchedBackKey = Object.keys(backImgsByColor).find(
                      (k) => k.trim().toLowerCase() === colorKeyLower
                    );
                    const backImgUrl =
                      (matchedBackKey && backImgsByColor[matchedBackKey]) ||
                      backImgsByColor.default ||
                      '';

                    if (backImgUrl) {
                      disenoEspaldaData = {
                        cantidadCapas: 0,
                        imagenes: [backImgUrl],
                        textos: [],
                        esImagenBase: true,
                      };
                    }
                  }
                }
              }

              subProductos[`subItem_${subIdx}`] = {
                productoId: subItem.productId || subItem.id || '',
                producto: productName,
                talla: varSel.size || '',
                color: colorKey !== 'default' ? colorKey : '',
                personalizado: tieneDiseno,
                ...(disenoFrenteData && { disenoFrente: disenoFrenteData }),
                ...(disenoEspaldaData && { disenoEspalda: disenoEspaldaData }),
              };
            });

            productosMap[`item_${idx}`] = {
              productoId: item.productId || '',
              producto: item.productName || '',
              cantidad: item.quantity || 1,
              precio: precioItem,
              subtotal: subtotalItem,
              esCombo: true,
              personalizado: !!(item.customization?.comboItemCustomization?.some(
                (c) => c?.layersByView && Object.values(c.layersByView).some((l) => l?.length > 0)
              )),
              urlImagenPersonalizada: item.customization?.imageURL || '',
              designId: item.customization?.designId || '',
              subProductos,
            };
          } else {
            // ── Producto simple ───────────────────────────────────────────
            productosMap[`item_${idx}`] = {
              productoId: item.productId || '',
              producto: item.productName || '',
              cantidad: item.quantity || 1,
              talla: item.variant?.size || '',
              color: item.variant?.color || '',
              precio: precioItem,
              subtotal: subtotalItem,
              personalizado: !!(item.customization?.layersByView
                ? Object.values(item.customization.layersByView).some((l) => l?.length > 0)
                : item.customization?.imageURL),
              textoPersonalizado: item.customization?.text || '',
              urlImagenPersonalizada: item.customization?.imageURL || '',
              designId: item.customization?.designId || '',
            };
          }
        });

        // ── Payload completo con campos del ERP ───────────────────────────
        const webOrderPayload = {
          // ─ Número de referencia ─
          numeroPedido: pseudoOrderId,

          // ─ Documento principal (el ERP busca el pedido por 'dni') ─
          dni: values.dni,

          // ─ Datos internacionales (aditivos; PE sigue funcionando igual) ─
          country: values.country,
          phoneIntl,

          // ─ Datos del cliente (campos ERP oficiales) ─
          clienteNombre,
          clienteApellidos,
          clienteNombreCompleto: values.customerName,
          clienteNumeroDocumento: values.dni,
          clienteTipoDocumento: tipoDocumento,
          clienteContacto: values.phone,
          clienteContactoSecundario: '',
          clienteCorreo: values.email,
          clienteDepartamento: values.city,
          clienteDistrito: values.district,
          clienteProvincia: values.city === 'Lima' || values.city === 'Callao' ? 'No' : 'Sí',

          // ─ Datos de envío ─
          envioNombres: clienteNombre,
          envioApellidos: clienteApellidos,
          envioContacto: values.phone,
          envioNumeroDocumento: values.dni,
          envioTipoDocumento: tipoDocumento,
          envioDireccion: values.address,
          envioDistrito: values.district,
          envioDepartamento: values.city,
          envioProvincia: values.city === 'Lima' || values.city === 'Callao' ? 'No' : 'Sí',

          // ─ Canal, origen y flag web ─
          canalVenta: 'Portal Web',
          web: true,
          activador: 'portal_web',
          vendedor: 'Portal Web',
          whatsappOrigen: '',

          // ─ Montos ─
          montoTotal: total,
          montoAdelanto: 0,
          montoPendiente: total,
          ...(discount > 0 && { descuentoMonedas: discount }),
          ...(discount > 0 && { monedasEnEspera: discount }),

          // ─ Estado inicial ─
          estadoGeneral: 'Nuevo',
          status: 'Nuevo',

          // ─ Prendas y productos ─
          prendas: prendasStr,
          cantidad: selectedItems.reduce((acc, i) => acc + (i.quantity || 1), 0),
          productos: productosMap,
          lineaProducto: '',
          añadidos: [],

          // ─ Flags de tipo de pedido ─
          esPersonalizado: selectedItems.some(
            (i) => !!(i.customization?.text || i.customization?.imageURL)
          ),
          esMostacero: false,
          esPrioridad: false,
          importado: false,

          // ─ Imágenes de diseños personalizados (Mapeo completo galería) ─
          imageURLs: selectedItems
            .flatMap((i) => {
              const urls = [];
              if (i.customization?.imageURL) urls.push(i.customization.imageURL);
              if (i.isComboProduct && productosMap) {
                const itemMap = Object.values(productosMap).find((pm) => pm.productoId === i.productId);
                if (itemMap?.subProductos) {
                  Object.values(itemMap.subProductos).forEach((sub) => {
                    if (sub.disenoFrente?.imagenes) urls.push(...sub.disenoFrente.imagenes);
                    if (sub.disenoEspalda?.imagenes) urls.push(...sub.disenoEspalda.imagenes);
                  });
                }
              }
              return urls;
            })
            .filter(Boolean),

          // ─ Sub-maps de etapas (vacíos, se completan en el ERP al aprobar) ─
          impresion: {
            estado: 'Pendiente',
            pago1: null,
            pago2: null,
            montoPendiente: total,
          },
          diseño: {
            diseñadorAsignado: null,
            urlImagen: null,
            fechaEntrada: null,
            fechaSalida: null,
          },
          preparación: {
            estado: null,
            operador: null,
            fechaEntrada: null,
            fechaSalida: null,
          },
          estampado: {
            estado: null,
            operador: null,
            fechaEntrada: null,
            fechaSalida: null,
          },
          empaquetado: {
            estado: null,
            operador: null,
            fechaEntrada: null,
            fechaSalida: null,
          },
          reparto: {
            estado: null,
            repartidor: null,
            fechaEntrada: null,
            fechaSalida: null,
            fechaFinalizado: null,
          },

          // ─ Otros campos ERP ─
          agenciaEnvio: '',
          observación: '',
          historialModificaciones: [],
          tiempos: {},
          fechaEnvio: null,

          // ─ Referencia del usuario autenticado (si aplica) ─
          ...(user?.uid && { userId: user.uid }),
          portalPseudoOrderId: pseudoOrderId,
          ...(values.isGiftMode && {
            giftDetails: {
              isGift: true,
              recipientName: values.giftRecipientName,
              message: values.giftMessage,
              sticker: values.giftSticker,
              // ── Campos NUEVOS de "Mis fechas especiales" (ADITIVOS) ──────────
              // Solo se añaden si la fecha de entrega llegó desde /regalar/:code.
              // No alteran montos ni la lógica del pedido: son metadatos para
              // que operaciones/ERP sepan QUÉ DÍA entregar el regalo.
              ...(values.deliveryDate && { deliveryDate: values.deliveryDate }),
              ...(registryEventLabel && { deliveryEventLabel: registryEventLabel }),
              ...(giftRegistryItem?.wishlistUserCode && {
                wishlistUserCode: giftRegistryItem.wishlistUserCode
              })
            }
          }),
        };

        // ── 1. Guardar en pedidos_web (colección separada, para validación previa) ──
        let webOrderId = null;
        try {
          const { id, error: webErr } = await createWebOrder(webOrderPayload);
          if (webErr) {
            console.warn('No se pudo guardar en pedidos_web:', webErr);
          } else {
            webOrderId = id;
          }
        } catch (erpErr) {
          console.warn('Error al conectar con ERP Firebase:', erpErr);
        }

        // ── 1.5 Procesar Regalos de Wishlist ──────────────────────────────
        try {
          const wishlistGifts = selectedItems.filter(item => item.isWishlistGift && item.wishlistUserCode);
          for (const gift of wishlistGifts) {
            await markItemAsGifted(gift.wishlistUserCode, gift.productId, values.customerName);
          }
        } catch (giftErr) {
          console.warn('Error al marcar regalos de wishlist:', giftErr);
        }

        // ── 2. Procesar referidos ─────────────────────────────────────────
        let referralTag = '';
        try {
          const rawRef = localStorage.getItem('wala_referral');
          if (rawRef) {
            const refData = JSON.parse(rawRef);
            const now = Date.now();
            if (now - refData.timestamp < 36 * 60 * 60 * 1000) {
              referralTag = `\n_Referido por: ${refData.referrerCode}_`;
              await linkPurchaseToReferral(refData.referralId, pseudoOrderId, subtotal);
            }
          }
        } catch (e) {
          console.warn('No se pudo procesar cookie de referido:', e);
        }

        // ── 3. Armar mensaje de WhatsApp ──────────────────────────────────
        let message = `SOLICITUD DE NUEVO PEDIDO (${pseudoOrderId})\n\n`;
        message += `Datos del Cliente:\n`;
        message += `Nombre: ${values.customerName}\n`;
        message += `DNI: ${values.dni}\n`;
        message += `Teléfono: ${values.phone}\n`;
        message += `Email: ${values.email}\n`;
        message += `Dirección: ${values.address}, ${values.district}, ${values.city}\n\n`;

        if (values.isGiftMode) {
          message += `🎁 *MODO REGALO ACTIVO*\n`;
          message += `   Para: ${values.giftRecipientName}\n`;
          message += `   Mensaje: "${values.giftMessage}"\n`;
          // ── Entrega programada (Feature B): se añade solo si vino una fecha ──
          if (values.deliveryDate) {
            message += `   📅 Entrega programada: ${formatDeliveryDate(values.deliveryDate)}`;
            if (registryEventLabel) message += ` (${registryEventLabel})`;
            message += `\n`;
          }
          message += `\n`;
        }

        message += `Detalle de Compra:\n`;
        selectedItems.forEach((item, index) => {
          message += `${index + 1}. ${item.productName}\n`;
          message += `   Cantidad: ${item.quantity}\n`;
          if (item.variant && item.variant.size) {
            message += `   Talla/Modelo: ${item.variant.size}\n`;
          }
          if (item.customization && item.customization.text) {
            message += `   Texto: ${item.customization.text}\n`;
          }
          const price = item.customization?.finalPrice || item.price;
          message += `   Subtotal: S/ ${(price * item.quantity).toFixed(2)}\n`;
          message += `   Link: ${window.location.origin}/producto/${item.productId}\n\n`;
        });

        message += `Resumen de Pago:\n`;
        message += `Producto(s): S/ ${subtotal.toFixed(2)}\n`;
        if (discount > 0) {
          message += `Descuento (Monedas): - S/ ${discount.toFixed(2)}\n`;
        }
        message += `Envío: ${shipping === 0 ? 'Gratis' : `S/ ${shipping.toFixed(2)}`}\n`;
        message += `TOTAL A PAGAR: S/ ${total.toFixed(2)}\n\n`;

        // ── Aviso de envío internacional (solo si NO es Perú) ──────────────
        if (!esPeru) {
          message += `\nEnvíos internacionales: la entrega demora de 7 a 30 días hábiles.\n`;
        }

        message += whatsappConfig?.customText?.replace('{id}', pseudoOrderId) || `Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código ${pseudoOrderId}.`;
        if (referralTag) message += referralTag;

        const waLink = `https://wa.me/${whatsappConfig?.number}?text=${encodeURIComponent(message)}`;

        // ── 4. Guardar en localStorage (pendiente de confirmación) ─────────
        const currentCart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
        const updatedCart = currentCart.map((item) => ({
          ...item,
          status: 'pending_confirmation',
          pseudoOrderId,
          ...(webOrderId && { webOrderId }),
        }));
        localStorage.setItem('shopping_cart', JSON.stringify(updatedCart));

        const savedInfo = {
          customerName: values.customerName,
          dni: values.dni,
          phone: values.phone,
          address: values.address,
          district: values.district,
          city: values.city,
          email: values.email,
        };
        localStorage.setItem('checkout_customer_info', JSON.stringify(savedInfo));

        // ── 5. Congelar monedas en estado de "espera" ─────────────────────
        if (discount > 0 && freezeMonedas) {
          // Congela de la cantidad "monedas" a "monedasEnEspera"
          await freezeMonedas(discount, pseudoOrderId);
        }

        // ── 6. Auto-actualizar perfil del usuario ─────────────────────────
        if (user && updateUserProfile) {
          const updates = {};
          if (!userProfile?.dni || userProfile.dni !== values.dni) updates.dni = values.dni;
          if (!userProfile?.phone || userProfile.phone !== values.phone) updates.phone = values.phone;
          if (!userProfile?.displayName || userProfile.displayName !== values.customerName) updates.displayName = values.customerName;
          if (Object.keys(updates).length > 0) {
            updateUserProfile(updates).catch((err) =>
              console.error('Error auto-updating profile from checkout:', err)
            );
          }
        }

        // ── 7. Pasar a Opciones de Pago ─────────────────────────────────────────────
        toast.success('¡Pedido generado! Por favor, selecciona tu método de pago.');
        setPaymentStepData({
          id: webOrderId || pseudoOrderId,
          montoDeuda: total,
          waLink: waLink,
          // Bandera para la pantalla de pago: define método (Culqi vs Paypal) y aviso internacional.
          esPeru: esPeru,
          country: values.country
        });
      } catch (error) {
        console.error('Error al generar pedido:', error);
        toast.error('Error al procesar el pedido. Inténtalo de nuevo.');
      } finally {
        setProcessing(false);
      }
    }
  });

  const { setFieldValue } = formik;

  // ── Analytics: contexto de usuario reutilizable para los eventos del embudo ──
  const analyticsUserCtx = React.useMemo(
    () =>
      user?.uid
        ? { uid: user.uid, email: user.email, displayName: user.displayName }
        : {},
    [user?.uid, user?.email, user?.displayName]
  );

  // ── Analytics: emitir checkout_start una sola vez al montar (si hay ítems) ──
  // Envuelto en try/catch y .catch(); nunca debe afectar el checkout.
  const checkoutStartSentRef = useRef(false);
  useEffect(() => {
    if (checkoutStartSentRef.current) return;
    if (!items || items.length === 0) return;
    checkoutStartSentRef.current = true;
    try {
      trackCheckoutStart(
        {
          totalCents: Math.round((getTotalPrice() || 0) * 100),
          itemsCount: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
          currency: 'PEN',
        },
        analyticsUserCtx
      ).catch(() => {});
    } catch (_e) {
      // Tracking nunca debe afectar la experiencia de compra.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // ── Analytics: emitir purchase_complete al confirmar el pedido ──────────────
  // Se invoca en el onSuccess de Culqi/PayPal y al confirmar por WhatsApp.
  // Captura los datos ANTES de clearSelectedItems() (que vacía los pagados). Idempotente.
  const purchaseSentRef = useRef(false);
  const emitPurchaseComplete = React.useCallback(
    (method) => {
      if (purchaseSentRef.current) return;
      purchaseSentRef.current = true;
      try {
        const orderTotal = paymentStepData?.montoDeuda ?? total;
        // ── Detalle por ítem del carrito (aditivo): solo se añaden los campos
        // que el ítem realmente tenga; los IDs ausentes se omiten (no se inventan). ──
        // Solo los items seleccionados ("comprar esta vez") cuentan en analytics.
        const purchaseItems = selectedItems.map((i) => ({
          productId: i.productId,
          qty: i.quantity || 1,
          price: i.customization?.finalPrice || i.price || 0,
          ...(i.categoryId && { categoryId: i.categoryId }),
          ...(i.lineaProducto && { lineaProducto: i.lineaProducto }),
          ...((i.lineId ?? i.lineaProducto) && { lineId: i.lineId ?? i.lineaProducto }),
        }));
        trackPurchaseComplete(
          {
            orderId: paymentStepData?.id || null,
            total: orderTotal,
            totalCents: Math.round((orderTotal || 0) * 100),
            itemsCount: selectedItems.reduce((acc, i) => acc + (i.quantity || 1), 0),
            items: purchaseItems,
            method,
            currency: 'PEN',
          },
          analyticsUserCtx
        ).catch(() => {});
      } catch (_e) {
        // Tracking nunca debe afectar la confirmación del pedido.
      }
    },
    [paymentStepData, total, selectedItems, analyticsUserCtx]
  );

  // ── Autodetección de país (solo si el usuario NO ha tocado el selector y no hay país en perfil) ──
  // No pisa la elección manual del usuario ni un país ya cargado desde el perfil/invitado.
  useEffect(() => {
    let active = true;
    if (userProfile?.country || guestSavedInfo.country) return; // ya hay país conocido
    (async () => {
      try {
        const detected = await detectCountry();
        if (active && detected?.code && !countryTouchedRef.current) {
          setFieldValue('country', detected.code);
        }
      } catch (e) {
        // Si la detección falla, se mantiene el default 'PE' (no rompe el flujo peruano).
        console.warn('No se pudo autodetectar el país:', e);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // País actual del formulario; esPeru gobierna qué UI/validación mostrar (default seguro: Perú).
  const formIsPeru = formik.values.country === 'PE' || !formik.values.country;

  // ── Display multi-moneda del RESUMEN (aditivo, NO toca los totales PEN) ──────
  // Para Perú: se sigue mostrando 'S/ total' como hoy.
  // Para extranjero: se muestra el equivalente local informativo (penToLocal)
  // y se deja claro cuánto pagará en USD por PayPal (penToUsd, con margen).
  // Se recomputa cuando cambia el país (formik.values.country), el total o la tasa fx.
  const summaryCountry = formik.values.country;
  const summaryCurrency = getCurrency(summaryCountry);
  // USD final a cobrar por PayPal: derivado del TOTAL final en PEN (con descuento).
  const summaryAmountUsd = penToUsd(total, fx);
  // Equivalente local informativo (puede ser null si no hay tasa para el país).
  const summaryLocalAmount = !formIsPeru ? penToLocal(total, summaryCountry, fx) : null;

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <h2>Tu carrito está vacío</h2>
        <Button onClick={() => navigate('/tienda')}>Ir a la Tienda</Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Fondo de marca MUY suave detrás del contenido (decorativo, no interactivo). */}
      <AuroraBackground variant="subtle" intensity={0.18} />
      <h1>Checkout</h1>

      <div className={styles.layout}>
        <div className={styles.formContainer}>
          {paymentStepData ? (
            <GlassCard variant="solid" padding="lg" className={styles.payCard}>
              <h2 style={{ marginBottom: '1rem', textAlign: 'center', color: '#1e293b' }}>Selecciona tu método de pago</h2>
              <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#64748b' }}>
                Tu pedido se ha generado correctamente. Para confirmarlo, realiza el pago.
              </p>

              {/* Aviso de envío internacional (solo si NO es Perú) */}
              {!paymentStepData.esPeru && (
                <div className={styles.intlNotice}>
                  <span className={styles.intlNoticeIcon} aria-hidden="true">✈️</span>
                  <span>Envíos internacionales: la entrega demora de <strong>7 a 30 días hábiles</strong>.</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {paymentStepData.esPeru ? (
                  <>
                    {/* PERÚ: Culqi (idéntico a hoy) + acuerdo por WhatsApp/Yape.
                        autoOpen (Opción A): al entrar al paso de pago tras confirmar,
                        se abre automáticamente el modal de Culqi una sola vez. */}
                    <CulqiCustomCheckout
                      pedido={paymentStepData}
                      autoOpen={true}
                      onSuccess={() => {
                        emitPurchaseComplete('culqi');
                        // Conserva en el carrito los "no comprar esta vez"; quita los pagados.
                        clearSelectedItems();
                        navigate('/cuenta/pedidos');
                      }}
                    />

                    <div className={styles.payDivider}>O</div>

                    <GlassButton
                      onClick={() => {
                        emitPurchaseComplete('whatsapp');
                        window.open(paymentStepData.waLink, '_blank');
                        // Conserva en el carrito los "no comprar esta vez"; quita los pagados.
                        clearSelectedItems();
                        navigate('/cuenta/pedidos');
                      }}
                      variant="ghost"
                      fullWidth
                    >
                      Acordar pago por WhatsApp (Yape / Plin / Transf)
                    </GlassButton>
                  </>
                ) : (
                  <>
                    {/* INTERNACIONAL: PayPal (Culqi oculto) + acuerdo por WhatsApp.
                        amountUsd = USD final a cobrar, derivado del TOTAL final en PEN
                        (paymentStepData.montoDeuda) con el margen FX aplicado.
                        PayPal SIEMPRE cobra en USD; la moneda local es solo display. */}
                    <PaypalCheckout
                      pedido={paymentStepData}
                      amountUsd={penToUsd(paymentStepData.montoDeuda, fx)}
                      webOrderId={paymentStepData.id}
                      localLabel={(() => {
                        // Etiqueta local SOLO informativa (PayPal cobra en USD).
                        const localAmt = penToLocal(paymentStepData.montoDeuda, paymentStepData.country, fx);
                        return localAmt != null
                          ? formatMoney(localAmt, getCurrency(paymentStepData.country))
                          : undefined;
                      })()}
                      onSuccess={() => {
                        emitPurchaseComplete('paypal');
                        // Conserva en el carrito los "no comprar esta vez"; quita los pagados.
                        clearSelectedItems();
                        navigate('/cuenta/pedidos');
                      }}
                    />

                    <div className={styles.payDivider}>O</div>

                    <GlassButton
                      onClick={() => {
                        emitPurchaseComplete('whatsapp');
                        window.open(paymentStepData.waLink, '_blank');
                        // Conserva en el carrito los "no comprar esta vez"; quita los pagados.
                        clearSelectedItems();
                        navigate('/cuenta/pedidos');
                      }}
                      variant="ghost"
                      fullWidth
                    >
                      Acordar pago por WhatsApp
                    </GlassButton>
                  </>
                )}
              </div>
            </GlassCard>
          ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              // Valida primero; si hay errores, AVISA y lleva al primer campo (antes el bloqueo era silencioso).
              const errs = await formik.validateForm();
              if (Object.keys(errs).length > 0) {
                formik.setTouched(
                  Object.keys(errs).reduce((acc, k) => { acc[k] = true; return acc; }, {}),
                  false,
                );
                toast.error('Revisa los campos marcados en rojo para continuar.');
                const firstKey = Object.keys(errs)[0];
                const el = document.querySelector(`[name="${firstKey}"]`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  if (typeof el.focus === 'function') el.focus();
                }
                return;
              }
              formik.handleSubmit(e);
            }}
            className={styles.form}
          >
            <h2>Detalles de Envío</h2>

            <div className={styles.field}>
              <label>País *</label>
              <CountrySelect
                value={formik.values.country}
                onChange={(code) => {
                  countryTouchedRef.current = true;
                  formik.setFieldValue('country', code);
                }}
              />
              {formik.touched.country && formik.errors.country && (
                <span className={styles.error}>{formik.errors.country}</span>
              )}
            </div>

            <div className={styles.field}>
              <label>Nombre Completo *</label>
              <input
                type="text"
                name="customerName"
                value={formik.values.customerName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Ej: Juan Pérez"
              />
              {formik.touched.customerName && formik.errors.customerName && (
                <span className={styles.error}>{formik.errors.customerName}</span>
              )}
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Documento *</label>
                <input
                  type="text"
                  name="dni"
                  value={formik.values.dni}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder={formIsPeru ? 'DNI, CE, RUC o pasaporte' : 'Documento de identidad'}
                />
                {formik.touched.dni && formik.errors.dni && (
                  <span className={styles.error}>{formik.errors.dni}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Teléfono *</label>
                <PhoneIntlInput
                  countryCode={formik.values.country}
                  value={formik.values.phone}
                  onChange={({ localNumber, full }) => {
                    formik.setFieldValue('phone', localNumber);
                    setPhoneFull(full);
                  }}
                />
                {formik.touched.phone && formik.errors.phone && (
                  <span className={styles.error}>{formik.errors.phone}</span>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="correo@ejemplo.com"
              />
              {formik.touched.email && formik.errors.email && (
                <span className={styles.error}>{formik.errors.email}</span>
              )}
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Ciudad / Región *</label>
                <select
                  name="city"
                  value={formik.values.city}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={styles.selectInput}
                  style={{ padding: '0.8rem 1rem', border: '2px solid var(--gris-borde)', borderRadius: 'var(--radio-pequeno)', fontSize: '1rem', background: 'white' }}
                >
                  <option value="Lima">Lima Metropolitana</option>
                  <option value="Callao">Callao</option>
                  <option value="Provincias">Otras Provincias</option>
                </select>
                {formik.touched.city && formik.errors.city && (
                  <span className={styles.error}>{formik.errors.city}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Distrito *</label>
                <input
                  type="text"
                  name="district"
                  value={formik.values.district}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Ej: Miraflores"
                />
                {formik.touched.district && formik.errors.district && (
                  <span className={styles.error}>{formik.errors.district}</span>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label>Dirección exacta *</label>
              <input
                type="text"
                name="address"
                value={formik.values.address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Avenida, Calle, Nro, Dpto, Referencia"
              />
              {formik.touched.address && formik.errors.address && (
                <span className={styles.error}>{formik.errors.address}</span>
              )}
            </div>

            <div className={styles.giftModeContainer}>
              <div className={styles.giftModeToggle}>
                <label>
                  <input
                    type="checkbox"
                    name="isGiftMode"
                    checked={formik.values.isGiftMode}
                    onChange={formik.handleChange}
                  />
                  🎁 Activar Modo Regalo (Gratis)
                </label>
                <p>Incluye una experiencia digital inmersiva para el destinatario.</p>
              </div>

              {formik.values.isGiftMode && (
                <div className={styles.giftModeFields}>
                  {/* ── Aviso de Entrega Programada (Feature B "Mis fechas especiales") ──
                      Solo se muestra cuando la fecha llegó desde la página pública
                      /regalar/:referralCode (hasScheduledGift). Es SOLO display:
                      la fecha es de lectura; no hay input que altere el flujo de pago. */}
                  {hasScheduledGift && (
                    <div
                      className={styles.field}
                      style={{
                        padding: '0.85rem 1rem',
                        marginBottom: '0.5rem',
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#5b21b6' }}>
                        <span aria-hidden="true">📅</span>
                        <span>Entrega programada para {formatDeliveryDate(registryDeliveryDate)}</span>
                      </div>
                      {registryEventLabel && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6d28d9' }}>
                          Ocasión: {registryEventLabel}
                        </p>
                      )}
                      {/* Aviso (no bloqueante) si la fecha está dentro de la ventana mínima. */}
                      {deliveryTooSoon && (
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#b45309' }}>
                          ⚠️ La fecha elegida está muy cerca (faltan ~{deliveryBusinessDays} días hábiles).
                          La preparación y el envío toman de 7 a 30 días hábiles, así que la entrega
                          podría no llegar a tiempo. Puedes continuar igual.
                        </p>
                      )}
                      {/* Campo oculto: mantiene deliveryDate en Formik para que viaje al payload. */}
                      <input type="hidden" name="deliveryDate" value={formik.values.deliveryDate} readOnly />
                    </div>
                  )}

                  <div className={styles.field}>
                    <label>Nombre del destinatario *</label>
                    <input
                      type="text"
                      name="giftRecipientName"
                      value={formik.values.giftRecipientName}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      placeholder="Ej: María"
                    />
                    {formik.touched.giftRecipientName && formik.errors.giftRecipientName && (
                      <span className={styles.error}>{formik.errors.giftRecipientName}</span>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label>Mensaje (Máx 200 caracteres) *</label>
                    <textarea
                      name="giftMessage"
                      value={formik.values.giftMessage}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      maxLength="200"
                      placeholder="Escribe un mensaje especial..."
                      rows="3"
                    ></textarea>
                    {formik.touched.giftMessage && formik.errors.giftMessage && (
                      <span className={styles.error}>{formik.errors.giftMessage}</span>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label>Sticker de Kapi</label>
                    <div className={styles.stickerSelection}>
                      <label className={formik.values.giftSticker === 'kapi-love' ? styles.stickerSelected : ''}>
                        <input type="radio" name="giftSticker" value="kapi-love" checked={formik.values.giftSticker === 'kapi-love'} onChange={formik.handleChange} />
                        😍 Amor
                      </label>
                      <label className={formik.values.giftSticker === 'kapi-party' ? styles.stickerSelected : ''}>
                        <input type="radio" name="giftSticker" value="kapi-party" checked={formik.values.giftSticker === 'kapi-party'} onChange={formik.handleChange} />
                        🎉 Fiesta
                      </label>
                      <label className={formik.values.giftSticker === 'kapi-smile' ? styles.stickerSelected : ''}>
                        <input type="radio" name="giftSticker" value="kapi-smile" checked={formik.values.giftSticker === 'kapi-smile'} onChange={formik.handleChange} />
                        😊 Feliz
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GUARD (dinero): aviso si no hay ningún producto seleccionado para pagar. */}
            {!hasSelectedItems && (
              <p style={{ margin: '0 0 0.75rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.875rem' }}>
                Selecciona al menos un producto para pagar. Vuelve al carrito y marca "Comprar esta vez".
              </p>
            )}
            <div className={styles.buttonGroup}>
              <Button type="button" variant="outline" onClick={() => navigate('/carrito')} disabled={processing} fullWidth>
                Volver al carrito
              </Button>
              <GlassButton type="submit" variant="primary" loading={processing} disabled={processing || !hasSelectedItems} fullWidth>
                {processing ? 'Generando...' : 'Confirmar y Seleccionar Pago'}
              </GlassButton>
            </div>
          </form>
          )}
        </div>

        <div className={`${styles.summary} ${styles.summaryGlass}`}>
          <GlassCard variant="solid" padding="lg" animate={false} bodyClassName={styles.summaryBody}>
          <h2>Resumen del Pedido</h2>
          <div className={styles.items}>
            {items.map(item => (
              <div key={item.id} className={styles.summaryItem}>
                <span>{item.productName} x{item.quantity}</span>
                <span>S/ {((item.customization?.finalPrice || item.price) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Subtotal:</span>
                <span>S/ {subtotal.toFixed(2)}</span>
              </div>
              {canUseCoins && (
                <div className={styles.coinsNotice}>
                  <div className={styles.coinsNoticeInner}>
                    <div className={styles.coinsNoticeHead}>
                      <div className={styles.coinsNoticeTitle}>
                        <KapiSolCoinMini />
                        <label className={styles.coinsNoticeLabel}>
                          Tienes {monedasCount} monedas = S/{monedasCount.toFixed(2)}
                        </label>
                      </div>
                      <div className={styles.coinsNoticeToggle}>
                        <Badge tone="warning" variant="soft" size="sm">¿Aplicar?</Badge>
                        <input
                          type="checkbox"
                          checked={useCoinsToggle}
                          onChange={handleToggleCoins}
                          style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#e11d48' }}
                        />
                      </div>
                    </div>
                    <p className={styles.coinsNoticeHint}>
                      Se aplicará automáticamente el descuento máximo permitido ({availableCoins} monedas = S/{availableCoins.toFixed(2)}).
                    </p>
                  </div>
                </div>
              )}
              {discount > 0 && (
                <div className={styles.totalRow} style={{ color: '#d97706', fontWeight: 600, fontSize: '1.05rem', margin: '0.5rem 0', padding: '0.5rem', background: '#fffbeb', borderRadius: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <KapiSolCoinMini /> Ahorro Monedas:
                  </span>
                  <span>-S/ {discount.toFixed(2)}</span>
                </div>
              )}
              <div className={styles.totalRow}>
                <span>Envío:</span>
              <span>{shipping === 0 ? 'Gratis' : `S/ ${shipping.toFixed(2)}`}</span>
            </div>
            <div className={styles.totalRow + ' ' + styles.finalTotal}>
              <span>Total a Pagar:</span>
              {/* Perú: 'S/ total' (como hoy). El total real SIEMPRE se procesa en PEN. */}
              <span>S/ {total.toFixed(2)}</span>
            </div>

            {/* ── Bloque informativo internacional (solo si NO es Perú) ──────────
                Muestra el equivalente local (display) y deja claro el cobro en USD.
                No reemplaza el total PEN: es información adicional para el comprador. */}
            {!formIsPeru && (
              <div className={styles.intlPriceInfo} style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {summaryLocalAmount != null && (
                  <div className={styles.totalRow}>
                    <span>Equivalente aprox.:</span>
                    <span>{formatMoney(summaryLocalAmount, summaryCurrency)}</span>
                  </div>
                )}
                <div className={styles.totalRow} style={{ fontWeight: 600, color: '#0f172a' }}>
                  <span>Pagarás por PayPal:</span>
                  <span>{summaryAmountUsd.toFixed(2)} USD</span>
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  El cobro internacional se realiza en dólares (USD). La moneda local
                  es solo una referencia informativa.
                </p>
              </div>
            )}
          </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
