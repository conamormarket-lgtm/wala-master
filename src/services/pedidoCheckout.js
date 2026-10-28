import { getFunctions, httpsCallable } from 'firebase/functions';
import { leerReferidoGuardado, olvidarReferido } from './referrals';
import { markItemAsGifted } from './wishlist';
import { marcarCreacionesEnPedido } from './designs';
import { canjearCupon } from './cupones';
import { esComboCrear, repartirPrecio, resumenPiezas } from '../pages/Crear/comboCrear';
import { FOREIGN_DOC_LABEL } from '../constants/documentTypes';
import { ubicacionErp, lugarLegible } from '../utils/ubicacionErp';

/*
 * El armado del pedido del checkout: el payload del ERP (prepareCheckoutPayment)
 * y los mensajes de WhatsApp (uno, o uno por marca). Sacado TAL CUAL de
 * pages/CheckoutPage.jsx (paso 6 de la migración) para que la página de antes
 * (CheckoutViejo.jsx, interruptor pagosViejo) y la del kit
 * (components/checkout/CheckoutDeTienda.jsx) armen exactamente lo mismo.
 * No toca React ni el carrito: recibe los valores del formulario (los nombres
 * de Formik: customerName, dni, docType, phone, country, city, department,
 * province, district, address, email, isGiftMode, giftRecipientName,
 * giftMessage, giftSticker, deliveryDate) y los montos ya calculados.
 */

const uniqueImageUrls = (urls) => [...new Set(
  (urls || [])
    .filter((url) => typeof url === 'string' && url.trim() && !/^data:|^blob:/i.test(url.trim()))
    .map((url) => url.trim())
)];

export const getDesignReferences = (item) => {
  const refs = [item?.productImage, item?.customization?.imageURL];
  (item?.productReferenceImages || []).forEach((reference) => refs.push(reference?.url || reference));
  const views = {};
  const addLayers = (layersByView) => {
    Object.entries(layersByView || {}).forEach(([viewId, layers]) => {
      if (!Array.isArray(layers) || layers.length === 0) return;
      const images = uniqueImageUrls(layers.filter((layer) => layer?.type === 'image').map((layer) => layer.src));
      const texts = layers.filter((layer) => layer?.type === 'text' && layer.text).map((layer) => layer.text);
      refs.push(...images);
      views[viewId] = { imagenes: images, textos: texts };
    });
  };

  addLayers(item?.customization?.layersByView);

  // Prendas del apartado Crear: las capas van por zona de impresión (pecho,
  // manga, espalda...). Cada zona lleva su PNG a tamaño real para imprimir y
  // la vista previa de su lado (prenda + diseño).
  // La prenda completa: todas las vistas (frente y espalda) en una imagen.
  refs.push(item?.customization?.imagenConjunta);
  (item?.customization?.vistasPrevias || []).forEach((previa) => {
    refs.push(previa?.url);
    const zonas = Array.isArray(previa?.zonas) ? previa.zonas : [previa?.vista];
    zonas.forEach((zonaId) => {
      if (views[zonaId]) views[zonaId].vistaPrevia = previa.url || '';
    });
  });
  (item?.customization?.archivosImpresion || []).forEach((archivo) => {
    refs.push(archivo?.url);
    if (views[archivo?.vista]) {
      views[archivo.vista].archivoImpresion = archivo.url || '';
      views[archivo.vista].medida = archivo.anchoCm
        ? `${archivo.anchoCm} x ${archivo.altoCm} cm`
        : `${archivo.ancho} x ${archivo.alto} px`;
      if (archivo.nombre) views[archivo.vista].zona = archivo.nombre;
      // El taller graba con láser (PNG en grises) en vez de imprimir.
      if (archivo.tecnica === 'laser') views[archivo.vista].tecnicaProduccion = 'laser';
    }
  });

  (item?.customization?.comboItemCustomization || []).forEach((customization) => {
    addLayers(customization?.layersByView);
  });
  (item?.customization?.comboItemRenderedPreviews || []).forEach((preview) => {
    refs.push(preview?.frente, preview?.espalda);
  });

  return { images: uniqueImageUrls(refs), views };
};

