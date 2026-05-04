import React, { useState } from 'react';
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
import Button from '../components/common/Button';
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
  dni: Yup.string().required('DNI requerido'),
  phone: Yup.string().required('Teléfono requerido'),
  address: Yup.string().required('Dirección requerida'),
  district: Yup.string().required('Distrito requerido'),
  city: Yup.string().required('Ciudad requerida'),
  email: Yup.string().email('Email inválido').required('Email requerido'),
});

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, getTotalPrice, clearCart } = useCart();
  const { user, userProfile, updateUserProfile, freezeMonedas } = useAuth();
  const toast = useGlobalToast();

  const [processing, setProcessing] = useState(false);
  const [coinInput, setCoinInput] = useState('');
  
  const subtotal = getTotalPrice();
  const monedasCount = userProfile?.monedas || 0;
  
  // Calcular límite de monedas (50% del subtotal como máximo)
  const maxCoinsAllowed = Math.floor(subtotal / 2);
  const availableCoins = Math.min(monedasCount, maxCoinsAllowed);
  const canUseCoins = monedasCount > 0 && availableCoins > 0;
  
  // Calcular descuentos
  const parsedCoins = parseInt(coinInput, 10) || 0;
  const discount = (canUseCoins && parsedCoins > 0 && parsedCoins <= availableCoins) ? parsedCoins : 0;
  
  const subtotalWithDiscount = Math.max(0, subtotal - discount);
  const shipping = subtotalWithDiscount > 100 ? 0 : 15;
  const total = subtotalWithDiscount + shipping;
  
  const handleCoinInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val !== '') {
      let num = parseInt(val, 10);
      if (num > availableCoins) num = availableCoins;
      val = num.toString();
    }
    setCoinInput(val);
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

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      customerName: userProfile?.displayName || user?.displayName || guestSavedInfo.customerName || '',
      dni: userProfile?.dni || guestSavedInfo.dni || '',
      phone: userProfile?.phone || guestSavedInfo.phone || '',
      address: guestSavedInfo.address || '',
      district: guestSavedInfo.district || '',
      city: guestSavedInfo.city || 'Lima',
      email: user?.email || guestSavedInfo.email || ''
    },
    validationSchema,
    onSubmit: async (values) => {

      setProcessing(true);

      try {
        const pseudoOrderId = `PD-${Date.now().toString(36).toUpperCase()}`;

        // ── Separar nombre en partes (nombre / apellidos) ─────────────────
        const nameParts = values.customerName.trim().split(/\s+/);
        const clienteNombre = nameParts[0] || values.customerName;
        const clienteApellidos = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // ── Construir string de prendas (resumen de ítems del carrito) ─────
        const prendasStr = items
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
        items.forEach((item, idx) => {
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
            };
          }
        });

        // ── Payload completo con campos del ERP ───────────────────────────
        const webOrderPayload = {
          // ─ Número de referencia ─
          numeroPedido: pseudoOrderId,

          // ─ Datos del cliente (campos ERP oficiales) ─
          clienteNombre,
          clienteApellidos,
          clienteNombreCompleto: values.customerName,
          clienteNumeroDocumento: values.dni,
          clienteTipoDocumento: 'DNI',
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
          envioTipoDocumento: 'DNI',
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
          cantidad: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
          productos: productosMap,
          lineaProducto: '',
          añadidos: [],

          // ─ Flags de tipo de pedido ─
          esPersonalizado: items.some(
            (i) => !!(i.customization?.text || i.customization?.imageURL)
          ),
          esMostacero: false,
          esPrioridad: false,
          importado: false,

          // ─ Imágenes de diseños personalizados (Mapeo completo galería) ─
          imageURLs: items
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

        message += `Detalle de Compra:\n`;
        items.forEach((item, index) => {
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

        // ── 7. Abrir WhatsApp ─────────────────────────────────────────────
        toast.success('¡Redirigiendo a WhatsApp para finalizar tu pedido!');
        window.open(waLink, '_blank');
        navigate('/carrito');
      } catch (error) {
        console.error('Error al generar pedido:', error);
        toast.error('Error al procesar el pedido. Inténtalo de nuevo.');
      } finally {
        setProcessing(false);
      }
    }
  });

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
      <h1>Checkout</h1>

      <div className={styles.layout}>
        <div className={styles.formContainer}>
          <form onSubmit={formik.handleSubmit} className={styles.form}>
            <h2>Detalles de Envío</h2>

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
                <label>DNI *</label>
                <input
                  type="text"
                  name="dni"
                  value={formik.values.dni}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Documento de Identidad"
                />
                {formik.touched.dni && formik.errors.dni && (
                  <span className={styles.error}>{formik.errors.dni}</span>
                )}
              </div>
              <div className={styles.field}>
                <label>Teléfono *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formik.values.phone}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Celular"
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

            <div className={styles.buttonGroup}>
              <Button type="button" variant="outline" onClick={() => navigate('/carrito')} disabled={processing} fullWidth>
                Volver al carrito
              </Button>
              <Button type="submit" variant="primary" disabled={processing} fullWidth>
                {processing ? 'Generando...' : 'Confirmar y Enviar por WhatsApp'}
              </Button>
            </div>
          </form>
        </div>

        <div className={styles.summary}>
          <h2>Resumen del Pedido</h2>
          <div className={styles.items}>
            {items.map(item => (
              <div key={item.id} className={styles.summaryItem}>
                <span>{item.productName} x{item.quantity}</span>
                <span>S/ {(item.customization?.finalPrice || item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Subtotal:</span>
                <span>S/ {subtotal.toFixed(2)}</span>
              </div>
              {canUseCoins && (
                <div style={{ marginTop: '1rem', marginBottom: '1rem', background: 'linear-gradient(145deg, #fffbeb, #fef3c7)', padding: '1.25rem', borderRadius: '12px', border: '1px solid #fcd34d', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.1)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <KapiSolCoinMini />
                      <label style={{ fontWeight: 700, fontSize: '15px', color: '#92400e', margin: 0, lineHeight: 1 }}>
                        Usa tus Monedas KapiSol
                      </label>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#b45309', margin: '0 0 0.5rem 0', fontWeight: 500 }}>
                      Puedes cubrir hasta el <strong style={{ color: '#92400e' }}>50%</strong> (S/ {maxCoinsAllowed.toFixed(2)}) de tus productos. 
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <input 
                        type="number" 
                        value={coinInput}
                        onChange={handleCoinInputChange}
                        placeholder="0"
                        min="0"
                        max={availableCoins}
                        style={{ width: '80px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '2px solid #fcd34d', fontSize: '1rem', fontWeight: 600, color: '#92400e', textAlign: 'center', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, fontSize: '0.8rem', color: '#78350f' }}>
                        <span>/ <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{availableCoins}</span> KS max.</span>
                        <span style={{ fontSize: '0.7rem' }}>Tienes {monedasCount} KS en total</span>
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={() => setCoinInput(availableCoins.toString())} 
                        style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', padding: '0 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s', alignSelf: 'stretch' }}
                        onMouseOver={(e) => e.target.style.background = '#d97706'}
                        onMouseOut={(e) => e.target.style.background = '#f59e0b'}
                      >
                        USAR MAX
                      </button>
                    </div>
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
              <span>S/ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