/**
 * Las líneas de detalle de un artículo para el WhatsApp al asesor: en un combo,
 * cada pieza con su color y talla; en una creación, su color y los lados con
 * diseño; en lo demás, su talla y color.
 */
export const detalleWhatsapp = (item) => {
  const lineas = [];
  const pieza = (nombre, color, talla, extra = '') => `   • ${[nombre, color, talla && `Talla ${talla}`, extra].filter(Boolean).join(' · ')}`;
  if (item?.customization?.tipo === 'comboCrear') {
    (item.customization.piezas || []).forEach((p) => {
      // Qué lados llevan diseño ("solo Frente"): así no se espera una espalda.
      const lados = (p.vistasPrevias || []).map((v) => v?.nombre).filter(Boolean);
      const conDiseno = lados.length ? `diseño en ${lados.join(' y ')}` : '';
      lineas.push(pieza(p.prendaNombre || 'Prenda', p.color?.nombre, p.talla, conDiseno));
    });
    return lineas;
  }
  if (item?.isComboProduct) {
    const selecciones = item.comboVariantSelections || {};
    (item.comboItems || []).forEach((sub, i) => {
      const datos = (item.comboSubProductsData || {})[i];
      const sel = selecciones[i] || item.customization?.comboItemCustomization?.[i]?.variant || {};
      lineas.push(pieza(datos?.name || sub.productName || sub.name || `Prenda ${i + 1}`, sel.color, sel.size));
    });
    return lineas;
  }
  if (item?.variant?.size) lineas.push(`   Talla/Modelo: ${item.variant.size}`);
  if (item?.variant?.color) lineas.push(`   Color: ${item.variant.color}`);
  if (item?.customization?.tipo === 'crear') {
    const lados = (item.customization.vistasPrevias || []).map((v) => v?.nombre).filter(Boolean);
    if (lados.length) lineas.push(`   Lados con diseño: ${lados.join(' + ')}`);
  }
  return lineas;
};

/**
 * El enlace de un artículo en el WhatsApp al asesor. Lo de Crear va a su diseño
 * ("wala.pe/ver/<id>": el combo con todas sus prendas o la creación), no a la
 * prenda o al combo vacíos; lo demás, a su producto.
 */
export const enlaceWhatsapp = (item) => {
  const c = item?.customization;
  if (c?.tipo === 'comboCrear') {
    const ids = c.miComboId ? [c.miComboId] : (c.piezas || []).map((p) => p?.designId).filter(Boolean);
    if (ids.length) return `${window.location.origin}/ver/${ids.join(',')}`;
  }
  if (c?.tipo === 'crear' && c.designId) return `${window.location.origin}/ver/${c.designId}`;
  return `${window.location.origin}/producto/${item.productId}`;
};

// ── Formateo legible de la fecha de entrega (solo display, no afecta lógica) ──
// Se parsea 'YYYY-MM-DD' como fecha local (evita el corrimiento por zona horaria de new Date(str)).
export const formatDeliveryDate = (isoDate) => {
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
export const businessDaysUntil = (isoDate) => {
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

/**
 * El pedido para el ERP (prepareCheckoutPayment). Devuelve { pseudoOrderId,
 * esPeru, webOrderPayload }.
 *  - values: los del formulario · phoneFull: el teléfono con su código de país
 *  - selectedItems: los elegidos del carrito
 *  - discount (monedas), shipping, total, cuponAplicado ({ code }),
 *    descuentoCupon, cuponEnvioGratis
 *  - user · registryEventLabel, giftRegistryItem (el regalo de /regalar)
 *  - muestraColor(item): si el color del artículo dice algo (cartValidation)
 */
export function armarPedidoWeb({
  values, phoneFull, selectedItems, discount, shipping, total, cuponAplicado, descuentoCupon, cuponEnvioGratis,
  user, registryEventLabel, giftRegistryItem, muestraColor,
}) {
    const pseudoOrderId = `PD-${Date.now().toString(36).toUpperCase()}`;

    // ── País / tipo de documento ──────────────────────────────────────
    // esPeru = true cuando el país es 'PE' o no está definido (default seguro).
    const esPeru = values.country === 'PE' || !values.country;
    // Tipo de documento para el ERP:
    //   Perú → el tipo elegido en el select (values.docType: DNI/CE/Pasaporte).
    //   Extranjero → etiqueta fija "Documento de identidad nacional".
    const tipoDocumento = esPeru
      ? (values.docType || 'DNI')
      : FOREIGN_DOC_LABEL;
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
        if (esComboCrear(item)) return `[COMBO] ${item.productName}: ${resumenPiezas(item)} x${item.quantity}`;
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
        // Sin "/Principal" en productos que no tienen colores (un sérum).
        const color = item.variant?.color && muestraColor(item) ? `/${item.variant.color}` : '';
        return `${item.productName}${color} ${talla} x${item.quantity}`.trim();
      })
      .join(' - ');

    // ── Construir mapa de productos (estructura ERP: productos) ────────
    // Para combos: incluye sub-productos, tallas, colores y diseños por vista (frente/espalda)
    const productosMap = {};
    selectedItems.forEach((item, idx) => {
      const precioItem = item.customization?.finalPrice || item.price || 0;
      const subtotalItem = precioItem * (item.quantity || 1);
      const designReferences = getDesignReferences(item);

      if (esComboCrear(item)) {
        // ── Combo de Crear: una línea por pieza ───────────────────────
        // Cada pieza llega al ERP como una prenda de Crear normal (sus
        // archivos de impresión, color y talla) y descuenta su prenda del
        // inventario. Entre todas suman el precio del combo; el servidor
        // lo comprueba por grupo (functions/cartValidation.js).
        const piezas = item.customization.piezas || [];
        const precios = repartirPrecio(precioItem, piezas.length);
        piezas.forEach((pieza, k) => {
          const refs = getDesignReferences({ productImage: pieza.imageURL, customization: pieza });
          productosMap[`item_${idx}_${k}`] = {
            productoId: pieza.prendaId || '',
            // "Pareja · Polera clásica (1 de 2)": la prenda no se repite si
            // el combo ya la nombra; en un conjunto sí ("… · Polo clásico (2 de 3)").
            producto: String(item.productName || '').includes(pieza.prendaNombre || '\u0000')
              ? `${item.productName} (${k + 1} de ${piezas.length})`
              : `${item.productName} · ${pieza.prendaNombre || 'Prenda'} (${k + 1} de ${piezas.length})`,
            // La prenda de verdad: el ERP saca de aquí el tipo para su inventario.
            prendaNombre: pieza.prendaNombre || '',
            combo: item.productName || '',
            comboCrear: {
              comboId: item.productId || '', grupo: idx, pieza: k, de: piezas.length,
              ...(item.customization.miComboId && { miComboId: item.customization.miComboId }),
            },
            brandId: item.brandId || null,
            urlImagen: pieza.imageURL || '',
            imagenReferencial: pieza.imageURL || '',
            imagenesReferencia: refs.images,
            imagenesPorLado: [],
            cantidad: item.quantity || 1,
            talla: pieza.talla || '',
            color: pieza.color?.nombre || '',
            colorHex: pieza.color?.hex || '',
            precio: precios[k],
            subtotal: precios[k] * (item.quantity || 1),
            personalizado: true,
            textoPersonalizado: '',
            urlImagenPersonalizada: pieza.imageURL || '',
            disenoVistas: refs.views,
            designId: pieza.designId || '',
            vistasPersonalizadas: pieza.vistasUsadas || [],
            colorPrenda: pieza.color?.nombre || '',
          };
        });
      } else if (item.isComboProduct) {
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
                // Sin enlaces temporales (blob:/data:) de una imagen que seguía subiéndose.
                .filter((l) => l.type === 'image' && l.src && /^https?:\/\//.test(String(l.src)))
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

        // Las piezas en texto ("Casaca Blanco M + Polo Granate M"): el ERP
        // muestra el nombre de la línea en todas sus etapas, también después
        // de aprobar (sus recuadros de prendas van aparte, una por pieza).
        const detallePiezas = Object.values(subProductos)
          .map((s) => [s.producto, s.color, s.talla].filter(Boolean).join(' '))
          .join(' + ');
        productosMap[`item_${idx}`] = {
          productoId: item.productId || '',
          producto: detallePiezas ? `${item.productName || 'Combo'} (${detallePiezas})` : (item.productName || ''),
          combo: item.productName || '',
          // Marca del producto (para enrutar el WhatsApp de "Mis Compras" al asesor correcto)
          brandId: item.brandId || null,
          // Snapshot de la imagen del producto AL COMPRAR (ya vive en el cartItem):
          // la miniatura de "Mis Compras" deja de depender del catálogo vivo.
          urlImagen: item.productImage || '',
          imagenReferencial: item.productImage || '',
          imagenesReferencia: designReferences.images,
          imagenesPorLado: item.productReferenceImages || [],
          cantidad: item.quantity || 1,
          precio: precioItem,
          subtotal: subtotalItem,
          esCombo: true,
          personalizado: !!(item.customization?.comboItemCustomization?.some(
            (c) => c?.layersByView && Object.values(c.layersByView).some((l) => l?.length > 0)
          )),
          urlImagenPersonalizada: item.customization?.imageURL || '',
          disenoVistas: designReferences.views,
          designId: item.customization?.designId || '',
          subProductos,
        };
      } else {
        // ── Producto simple ───────────────────────────────────────────
        productosMap[`item_${idx}`] = {
          productoId: item.productId || '',
          producto: item.productName || '',
          // Marca del producto (para enrutar el WhatsApp de "Mis Compras" al asesor correcto)
          brandId: item.brandId || null,
          // Snapshot de la imagen del producto AL COMPRAR (ya vive en el cartItem):
          // la miniatura de "Mis Compras" deja de depender del catálogo vivo.
          urlImagen: item.productImage || '',
          imagenReferencial: item.productImage || '',
          imagenesReferencia: designReferences.images,
          imagenesPorLado: item.productReferenceImages || [],
          cantidad: item.quantity || 1,
          talla: item.variant?.size || '',
          color: item.variant?.color || '',
          colorHex: item.variant?.colorHex || '',
          precio: precioItem,
          subtotal: subtotalItem,
          personalizado: !!(item.customization?.layersByView
            ? Object.values(item.customization.layersByView).some((l) => l?.length > 0)
            : item.customization?.imageURL),
          textoPersonalizado: item.customization?.text || '',
          urlImagenPersonalizada: item.customization?.imageURL || '',
          disenoVistas: designReferences.views,
          designId: item.customization?.designId || '',
          // Prendas de Crear: zonas con diseño (el servidor revalida el precio).
          ...(item.customization?.tipo === 'crear' && {
            vistasPersonalizadas: item.customization.vistasUsadas || [],
            colorPrenda: item.customization.color?.nombre || '',
            prendaNombre: item.customization.prendaNombre || '',
          }),
        };
      }
    });

    // ── Payload completo con campos del ERP ───────────────────────────
    // Ubicación con nombres (departamento/provincia) y tipoEnvio, como la guarda el ERP.
    const ubicacion = ubicacionErp(values);
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
      clienteDepartamento: ubicacion.departamento,
      clienteDistrito: values.district,
      clienteDistritoReal: values.district,
      clienteProvincia: ubicacion.provincia,

      // ─ Datos de envío ─
      envioNombres: clienteNombre,
      envioApellidos: clienteApellidos,
      envioContacto: values.phone,
      envioNumeroDocumento: values.dni,
      envioTipoDocumento: tipoDocumento,
      envioDireccion: values.address,
      envioDistrito: values.district,
      envioDepartamento: ubicacion.departamento,
      envioProvincia: ubicacion.provincia,
      envioEsProvincia: ubicacion.esProvincia ? 'Sí' : 'No',
      tipoEnvio: ubicacion.tipoEnvio,

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
      costoEnvio: shipping, // se persiste el envío para que el desglose del detalle cuadre
      ...(discount > 0 && { descuentoMonedas: discount }),
      // Deja rastro del cupón en el pedido: sin esto, el desglose del detalle
      // no cuadra con lo que se cobró y nadie sabe de dónde salió la rebaja.
      ...(cuponAplicado?.code && { cuponCode: cuponAplicado.code }),
      ...(descuentoCupon > 0 && { descuentoCupon }),
      ...(cuponEnvioGratis && { cuponEnvioGratis: true }),
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
          const urls = [...getDesignReferences(i).images];
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
  return { pseudoOrderId, esPeru, webOrderPayload };
}

/**
 * Los WhatsApp del pedido: el enlace al número principal ("Todo a WALA") y,
 * con whatsapp_multimarca, uno por marca con asesor propio. Devuelve
 * { waLink, waGroups } (waGroups vacío si no se divide).
 *  - whatsappConfig: { principalNumber, multimarca, customText } · brandsList
 */
export function armarWhatsapp({
  values, selectedItems, subtotal, discount, shipping, total, cuponAplicado, descuentoCupon, esPeru, pseudoOrderId,
  whatsappConfig, brandsList, registryEventLabel,
}) {
    const refGuardado = leerReferidoGuardado();
    const referralTag = refGuardado ? `\n_Referido por: ${refGuardado.referrerCode}_` : '';

    // ── 3. Armar mensaje de WhatsApp ──────────────────────────────────
    let message = `SOLICITUD DE NUEVO PEDIDO (${pseudoOrderId})\n\n`;
    message += `Datos del Cliente:\n`;
    message += `Nombre: ${values.customerName}\n`;
    message += `DNI: ${values.dni}\n`;
    message += `Teléfono: ${values.phone}\n`;
    message += `Email: ${values.email}\n`;
    message += `Dirección: ${values.address}, ${lugarLegible(values)}\n\n`;

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
      detalleWhatsapp(item).forEach((linea) => { message += `${linea}\n`; });
      if (item.customization && item.customization.text) {
        message += `   Texto: ${item.customization.text}\n`;
      }
      const price = item.customization?.finalPrice || item.price;
      message += `   Subtotal: S/ ${(price * item.quantity).toFixed(2)}\n`;
      // Sin enlaces de imágenes (Firebase): el del producto o el del diseño basta.
      message += `   Link: ${enlaceWhatsapp(item)}\n\n`;
    });

    message += `Resumen de Pago:\n`;
    message += `Producto(s): S/ ${subtotal.toFixed(2)}\n`;
    if (discount > 0) {
      message += `Descuento (Monedas): - S/ ${discount.toFixed(2)}\n`;
    }
    if (cuponAplicado?.code) {
      message += descuentoCupon > 0
        ? `Cupón ${cuponAplicado.code}: - S/ ${descuentoCupon.toFixed(2)}\n`
        : `Cupón ${cuponAplicado.code}: envío gratis\n`;
    }
    message += `Envío: ${shipping === 0 ? 'Gratis' : `S/ ${shipping.toFixed(2)}`}\n`;
    message += `TOTAL A PAGAR: S/ ${total.toFixed(2)}\n\n`;

    // ── Aviso de envío internacional (solo si NO es Perú) ──────────────
    if (!esPeru) {
      message += `\nEnvíos internacionales: la entrega demora de 7 a 30 días hábiles.\n`;
    }

    message += whatsappConfig?.customText?.replace('{id}', pseudoOrderId) || `Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código ${pseudoOrderId}.`;
    if (referralTag) message += referralTag;

    // ── Número de destino del WhatsApp único ("Todo a WALA") ───────────
    // Por defecto (multimarca !== true) TODO va al NÚMERO PRINCIPAL.
    const waMultimarca = whatsappConfig?.multimarca === true;
    const waPrincipal = whatsappConfig?.principalNumber || '51924426791';
    const waLink = `https://wa.me/${waPrincipal}?text=${encodeURIComponent(message)}`;

    // ── 3.a Helper de mensaje por marca (usado solo en modo multimarca) ──
    // Cada marca con número de asesor configurado recibe su PROPIO mensaje
    // (solo sus productos). Los items sin marca o cuya marca no tiene número
    // caen al número general. NO toca pago/totales; solo enrutamiento de WA.
    const buildMessageForItems = (its, brandLabel) => {
      let m = `SOLICITUD DE PEDIDO (${pseudoOrderId})`;
      if (brandLabel) m += ` — Marca: ${brandLabel}`;
      m += `\n\nDatos del Cliente:\n`;
      m += `Nombre: ${values.customerName}\n`;
      m += `DNI: ${values.dni}\n`;
      m += `Teléfono: ${values.phone}\n`;
      m += `Email: ${values.email}\n`;
      m += `Dirección: ${values.address}, ${lugarLegible(values)}\n\n`;
      if (values.isGiftMode) {
        m += `🎁 *MODO REGALO ACTIVO*\n   Para: ${values.giftRecipientName}\n   Mensaje: "${values.giftMessage}"\n`;
        if (values.deliveryDate) {
          m += `   📅 Entrega programada: ${formatDeliveryDate(values.deliveryDate)}`;
          if (registryEventLabel) m += ` (${registryEventLabel})`;
          m += `\n`;
        }
        m += `\n`;
      }
      m += `Detalle${brandLabel ? ` (productos de ${brandLabel})` : ''}:\n`;
      let sub = 0;
      its.forEach((item, index) => {
        m += `${index + 1}. ${item.productName}\n`;
        m += `   Cantidad: ${item.quantity}\n`;
        detalleWhatsapp(item).forEach((linea) => { m += `${linea}\n`; });
        if (item.customization && item.customization.text) m += `   Texto: ${item.customization.text}\n`;
        const price = item.customization?.finalPrice || item.price;
        sub += price * item.quantity;
        m += `   Subtotal: S/ ${(price * item.quantity).toFixed(2)}\n`;
        m += `   Link: ${enlaceWhatsapp(item)}\n\n`;
      });
      m += `Subtotal${brandLabel ? ` de ${brandLabel}` : ''}: S/ ${sub.toFixed(2)}\n`;
      if (brandLabel) {
        m += `(Parte del pedido #${pseudoOrderId}; puede incluir productos de otras marcas con otros asesores.)\n`;
      } else {
        if (discount > 0) m += `Descuento (Monedas): - S/ ${discount.toFixed(2)}\n`;
        if (cuponAplicado?.code) {
          m += descuentoCupon > 0
            ? `Cupón ${cuponAplicado.code}: - S/ ${descuentoCupon.toFixed(2)}\n`
            : `Cupón ${cuponAplicado.code}: envío gratis\n`;
        }
        m += `Envío: ${shipping === 0 ? 'Gratis' : `S/ ${shipping.toFixed(2)}`}\n`;
        m += `TOTAL A PAGAR: S/ ${total.toFixed(2)}\n`;
      }
      if (!esPeru) m += `\nEnvíos internacionales: la entrega demora de 7 a 30 días hábiles.\n`;
      m += `\n` + (whatsappConfig?.customText?.replace('{id}', pseudoOrderId) || `Hola! Quiero confirmar mi pedido con código ${pseudoOrderId}.`);
      if (referralTag) m += referralTag;
      return m;
    };

    // ── 3.b WhatsApp DIVIDIDO POR MARCA (solo si multimarca === true) ───
    // DEFAULT "Todo a WALA": waGroups queda [] y todo va al NÚMERO PRINCIPAL
    // (el waLink único de arriba). Solo dividimos cuando el admin activa
    // whatsapp_multimarca === 'true'.
    let waGroups = [];
    if (waMultimarca) {
      try {
        // brandId -> { name, number } SOLO para marcas con número configurado.
        const numByBrand = new Map();
        (brandsList || []).forEach((b) => {
          const raw = (b.whatsappNumber || '').replace(/[\s\-()]/g, '');
          const n = raw.startsWith('+') ? raw.replace(/\+/g, '') : raw;
          if (n) numByBrand.set(b.id, { name: b.name, number: n });
        });
        // Agrupa los items seleccionados por asesor (marca con número) o general.
        const groupsMap = new Map();
        selectedItems.forEach((item) => {
          const info = item.brandId ? numByBrand.get(item.brandId) : null;
          const key = info ? item.brandId : '__general__';
          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              label: info ? info.name : 'Tienda (general)',
              // El grupo general/fallback usa el NÚMERO PRINCIPAL ("Todo a WALA").
              number: info ? info.number : waPrincipal,
              isGeneral: !info,
              items: [],
            });
          }
          groupsMap.get(key).items.push(item);
        });
        // Solo dividimos si hay AL MENOS un grupo de MARCA (asesor propio distinto al general).
        const hasBrandGroup = [...groupsMap.values()].some((g) => !g.isGeneral);
        if (hasBrandGroup) {
          waGroups = [...groupsMap.values()]
            .filter((g) => g.number)
            .map((g) => ({
              label: g.label,
              count: g.items.length,
              link: `https://wa.me/${g.number}?text=${encodeURIComponent(buildMessageForItems(g.items, g.isGeneral ? null : g.label))}`,
            }));
        }
      } catch (e) {
        console.warn('No se pudo armar WhatsApp por marca:', e);
        waGroups = [];
      }
    }
  return { waLink, waGroups };
}
/**
 * Lo que corresponde a una compra ya creada (después de WhatsApp o de la
 * confirmación de una pasarela; nunca al preparar el pago): marcar los regalos
 * de la lista, las creaciones "en pedido", olvidar el referido, dejar lo pagado
 * como pendiente en el carrito guardado, congelar las monedas y canjear el cupón.
 *  - datos: { selectedItemsSnapshot, customerName, numeroPedido, discount, couponCode }
 *  - pedidoWebId · user · freezeMonedas · toast
 */
export async function aplicarEfectosDeCompra({ datos, pedidoWebId, user, freezeMonedas, toast }) {
  const snapshot = datos.selectedItemsSnapshot || [];
  try {
    for (const gift of snapshot.filter((i) => i.isWishlistGift && i.wishlistUserCode)) {
      await markItemAsGifted(gift.wishlistUserCode, gift.productId, datos.customerName);
    }
  } catch (e) {
    console.warn('Error al marcar regalos de wishlist:', e);
  }
  // Las creaciones compradas no pueden borrar sus archivos: el pedido los usa para imprimir.
  if (user) {
    await marcarCreacionesEnPedido(snapshot.flatMap((i) => [
      i?.customization?.designId,
      ...(i?.customization?.piezas || []).map((p) => p?.designId),
    ])).catch(() => {});
  }
  // El referido lo vinculó el servidor al crear el pedido. El enlace ya se usó:
  // se olvida para que otra compra de este navegador no lo vuelva a mandar.
  olvidarReferido();
  try {
    const currentCart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    localStorage.setItem('shopping_cart', JSON.stringify(currentCart.map((item) => item.selected === false
      ? item
      : { ...item, status: 'pending_confirmation', pseudoOrderId: datos.numeroPedido, webOrderId: pedidoWebId })));
  } catch (e) {
    console.warn('No se pudo guardar el estado local del pedido:', e);
  }
  if (datos.discount > 0 && freezeMonedas) {
    await freezeMonedas(datos.discount, datos.numeroPedido).catch((e) =>
      console.warn('No se pudieron congelar las monedas:', e));
  }
  if (datos.couponCode) {
    const canje = await canjearCupon(datos.couponCode, datos.numeroPedido);
    if (!canje.success) {
      console.error('No se pudo canjear el cupón:', canje.error);
      toast.error('La compra se creó, pero el cupón no se pudo canjear. Escríbenos y lo revisamos.');
    }
  }
}

/**
 * Completa el perfil con lo del checkout: solo lo que falta, nunca reemplaza
 * (el documento, si nadie más lo tiene). Corre por detrás: no retrasa el pago.
 */
export async function completarPerfilDesdeCheckout({ userProfile, updateUserProfile, values }) {
  const updates = {};
  const docNuevo = String(values.dni || '').trim().replace(/\s/g, '');
  if (!String(userProfile?.dni || '').trim() && docNuevo) {
    try {
      const { data: dniCheck } = await httpsCallable(getFunctions(), 'checkDniAvailableSecure')({ dni: docNuevo });
      if (dniCheck?.available) {
        const tipo = values.country && values.country !== 'PE' ? 'OTRO' : (values.docType || 'DNI');
        Object.assign(updates, {
          dni: docNuevo,
          clienteNumeroDocumento: docNuevo,
          tipoDocumento: tipo,
          docType: tipo,
        });
        if (!userProfile?.country && values.country) updates.country = values.country;
      }
    } catch (_) { /* sin red: se pedirá en "Completar perfil" */ }
  }
  if (!String(userProfile?.phone || '').trim() && values.phone) updates.phone = values.phone;
  if (!String(userProfile?.displayName || '').trim() && values.customerName) updates.displayName = values.customerName;
  if (Object.keys(updates).length > 0) {
    const { error: errPerfil } = await updateUserProfile(updates);
    if (errPerfil) console.warn('Checkout: no se pudo completar el perfil:', errPerfil);
  }
}
